import { ReportCards } from "@/components/reports/ReportCards"
import { RegionTable } from "@/components/reports/RegionTable"
import { ReportDialog } from "@/components/reports/ReportDialog"
import type { ReportsProps } from "./useReports"

// 统计报表视图: 只消费 props, 不自调逻辑 hook
export function ReportsPage({ regionRows, reports, loading, viewing, openReport, closeReport }: ReportsProps) {
  return (
    <div>
      <div className="h-1 w-12 rounded-full bg-primary mb-3" aria-hidden />
      <div className="rounded-lg hover:shadow-md transition-shadow" style={{ boxShadow: "var(--elev-ring)" }}>
        <ReportCards reports={reports} onView={openReport} />
      </div>
      <RegionTable rows={regionRows} loading={loading} />
      <ReportDialog report={viewing} onClose={closeReport} />
    </div>
  )
}
