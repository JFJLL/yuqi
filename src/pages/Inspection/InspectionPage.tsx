import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IssueFilters } from "@/components/inspection/IssueFilters"
import { IssueTable } from "@/components/inspection/IssueTable"
import { IssueDetailDialog } from "@/components/inspection/IssueDetailDialog"
import type { InspectionProps } from "./useInspection"

const TABS: { key: InspectionProps["tab"]; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "high", label: "高风险" },
  { key: "appealing", label: "申诉中" },
]

export function InspectionPage({
  rows,
  filters,
  tab,
  loading,
  pushing,
  detail,
  typeOptions,
  setFilters,
  setTab,
  openDetail,
  closeDetail,
  pushRectify,
  handleDismissIssue,
  handleCloseIssue,
  handleExport,
}: InspectionProps) {
  return (
    <section className="bg-card border border-border rounded-lg" style={{ boxShadow: "var(--elev-ring)" }}>
      <div className="min-h-[54px] px-4 py-3.5 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="m-0 text-base font-bold text-[#172033]">通用 AI 巡检结果</h2>
          <p className="mt-0.5 mb-0 text-[#65738a] text-xs">查看风险问题、命中文本与整改状态。</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-grid grid-flow-col gap-1 p-0.5 border border-[#dbe3ec] rounded-[6px] bg-[#f8fafc]">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`h-7 border-0 rounded-[4px] px-2.5 text-xs cursor-pointer transition-colors ${
                  tab === item.key
                    ? "bg-white text-[#1672a8] font-semibold shadow-xs"
                    : "bg-transparent text-[#65738a] hover:text-[#172033]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-8 gap-1 bg-white border-[#dbe3ec] text-[#172033] text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            导出问题
          </Button>
        </div>
      </div>
      <div className="p-4">
        <IssueFilters filters={filters} typeOptions={typeOptions} onChange={setFilters} onExport={handleExport} />
        <IssueTable rows={rows} loading={loading} onDetail={openDetail} />
      </div>
      <IssueDetailDialog
        issue={detail}
        pushing={pushing}
        onClose={closeDetail}
        onPushRectify={pushRectify}
        onDismiss={handleDismissIssue}
        onCloseIssue={handleCloseIssue}
      />
    </section>
  )
}
