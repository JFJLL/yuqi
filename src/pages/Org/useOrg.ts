import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  createRecord,
  fetchList,
  updateRecord,
  type Device,
  type Employee,
  type Region,
  type Store,
} from "@/lib/admin"
import type { RegionFormValues } from "@/components/org/RegionDialog"
import type { StoreFormValues } from "@/components/org/StoreDialog"
import type { ImportType } from "@/components/org/BatchImportDialog"

export interface StoreFilterState {
  keyword: string
  regionId: string
  status: string
}

export function useOrg() {
  const [regions, setRegions] = useState<Region[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [filters, setFilters] = useState<StoreFilterState>({ keyword: "", regionId: "", status: "" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Dialog states
  const [regionDialogOpen, setRegionDialogOpen] = useState(false)
  const [editingRegion, setEditingRegion] = useState<Region | null>(null)

  const [storeDialogOpen, setStoreDialogOpen] = useState(false)
  const [editingStore, setEditingStore] = useState<Store | null>(null)

  const [setManagerDialogOpen, setSetManagerDialogOpen] = useState(false)
  const [managerStore, setManagerStore] = useState<Store | null>(null)

  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importType, setImportType] = useState<ImportType>("stores")

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [regionData, storeData, employeeData, deviceData] = await Promise.all([
        fetchList<Region>("regions", { perPage: 100 }).catch(() => ({ items: [] as Region[], page: 1, perPage: 100, totalItems: 0 })),
        fetchList<Store>("stores", { perPage: 200 }).catch(() => ({ items: [] as Store[], page: 1, perPage: 200, totalItems: 0 })),
        fetchList<Employee>("employees", { perPage: 500 }).catch(() => ({ items: [] as Employee[], page: 1, perPage: 500, totalItems: 0 })),
        fetchList<Device>("devices", { perPage: 500 }).catch(() => ({ items: [] as Device[], page: 1, perPage: 500, totalItems: 0 })),
      ])

      const rawRegions = regionData.items || []
      const rawStores = storeData.items || []
      const rawEmployees = employeeData.items || []
      const rawDevices = deviceData.items || []

      // 聚合区域指标
      const enrichedRegions: Region[] = rawRegions.map((reg) => {
        const regStores = rawStores.filter((st) => st.region === reg.id || st.region === reg.name)
        const regEmps = rawEmployees.filter((e) => regStores.some((st) => st.id === e.store || st.name === e.store))
        return {
          ...reg,
          status: reg.status || "启用",
          manager_name: reg.manager_name || "未设置",
          manager_mobile: reg.manager_mobile || "-",
          storeCount: regStores.length,
          employeeCount: regEmps.length,
        }
      })

      // 聚合门店指标
      const enrichedStores: Store[] = rawStores.map((st) => {
        const stEmps = rawEmployees.filter((e) => e.store === st.id || e.store === st.name)
        const stMgr = stEmps.find((e) => e.role === "店长" || e.role === "STORE_MANAGER")
        const stDevs = rawDevices.filter((d) => stEmps.some((e) => e.id === d.id || e.name === d.device_no) || d.id === st.id)
        const reg = rawRegions.find((r) => r.id === st.region || r.name === st.region)

        return {
          ...st,
          code: st.code || st.id,
          status: st.status || "营业中",
          region: reg?.name || st.region || "默认区域",
          manager_name: stMgr?.name || st.manager_name || "未设置",
          manager_mobile: stMgr?.phone || st.manager_mobile || "",
          manager_employee: stMgr?.id,
          employeeCount: stEmps.length,
          deviceCount: stDevs.length,
        }
      })

      setRegions(enrichedRegions)
      setStores(enrichedStores)
      setEmployees(rawEmployees)
      setDevices(rawDevices)
    } catch {
      toast.error("组织与门店数据加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 过滤门店
  const filteredStores = useMemo(() => {
    const q = filters.keyword.trim().toLowerCase()
    return stores.filter((st) => {
      if (filters.regionId && st.region !== filters.regionId) return false
      if (filters.status && st.status !== filters.status) return false
      if (q) {
        const text = `${st.code} ${st.name} ${st.manager_name}`.toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [stores, filters])

  // 区域操作
  function openCreateRegion() {
    setEditingRegion(null)
    setRegionDialogOpen(true)
  }

  function openEditRegion(region: Region) {
    setEditingRegion(region)
    setRegionDialogOpen(true)
  }

  async function handleSaveRegion(values: RegionFormValues) {
    setSaving(true)
    try {
      const body = {
        name: values.name.trim(),
        code: values.code.trim(),
        manager_name: values.manager_name.trim(),
        manager_mobile: values.manager_mobile.trim(),
        status: values.status,
      }
      if (editingRegion) {
        await updateRecord<Region>("regions", editingRegion.id, body)
        toast.success("区域信息已更新")
      } else {
        await createRecord<Region>("regions", body)
        toast.success("区域已创建")
      }
      setRegionDialogOpen(false)
      await loadData()
    } catch {
      toast.error("区域保存失败")
    } finally {
      setSaving(false)
    }
  }

  // 门店操作
  function openCreateStore() {
    setEditingStore(null)
    setStoreDialogOpen(true)
  }

  function openEditStore(store: Store) {
    setEditingStore(store)
    setStoreDialogOpen(true)
  }

  async function handleSaveStore(values: StoreFormValues) {
    setSaving(true)
    try {
      const body = {
        code: values.code.trim(),
        name: values.name.trim(),
        region: values.region,
        address: values.address.trim(),
        status: values.status,
      }
      if (editingStore) {
        await updateRecord<Store>("stores", editingStore.id, body)
        toast.success("门店信息已更新")
      } else {
        await createRecord<Store>("stores", body)
        toast.success("门店已创建")
      }
      setStoreDialogOpen(false)
      await loadData()
    } catch {
      toast.error("门店保存失败")
    } finally {
      setSaving(false)
    }
  }

  // 设置店长
  function openSetManager(store: Store) {
    setManagerStore(store)
    setSetManagerDialogOpen(true)
  }

  async function handleSaveManager(storeId: string, employeeId: string) {
    setSaving(true)
    try {
      // 1. 如果指定了员工，将该员工角色设置为店长，并更新所属门店
      if (employeeId) {
        const emp = employees.find((e) => e.id === employeeId)
        if (emp) {
          await updateRecord<Employee>("employees", employeeId, {
            role: "店长",
            store: storeId,
          })
          await updateRecord<Store>("stores", storeId, {
            manager_name: emp.name,
            manager_mobile: emp.phone,
            manager_employee: emp.id,
          })
        }
      } else {
        // 清空店长
        await updateRecord<Store>("stores", storeId, {
          manager_name: "",
          manager_mobile: "",
          manager_employee: "",
        })
      }
      toast.success("店长设置已生效")
      setSetManagerDialogOpen(false)
      await loadData()
    } catch {
      toast.error("店长设置失败")
    } finally {
      setSaving(false)
    }
  }

  // 批量导入
  function openBatchImport(type: ImportType) {
    setImportType(type)
    setImportDialogOpen(true)
  }

  async function handleBatchImport(type: ImportType, csvText: string) {
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

      // 跳过第一行表头
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim())

        try {
          if (type === "stores") {
            // 格式: 门店编号,门店名称,所属区域,门店地址,状态
            const [code, name, regionName, address, status] = cols
            if (!name) {
              failed++
              errors.push(`第 ${i + 1} 行: 门店名称不能为空`)
              continue
            }
            const reg = regions.find((r) => r.name === regionName || r.id === regionName)
            const regionId = reg?.id || regions[0]?.id || ""
            await createRecord<Store>("stores", {
              code: code || `STORE-${Date.now()}-${i}`,
              name,
              region: regionId,
              address: address || "",
              status: status || "营业中",
            })
            success++
          } else {
            // 格式: 门店名称,店长姓名,店长手机号
            const [storeName, mgrName, mgrPhone] = cols
            const st = stores.find((s) => s.name === storeName || s.code === storeName)
            if (!st) {
              failed++
              errors.push(`第 ${i + 1} 行: 未找到门店 "${storeName}"`)
              continue
            }
            let emp = employees.find((e) => e.phone === mgrPhone)
            if (!emp && mgrName && mgrPhone) {
              emp = await createRecord<Employee>("employees", {
                name: mgrName,
                phone: mgrPhone,
                role: "店长",
                store: st.id,
                status: "在职",
              })
            }
            if (emp) {
              await updateRecord<Store>("stores", st.id, {
                manager_name: mgrName,
                manager_mobile: mgrPhone,
                manager_employee: emp.id,
              })
              success++
            }
          }
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

  // 导出
  function handleExportStores() {
    if (filteredStores.length === 0) {
      toast.error("当前没有可导出的门店")
      return
    }
    const head = ["门店编号", "门店", "区域", "地址", "店长", "店长电话", "员工数", "设备数", "状态"]
    const lines = filteredStores.map((s) =>
      [s.code || s.id, s.name, s.region, s.address || "-", s.manager_name || "未设置", s.manager_mobile || "-", s.employeeCount || 0, s.deviceCount || 0, s.status || "营业中"]
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    const csv = ["\uFEFF" + head.join(","), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "门店列表.csv"
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success(`已导出 ${filteredStores.length} 家门店`)
  }

  return {
    regions,
    stores: filteredStores,
    allStores: stores,
    employees,
    devices,
    filters,
    loading,
    saving,
    setFilters,
    reload: loadData,
    // 区域弹窗
    regionDialogOpen,
    editingRegion,
    openCreateRegion,
    openEditRegion,
    closeRegionDialog: () => setRegionDialogOpen(false),
    handleSaveRegion,
    // 门店弹窗
    storeDialogOpen,
    editingStore,
    openCreateStore,
    openEditStore,
    closeStoreDialog: () => setStoreDialogOpen(false),
    handleSaveStore,
    // 设置店长
    setManagerDialogOpen,
    managerStore,
    openSetManager,
    closeSetManagerDialog: () => setSetManagerDialogOpen(false),
    handleSaveManager,
    // 批量导入
    importDialogOpen,
    importType,
    openBatchImport,
    closeImportDialog: () => setImportDialogOpen(false),
    handleBatchImport,
    // 导出
    handleExportStores,
  }
}

export type OrgProps = ReturnType<typeof useOrg>
