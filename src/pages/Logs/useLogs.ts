import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { exportCsv } from "@/lib/export"
import { fetchAuditLogs, type AuditLogItem } from "@/lib/v1"
import type { LogFilterState } from "@/components/logs/LogFilters"

// 审计日志页逻辑: 服务端分页 + 关键字/操作/日期筛选 + 导出
export function useLogs() {
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [filters, setFilters] = useState<LogFilterState>({ keyword: "", action: "", date: "" })
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<AuditLogItem | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchAuditLogs({
      page,
      page_size: 20,
      keyword: filters.keyword || undefined,
      action: filters.action || undefined,
      date: filters.date || undefined,
    })
      .then((data) => {
        if (cancelled) return
        setLogs(data.items)
        setTotal(data.total)
        setTotalPages(data.total_pages)
      })
      .catch(() => {
        if (!cancelled) toast.error("日志加载失败，请稍后重试")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, filters])

  const changeFilters = useCallback((next: LogFilterState) => {
    setFilters(next)
    setPage(1)
  }, [])

  const changePage = useCallback((next: number) => setPage(next), [])

  function handleExport() {
    if (logs.length === 0) {
      toast.error("当前没有可导出的日志")
      return
    }
    exportCsv(
      "审计日志.csv",
      ["时间", "操作", "资源", "对象", "执行人", "详情"],
      logs.map((log) => [
        log.created_at ?? "",
        log.action,
        log.resource_type,
        log.resource_id ?? "",
        log.actor_name ?? "",
        log.detail ?? "",
      ]),
    )
    toast.success(`已导出 ${logs.length} 条日志`)
  }

  const openDetail = useCallback((row: AuditLogItem) => setDetail(row), [])
  const closeDetail = useCallback(() => setDetail(null), [])

  return {
    rows: logs,
    filters,
    loading,
    detail,
    page,
    total,
    totalPages,
    setFilters: changeFilters,
    setPage: changePage,
    handleExport,
    openDetail,
    closeDetail,
  }
}

export type LogsProps = ReturnType<typeof useLogs>
