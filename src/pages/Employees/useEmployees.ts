import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  createRecord,
  fetchEmployeeIssueCounts,
  fetchList,
  updateRecord,
  type Device,
  type DeviceBinding,
  type Employee,
  type Store,
} from "@/lib/admin"
import { pb } from "@/lib/pb"
import { selectCurrentBindings } from "../../../shared/device-binding-semantics.js"

export interface WechatAccountRecord {
  id: string
  employee: string
  openid: string
  mobile: string
  status: string
}

export interface EmployeeListItem extends Employee {
  code: string
  storeName: string
  wechatStatus: "已绑定" | "未绑定"
  wechatOpenid?: string
  deviceSn: string
  issueCount: number
}

export interface EmployeeFilterState {
  keyword: string
  storeId: string
  role: string
  status: string
}

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [bindings, setBindings] = useState<DeviceBinding[]>([])
  const [wechatAccounts, setWechatAccounts] = useState<WechatAccountRecord[]>([])
  const [issueCounts, setIssueCounts] = useState<Record<string, number>>({})
  const [filters, setFilters] = useState<EmployeeFilterState>({ keyword: "", storeId: "", role: "", status: "" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 弹窗状态
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [empRes, storeRes, devRes, bindRes, wechatRes, counts] = await Promise.all([
        fetchList<Employee>("employees", { perPage: 500 }).catch(() => ({ items: [] as Employee[], page: 1, perPage: 500, totalItems: 0 })),
        fetchList<Store>("stores", { perPage: 200 }).catch(() => ({ items: [] as Store[], page: 1, perPage: 200, totalItems: 0 })),
        fetchList<Device>("devices", { perPage: 500 }).catch(() => ({ items: [] as Device[], page: 1, perPage: 500, totalItems: 0 })),
        fetchList<DeviceBinding>("device_bindings", { perPage: 500 }).catch(() => ({ items: [] as DeviceBinding[], page: 1, perPage: 500, totalItems: 0 })),
        fetchList<WechatAccountRecord>("wechat_accounts", { perPage: 500 }).catch(() => ({ items: [] as WechatAccountRecord[], page: 1, perPage: 500, totalItems: 0 })),
        fetchEmployeeIssueCounts().catch(() => ({})),
      ])

      setEmployees(empRes.items || [])
      setStores(storeRes.items || [])
      setDevices(devRes.items || [])
      setBindings(bindRes.items || [])
      setWechatAccounts(wechatRes.items || [])
      setIssueCounts(counts)
    } catch {
      toast.error("员工数据加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id, s.name])), [stores])
  const activeBindingMap = useMemo(() => {
    const map = new Map<string, string>()
    const selections = selectCurrentBindings(bindings)
    for (const selection of selections.byDevice.values()) {
      if (selection.isActive && selection.binding?.employee && selection.binding.device) {
        map.set(selection.binding.employee, selection.binding.device)
      }
    }
    return map
  }, [bindings])
  const deviceSnMap = useMemo(() => new Map(devices.map((d) => [d.id, d.device_no])), [devices])
  const wechatMap = useMemo(() => {
    const map = new Map<string, WechatAccountRecord>()
    for (const w of wechatAccounts) {
      if (w.status === "ACTIVE") {
        map.set(w.employee, w)
      }
    }
    return map
  }, [wechatAccounts])

  const items: EmployeeListItem[] = useMemo(() => {
    const q = filters.keyword.trim().toLowerCase()
    return employees
      .map((emp) => {
        const storeName = storeMap.get(emp.store) || emp.store || "-"
        const devId = activeBindingMap.get(emp.id)
        const deviceSn = devId ? (deviceSnMap.get(devId) || devId) : "未绑定"
        const wechat = wechatMap.get(emp.id)

        return {
          ...emp,
          code: emp.id,
          storeName,
          wechatStatus: wechat ? ("已绑定" as const) : ("未绑定" as const),
          wechatOpenid: wechat?.openid,
          deviceSn,
          issueCount: issueCounts[emp.id] || 0,
        }
      })
      .filter((emp) => {
        if (filters.storeId && emp.store !== filters.storeId && emp.storeName !== filters.storeId) return false
        if (filters.role && emp.role !== filters.role) return false
        if (filters.status && emp.status !== filters.status) return false
        if (q) {
          const text = `${emp.id} ${emp.name} ${emp.phone} ${emp.storeName}`.toLowerCase()
          if (!text.includes(q)) return false
        }
        return true
      })
  }, [employees, filters, storeMap, activeBindingMap, deviceSnMap, wechatMap, issueCounts])

  function openCreate() {
    setEditingEmployee(null)
    setDialogOpen(true)
  }

  function openEdit(emp: Employee) {
    setEditingEmployee(emp)
    setDialogOpen(true)
  }

  async function handleSave(values: { name: string; phone: string; role: string; store: string; status: string }) {
    setSaving(true)
    try {
      const body = {
        name: values.name.trim(),
        phone: values.phone.trim(),
        role: values.role,
        store: values.store,
        status: values.status,
      }
      if (editingEmployee) {
        await updateRecord<Employee>("employees", editingEmployee.id, body)
        toast.success("员工信息已更新")
      } else {
        await createRecord<Employee>("employees", body)
        toast.success("员工已新增")
      }
      setDialogOpen(false)
      await loadData()
    } catch {
      toast.error("保存员工失败")
    } finally {
      setSaving(false)
    }
  }

  async function handleUnbindWechat(emp: EmployeeListItem) {
    if (!emp.wechatOpenid) return
    try {
      await pb.send("/api/yuqi/auth/wechat/unbind", {
        method: "POST",
        body: { openid: emp.wechatOpenid },
      })
      toast.success(`已解除 ${emp.name} 的微信绑定`)
      await loadData()
    } catch {
      toast.error("解绑微信失败")
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
        const [name, phone, role, storeName, status] = cols

        if (!name || !phone) {
          failed++
          errors.push(`第 ${i + 1} 行: 姓名和手机号不能为空`)
          continue
        }

        try {
          const st = stores.find((s) => s.name === storeName || s.code === storeName)
          const storeId = st?.id || stores[0]?.id || ""

          const existingEmp = employees.find((e) => e.phone === phone)
          if (existingEmp) {
            await updateRecord<Employee>("employees", existingEmp.id, {
              name,
              role: role || "营业员",
              store: storeId,
              status: status || "在职",
            })
          } else {
            await createRecord<Employee>("employees", {
              name,
              phone,
              role: role || "营业员",
              store: storeId,
              status: status || "在职",
            })
          }
          success++
        } catch (rowErr) {
          failed++
          errors.push(`第 ${i + 1} 行处理异常: ${rowErr instanceof Error ? rowErr.message : "未知错误"}`)
        }
      }

      await loadData()
      if (success > 0) toast.success(`批量导入完成，成功 ${success} 条`)
      return { success, failed, errors }
    } finally {
      setSaving(false)
    }
  }

  function handleExport() {
    if (items.length === 0) {
      toast.error("当前没有可导出的员工")
      return
    }
    const head = ["员工编号", "姓名", "手机号", "岗位", "所属门店", "微信绑定", "绑定设备", "待处理问题", "在职状态"]
    const lines = items.map((emp) =>
      [emp.code, emp.name, emp.phone, emp.role, emp.storeName, emp.wechatStatus, emp.deviceSn, emp.issueCount, emp.status || "在职"]
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    const csv = ["\uFEFF" + head.join(","), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "员工与店长列表.csv"
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success(`已导出 ${items.length} 名员工`)
  }

  return {
    items,
    stores,
    filters,
    loading,
    saving,
    setFilters,
    reload: loadData,
    dialogOpen,
    editingEmployee,
    openCreate,
    openEdit,
    closeDialog: () => setDialogOpen(false),
    handleSave,
    handleUnbindWechat,
    importDialogOpen,
    openImport: () => setImportDialogOpen(true),
    closeImport: () => setImportDialogOpen(false),
    handleBatchImport,
    handleExport,
  }
}

export type EmployeesProps = ReturnType<typeof useEmployees>
