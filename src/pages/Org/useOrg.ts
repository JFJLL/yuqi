import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  createEmployee,
  fetchEmployees,
  fetchOrgTree,
  fetchStores,
  totalPages,
  type EmployeeItem,
  type OrgNodeItem,
  type StoreItem,
} from "@/lib/v1"
import type { OrgFilterState } from "@/components/org/EmployeeFilters"
import type { EmployeeFormValues } from "@/components/org/EmployeeDialog"
import type { EmployeeRow } from "@/components/org/EmployeeTable"

const PAGE_SIZE = 20

// 门店员工页: 服务端分页 + 服务端筛选 (区域/岗位/状态/关键词), 手机号脱敏
export function useOrg() {
  const [regions, setRegions] = useState<OrgNodeItem[]>([])
  const [stores, setStores] = useState<StoreItem[]>([])
  const [employees, setEmployees] = useState<EmployeeItem[]>([])
  const [filters, setFilters] = useState<OrgFilterState>({ keyword: "", regionId: "", role: "", status: "" })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EmployeeItem | null>(null)
  const [saving, setSaving] = useState(false)

  const loadEmployees = useCallback(async (nextPage = 1) => {
    setLoading(true)
    try {
      const data = await fetchEmployees({
        page: nextPage,
        page_size: PAGE_SIZE,
        keyword: filters.keyword.trim(),
        region_id: filters.regionId || undefined,
        job_title: filters.role || undefined,
        status: filters.status ? "ACTIVE" : undefined,
      })
      setEmployees(data.items)
      setTotal(data.total)
      setPage(data.page)
    } catch {
      toast.error("员工数据加载失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }, [filters.keyword, filters.regionId, filters.role, filters.status])

  // 筛选变化时回到第 1 页
  useEffect(() => {
    loadEmployees(1)
  }, [loadEmployees])

  // 分页切换 (由分页控件触发)
  const goToPage = useCallback(
    (next: number) => {
      loadEmployees(next)
    },
    [loadEmployees],
  )

  // 组织树 / 门店下拉 (树本身就是全量结构, 门店按需加载)
  useEffect(() => {
    let cancelled = false
    Promise.all([fetchOrgTree(), fetchStores({ page_size: 200 })])
      .then(([tree, storeData]) => {
        if (cancelled) return
        setRegions(tree)
        setStores(storeData.items)
      })
      .catch(() => {
        if (!cancelled) toast.error("组织数据加载失败，请稍后重试")
      })
    return () => {
      cancelled = true
    }
  }, [])

  const rows: EmployeeRow[] = useMemo(
    () =>
      employees.map((employee) => ({
        ...employee,
        storeName: employee.store_name ?? "-",
        regionName: "",
        issueCount: 0,
      })),
    [employees],
  )

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(row: EmployeeRow) {
    setEditing(row)
    setDialogOpen(true)
  }

  const closeDialog = useCallback(() => setDialogOpen(false), [])

  async function handleSave(values: EmployeeFormValues) {
    setSaving(true)
    try {
      await createEmployee({
        employee_no: values.employeeNo.trim(),
        name: values.name.trim(),
        mobile: values.mobile.trim(),
        job_title: values.jobTitle || null,
        store_id: values.store || null,
        joined_at: values.joinedAt || null,
      })
      toast.success(editing ? "员工信息已更新" : "员工已保存")
      setDialogOpen(false)
      await loadEmployees(page)
    } catch {
      toast.error("保存失败，请检查员工号/手机号是否重复")
    } finally {
      setSaving(false)
    }
  }

  function handleExport() {
    if (rows.length === 0) {
      toast.error("当前页没有可导出的员工")
      return
    }
    const head = ["员工号", "员工", "手机号", "岗位", "门店", "状态"]
    const lines = rows.map((row) =>
      [row.employee_no, row.name, row.mobile_masked ?? "-", row.job_title ?? "-", row.storeName, row.employment_status]
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    const csv = ["\ufeff" + head.join(","), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "门店员工名单.csv"
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success(`已导出 ${rows.length} 名员工`)
  }

  return {
    regions,
    stores,
    rows,
    filters,
    page,
    total,
    totalPages: totalPages(total, PAGE_SIZE),
    loading,
    saving,
    dialogOpen,
    editing,
    setFilters,
    setPage: goToPage,
    openCreate,
    openEdit,
    closeDialog,
    handleSave,
    handleExport,
  }
}

export type OrgProps = ReturnType<typeof useOrg>
