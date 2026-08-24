import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { exportCsv } from "@/lib/export"
import {
  deleteRecording,
  fetchEmployees,
  fetchRecordingDetail,
  fetchRecordings,
  fetchRecordingSummary,
  fetchStores,
  retryRecording,
  type EmployeeItem,
  type RecordingDetail,
  type RecordingListItem,
  type RecordingSummary,
  type StoreItem,
} from "@/lib/v1"
import { uploadRecording } from "@/lib/v1"
import type { AsrSubmission } from "@/lib/v1"
import type { RecordFilterState } from "@/components/records/RecordFilters"
import type { RecordRow } from "@/components/records/RecordTable"

const PAGE_SIZE = 20

interface RecordsData {
  rows: RecordingListItem[]
  summary: RecordingSummary
}

// 录音转写页逻辑: 服务端分页 + 筛选 + 上传/重试/软删除 + 详情拉取。
export type ViewingRecord = RecordingDetail & { employeeName: string; storeName: string }

export function useRecords() {
  const [rows, setRows] = useState<RecordingListItem[]>([])
  const [employees, setEmployees] = useState<EmployeeItem[]>([])
  const [stores, setStores] = useState<StoreItem[]>([])
  const [summary, setSummary] = useState<RecordingSummary>({
    total: 0, done_count: 0, pending_count: 0, failed_count: 0,
    retryable_count: 0, merge_count: 0, resend_count: 0,
  })
  const [page, setPage] = useState(1)
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
  const [viewing, setViewing] = useState<ViewingRecord | null>(null)
  const [deleting, setDeleting] = useState<RecordRow | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const keywordTimer = useRef<number | null>(null)

  // 关键词防抖: 输入停止 400ms 后再发起服务端查询
  const setFiltersDebounced = useCallback((next: RecordFilterState) => {
    setFilters(next)
    if (keywordTimer.current) window.clearTimeout(keywordTimer.current)
    keywordTimer.current = window.setTimeout(() => setPage(1), 400)
  }, [])

  const fetchData = useCallback(async (pageNum: number, filterState: RecordFilterState): Promise<RecordsData> => {
    const [listData, summaryData] = await Promise.all([
      fetchRecordings({
        page: pageNum,
        page_size: PAGE_SIZE,
        keyword: filterState.keyword.trim() || undefined,
        date: filterState.date || undefined,
        store_id: filterState.storeId || undefined,
        employee_id: filterState.employeeId || undefined,
        qc_result: filterState.qcResult || undefined,
      }),
      fetchRecordingSummary(),
    ])
    return { rows: listData.items, summary: summaryData }
  }, [])

  const refresh = useCallback(async (showError = false) => {
    try {
      const data = await fetchData(page, filters)
      setRows(data.rows)
      setSummary(data.summary)
    } catch {
      if (showError) toast.error("转写数据刷新失败，请稍后重试")
      throw new Error("转写数据刷新失败")
    }
  }, [fetchData, page, filters])

  // 首次加载 + 员工/门店下拉数据
  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchEmployees({ page_size: 200 }),
      fetchStores({ page_size: 200 }),
    ])
      .then(([empData, storeData]) => {
        if (!cancelled) {
          setEmployees(empData.items.map((e) => ({ ...e, store: e.store_id })))
          setStores(storeData.items)
        }
      })
      .catch(() => undefined)
    fetchData(1, filters)
      .then((data) => {
        if (!cancelled) {
          setRows(data.rows)
          setSummary(data.summary)
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 翻页/筛选变化时刷新列表
  useEffect(() => {
    fetchData(page, filters)
      .then((data) => {
        setRows(data.rows)
        setSummary(data.summary)
      })
      .catch(() => toast.error("转写数据刷新失败，请稍后重试"))
  }, [page, filters, fetchData])

  // 有排队任务时每 5s 轮询
  useEffect(() => {
    if (summary.pending_count === 0) return
    const timer = window.setInterval(() => {
      void refresh(false).catch(() => undefined)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [summary.pending_count, refresh])

  const rowsMapped: RecordRow[] = useMemo(
    () =>
      rows.map((item) => ({
        ...item,
        employeeName: item.employee_name ?? "",
        storeName: item.store_name ?? "",
      })),
    [rows],
  )

  const queue = useMemo(
    () => ({
      doneCount: summary.done_count,
      pendingCount: summary.pending_count,
      failedCount: summary.failed_count,
      mergeCount: summary.merge_count,
      resendCount: summary.resend_count,
    }),
    [summary],
  )

  const openDetail = useCallback(async (row: RecordRow) => {
    try {
      const detail = await fetchRecordingDetail(row.id)
      setViewing({
        ...detail,
        employeeName: detail.employee_name ?? "",
        storeName: detail.store_name ?? "",
      })
    } catch {
      toast.error("转写详情加载失败，请稍后重试")
    }
  }, [])
  const closeDetail = useCallback(() => setViewing(null), [])

  const handleSubmitAudio = useCallback(async (input: AsrSubmission) => {
    setSubmitting(true)
    try {
      const form = new FormData()
      form.append("file", input.file)
      if (input.device) form.append("device_code", input.device)
      if (input.employee) form.append("employee_id", input.employee)
      if (input.store) form.append("store_id", input.store)
      if (input.occurred_at) form.append("occurred_at", input.occurred_at)
      if (input.hotwords) form.append("hotwords", input.hotwords)
      form.append("language", input.language ?? "zh-CN")
      await uploadRecording(form)
      toast.success("音频已提交，转写完成后自动同步")
      await refresh(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : "音频提交失败，请稍后重试"
      toast.error(message)
      throw error
    } finally {
      setSubmitting(false)
    }
  }, [refresh])

  const handleRetry = useCallback(async (audioId: string) => {
    try {
      await retryRecording(audioId)
      toast.success("已重新加入转写队列")
      await refresh(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "转写重试失败")
    }
  }, [refresh])

  const requestDelete = useCallback((row: RecordRow) => setDeleting(row), [])
  const cancelDelete = useCallback(() => {
    if (!deleteBusy) setDeleting(null)
  }, [deleteBusy])

  const confirmDelete = useCallback(async () => {
    const row = deleting
    if (!row || deleteBusy) return
    setDeleteBusy(true)
    try {
      await deleteRecording(row.id)
      toast.success("已删除该条转写记录")
      setDeleting(null)
      await refresh(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败，请稍后重试")
    } finally {
      setDeleteBusy(false)
    }
  }, [deleting, deleteBusy, refresh])

  function handleExport() {
    if (rowsMapped.length === 0) {
      toast.error("当前没有可导出的记录")
      return
    }
    exportCsv(
      "录音转写记录.csv",
      ["时间", "员工", "门店", "设备码", "文件名", "文本摘要", "ASR 状态", "质检"],
      rowsMapped.map((row) => [
        row.occurred_at,
        row.employeeName,
        row.storeName,
        String(row.device ?? ""),
        String(row.audio_name ?? ""),
        row.summary,
        row.asr_status || "-",
        row.qc_result,
      ]),
    )
    toast.success(`已导出 ${rowsMapped.length} 条记录`)
  }

  return {
    stores,
    employees,
    rows: rowsMapped,
    summary,
    filters,
    loading,
    queue,
    viewing,
    uploadOpen,
    submitting,
    deleting,
    deleteBusy,
    page,
    totalPages: Math.max(1, Math.ceil(summary.total / PAGE_SIZE)),
    setFilters: setFiltersDebounced,
    setPage,
    setUploadOpen,
    openDetail,
    closeDetail,
    handleSubmitAudio,
    handleRetry,
    requestDelete,
    cancelDelete,
    confirmDelete,
    handleExport,
  }
}

export type RecordsProps = ReturnType<typeof useRecords>
