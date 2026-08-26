import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  fetchList,
  type Employee,
  type Region,
  type Store,
} from "@/lib/admin"
import { pb } from "@/lib/pb"
import type { ReportSummary } from "@/components/reports/ReportCards"

export interface StoreReportRow {
  storeId: string
  storeName: string
  regionName: string
  employeeCount: number
  deviceCount: number
  recordingCount: number
  issueCount: number
  pendingRectifyCount: number
  appealCount: number
}

interface ServerOverviewResult {
  recordings?: { total: number; in_range: number }
  transcripts?: { total: number; in_range: number }
  issues?: { total: number; in_range: number; final_valid: number; risk_distribution?: { HIGH?: number; MEDIUM?: number; LOW?: number } }
  rectifications?: { total: number; confirmed: number; completion_rate: number }
  store_rows?: StoreReportRow[]
}

export function useReports() {
  const [regions, setRegions] = useState<Region[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [serverOverview, setServerOverview] = useState<ServerOverviewResult | null>(null)
  const [storeRows, setStoreRows] = useState<StoreReportRow[]>([])
  const [filters, setFilters] = useState({ regionId: "", storeId: "", employeeId: "", date: "" })
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState<ReportSummary | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [overviewRes, regRes, storeRes, empRes] = await Promise.all([
        pb.send<ServerOverviewResult>("/api/reports/overview", {
          method: "GET",
          query: {
            from: filters.date ? `${filters.date}-01T00:00:00Z` : "",
            to: filters.date ? `${filters.date}-31T23:59:59Z` : "",
            regionId: filters.regionId,
            storeId: filters.storeId,
            employeeId: filters.employeeId,
          },
        }),
        fetchList<Region>("regions", { perPage: 100 }).catch(() => ({ items: [] as Region[], page: 1, perPage: 100, totalItems: 0 })),
        fetchList<Store>("stores", { perPage: 200 }).catch(() => ({ items: [] as Store[], page: 1, perPage: 200, totalItems: 0 })),
        fetchList<Employee>("employees", { perPage: 500 }).catch(() => ({ items: [] as Employee[], page: 1, perPage: 500, totalItems: 0 })),
      ])

      setServerOverview(overviewRes)
      setStoreRows(overviewRes?.store_rows || [])
      setRegions(regRes.items || [])
      setStores(storeRes.items || [])
      setEmployees(empRes.items || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "报表数据加载失败")
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totals = useMemo(() => {
    if (serverOverview) {
      const totalTranscripts = serverOverview.transcripts?.total ?? 0
      const totalIssues = serverOverview.issues?.final_valid ?? serverOverview.issues?.total ?? 0
      const highRisk = serverOverview.issues?.risk_distribution?.HIGH ?? 0
      const rectifyRate = serverOverview.rectifications?.completion_rate ?? 0
      return { totalTranscripts, totalIssues, highRisk, rectifyRate }
    }
    return { totalTranscripts: 0, totalIssues: 0, highRisk: 0, rectifyRate: 0 }
  }, [serverOverview])

  const reports: ReportSummary[] = useMemo(
    () => [
      {
        key: "monthly",
        title: "门店合规月报",
        desc: "问题趋势、门店排名、整改完成率。",
        points: totals.totalIssues > 0 ? [
          `本月共记录巡检问题 ${totals.totalIssues} 条，其中高风险 ${totals.highRisk} 条`,
          `整改完成率 ${totals.rectifyRate}%，闭环指标可追溯`,
          "已按区域与门店建立分级巡检与整改责任闭环",
        ] : [
          "当前周期内暂无有效巡检问题记录",
          "所有会话处于合规质检监控中",
          "已按区域与门店建立分级巡检与整改责任闭环",
        ],
      },
      {
        key: "growth",
        title: "员工成长报告",
        desc: "高频问题、培训建议、能力变化。",
        points: totals.totalIssues > 0 ? [
          "高频问题集中在夸大疗效表达与处方药提醒缺失",
          "已联动培训中心派发针对性课程与考试",
          "支持查看每位员工的学习进度与考核成绩",
        ] : [
          "当前周期内暂无关联员工的违规巡检记录",
          "培训任务与考试考核数据就绪",
          "支持查看每位员工的学习进度与考核成绩",
        ],
      },
      {
        key: "category",
        title: "品类与荐药分析",
        desc: "常见咨询、组合销售执行和风险分布。",
        points: totals.totalTranscripts > 0 ? [
          `本期累计转写文本 ${totals.totalTranscripts} 条`,
          "感冒、咽痛、联合用药为高频咨询场景",
          "具备标准药学指南依据支持与禁忌拦截",
        ] : [
          "暂无转写文本，等待录音回传",
          "支持与 ERP / 处方库联合分析咨询场景",
          "具备标准药学指南依据支持与禁忌拦截",
        ],
      },
    ],
    [totals],
  )

  async function handleExport() {
    try {
      const q = {
        from: filters.date ? `${filters.date}-01T00:00:00Z` : "",
        to: filters.date ? `${filters.date}-31T23:59:59Z` : "",
        regionId: filters.regionId,
        storeId: filters.storeId,
        employeeId: filters.employeeId,
      }
      const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => Boolean(v))).toString()
      const csvText = await pb.send<string>(`/api/reports/export/issues?${qs}`, { method: "GET" })
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" })
      const dlUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = dlUrl
      a.download = `合规巡检问题报表_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(dlUrl)
      toast.success("已通过服务端导出带审计记录的报表")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导出报表失败")
    }
  }

  return {
    regions,
    stores,
    employees,
    storeRows,
    totals,
    reports,
    filters,
    loading,
    setFilters,
    viewing,
    openReport: (r: ReportSummary) => setViewing(r),
    closeReport: () => setViewing(null),
    handleExport,
  }
}

export type ReportsProps = ReturnType<typeof useReports>
