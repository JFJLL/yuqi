import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  createRecord,
  fetchList,
  updateRecord,
  type Employee,
  type InspectionIssueRecord,
  type RectifyTaskRecord,
  type Store,
} from "@/lib/admin"
import type { TaskFormValues } from "@/components/tasks/TaskDialog"
import type { TaskRow } from "@/components/tasks/TaskTable"

// 整改任务页逻辑: 统计、派发、跟进更新
export function useTasks() {
  const [tasks, setTasks] = useState<RectifyTaskRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [issues, setIssues] = useState<InspectionIssueRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "follow">("create")
  const [following, setFollowing] = useState<TaskRow | null>(null)

  const reload = useCallback(async () => {
    const data = await fetchList<RectifyTaskRecord>("rectify_tasks", { perPage: 500 })
    setTasks(data.items ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchList<RectifyTaskRecord>("rectify_tasks", { perPage: 500 }),
      fetchList<Employee>("employees", { perPage: 200 }),
      fetchList<Store>("stores", { perPage: 200 }),
      fetchList<InspectionIssueRecord>("inspection_issues", { perPage: 500 }),
    ])
      .then(([taskData, employeeData, storeData, issueData]) => {
        if (cancelled) return
        setTasks(taskData.items ?? [])
        setEmployees(employeeData.items ?? [])
        setStores(storeData.items ?? [])
        setIssues(issueData.items ?? [])
      })
      .catch(() => {
        if (!cancelled) toast.error("整改任务加载失败，请稍后重试")
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
  const issueById = useMemo(() => new Map(issues.map((issue) => [issue.id, issue])), [issues])

  const rows: TaskRow[] = useMemo(() => {
    const todayText = new Date().toISOString().slice(0, 10)
    return tasks
      .map((task) => ({
        ...task,
        ownerName: employeeById.get(task.owner)?.name ?? "",
        storeName: storeById.get(task.store)?.name ?? "",
        sourceIssueType: issueById.get(task.source_issue)?.issue_type ?? "",
        isNewToday: (task.created ?? "").startsWith(todayText),
      }))
      .sort((a, b) => (b.created ?? "").localeCompare(a.created ?? ""))
  }, [tasks, employeeById, storeById, issueById])

  const stats = useMemo(() => {
    const openCount = tasks.filter((task) => task.state === "待整改" || task.state === "进行中").length
    const overdueCount = tasks.filter((task) => task.state === "逾期").length
    const doneCount = tasks.filter((task) => task.state === "已完成").length
    const completionRate = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0
    const todayText = new Date().toISOString().slice(0, 10)
    const newToday = tasks.filter((task) => (task.created ?? "").startsWith(todayText)).length
    return { openCount, overdueCount, completionRate, newToday }
  }, [tasks])

  function openCreate() {
    setDialogMode("create")
    setFollowing(null)
    setDialogOpen(true)
  }

  function openFollow(row: TaskRow) {
    setDialogMode("follow")
    setFollowing(row)
    setDialogOpen(true)
  }

  const closeDialog = useCallback(() => setDialogOpen(false), [])

  async function handleSave(values: TaskFormValues) {
    setSaving(true)
    try {
      if (dialogMode === "create") {
        await createRecord("rectify_tasks", {
          title: values.requirement.trim().slice(0, 60),
          owner: values.ownerId,
          store: employeeById.get(values.ownerId)?.store ?? "",
          source_issue: "",
          due_date: values.dueDate,
          progress: 0,
          state: "待整改",
        })
        toast.success("整改任务已派发")
      } else if (following) {
        await updateRecord("rectify_tasks", following.id, {
          due_date: values.dueDate,
          progress: values.progress,
          state: values.state,
        })
        toast.success("任务进度已更新")
      }
      setDialogOpen(false)
      await reload()
    } catch {
      toast.error("保存失败，请稍后重试")
    } finally {
      setSaving(false)
    }
  }

  return {
    employees,
    rows,
    stats,
    loading,
    saving,
    dialogOpen,
    dialogMode,
    following,
    openCreate,
    openFollow,
    closeDialog,
    handleSave,
  }
}

export type TasksProps = ReturnType<typeof useTasks>
