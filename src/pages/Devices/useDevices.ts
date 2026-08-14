import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  createRecord,
  fetchList,
  updateRecord,
  type Device,
  type DeviceBinding,
  type Employee,
  type Store,
} from "@/lib/admin"
import type { DeviceFilterState } from "@/components/devices/DeviceFilters"
import type { BindFormValues } from "@/components/devices/BindDialog"
import type { DeviceRow } from "@/components/devices/DeviceTable"

// 设备绑定页逻辑: 设备与绑定数据加载、筛选、新增/调整绑定
export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([])
  const [bindings, setBindings] = useState<DeviceBinding[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [filters, setFilters] = useState<DeviceFilterState>({
    keyword: "",
    deviceStatus: "",
    deviceType: "",
    bindStatus: "",
    storeId: "",
  })
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [adjusting, setAdjusting] = useState<DeviceRow | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    const [deviceData, bindingData] = await Promise.all([
      fetchList<Device>("devices", { perPage: 200 }),
      fetchList<DeviceBinding>("device_bindings", { perPage: 500 }),
    ])
    setDevices(deviceData.items ?? [])
    setBindings(bindingData.items ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchList<Device>("devices", { perPage: 200 }),
      fetchList<DeviceBinding>("device_bindings", { perPage: 500 }),
      fetchList<Employee>("employees", { perPage: 200 }),
      fetchList<Store>("stores", { perPage: 200 }),
    ])
      .then(([deviceData, bindingData, employeeData, storeData]) => {
        if (cancelled) return
        setDevices(deviceData.items ?? [])
        setBindings(bindingData.items ?? [])
        setEmployees(employeeData.items ?? [])
        setStores(storeData.items ?? [])
      })
      .catch(() => {
        if (!cancelled) toast.error("设备数据加载失败，请稍后重试")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])
  const storeById = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores])

  // 每台设备取最新一条「已绑定」记录
  const activeBindingByDevice = useMemo(() => {
    const map = new Map<string, DeviceBinding>()
    for (const binding of bindings) {
      if (binding.status !== "已绑定") continue
      const prev = map.get(binding.device)
      if (!prev || (binding.created ?? "") > (prev.created ?? "")) map.set(binding.device, binding)
    }
    return map
  }, [bindings])

  const rows: DeviceRow[] = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase()
    return devices
      .map((device) => {
        const binding = activeBindingByDevice.get(device.id)
        const employee = binding ? employeeById.get(binding.employee) : undefined
        const store = binding ? storeById.get(binding.store) : undefined
        const row: DeviceRow & { bindingStoreId: string } = {
          ...device,
          bound: !!binding,
          employeeName: employee?.name ?? "",
          storeName: store?.name ?? "",
          bindingStoreId: binding?.store ?? "",
        }
        return row
      })
      .filter((row) => {
        if (filters.deviceStatus && row.status !== filters.deviceStatus) return false
        if (filters.deviceType && row.type !== filters.deviceType) return false
        if (filters.bindStatus === "已绑定" && !row.bound) return false
        if (filters.bindStatus === "未绑定" && row.bound) return false
        if (filters.storeId && row.bindingStoreId !== filters.storeId) return false
        if (keyword) {
          const text = `${row.device_no}${row.employeeName}${row.storeName}`.toLowerCase()
          if (!text.includes(keyword)) return false
        }
        return true
      })
  }, [devices, filters, activeBindingByDevice, employeeById, storeById])

  function openCreate() {
    setAdjusting(null)
    setDialogOpen(true)
  }

  function openAdjust(row: DeviceRow) {
    setAdjusting(row)
    setDialogOpen(true)
  }

  const closeDialog = useCallback(() => setDialogOpen(false), [])

  async function handleSave(values: BindFormValues) {
    setSaving(true)
    try {
      let device = adjusting as Device | null
      if (!device) {
        device = await createRecord<Device>("devices", {
          device_no: values.deviceNo.trim(),
          type: values.deviceType,
          status: "在线",
          power: 100,
          texts_today: 0,
          last_online_at: new Date().toISOString().slice(0, 19).replace("T", " "),
        })
      }
      // 旧绑定置为已解绑, 再写新绑定
      const prev = device ? activeBindingByDevice.get(device.id) : undefined
      if (prev) {
        await updateRecord<DeviceBinding>("device_bindings", prev.id, { status: "已解绑" })
      }
      await createRecord<DeviceBinding>("device_bindings", {
        device: device?.id ?? "",
        employee: values.employeeId,
        store: values.storeId,
        effective_date: values.effectiveDate,
        status: "已绑定",
      })
      await createRecord("device_logs", {
        device: device?.id ?? "",
        type: "操控",
        content: adjusting ? "调整设备绑定并更新员工归属" : "新增设备绑定并下发员工归属",
        status: "成功",
        occurred_at: new Date().toISOString().slice(0, 19).replace("T", " "),
      })
      toast.success("设备绑定成功")
      setDialogOpen(false)
      await reload()
    } catch {
      toast.error("绑定失败，请稍后重试")
    } finally {
      setSaving(false)
    }
  }

  return {
    devices,
    employees,
    stores,
    rows,
    filters,
    loading,
    saving,
    dialogOpen,
    adjusting,
    setFilters,
    openCreate,
    openAdjust,
    closeDialog,
    handleSave,
  }
}

export type DevicesProps = ReturnType<typeof useDevices>
