import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { fetchAppeals, reviewAppeal, type AppealItem } from "@/lib/v1"

// 申诉复核页逻辑: 服务端分页队列 + 通过/驳回联动问题状态 (巡检闭环终点)
export function useAppeals() {
  const [items, setItems] = useState<AppealItem[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(false)
  const [selectedId, setSelectedId] = useState("")
  const [contextOpen, setContextOpen] = useState(false)
  const [status, setStatus] = useState("APPEALING")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const reload = useCallback(async () => {
    try {
      const data = await fetchAppeals({ page, page_size: 20, status })
      setItems(data.items)
      setTotal(data.total)
      setTotalPages(data.total_pages)
      // 若选中项已不在当前页, 清除选中
      setSelectedId((cur) => (data.items.some((item) => item.id === cur) ? cur : ""))
    } catch {
      toast.error("申诉队列加载失败，请稍后重试")
    }
  }, [page, status])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchAppeals({ page, page_size: 20, status })
      .then((data) => {
        if (cancelled) return
        setItems(data.items)
        setTotal(data.total)
        setTotalPages(data.total_pages)
        setSelectedId((cur) => (data.items.some((item) => item.id === cur) ? cur : ""))
      })
      .catch(() => {
        if (!cancelled) toast.error("申诉队列加载失败，请稍后重试")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, status])

  const changeStatus = useCallback(
    (next: string) => {
      setStatus(next)
      setPage(1)
      setSelectedId("")
    },
    [],
  )

  const changePage = useCallback((next: number) => setPage(next), [])

  const selected = items.find((item) => item.id === selectedId) ?? null

  const review = useCallback(
    async (appeal: AppealItem, approve: boolean) => {
      setReviewing(true)
      try {
        await reviewAppeal(appeal.id, { approve })
        toast.success(approve ? "申诉已通过" : "申诉已驳回")
        await reload()
      } catch {
        toast.error("复核失败，请稍后重试")
      } finally {
        setReviewing(false)
      }
    },
    [reload],
  )

  const handleApprove = useCallback((appeal: AppealItem) => review(appeal, true), [review])
  const handleReject = useCallback((appeal: AppealItem) => review(appeal, false), [review])
  const openContext = useCallback(() => setContextOpen(true), [])
  const closeContext = useCallback(() => setContextOpen(false), [])

  return {
    items,
    loading,
    reviewing,
    selected,
    status,
    page,
    total,
    totalPages,
    contextOpen,
    setSelectedId: (item: AppealItem) => setSelectedId(item.id),
    changeStatus,
    changePage,
    handleApprove,
    handleReject,
    openContext,
    closeContext,
  }
}

export type AppealsProps = ReturnType<typeof useAppeals>
