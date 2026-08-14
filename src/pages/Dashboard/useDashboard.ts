import { useCallback, useEffect, useState } from "react"
import {
  fetchDashboardSummary,
  type DashboardStats,
  type DashboardTab,
  type KeyIssue,
  type StoreRankItem,
} from "@/lib/admin"

// 工作台数据逻辑: 按 tab 拉聚合数据, 管理问题详情弹窗状态
export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [keyIssues, setKeyIssues] = useState<KeyIssue[]>([])
  const [storeRank, setStoreRank] = useState<StoreRankItem[]>([])
  const [tab, setTab] = useState<DashboardTab>("all")
  const [loading, setLoading] = useState(true)
  const [detailIssue, setDetailIssue] = useState<KeyIssue | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchDashboardSummary(tab)
      .then((data) => {
        if (cancelled) return
        setStats(data.stats ?? null)
        setKeyIssues(data.key_issues ?? [])
        setStoreRank(data.store_rank ?? [])
      })
      .catch(() => {
        if (cancelled) return
        setStats(null)
        setKeyIssues([])
        setStoreRank([])
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
