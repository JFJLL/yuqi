import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  exportCsv,
  fetchList,
  type Employee,
  type Store,
  type SyncLog,
  type TranscriptRecord,
} from "@/lib/admin"
import type { RecordFilterState } from "@/components/records/RecordFilters"
import type { RecordRow } from "@/components/records/RecordTable"

// 录音转写页逻辑: 列表筛选 + 任务队列统计
export function useRecords() {
  const [transcripts, setTranscripts] = useState<TranscriptRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [filters, setFilters] = useState<RecordFilterState>({
    keyword: "",
    date: "",
    storeId: "",
    employeeId: "",
    qcResult: "",
  })
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState<RecordRow | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchList<TranscriptRecord>("transcripts", { perPage: 500 }),
      fetchList<Employee>("employees", { perPage: 200 }),
      fetchList<Store>("stores", { perPage: 200 }),
      fetchList<SyncLog>("sync_logs", { perPage: 500 }),
    ])
      .then(([transcriptData, employeeData, storeData, logData]) => {
        if (cancelled) return
        setTranscripts(transcriptData.items ?? [])
        setEmployees(employeeData.items ?? [])
        setStores(storeData.items ?? [])
        setSyncLogs(logData.items ?? [])
      })
      .catch(() => {
        if (!cancelled) toast.error("转写数据加载失败，请稍后重试")
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

  const rows: RecordRow[] = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase()
    return transcripts
      .map((item) => ({
        ...item,
        employeeName: employeeById.get(item.employee)?.name ?? "",
        storeName: storeById.get(item.store)?.name ?? "",
      }))
      .filter((row) => {
        if (filters.storeId && row.store !== filters.storeId) return false
        if (filters.employeeId && row.employee !== filters.employeeId) return false
        if (filters.qcResult && row.qc_result !== filters.qcResult) return false
        if (filters.date && !(row.occurred_at ?? "").startsWith(filters.date)) return false
        if (keyword) {
          const text = `${row.summary}${row.full_text}${row.employeeName}${row.storeName}`.toLowerCase()
          if (!text.includes(keyword)) return false
        }
        return true
      })
      .sort((a, b) => (b.occurred_at ?? "").localeCompare(a.occurred_at ?? ""))
  }, [transcripts, filters, employeeById, storeById])

  const queue = useMemo(() => {
    const pushLogs = syncLogs.filter((log) => log.type === "转写推送")
    return {
      doneCount: transcripts.length,
      pendingCount: pushLogs.filter((log) => log.status === "重试中").length,
      failedCount: pushLogs.filter((log) => log.status === "失败").length,
      mergeCount: syncLogs.filter((log) => log.type === "合并录音").length,
      resendCount: syncLogs.filter((log) => log.type === "文本同步" && log.status !== "成功").length,
    }
  }, [transcripts, syncLogs])

  const openDetail = useCallback((row: RecordRow) => setViewing(row), [])
  const closeDetail = useCallback(() => setViewing(null), [])

  function handleExport() {
    if (rows.length === 0) {
      toast.error("当前没有可导出的记录")
      return
    }
    exportCsv(
      "录音转写记录.csv",
      ["时间", "员工", "门店", "设备码", "文本摘要", "质检"],
      rows.map((row) => [row.occurred_at, row.employeeName, row.storeName, row.device, row.summary, row.qc_result]),
    )
    toast.success(`已导出 ${rows.length} 条记录`)
  }

  return {
    stores,
    employees,
    rows,
    filters,
    loading,
    queue,
    viewing,
    setFilters,
    openDetail,
    closeDetail,
    handleExport,
  }
}

export type RecordsProps = ReturnType<typeof useRecords>
