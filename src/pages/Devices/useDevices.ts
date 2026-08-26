import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  createRecord,
  fetchList,
  updateRecord,
  type Device,
  type DeviceBinding,
  type DeviceLog,
  type Employee,
  type Store,
} from "@/lib/admin"
import type { BindFormValues } from "@/components/devices/BindDialog"

export type DeviceTab = "ledger" | "ops" | "history"

export interface DeviceRow extends Device {
  bound: boolean
  employeeName: string
  employeeId?: string
  storeName: string
  storeId?: string
  bindingId?: string
  bindingCreated?: string
}

export interface DeviceFilterState {
  keyword: string
  deviceStatus: string
  bindStatus: string
}

export function useDevices() {
  const [activeTab, setActiveTab] = useState<DeviceTab>("ledger")
  const [devices, setDevices] = useState<Device[]>([])
  const [bindings, setBindings] = useState<DeviceBinding[]>([])
  const [deviceLogs, setDeviceLogs] = useState<DeviceLog[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [filters, setFilters] = useState<DeviceFilterState>({
    keyword: "",
    deviceStatus: "",
    bindStatus: "",
  })
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [adjusting, setAdjusting] = useState<DeviceRow | null>(null)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [deviceData, bindingData, logData, employeeData, storeData] = await Promise.all([
        fetchList<Device>("devices", { perPage: 500 }).catch(() => ({ items: [] as Device[], page: 1, perPage: 500, totalItems: 0 })),
        fetchList<DeviceBinding>("device_bindings", { perPage: 500 }).catch(() => ({ items: [] as DeviceBinding[], page: 1, perPage: 500, totalItems: 0 })),
        fetchList<DeviceLog>("device_logs", { perPage: 500 }).catch(() => ({ items: [] as DeviceLog[], page: 1, perPage: 500, totalItems: 0 })),
        fetchList<Employee>("employees", { perPage: 500 }).catch(() => ({ items: [] as Employee[], page: 1, perPage: 500, totalItems: 0 })),
        fetchList<Store>("stores", { perPage: 200 }).catch(() => ({ items: [] as Store[], page: 1, perPage: 200, totalItems: 0 })),
      ])

      setDevices(deviceData.items || [])
      setBindings(bindingData.items || [])
      setDeviceLogs(logData.items || [])
      setEmployees(employeeData.items || [])
      setStores(storeData.items || [])
    } catch {
      toast.error("设备数据加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])
  const storeById = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores])

  // 取每台设备的最新有效绑定
  const activeBindingByDevice = useMemo(() => {
    const map = new Map<string, DeviceBinding>()
    for (const binding of bindings) {
      if (binding.status !== "已绑定" && binding.status !== "ACTIVE" && binding.status !== "active") continue
      const prev = map.get(binding.device)
      if (!prev || (binding.created || "") > (prev.created || "")) {
        map.set(binding.device, binding)
      }
    }
    return map
  }, [bindings])

  const rows: DeviceRow[] = useMemo(() => {
    const q = filters.keyword.trim().toLowerCase()
    return devices
      .map((device) => {
        const binding = activeBindingByDevice.get(device.id)
        const employee = binding ? employeeById.get(binding.employee) : undefined
        const store = binding ? storeById.get(binding.store) : undefined

        return {
          ...device,
          bound: Boolean(binding),
          employeeName: employee?.name || "未绑定",
          employeeId: employee?.id,
          storeName: store?.name || (employee?.store ? (storeById.get(employee.store)?.name || employee.store) : "-"),
          storeId: store?.id,
          bindingId: binding?.id,
          bindingCreated: binding?.created,
        }
      })
      .filter((row) => {
        if (filters.deviceStatus && row.status !== filters.deviceStatus) return false
        if (filters.bindStatus === "bound" && !row.bound) return false
        if (filters.bindStatus === "unbound" && row.bound) return false
        if (q) {
          const text = `${row.device_no} ${row.employeeName} ${row.storeName}`.toLowerCase()
          if (!text.includes(q)) return false
        }
        return true
      })
  }, [devices, filters, activeBindingByDevice, employeeById, storeById])

  // 运维统计
  const opsStats = useMemo(() => {
    const total = devices.length
    const online = devices.filter((d) => d.status === "在线" || d.status === "online" || d.status === "ACTIVE").length
    const offline = total - online
    const bound = rows.filter((r) => r.bound).length
    const unbound = total - bound
    return { total, online, offline, bound, unbound }
  }, [devices, rows])

  function openCreate() {
    setAdjusting(null)
    setDialogOpen(true)
  }

  function openAdjust(row: DeviceRow) {
    setAdjusting(row)
    setDialogOpen(true)
  }

  async function handleSave(values: BindFormValues) {
    setSaving(true)
    try {
      let device = adjusting as Device | null
      if (!device) {
        // 新增设备或按序列号查找
        const existing = devices.find((d) => d.device_no === values.deviceNo.trim())
        if (existing) {
          device = existing
        } else {
          device = await createRecord<Device>("devices", {
            device_no: values.deviceNo.trim(),
            type: values.deviceType || "4G智能工牌",
            status: "在线",
            power: 100,
            texts_today: 0,
            last_online_at: new Date().toISOString().slice(0, 19).replace("T", " "),
          })
        }
      }

      // 将原有旧绑定置为已解绑
      const prevBinding = activeBindingByDevice.get(device.id)
      if (prevBinding) {
        await updateRecord<DeviceBinding>("device_bindings", prevBinding.id, { status: "已解绑" })
      }

      // 写入新绑定
      await createRecord<DeviceBinding>("device_bindings", {
        device: device.id,
        employee: values.employeeId,
        store: values.storeId,
        effective_date: values.effectiveDate || new Date().toISOString().slice(0, 10),
        status: "已绑定",
      })

      // 写入设备运维日志
      await createRecord("device_logs", {
        device: device.id,
        type: "操控",
        content: adjusting ? "调整设备绑定并更新员工归属" : "新增设备绑定并下发员工归属",
        status: "成功",
        occurred_at: new Date().toISOString().slice(0, 19).replace("T", " "),
      })

      toast.success("设备绑定已保存")
      setDialogOpen(false)
      await loadData()
    } catch {
      toast.error("设备绑定失败")
    } finally {
      setSaving(false)
    }
  }

  async function handleUnbind(row: DeviceRow) {
    if (!row.bindingId) return
    setSaving(true)
    try {
      await updateRecord<DeviceBinding>("device_bindings", row.bindingId, {
        status: "已解绑",
      })
      await createRecord("device_logs", {
        device: row.id,
        type: "解绑",
        content: `解除员工 ${row.employeeName} 与设备 ${row.device_no} 的绑定关系`,
        status: "成功",
        occurred_at: new Date().toISOString().slice(0, 19).replace("T", " "),
      })
      toast.success(`设备 ${row.device_no} 已解绑`)
      await loadData()
    } catch {
      toast.error("解绑失败")
    } finally {
      setSaving(false)
    }
  }

  async function handleBatchImport(csvText: string) {
    setSaving(true)
    let success = 0
    let failed = 0
    const errors: string[] = []

    try {
      const lines = csvText.trim().split(/\r?\n/).filter(Boolean)
      if (lines.length <= 1) {
        errors.push("CSV 文件为空或仅包含表头")
        return { success: 0, failed: 0, errors }
      }

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim())
        const [deviceNo, type, status] = cols

        if (!deviceNo) {
          failed++
          errors.push(`第 ${i + 1} 行: 设备码不能为空`)
          continue
        }

        try {
          const existing = devices.find((d) => d.device_no === deviceNo)
          if (existing) {
            await updateRecord<Device>("devices", existing.id, {
              type: type || "4G智能工牌",
              status: status || "在线",
            })
          } else {
            await createRecord<Device>("devices", {
              device_no: deviceNo,
              type: type || "4G智能工牌",
              status: status || "在线",
              power: 100,
              texts_today: 0,
              last_online_at: new Date().toISOString().slice(0, 19).replace("T", " "),
            })
          }
          success++
        } catch (rowErr) {
          failed++
          errors.push(`第 ${i + 1} 行处理异常: ${rowErr instanceof Error ? rowErr.message : "未知错误"}`)
        }
      }

      await loadData()
      if (success > 0) toast.success(`批量导入设备完成，成功 ${success} 台`)
      return { success, failed, errors }
    } finally {
      setSaving(false)
    }
  }

  return {
    activeTab,
    setActiveTab,
    devices,
    rows,
    deviceLogs,
    bindings,
    employees,
    stores,
    filters,
    opsStats,
    loading,
    saving,
    setFilters,
    reload: loadData,
    dialogOpen,
    adjusting,
    openCreate,
    openAdjust,
    closeDialog: () => setDialogOpen(false),
    handleSave,
    handleUnbind,
    importDialogOpen,
    openImport: () => setImportDialogOpen(true),
    closeImport: () => setImportDialogOpen(false),
    handleBatchImport,
  }
}

export type DevicesProps = ReturnType<typeof useDevices>
