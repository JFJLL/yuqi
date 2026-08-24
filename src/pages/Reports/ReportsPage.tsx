import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ReportCards } from "@/components/reports/ReportCards"
import { RegionTable } from "@/components/reports/RegionTable"
import { ReportDialog } from "@/components/reports/ReportDialog"
import type { ReportsProps } from "./useReports"

// 统计报表视图: 只消费 props, 不自调逻辑 hook
export function ReportsPage({
  regionRows,
  reports,
  loading,
  exporting,
  viewing,
  openReport,
  closeReport,
  handleExport,
}: ReportsProps) {
  return (
    <div>
      <div className="h-1 w-12 rounded-full bg-primary mb-3" aria-hidden />
      <div className="rounded-lg hover:shadow-md transition-shadow" style={{ boxShadow: "var(--elev-ring)" }}>
        <ReportCards reports={reports} onView={openReport} />
      </div>
      <RegionTable rows={regionRows} loading={loading} />
      <div className="mt-3.5 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          disabled={exporting}
          onClick={() => void handleExport()}
        >
          <Download className="w-4 h-4" />
          {exporting ? "导出中…" : "导出报表 (水印 CSV)"}
        </Button>
      </div>
      <ReportDialog report={viewing} onClose={closeReport} />
    </div>
  )
}
