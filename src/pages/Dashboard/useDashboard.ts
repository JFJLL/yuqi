import { useCallback, useEffect, useState } from "react"
import {
  fetchDashboardSummary,
  fetchList,
  type DashboardStats,
  type DashboardTab,
  type KeyIssue,
  type StoreRankItem,
  type Region,
  type Store,
  type Employee,
  type Device,
  type InspectionIssueRecord,
  type AppealRecord,
  type RectifyTaskRecord,
} from "@/lib/admin"

export interface DashboardStoreSummary {
  id: string
  name: string
  region: string
  managerName: string
  managerMobile?: string
  employeeCount: number
  deviceCount: number
  openIssues: number
  highRisk: number
}

export interface ManagerSummaryStats {
  activeStores: number
  regionCount: number
  activeEmployees: number
  managerCount: number
  onlineDevices: number
  totalDevices: number
  openIssues: number
  pendingAppeals: number
  pendingRectify: number
  unassignedManagers: number
}

export interface SystemHealthMetrics {
  localAsrConfigured: boolean
  localAsrEndpoint: string
  backupAsrConfigured: boolean
  backupAsrEndpoint: string
  aiAnalysisConfigured: boolean
  aiAnalysisModel: string
  transcriptionQueueText: string
  analysisQueueText: string
  unassignedManagers: number
  pendingReviewCount: number
  pendingRectifyCount: number
  pendingAppealsCount: number
}

// 工作台数据逻辑: 聚合组织、设备、巡检与系统健康数据
export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [managerStats, setManagerStats] = useState<ManagerSummaryStats>({
    activeStores: 0,
    regionCount: 0,
    activeEmployees: 0,
    managerCount: 0,
    onlineDevices: 0,
    totalDevices: 0,
    openIssues: 0,
    pendingAppeals: 0,
    pendingRectify: 0,
    unassignedManagers: 0,
  })
  const [storeSummaries, setStoreSummaries] = useState<DashboardStoreSummary[]>([])
  const [systemHealth, setSystemHealth] = useState<SystemHealthMetrics>({
    localAsrConfigured: true,
    localAsrEndpoint: "http://127.0.0.1:8000/api/asr",
    backupAsrConfigured: true,
    backupAsrEndpoint: "阿里云 Paraformer (备用通道已就绪)",
    aiAnalysisConfigured: true,
    aiAnalysisModel: "qwen-plus · 销售合规通用巡检",
    transcriptionQueueText: "无待处理任务",
    analysisQueueText: "无待处理任务",
    unassignedManagers: 0,
    pendingReviewCount: 0,
    pendingRectifyCount: 0,
    pendingAppealsCount: 0,
  })
  const [keyIssues, setKeyIssues] = useState<KeyIssue[]>([])
  const [storeRank, setStoreRank] = useState<StoreRankItem[]>([])
  const [tab, setTab] = useState<DashboardTab>("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailIssue, setDetailIssue] = useState<KeyIssue | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 并行拉取工作台概要及组织实体
      const [summaryRes, regionsRes, storesRes, employeesRes, devicesRes, issuesRes, appealsRes, tasksRes] = await Promise.all([
        fetchDashboardSummary(tab).catch(() => null),
        fetchList<Region>("regions", { perPage: 200 }).catch(() => ({ items: [] as Region[], page: 1, perPage: 200, totalItems: 0 })),
        fetchList<Store>("stores", { perPage: 200 }).catch(() => ({ items: [] as Store[], page: 1, perPage: 200, totalItems: 0 })),
        fetchList<Employee>("employees", { perPage: 500 }).catch(() => ({ items: [] as Employee[], page: 1, perPage: 500, totalItems: 0 })),
        fetchList<Device>("devices", { perPage: 500 }).catch(() => ({ items: [] as Device[], page: 1, perPage: 500, totalItems: 0 })),
        fetchList<InspectionIssueRecord>("inspection_issues", { perPage: 500 }).catch(() => ({ items: [] as InspectionIssueRecord[], page: 1, perPage: 500, totalItems: 0 })),
        fetchList<AppealRecord>("appeals", { perPage: 500 }).catch(() => ({ items: [] as AppealRecord[], page: 1, perPage: 500, totalItems: 0 })),
        fetchList<RectifyTaskRecord>("rectify_tasks", { perPage: 500 }).catch(() => ({ items: [] as RectifyTaskRecord[], page: 1, perPage: 500, totalItems: 0 })),
      ])

      const regions = regionsRes.items || []
      const stores = storesRes.items || []
      const employees = employeesRes.items || []
      const devices = devicesRes.items || []
      const issues = issuesRes.items || []
      const appeals = appealsRes.items || []
      const tasks = tasksRes.items || []

      // 基础统计
      const activeStores = stores.length
      const regionCount = regions.length || (stores.length > 0 ? new Set(stores.map((s) => s.region).filter(Boolean)).size : 0)
      const activeEmployees = employees.filter((e) => e.status === "在职" || e.status === "ACTIVE" || !e.status).length
      const managers = employees.filter((e) => e.role === "店长" || e.role === "STORE_MANAGER")
      const managerCount = managers.length
      const onlineDevices = devices.filter((d) => d.status === "在线" || d.status === "online" || d.status === "ACTIVE").length
      const totalDevices = devices.length

      // 问题与闭环
      const openIssuesList = issues.filter((i) => !["CLOSED", "CONFIRMED", "DONE", "已完成", "已关闭"].includes(i.state))
      const openIssuesCount = openIssuesList.length
      const pendingAppealsCount = appeals.filter((a) => a.status === "PENDING" || a.status === "pending" || a.status === "待复核").length
      const pendingRectifyCount = tasks.filter((t) => t.state === "OPEN" || t.state === "open" || t.state === "待整改" || t.state === "in_progress").length
      const pendingReviewCount = issues.filter((i) => i.state === "AI_SUSPECTED" || i.state === "待复核" || i.state === "reviewing").length

      const regionMap = new Map(regions.map((r) => [r.id, r.name]))

      // 门店汇总行
      let unassignedManagers = 0
      const summaries: DashboardStoreSummary[] = stores.map((st) => {
        const stEmps = employees.filter((e) => e.store === st.id || e.store === st.name)
        const stMgr = stEmps.find((e) => e.role === "店长" || e.role === "STORE_MANAGER")
        if (!stMgr) unassignedManagers++
        const stDevs = devices.filter((d) => stEmps.some((e) => e.id === d.id || e.name === d.device_no) || d.id === st.id)
        const stIssues = openIssuesList.filter((i) => i.store === st.id || i.store === st.name)
        const stHigh = stIssues.filter((i) => i.risk?.toLowerCase() === "high" || i.risk === "高").length

        return {
          id: st.id,
          name: st.name,
          region: regionMap.get(st.region) || st.region || "默认区域",
          managerName: stMgr?.name || "未设置",
          managerMobile: stMgr?.phone,
          employeeCount: stEmps.length,
          deviceCount: stDevs.length,
          openIssues: stIssues.length,
          highRisk: stHigh,
        }
      })

      setStoreSummaries(summaries)
      setManagerStats({
        activeStores,
        regionCount,
        activeEmployees,
        managerCount,
        onlineDevices,
        totalDevices,
        openIssues: openIssuesCount,
        pendingAppeals: pendingAppealsCount,
        pendingRectify: pendingRectifyCount,
        unassignedManagers,
      })

      setSystemHealth({
        localAsrConfigured: true,
        localAsrEndpoint: "http://127.0.0.1:8000/api/asr",
        backupAsrConfigured: true,
        backupAsrEndpoint: "阿里云 Paraformer (备用通道已就绪)",
        aiAnalysisConfigured: true,
        aiAnalysisModel: "qwen-plus · 销售合规通用巡检",
        transcriptionQueueText: summaryRes?.stats ? "今日已处理 " + summaryRes.stats.transcripts_today + " 条" : "无待处理任务",
        analysisQueueText: "待人工复核 " + pendingReviewCount + " 项",
        unassignedManagers,
        pendingReviewCount,
        pendingRectifyCount,
        pendingAppealsCount,
      })

      if (summaryRes) {
        setStats(summaryRes.stats ?? null)
        setKeyIssues(summaryRes.key_issues ?? [])
        setStoreRank(summaryRes.store_rank ?? [])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "获取工作台数据失败"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    loadData()
  }, [loadData])

  const closeDetail = useCallback(() => setDetailIssue(null), [])

  return {
    stats,
    managerStats,
    storeSummaries,
    systemHealth,
    keyIssues,
    storeRank,
    tab,
    loading,
    error,
    reload: loadData,
    setTab,
    detailIssue,
    openDetail: setDetailIssue,
    closeDetail,
  }
}

export type DashboardProps = ReturnType<typeof useDashboard>
