import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  fetchDashboardSummary,
  type DashboardKeyIssue,
  type DashboardStats,
  type DashboardStoreRankItem,
  type DashboardTab,
} from "@/lib/v1"

// 工作台数据逻辑: 按 tab 拉聚合数据, 管理问题详情弹窗状态
export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [keyIssues, setKeyIssues] = useState<DashboardKeyIssue[]>([])
  const [storeRank, setStoreRank] = useState<DashboardStoreRankItem[]>([])
  const [tab, setTab] = useState<DashboardTab>("all")
  const [loading, setLoading] = useState(true)
  const [detailIssue, setDetailIssue] = useState<DashboardKeyIssue | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchDashboardSummary(tab)
      .then((data) => {
        if (cancelled) return
        setStats(data.stats)
        setKeyIssues(data.key_issues)
        setStoreRank(data.store_rank)
      })
      .catch(() => {
        if (cancelled) return
        setStats(null)
        setKeyIssues([])
        setStoreRank([])
        toast.error("工作台数据加载失败，请稍后重试")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab])

  const closeDetail = useCallback(() => setDetailIssue(null), [])

  return {
    stats,
    keyIssues,
    storeRank,
    tab,
    loading,
    setTab,
    detailIssue,
    openDetail: setDetailIssue,
    closeDetail,
  }
}

export type DashboardProps = ReturnType<typeof useDashboard>
