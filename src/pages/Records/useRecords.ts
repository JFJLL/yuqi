import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { retryAsrJob, submitAsrAudio, type AsrJob, type AsrSubmission } from "@/lib/asr"
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

interface RecordsData {
  transcripts: TranscriptRecord[]
  employees: Employee[]
  stores: Store[]
  syncLogs: SyncLog[]
  asrJobs: AsrJob[]
}

// 录音转写页逻辑：转写记录、ASR 任务状态、上传提交与结果刷新。
export function useRecords() {
  const [transcripts, setTranscripts] = useState<TranscriptRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [asrJobs, setAsrJobs] = useState<AsrJob[]>([])
  const [filters, setFilters] = useState<RecordFilterState>({
    keyword: "",
    date: "",
    storeId: "",
    employeeId: "",
    qcResult: "",
  })
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [viewing, setViewing] = useState<RecordRow | null>(null)

  const fetchData = useCallback(async (): Promise<RecordsData> => {
    const [transcriptData, employeeData, storeData, logData, jobData] = await Promise.all([
      fetchList<TranscriptRecord>("transcripts", { perPage: 500 }),
      fetchList<Employee>("employees", { perPage: 200 }),
      fetchList<Store>("stores", { perPage: 200 }),
      fetchList<SyncLog>("sync_logs", { perPage: 500 }),
      fetchList<AsrJob>("asr_jobs", { perPage: 200 }),
    ])
    return {
      transcripts: transcriptData.items ?? [],
      employees: employeeData.items ?? [],
      stores: storeData.items ?? [],
      syncLogs: logData.items ?? [],
      asrJobs: jobData.items ?? [],
    }
  }, [])

  const applyData = useCallback((data: RecordsData) => {
    setTranscripts(data.transcripts)
    setEmployees(data.employees)
    setStores(data.stores)
    setSyncLogs(data.syncLogs)
    setAsrJobs(data.asrJobs)
  }, [])

  const refreshRecords = useCallback(async (showError = false) => {
    try {
      applyData(await fetchData())
    } catch {
      if (showError) toast.error("转写数据刷新失败，请稍后重试")
      throw new Error("转写数据刷新失败")
    }
  }, [applyData, fetchData])

  useEffect(() => {
    let cancelled = false
    fetchData()
      .then((data) => {
        if (!cancelled) applyData(data)
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
  }, [applyData, fetchData])

  const activeJobCount = useMemo(
    () => asrJobs.filter((job) => job.status === "queued" || job.status === "running").length,
    [asrJobs],
  )

  useEffect(() => {
    if (activeJobCount === 0) return
    const timer = window.setInterval(() => {
      void refreshRecords(false).catch(() => undefined)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [activeJobCount, refreshRecords])

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
          const text = `${row.summary}${row.full_text}${row.employeeName}${row.storeName}${row.audio_name ?? ""}`.toLowerCase()
          if (!text.includes(keyword)) return false
        }
        return true
      })
      .sort((a, b) => (b.occurred_at ?? "").localeCompare(a.occurred_at ?? ""))
  }, [transcripts, filters, employeeById, storeById])

  const queue = useMemo(() => {
    const pushLogs = syncLogs.filter((log) => log.type === "转写推送")
    return {
      doneCount: transcripts.filter((item) => !item.asr_status || item.asr_status === "succeeded").length,
      pendingCount: activeJobCount,
      failedCount: asrJobs.filter((job) => job.status === "failed").length,
      mergeCount: syncLogs.filter((log) => log.type === "合并录音").length,
      resendCount: syncLogs.filter((log) => log.type === "文本同步" && log.status !== "成功").length + pushLogs.filter((log) => log.status === "重试中").length,
    }
  }, [activeJobCount, asrJobs, syncLogs, transcripts])

  const openDetail = useCallback((row: RecordRow) => setViewing(row), [])
  const closeDetail = useCallback(() => setViewing(null), [])

  const handleSubmitAudio = useCallback(async (input: AsrSubmission) => {
    setSubmitting(true)
    try {
      await submitAsrAudio(input)
      toast.success("音频已提交，后台将持续同步转写结果")
      await refreshRecords(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : "音频提交失败，请稍后重试"
      toast.error(message)
      throw error
    } finally {
      setSubmitting(false)
    }
  }, [refreshRecords])

  const handleRetry = useCallback(async (job: AsrJob) => {
    try {
      await retryAsrJob(job.id)
      toast.success("已重新加入转写队列")
      await refreshRecords(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "转写重试失败")
    }
  }, [refreshRecords])

  function handleExport() {
    if (rows.length === 0) {
      toast.error("当前没有可导出的记录")
      return
    }
    exportCsv(
      "录音转写记录.csv",
      ["时间", "员工", "门店", "设备码", "文件名", "文本摘要", "ASR 状态", "质检"],
      rows.map((row) => [
        row.occurred_at,
        row.employeeName,
        row.storeName,
        row.device,
        row.audio_name ?? "",
        row.summary,
        row.asr_status || "-",
        row.qc_result,
      ]),
    )
    toast.success(`已导出 ${rows.length} 条记录`)
  }

  return {
    stores,
    employees,
    rows,
    asrJobs,
    filters,
    loading,
    queue,
    viewing,
    uploadOpen,
    submitting,
    setFilters,
    setUploadOpen,
    openDetail,
    closeDetail,
    handleSubmitAudio,
    handleRetry,
    handleExport,
  }
}

export type RecordsProps = ReturnType<typeof useRecords>
