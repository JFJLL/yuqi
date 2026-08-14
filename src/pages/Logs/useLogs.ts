import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { exportCsv, fetchList, updateRecord, type SyncLog } from "@/lib/admin"
import type { LogFilterState } from "@/components/logs/LogFilters"

// 接口日志页逻辑: 筛选、详情、重试失败项
export function useLogs() {
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [filters, setFilters] = useState<LogFilterState>({ keyword: "", type: "", status: "", date: "" })
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<SyncLog | null>(null)
  const [retrying, setRetrying] = useState(false)

  const reload = useCallback(async () => {
    const data = await fetchList<SyncLog>("sync_logs", { perPage: 500 })
    setLogs(data.items ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    reload()
      .catch(() => {
        if (!cancelled) toast.error("日志加载失败，请稍后重试")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reload])

  const rows = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase()
    return logs
      .filter((log) => {
        if (filters.type && log.type !== filters.type) return false
        if (filters.status && log.status !== filters.status) return false
        if (filters.date && !(log.occurred_at ?? "").startsWith(filters.date)) return false
        if (keyword) {
          const text = `${log.object}${log.store}${log.type}`.toLowerCase()
          if (!text.includes(keyword)) return false
        }
        return true
      })
      .sort((a, b) => (b.occurred_at ?? "").localeCompare(a.occurred_at ?? ""))
  }, [logs, filters])

  async function handleRetry() {
    const failed = logs.filter((log) => log.status === "失败")
    if (failed.length === 0) {
      toast.info("当前没有失败项需要重试")
      return
    }
    setRetrying(true)
    try {
      await Promise.all(
        failed.map((log) =>
          updateRecord("sync_logs", log.id, {
            status: "重试中",
            result: `${log.result}（已重新入队）`,
          }),
        ),
      )
      toast.success(`${failed.length} 条失败项已进入重试队列`)
      await reload()
    } catch {
      toast.error("重试失败，请稍后再试")
    } finally {
      setRetrying(false)
    }
  }

  function handleExport() {
    if (rows.length === 0) {
      toast.error("当前没有可导出的日志")
      return
    }
    exportCsv(
      "接口日志.csv",
      ["时间", "类型", "对象", "门店", "状态", "结果"],
      rows.map((log) => [log.occurred_at, log.type, log.object, log.store, log.status, log.result]),
    )
    toast.success(`已导出 ${rows.length} 条日志`)
  }

  const openDetail = useCallback((row: SyncLog) => setDetail(row), [])
  const closeDetail = useCallback(() => setDetail(null), [])

  return { rows, filters, loading, retrying, detail, setFilters, handleRetry, handleExport, openDetail, closeDetail }
}

export type LogsProps = ReturnType<typeof useLogs>
