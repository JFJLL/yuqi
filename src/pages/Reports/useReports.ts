import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  fetchList,
  type AppealRecord,
  type InspectionIssueRecord,
  type RectifyTaskRecord,
  type Region,
  type Store,
  type TranscriptRecord,
} from "@/lib/admin"
import type { ReportSummary } from "@/components/reports/ReportCards"
import type { RegionRow } from "@/components/reports/RegionTable"

// 统计报表页逻辑: 按区域聚合巡检与整改数据
export function useReports() {
  const [regions, setRegions] = useState<Region[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [transcripts, setTranscripts] = useState<TranscriptRecord[]>([])
  const [issues, setIssues] = useState<InspectionIssueRecord[]>([])
  const [tasks, setTasks] = useState<RectifyTaskRecord[]>([])
  const [appeals, setAppeals] = useState<AppealRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState<ReportSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchList<Region>("regions", { perPage: 100 }),
      fetchList<Store>("stores", { perPage: 200 }),
      fetchList<TranscriptRecord>("transcripts", { perPage: 500 }),
      fetchList<InspectionIssueRecord>("inspection_issues", { perPage: 500 }),
      fetchList<RectifyTaskRecord>("rectify_tasks", { perPage: 500 }),
      fetchList<AppealRecord>("appeals", { perPage: 500 }),
    ])
      .then(([regionData, storeData, transcriptData, issueData, taskData, appealData]) => {
        if (cancelled) return
        setRegions(regionData.items ?? [])
        setStores(storeData.items ?? [])
        setTranscripts(transcriptData.items ?? [])
        setIssues(issueData.items ?? [])
        setTasks(taskData.items ?? [])
        setAppeals(appealData.items ?? [])
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

  const regionRows: RegionRow[] = useMemo(() => {
    return regions.map((region) => {
      const regionStores = new Set(stores.filter((store) => store.region === region.id).map((store) => store.id))
      const regionTranscripts = transcripts.filter((t) => regionStores.has(t.store))
      const regionIssues = issues.filter((issue) => regionStores.has(issue.store))
      const regionTasks = tasks.filter((task) => regionStores.has(task.store))
      const highRisk = regionIssues.filter((issue) => issue.risk === "高").length
      const doneTasks = regionTasks.filter((task) => task.state === "已完成").length
      const rectifyRate = regionTasks.length ? Math.round((doneTasks / regionTasks.length) * 100) : 0
      const issueIds = new Set(regionIssues.map((issue) => issue.id))
      const regionAppeals = appeals.filter((appeal) => issueIds.has(appeal.issue))
      const passedAppeals = regionAppeals.filter((appeal) => appeal.status === "已通过").length
      const reviewedAppeals = regionAppeals.filter((appeal) => appeal.status !== "待复核").length
      const appealPassRate = reviewedAppeals ? Math.round((passedAppeals / reviewedAppeals) * 100) : 0
      return {
        regionId: region.id,
        regionName: region.name,
        storeCount: regionStores.size,
        transcriptCount: regionTranscripts.length,
        issueCount: regionIssues.length,
        highRisk,
        rectifyRate,
        appealPassRate,
      }
    })
  }, [regions, stores, transcripts, issues, tasks, appeals])

  const totals = useMemo(() => {
    const highRisk = issues.filter((issue) => issue.risk === "高").length
    const doneTasks = tasks.filter((task) => task.state === "已完成").length
    const rectifyRate = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0
    return { highRisk, rectifyRate, issueCount: issues.length, transcriptCount: transcripts.length }
  }, [issues, tasks, transcripts])

  const reports: ReportSummary[] = useMemo(
    () => [
      {
        key: "monthly",
        title: "门店合规月报",
        desc: "问题趋势、门店排名、整改完成率。",
        points: [
          `本月共记录巡检问题 ${totals.issueCount} 条，其中高风险 ${totals.highRisk} 条`,
          `整改完成率 ${totals.rectifyRate}%，目标 80%`,
          `问题最多的门店排在门店排行首位，建议优先复盘`,
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
          `本期累计转写文本 ${totals.transcriptCount} 条`,
          "感冒、咽痛、联合用药为高频咨询场景",
          "AI荐药经营模块建设中，品类数据后续接入",
        ],
      },
    ],
    [totals],
  )

  const openReport = useCallback((report: ReportSummary) => setViewing(report), [])
  const closeReport = useCallback(() => setViewing(null), [])

  return { regionRows, reports, loading, viewing, openReport, closeReport }
}

export type ReportsProps = ReturnType<typeof useReports>
