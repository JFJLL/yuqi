import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  closeIssue,
  exportCsv,
  fetchList,
  pushIssueRectification,
  reviewIssue,
  type Employee,
  type InspectionIssueRecord,
  type Store,
} from "@/lib/admin"
import type { IssueFilterState } from "@/components/inspection/IssueFilters"
import type { IssueRow } from "@/components/inspection/IssueTable"

export type InspectionTab = "all" | "high" | "appealing"

// 合规巡检页逻辑: 问题筛选 + 推送整改(巡检→整改闭环起点)
export function useInspection() {
  const [issues, setIssues] = useState<InspectionIssueRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [tab, setTab] = useState<InspectionTab>("all")
  const [filters, setFilters] = useState<IssueFilterState>({
    keyword: "",
    risk: "",
    state: "",
    issueType: "",
    date: "",
  })
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<IssueRow | null>(null)
  const [pushing, setPushing] = useState(false)

  const reload = useCallback(async () => {
    const data = await fetchList<InspectionIssueRecord>("inspection_issues", { perPage: 500 })
    setIssues(data.items ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchList<InspectionIssueRecord>("inspection_issues", { perPage: 500 }),
      fetchList<Employee>("employees", { perPage: 200 }),
      fetchList<Store>("stores", { perPage: 200 }),
    ])
      .then(([issueData, employeeData, storeData]) => {
        if (cancelled) return
        setIssues(issueData.items ?? [])
        setEmployees(employeeData.items ?? [])
        setStores(storeData.items ?? [])
      })
      .catch(() => {
        if (!cancelled) toast.error("巡检数据加载失败，请稍后重试")
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

  const typeOptions = useMemo(
    () => Array.from(new Set(issues.map((issue) => issue.issue_type).filter(Boolean))),
    [issues],
  )

  const rows: IssueRow[] = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase()
    return issues
      .map((issue) => ({
        ...issue,
        employeeName: employeeById.get(issue.employee)?.name ?? "",
        storeName: storeById.get(issue.store)?.name ?? "",
      }))
      .filter((row) => {
        if (tab === "high" && row.risk !== "高") return false
        if (tab === "appealing" && row.state !== "申诉中") return false
        if (filters.risk && row.risk !== filters.risk) return false
        if (filters.state && row.state !== filters.state) return false
        if (filters.issueType && row.issue_type !== filters.issueType) return false
        if (filters.date && !(row.occurred_at ?? "").startsWith(filters.date)) return false
        if (keyword) {
          const text = `${row.employeeName}${row.storeName}${row.issue_type}`.toLowerCase()
          if (!text.includes(keyword)) return false
        }
        return true
      })
      .sort((a, b) => (b.occurred_at ?? "").localeCompare(a.occurred_at ?? ""))
  }, [issues, tab, filters, employeeById, storeById])

  const openDetail = useCallback((row: IssueRow) => setDetail(row), [])
  const closeDetail = useCallback(() => setDetail(null), [])

  async function pushRectify(issue: IssueRow) {
    setPushing(true)
    try {
      await reviewIssue(issue.id, "APPROVE")
      await pushIssueRectification(issue.id, 3)
      toast.success("已审核通过并向员工推送整改任务")
      setDetail(null)
      await reload()
    } catch {
      toast.error("审核推送失败，请稍后重试")
    } finally {
      setPushing(false)
    }
  }

  async function handleDismissIssue(issue: IssueRow) {
    setPushing(true)
    try {
      await reviewIssue(issue.id, "DISMISS", "人工判定为误报")
      toast.success("已标记为误报并忽略")
      setDetail(null)
      await reload()
    } catch {
      toast.error("判定操作失败")
    } finally {
      setPushing(false)
    }
  }

  async function handleCloseIssue(issue: IssueRow) {
    setPushing(true)
    try {
      await closeIssue(issue.id, "管理员手动关闭")
      toast.success("问题已关闭")
      setDetail(null)
      await reload()
    } catch {
      toast.error("关闭问题失败")
    } finally {
      setPushing(false)
    }
  }

  function handleExport() {
    if (rows.length === 0) {
      toast.error("当前没有可导出的问题")
      return
    }
    exportCsv(
      "合规巡检问题.csv",
      ["时间", "员工", "门店", "问题类型", "命中文本", "风险", "状态"],
      rows.map((row) => [row.occurred_at, row.employeeName, row.storeName, row.issue_type, row.quote, row.risk, row.state]),
    )
    toast.success(`已导出 ${rows.length} 条问题`)
  }

  return {
    rows,
    filters,
    tab,
    loading,
    pushing,
    detail,
    typeOptions,
    setFilters,
    setTab,
    openDetail,
    closeDetail,
    pushRectify,
    handleDismissIssue,
    handleCloseIssue,
    handleExport,
    reload,
  }
}

export type InspectionProps = ReturnType<typeof useInspection>
