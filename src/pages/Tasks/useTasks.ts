import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  confirmRectification,
  fetchRectifications,
  fetchRectificationSummary,
  updateRectification,
  type RectificationItem,
  type RectificationSummary,
} from "@/lib/v1"
import type { TaskFormValues } from "@/components/tasks/TaskDialog"
import type { TaskRow } from "@/components/tasks/TaskTable"

const PAGE_SIZE = 20

// 整改任务页逻辑: 服务端分页 + 跟进(截止/进度) + 确认员工提交 (整改闭环管理端)
export function useTasks() {
  const [rows, setRows] = useState<RectificationItem[]>([])
  const [stats, setStats] = useState<RectificationSummary>({
    total: 0, pending: 0, submitted: 0, confirmed: 0, rejected: 0,
    overdue: 0, escalated: 0, new_today: 0, completion_rate: 0,
  })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("")
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [following, setFollowing] = useState<TaskRow | null>(null)
  const [confirming, setConfirming] = useState<TaskRow | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmComment, setConfirmComment] = useState("")

  const reload = useCallback(async (pageNum: number, status: string) => {
    const data = await fetchRectifications({ page: pageNum, page_size: PAGE_SIZE, status: status || undefined })
    setRows(data.items)
    return data
  }, [])

  const refreshStats = useCallback(async () => {
    try {
      setStats(await fetchRectificationSummary())
    } catch {
      // 统计失败不阻塞列表
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([reload(1, ""), refreshStats()])
      .catch(() => {
        if (!cancelled) toast.error("整改任务加载失败，请稍后重试")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reload, refreshStats])

  useEffect(() => {
    reload(page, statusFilter).catch(() => toast.error("整改任务刷新失败，请稍后重试"))
  }, [page, statusFilter, reload])

  const rowsMapped: TaskRow[] = useMemo(
    () => rows.map((r) => ({ ...r, ownerName: r.employee_name ?? "", storeName: r.store_name ?? "" })),
    [rows],
  )

  const openFollow = useCallback((row: TaskRow) => {
    setFollowing(row)
    setDialogOpen(true)
  }, [])
  const closeDialog = useCallback(() => setDialogOpen(false), [])

  const handleSave = useCallback(async (values: TaskFormValues) => {
    if (!following) return
    setSaving(true)
    try {
      await updateRectification(following.id, {
        due_date: values.dueDate || null,
        progress: values.progress,
      })
      toast.success("任务已更新")
      setDialogOpen(false)
      setFollowing(null)
      await reload(page, statusFilter)
      await refreshStats()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }, [following, page, statusFilter, reload, refreshStats])

  const openConfirm = useCallback((row: TaskRow) => {
    setConfirming(row)
    setConfirmComment("")
  }, [])
  const closeConfirm = useCallback(() => setConfirming(null), [])

  const handleConfirm = useCallback(async (approve: boolean) => {
    if (!confirming || confirmBusy) return
    setConfirmBusy(true)
    try {
      await confirmRectification(confirming.id, { approve, comment: confirmComment || null })
      toast.success(approve ? "整改已确认" : "已驳回，员工需重新整改")
      setConfirming(null)
      await reload(page, statusFilter)
      await refreshStats()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "确认失败")
    } finally {
      setConfirmBusy(false)
    }
  }, [confirming, confirmBusy, confirmComment, page, statusFilter, reload, refreshStats])

  return {
    rows: rowsMapped,
    stats: {
      openCount: stats.pending + stats.submitted,
      newToday: stats.new_today,
      overdueCount: stats.overdue,
      completionRate: stats.completion_rate,
    },
    loading,
    saving,
    dialogOpen,
    following,
    confirming,
    confirmBusy,
    confirmComment,
    setConfirmComment,
    page,
    totalPages: Math.max(1, Math.ceil(stats.total / PAGE_SIZE)),
    total: stats.total,
    statusFilter,
    setStatusFilter: (v: string) => {
      setStatusFilter(v)
      setPage(1)
    },
    setPage,
    openFollow,
    closeDialog,
    handleSave,
    openConfirm,
    closeConfirm,
    handleConfirm,
  }
}

export type TasksProps = ReturnType<typeof useTasks>
