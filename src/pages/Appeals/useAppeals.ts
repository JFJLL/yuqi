import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  fetchList,
  updateRecord,
  type AppealRecord,
  type Employee,
  type InspectionIssueRecord,
  type Store,
  type TranscriptRecord,
} from "@/lib/admin"
import type { AppealCard } from "@/components/appeals/AppealQueue"

// 申诉复核页逻辑: 队列选择 + 通过/驳回联动问题状态 (巡检闭环终点)
export function useAppeals() {
  const [appeals, setAppeals] = useState<AppealRecord[]>([])
  const [issues, setIssues] = useState<InspectionIssueRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [transcripts, setTranscripts] = useState<TranscriptRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(false)
  const [selectedId, setSelectedId] = useState("")
  const [contextOpen, setContextOpen] = useState(false)

  const reload = useCallback(async () => {
    const [appealData, issueData] = await Promise.all([
      fetchList<AppealRecord>("appeals", { perPage: 500 }),
      fetchList<InspectionIssueRecord>("inspection_issues", { perPage: 500 }),
    ])
    setAppeals(appealData.items ?? [])
    setIssues(issueData.items ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchList<AppealRecord>("appeals", { perPage: 500 }),
      fetchList<InspectionIssueRecord>("inspection_issues", { perPage: 500 }),
      fetchList<Employee>("employees", { perPage: 200 }),
      fetchList<Store>("stores", { perPage: 200 }),
      fetchList<TranscriptRecord>("transcripts", { perPage: 500 }),
    ])
      .then(([appealData, issueData, employeeData, storeData, transcriptData]) => {
        if (cancelled) return
        setAppeals(appealData.items ?? [])
        setIssues(issueData.items ?? [])
        setEmployees(employeeData.items ?? [])
        setStores(storeData.items ?? [])
        setTranscripts(transcriptData.items ?? [])
      })
      .catch(() => {
        if (!cancelled) toast.error("申诉数据加载失败，请稍后重试")
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

  const items: AppealCard[] = useMemo(
    () =>
      appeals
        .map((appeal) => {
          const issue = issueById.get(appeal.issue)
          return {
            ...appeal,
            employeeName: issue ? employeeById.get(issue.employee)?.name ?? "" : "",
            storeName: issue ? storeById.get(issue.store)?.name ?? "" : "",
            issueType: issue?.issue_type ?? "",
          }
        })
        .sort((a, b) => (b.created ?? "").localeCompare(a.created ?? "")),
    [appeals, issueById, employeeById, storeById],
  )

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId])
  const selectedIssue = selected ? issueById.get(selected.issue) ?? null : null
  const selectedTranscript = selectedIssue ? transcripts.find((t) => t.id === selectedIssue.transcript) ?? null : null

  const review = useCallback(async (appeal: AppealCard, approve: boolean) => {
    setReviewing(true)
    try {
      await updateRecord("appeals", appeal.id, {
        status: approve ? "已通过" : "已驳回",
        reviewed_at: new Date().toISOString().slice(0, 19).replace("T", " "),
      })
      if (appeal.issue) {
        await updateRecord("inspection_issues", appeal.issue, {
          state: approve ? "已完成" : "待整改",
        })
      }
      toast.success(approve ? "申诉已通过" : "申诉已驳回")
      await reload()
    } catch {
      toast.error("复核失败，请稍后重试")
    } finally {
      setReviewing(false)
    }
  }, [reload])

  const handleApprove = useCallback((appeal: AppealCard) => review(appeal, true), [review])
  const handleReject = useCallback((appeal: AppealCard) => review(appeal, false), [review])
  const openContext = useCallback(() => setContextOpen(true), [])
  const closeContext = useCallback(() => setContextOpen(false), [])

  return {
    items,
    loading,
    reviewing,
    selected,
    selectedIssue,
    selectedTranscript,
    contextOpen,
    setSelectedId: (item: AppealCard) => setSelectedId(item.id),
    handleApprove,
    handleReject,
    openContext,
    closeContext,
  }
}

export type AppealsProps = ReturnType<typeof useAppeals>
