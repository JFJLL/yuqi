import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  createRecord,
  fetchEmployeeIssueCounts,
  fetchList,
  updateRecord,
  type Employee,
  type Region,
  type Store,
} from "@/lib/admin"
import type { OrgFilterState } from "@/components/org/EmployeeFilters"
import type { EmployeeFormValues, } from "@/components/org/EmployeeDialog"
import type { EmployeeRow } from "@/components/org/EmployeeTable"

// 门店员工页逻辑: 档案数据加载、筛选、新增/编辑、导出
export function useOrg() {
  const [regions, setRegions] = useState<Region[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [issueCounts, setIssueCounts] = useState<Record<string, number>>({})
  const [filters, setFilters] = useState<OrgFilterState>({ keyword: "", regionId: "", role: "", status: "" })
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [saving, setSaving] = useState(false)

  const loadEmployees = useCallback(async () => {
    const data = await fetchList<Employee>("employees", { perPage: 200 })
    setEmployees(data.items ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchList<Region>("regions", { perPage: 100 }),
      fetchList<Store>("stores", { perPage: 200 }),
      fetchList<Employee>("employees", { perPage: 200 }),
      fetchEmployeeIssueCounts(),
    ])
      .then(([regionData, storeData, employeeData, counts]) => {
        if (cancelled) return
        setRegions(regionData.items ?? [])
        setStores(storeData.items ?? [])
        setEmployees(employeeData.items ?? [])
        setIssueCounts(counts)
      })
      .catch(() => {
        if (!cancelled) toast.error("员工数据加载失败，请稍后重试")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const storeById = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores])
  const regionById = useMemo(() => new Map(regions.map((r) => [r.id, r])), [regions])

  const rows: EmployeeRow[] = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase()
    return employees
      .map((employee) => {
        const store = storeById.get(employee.store)
        const region = store ? regionById.get(store.region) : undefined
        return {
          ...employee,
          storeName: store?.name ?? "-",
          regionName: region?.name ?? "",
          issueCount: issueCounts[employee.id] ?? 0,
        }
      })
      .filter((row) => {
        if (filters.regionId) {
          const store = storeById.get(row.store)
          if (!store || store.region !== filters.regionId) return false
        }
        if (filters.role && row.role !== filters.role) return false
        if (filters.status && row.status !== filters.status) return false
        if (keyword) {
          const text = `${row.name}${row.storeName}${row.phone}`.toLowerCase()
          if (!text.includes(keyword)) return false
        }
        return true
      })
  }, [employees, filters, storeById, regionById, issueCounts])

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
      const body = {
        name: values.name.trim(),
        phone: values.phone.trim(),
        role: values.role,
        store: values.store,
        status: values.status,
      }
      if (editing) {
        await updateRecord<Employee>("employees", editing.id, body)
        toast.success("员工信息已更新")
      } else {
        await createRecord<Employee>("employees", body)
        toast.success("员工已保存")
      }
      setDialogOpen(false)
      await loadEmployees()
    } catch {
      toast.error("保存失败，请稍后重试")
    } finally {
      setSaving(false)
    }
  }

  function handleExport() {
    if (rows.length === 0) {
      toast.error("当前没有可导出的员工")
      return
    }
    const head = ["员工", "手机号", "岗位", "门店", "区域", "本月问题", "状态"]
    const lines = rows.map((row) =>
      [row.name, row.phone, row.role, row.storeName, row.regionName, row.issueCount, row.status]
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    const csv = ["﻿" + head.join(","), ...lines].join("\n")
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
    loading,
    saving,
    dialogOpen,
    editing,
    setFilters,
    openCreate,
    openEdit,
    closeDialog,
    handleSave,
    handleExport,
  }
}

export type OrgProps = ReturnType<typeof useOrg>
