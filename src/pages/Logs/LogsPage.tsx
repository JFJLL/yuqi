import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LogFilters } from "@/components/logs/LogFilters"
import { LogTable, LogDetailDialog } from "@/components/logs/LogTable"
import type { LogsProps } from "./useLogs"

// 接口日志视图: 只消费 props, 不自调逻辑 hook
export function LogsPage({
  rows,
  filters,
  loading,
  retrying,
  detail,
  setFilters,
  handleRetry,
  handleExport,
  openDetail,
  closeDetail,
}: LogsProps) {
  return (
    <section className="bg-card border border-border rounded-lg" style={{ boxShadow: "var(--elev-ring)" }}>
      <div className="min-h-[54px] px-4 py-3.5 border-b border-border flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-base font-semibold">接口与同步日志</h2>
          <p className="mt-0.5 mb-0 text-muted-foreground text-xs">
            查看转写推送、文本同步、重试和申诉片段调取记录。
          </p>
        </div>
        <Button
          size="sm"
          className="h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:shadow-[var(--focus-ring)]"
          disabled={retrying}
          onClick={handleRetry}
        >
          <RefreshCw className="w-4 h-4" />
          {retrying ? "重试中…" : "重试失败项"}
        </Button>
      </div>
      <div className="p-4">
        <LogFilters filters={filters} onChange={setFilters} onExport={handleExport} />
        <LogTable rows={rows} loading={loading} onDetail={openDetail} />
      </div>
      <LogDetailDialog log={detail} onClose={closeDetail} />
    </section>
  )
}
