import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  bindDevice,
  createDevice,
  fetchDevices,
  fetchEmployees,
  fetchStores,
  totalPages,
  unbindDevice,
  type DeviceItem,
  type EmployeeItem,
  type StoreItem,
} from "@/lib/v1"
import type { DeviceFilterState } from "@/components/devices/DeviceFilters"
import type { BindFormValues } from "@/components/devices/BindDialog"
import type { DeviceRow } from "@/components/devices/DeviceTable"

const PAGE_SIZE = 20

// 设备绑定页: 服务端分页 + 服务端筛选; 绑定/解绑走 FastAPI (数据库约束保证唯一生效绑定)
export function useDevices() {
  const [devices, setDevices] = useState<DeviceItem[]>([])
  const [employees, setEmployees] = useState<EmployeeItem[]>([])
  const [stores, setStores] = useState<StoreItem[]>([])
  const [filters, setFilters] = useState<DeviceFilterState>({
    keyword: "",
    deviceStatus: "",
    deviceType: "",
    bindStatus: "",
    storeId: "",
  })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [adjusting, setAdjusting] = useState<DeviceRow | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(
    async (nextPage = 1) => {
      setLoading(true)
      try {
        // 绑定状态/门店筛选由服务端联查结果在浏览器侧过滤不可行 →
        // 只把设备维度筛选交给服务端; 绑定维度在行数据上过滤
        const data = await fetchDevices({
          page: nextPage,
          page_size: PAGE_SIZE,
          keyword: filters.keyword.trim(),
          status: filters.deviceStatus === "离线" ? "OFFLINE" : undefined,
        })
        setDevices(data.items)
        setTotal(data.total)
        setPage(data.page)
      } catch {
        toast.error("设备数据加载失败，请稍后重试")
      } finally {
        setLoading(false)
      }
    },
    [filters.keyword, filters.deviceStatus],
  )

  useEffect(() => {
    reload(1)
  }, [reload])

  // 分页切换
  const goToPage = useCallback(
    (next: number) => {
      reload(next)
    },
    [reload],
  )

  // 员工/门店下拉
  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchEmployees({ page_size: 200 }),
      fetchStores({ page_size: 200 }),
    ])
      .then(([empData, storeData]) => {
        if (cancelled) return
        setEmployees(empData.items)
        setStores(storeData.items)
      })
      .catch(() => {
        if (!cancelled) toast.error("员工/门店数据加载失败，请稍后重试")
      })
    return () => {
      cancelled = true
    }
  }, [])

  const rows: DeviceRow[] = useMemo(
    () =>
      devices
        .map((device) => ({
          ...device,
          employeeName: device.employee_name ?? "",
          storeName: device.store_name ?? "",
          bound: !!device.bound,
        }))
        .filter((row) => {
          if (filters.bindStatus === "已绑定" && !row.bound) return false
          if (filters.bindStatus === "未绑定" && row.bound) return false
          if (filters.storeId && row.store_id !== filters.storeId) return false
          return true
        }),
    [devices, filters.bindStatus, filters.storeId],
  )

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
      // 新增时: 设备码不存在则建档 (重复设备码 → 400 提示)
      let deviceId = adjusting?.id ?? ""
      if (!deviceId) {
        try {
          const created = await createDevice({
            device_code: values.deviceNo.trim(),
            device_type: "BADGE",
            vendor: null,
            model: null,
          })
          deviceId = created.id
        } catch (err) {
          // 设备已存在 → 按设备码查回
          const found = await fetchDevices({ keyword: values.deviceNo.trim(), page_size: 1 })
          const match = found.items.find((d) => d.device_code === values.deviceNo.trim())
          if (!match) throw err
          deviceId = match.id
        }
      }
      // 调整绑定: 先解绑当前生效绑定, 再绑定新员工
      if (adjusting?.bound) {
        await unbindDevice({ device_id: deviceId })
      }
      await bindDevice({
        device_id: deviceId,
        employee_id: values.employeeId,
        start_at: values.effectiveDate ? new Date(values.effectiveDate).toISOString() : null,
      })
      toast.success(adjusting ? "设备绑定已调整" : "设备绑定成功")
      setDialogOpen(false)
      await reload(page)
    } catch {
      toast.error("绑定失败，请检查设备是否已绑定其他员工")
    } finally {
      setSaving(false)
    }
  }

  async function handleUnbind(row: DeviceRow) {
    try {
      await unbindDevice({ device_id: row.id })
      toast.success("设备已解绑")
      await reload(page)
    } catch {
      toast.error("解绑失败，请稍后重试")
    }
  }

  return {
    employees,
    stores,
    rows,
    filters,
    page,
    total,
    totalPages: totalPages(total, PAGE_SIZE),
    loading,
    saving,
    dialogOpen,
    adjusting,
    setFilters,
    setPage: goToPage,
    openCreate,
    openAdjust,
    closeDialog,
    handleSave,
    handleUnbind,
  }
}

export type DevicesProps = ReturnType<typeof useDevices>
