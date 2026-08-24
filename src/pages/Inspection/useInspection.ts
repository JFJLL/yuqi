import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { exportCsv } from "@/lib/export"
import {
  closeIssue,
  fetchIssueDetail,
  fetchIssues,
  pushRectify,
  rerunAnalysis,
  reviewIssue,
  type IssueItem,
} from "@/lib/v1"
import type { IssueFilterState } from "@/components/inspection/IssueFilters"
import type { IssueRow } from "@/components/inspection/IssueTable"
import type { DetailIssue } from "@/components/inspection/IssueDetailDialog"

export type InspectionTab = "all" | "high" | "appealing"

const PAGE_SIZE = 20

function tabToParams(tab: InspectionTab): Partial<Record<string, string>> {
  if (tab === "high") return { risk: "高" }
  if (tab === "appealing") return { state: "申诉中" }
  return {}
}

// 合规巡检页逻辑: 服务端分页 + 筛选 + 人工复核 + 推送整改 + 重跑分析
export function useInspection() {
  const [issues, setIssues] = useState<IssueItem[]>([])
  const [tab, setTab] = useState<InspectionTab>("all")
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<IssueFilterState>({
    keyword: "",
    risk: "",
    state: "",
    issueType: "",
    date: "",
  })
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [detail, setDetail] = useState<DetailIssue | null>(null)
  const [pushing, setPushing] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [rerunning, setRerunning] = useState(false)
  const keywordTimer = useRef<number | null>(null)

  const setFiltersDebounced = useCallback((next: IssueFilterState) => {
    setFilters(next)
    if (keywordTimer.current) window.clearTimeout(keywordTimer.current)
    keywordTimer.current = window.setTimeout(() => setPage(1), 400)
  }, [])

  const fetchData = useCallback(async (pageNum: number, f: IssueFilterState, t: InspectionTab) => {
    const data = await fetchIssues({
      page: pageNum,
      page_size: PAGE_SIZE,
      keyword: f.keyword.trim() || undefined,
      risk: f.risk || undefined,
      state: f.state || tabToParams(t).state,
      issue_type: f.issueType || undefined,
      date: f.date || undefined,
    })
    return data
  }, [])

  const reload = useCallback(async () => {
    const data = await fetchData(page, filters, tab)
    setIssues(data.items)
    setTotal(data.total)
    return data
  }, [fetchData, page, filters, tab])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchData(1, filters, tab)
      .then((data) => {
        if (!cancelled) {
          setIssues(data.items)
          setTotal(data.total)
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchData(page, filters, tab)
      .then((data) => {
        if (!cancelled) {
          setIssues(data.items)
          setTotal(data.total)
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("巡检数据刷新失败，请稍后重试")
      })
    return () => {
      cancelled = true
    }
  }, [page, filters, tab, fetchData])

  const typeOptions = useMemo(
    () => Array.from(new Set(["夸大疗效表达", "处方药提醒缺失", "联合用药风险", "基础疾病询问缺失", "服务态度问题"])),
    [],
  )

  const rows: IssueRow[] = useMemo(
    () =>
      issues.map((item) => ({
        ...item,
        employeeName: item.employee_name ?? "",
        storeName: item.store_name ?? "",
      })),
    [issues],
  )

  const openDetail = useCallback(async (row: IssueRow) => {
    try {
      const data = await fetchIssueDetail(row.id)
      setDetail({ ...data, employeeName: data.employee_name ?? "", storeName: data.store_name ?? "" })
    } catch {
      toast.error("问题详情加载失败，请稍后重试")
    }
  }, [])
  const closeDetail = useCallback(() => setDetail(null), [])

  const handleReview = useCallback(async (approve: boolean, comment?: string) => {
    if (!detail || reviewing) return
    setReviewing(true)
    try {
      await reviewIssue(detail.id, { approve, comment: comment ?? null })
      toast.success(approve ? "已通过复核" : "已驳回")
      setDetail(null)
      await reload().catch(() => undefined)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "复核失败")
    } finally {
      setReviewing(false)
    }
  }, [detail, reviewing, reload])

  const handleClose = useCallback(async () => {
    if (!detail || reviewing) return
    setReviewing(true)
    try {
      await closeIssue(detail.id)
      toast.success("问题已关闭")
      setDetail(null)
      await reload().catch(() => undefined)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "关闭失败")
    } finally {
      setReviewing(false)
    }
  }, [detail, reviewing, reload])

  async function pushRectifyIssue(issue: IssueRow) {
    setPushing(true)
    try {
      await pushRectify(issue.id)
      toast.success("整改任务已推送")
      setDetail(null)
      await reload().catch(() => undefined)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "推送失败，请稍后重试")
    } finally {
      setPushing(false)
    }
  }

  async function handleRerun() {
    setRerunning(true)
    try {
      const result = await rerunAnalysis()
      toast.success(`分析完成: 新增 ${result.issues_created} 个疑似问题`)
      await reload().catch(() => undefined)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "分析失败")
    } finally {
      setRerunning(false)
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
      rows.map((row) => [
        String(row.occurred_at ?? ""),
        row.employeeName,
        row.storeName,
        row.issue_type,
        row.quote,
        row.risk,
        row.state,
      ]),
    )
    toast.success(`已导出 ${rows.length} 条问题`)
  }

  return {
    rows,
    filters,
    tab,
    loading,
    pushing,
    reviewing,
    rerunning,
    detail,
    typeOptions,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    setFilters: setFiltersDebounced,
    setTab: (t: InspectionTab) => {
      setTab(t)
      setPage(1)
    },
    setPage,
    openDetail,
    closeDetail,
    handleReview,
    handleClose,
    pushRectify: pushRectifyIssue,
    handleRerun,
    handleExport,
    reload,
  }
}

export type InspectionProps = ReturnType<typeof useInspection>
