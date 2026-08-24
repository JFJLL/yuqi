import { ListChecks } from "lucide-react"
import { LogFilters } from "@/components/logs/LogFilters"
import { LogTable, LogDetailDialog } from "@/components/logs/LogTable"
import { TablePagination } from "@/components/ui/table-pagination"
import type { LogsProps } from "./useLogs"

// 审计日志视图: 只消费 props, 不自调逻辑 hook
export function LogsPage({
  rows,
  filters,
  loading,
  detail,
  page,
  total,
  totalPages,
  setFilters,
  setPage,
  handleExport,
  openDetail,
  closeDetail,
}: LogsProps) {
  return (
    <section className="bg-card border border-border rounded-lg" style={{ boxShadow: "var(--elev-ring)" }}>
      <div className="min-h-[54px] px-4 py-3.5 border-b border-border flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-base font-semibold">接口与审计日志</h2>
          <p className="mt-0.5 mb-0 text-muted-foreground text-xs">
            查看设备绑定、录音上传、转写编辑、复核与整改等敏感操作的审计留痕。
          </p>
        </div>
        <div className="w-9 h-9 rounded-full bg-accent text-primary grid place-items-center shrink-0">
          <ListChecks className="w-4 h-4" />
        </div>
      </div>
      <div className="p-4">
        <LogFilters filters={filters} onChange={setFilters} onExport={handleExport} />
        <LogTable rows={rows} loading={loading} onDetail={openDetail} />
        <TablePagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
      </div>
      <LogDetailDialog log={detail} onClose={closeDetail} />
    </section>
  )
}
