import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  exportReportCsv,
  fetchReportOverview,
  fetchReportRegions,
  type RegionReportItem,
  type ReportOverview,
} from "@/lib/v1"
import type { ReportSummary } from "@/components/reports/ReportCards"
import type { RegionRow } from "@/components/reports/RegionTable"

const EMPTY_OVERVIEW: ReportOverview = {
  issues_total: 0,
  high_risk: 0,
  issues_today: 0,
  rectify_rate: 0,
  rectify_total: 0,
  overdue_tasks: 0,
  recordings_total: 0,
  transcripts_total: 0,
  pending_appeals: 0,
  stores_total: 0,
}

// 统计报表页逻辑: 服务端聚合 (租户总览 + 区域维度)
export function useReports() {
  const [overview, setOverview] = useState<ReportOverview>(EMPTY_OVERVIEW)
  const [regions, setRegions] = useState<RegionReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [viewing, setViewing] = useState<ReportSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchReportOverview(), fetchReportRegions()])
      .then(([overviewData, regionData]) => {
        if (cancelled) return
        setOverview(overviewData)
        setRegions(regionData.items)
      })
      .catch(() => {
        if (!cancelled) toast.error("报表数据加载失败，请稍后重试")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const regionRows: RegionRow[] = useMemo(
    () =>
      regions.map((region) => ({
        regionId: region.region_id,
        regionName: region.region_name,
        storeCount: region.store_count,
        recordingCount: region.recording_count,
        issueCount: region.issue_count,
        highRisk: region.high_risk,
        rectifyRate: region.rectify_rate,
        appealPassRate: region.appeal_pass_rate,
      })),
    [regions],
  )

  const reports: ReportSummary[] = useMemo(
    () => [
      {
        key: "monthly",
        title: "门店合规月报",
        desc: "问题趋势、门店排名、整改完成率。",
        points: [
          `本月共记录巡检问题 ${overview.issues_total} 条，其中高风险 ${overview.high_risk} 条（今日新增 ${overview.issues_today} 条）`,
          `整改完成率 ${overview.rectify_rate}%，目标 80%（共 ${overview.rectify_total} 项整改任务，逾期 ${overview.overdue_tasks} 项）`,
          `待复核申诉 ${overview.pending_appeals} 条，建议优先处理`,
        ],
      },
      {
        key: "growth",
        title: "员工成长报告",
        desc: "高频问题、培训建议、能力变化。",
        points: [
          "高频问题集中在夸大疗效表达与处方药提醒缺失",
          "建议对高风险问题员工安排话术替换练习",
          "培训考核模块建设中，后续将自动关联课程",
        ],
      },
      {
        key: "category",
        title: "品类服务分析",
        desc: "常见咨询、组合销售执行和风险分布。",
        points: [
          `累计录音 ${overview.recordings_total} 条，转写完成 ${overview.transcripts_total} 条`,
          `覆盖门店 ${overview.stores_total} 家`,
          "AI荐药经营模块建设中，品类数据后续接入",
        ],
      },
    ],
    [overview],
  )

  const openReport = useCallback((report: ReportSummary) => setViewing(report), [])
  const closeReport = useCallback(() => setViewing(null), [])

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      await exportReportCsv()
      toast.success("报表已导出 (服务端水印 CSV, 已留审计)")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出失败，请稍后重试")
    } finally {
      setExporting(false)
    }
  }, [])

  return { regionRows, reports, loading, exporting, viewing, openReport, closeReport, handleExport }
}

export type ReportsProps = ReturnType<typeof useReports>
