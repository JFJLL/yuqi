import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { exportCsv, fetchList, updateRecord, type SyncLog } from "@/lib/admin"

export interface AuditLogRecord {
  id: string
  actor?: string
  actor_name?: string
  actor_type?: string
  action: string
  target_type: string
  target_id: string
  detail_json?: Record<string, unknown>
  ip?: string
  created?: string
}

export interface AuditRow {
  id: string
  time: string
  operator: string
  type: string
  objectId: string
  store: string
  status: string
  message: string
  detailJson?: Record<string, unknown>
}

export interface LogFilterState {
  keyword: string
  type: string
  status: string
  date: string
}

export function useLogs() {
  const [activeTab, setActiveTab] = useState<"audit" | "sync">("audit")
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([])
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [filters, setFilters] = useState<LogFilterState>({ keyword: "", type: "", status: "", date: "" })
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<AuditRow | null>(null)
  const [retrying, setRetrying] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [auditRes, syncRes] = await Promise.all([
        fetchList<AuditLogRecord>("audit_logs", { perPage: 500 }).catch(() => ({ items: [] as AuditLogRecord[], page: 1, perPage: 500, totalItems: 0 })),
        fetchList<SyncLog>("sync_logs", { perPage: 500 }).catch(() => ({ items: [] as SyncLog[], page: 1, perPage: 500, totalItems: 0 })),
      ])

      setAuditLogs(auditRes.items || [])
      setSyncLogs(syncRes.items || [])
    } catch {
      toast.error("日志加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const auditRows: AuditRow[] = useMemo(() => {
    const q = filters.keyword.trim().toLowerCase()
    return auditLogs
      .map((log) => {
        const detail = log.detail_json || {}
        const msg = Object.entries(detail).map(([k, v]) => `${k}: ${v}`).join("，") || "操作完成"
        return {
          id: log.id,
          time: log.created ? log.created.slice(0, 19).replace("T", " ") : "-",
          operator: log.actor_name || log.actor || "系统/管理员",
          type: log.action,
          objectId: log.target_id || log.target_type || "-",
          store: String(detail.store || detail.storeName || "总部/全局"),
          status: "成功",
          message: msg,
          detailJson: detail,
        }
      })
      .filter((row) => {
        if (q) {
          const text = `${row.operator} ${row.type} ${row.objectId} ${row.store} ${row.message}`.toLowerCase()
          if (!text.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => b.time.localeCompare(a.time))
  }, [auditLogs, filters])

  const syncRows = useMemo(() => {
    const q = filters.keyword.trim().toLowerCase()
    return syncLogs
      .filter((log) => {
        if (filters.type && log.type !== filters.type) return false
        if (filters.status && log.status !== filters.status) return false
        if (filters.date && !(log.occurred_at || "").startsWith(filters.date)) return false
        if (q) {
          const text = `${log.object} ${log.store} ${log.type} ${log.result}`.toLowerCase()
          if (!text.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => (b.occurred_at || "").localeCompare(a.occurred_at || ""))
  }, [syncLogs, filters])

  async function handleRetry() {
    const failed = syncLogs.filter((log) => log.status === "失败")
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
          })
        )
      )
      toast.success(`${failed.length} 条失败项已重新加入处理队列`)
      await reload()
    } catch {
      toast.error("重试失败")
    } finally {
      setRetrying(false)
    }
  }

  function handleExport() {
    if (activeTab === "audit") {
      if (auditRows.length === 0) {
        toast.error("当前没有可导出的审计日志")
        return
      }
      exportCsv(
        "操作审计日志.csv",
        ["时间", "操作人", "操作类型", "关联对象ID", "范围/门店", "状态", "操作说明"],
        auditRows.map((r) => [r.time, r.operator, r.type, r.objectId, r.store, r.status, r.message])
      )
      toast.success(`已导出 ${auditRows.length} 条审计日志`)
    } else {
      if (syncRows.length === 0) {
        toast.error("当前没有可导出的接口日志")
        return
      }
      exportCsv(
        "接口与同步日志.csv",
        ["时间", "类型", "对象", "门店", "状态", "结果"],
        syncRows.map((log) => [log.occurred_at, log.type, log.object, log.store, log.status, log.result])
      )
      toast.success(`已导出 ${syncRows.length} 条接口日志`)
    }
  }

  return {
    activeTab,
    setActiveTab,
    auditRows,
    syncRows,
    filters,
    loading,
    retrying,
    detail,
    setFilters,
    reload,
    handleRetry,
    handleExport,
    openDetail: (r: AuditRow) => setDetail(r),
    closeDetail: () => setDetail(null),
  }
}

export type LogsProps = ReturnType<typeof useLogs>
