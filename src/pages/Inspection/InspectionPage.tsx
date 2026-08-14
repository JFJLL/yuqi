import { ShieldAlert } from "lucide-react"
import { IssueFilters } from "@/components/inspection/IssueFilters"
import { IssueTable } from "@/components/inspection/IssueTable"
import { IssueDetailDialog } from "@/components/inspection/IssueDetailDialog"
import type { InspectionProps } from "./useInspection"

const TABS: { key: InspectionProps["tab"]; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "high", label: "高风险" },
  { key: "appealing", label: "申诉中" },
]

// 合规巡检视图: 只消费 props, 不自调逻辑 hook
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
  handleExport,
}: InspectionProps) {
  return (
    <section className="bg-card border border-border rounded-lg" style={{ boxShadow: "var(--elev-ring)" }}>
      <div className="min-h-[54px] px-4 py-3.5 border-b border-border flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-base font-semibold">合规巡检</h2>
          <p className="mt-0.5 mb-0 text-muted-foreground text-xs">查看 AI 识别的问题、命中文本、风险等级和整改建议。</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-grid grid-flow-col gap-1 p-1 border border-border rounded-lg bg-background">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`min-h-[30px] border-0 rounded-md px-3 text-sm cursor-pointer transition-colors ${
                  tab === item.key
                    ? "bg-card text-primary shadow-sm"
                    : "bg-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="w-9 h-9 rounded-full bg-accent text-primary grid place-items-center shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
      </div>
      <div className="p-4">
        <IssueFilters filters={filters} typeOptions={typeOptions} onChange={setFilters} onExport={handleExport} />
        <IssueTable rows={rows} loading={loading} onDetail={openDetail} />
      </div>
      <IssueDetailDialog issue={detail} pushing={pushing} onClose={closeDetail} onPushRectify={pushRectify} />
    </section>
  )
}
