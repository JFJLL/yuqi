import { Search } from "lucide-react"
import { RecordFilters } from "@/components/records/RecordFilters"
import { RecordTable } from "@/components/records/RecordTable"
import { RecordDetailDialog } from "@/components/records/RecordDetailDialog"
import { TaskQueueCards } from "@/components/records/TaskQueueCards"
import type { RecordsProps } from "./useRecords"

// 录音转写视图: 只消费 props, 不自调逻辑 hook
export function RecordsPage({
  stores,
  employees,
  rows,
  filters,
  loading,
  queue,
  viewing,
  setFilters,
  openDetail,
  closeDetail,
  handleExport,
}: RecordsProps) {
  return (
    <div>
      <section className="bg-card border border-border rounded-lg" style={{ boxShadow: "var(--elev-ring)" }}>
        <div className="min-h-[54px] px-4 py-3.5 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-base font-semibold">录音转写</h2>
            <p className="mt-0.5 mb-0 text-muted-foreground text-xs">
              按门店、员工、设备和时间检索音频索引、转写文本和识别状态。
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-accent text-primary grid place-items-center shrink-0">
            <Search className="w-4 h-4" />
          </div>
        </div>
        <div className="p-4">
          <RecordFilters
            filters={filters}
            stores={stores}
            employees={employees}
            onChange={setFilters}
            onExport={handleExport}
          />
          <RecordTable rows={rows} loading={loading} onView={openDetail} />
        </div>
      </section>
      <TaskQueueCards
        doneCount={queue.doneCount}
        pendingCount={queue.pendingCount}
        failedCount={queue.failedCount}
        mergeCount={queue.mergeCount}
        resendCount={queue.resendCount}
      />
      <RecordDetailDialog record={viewing} onClose={closeDetail} />
    </div>
  )
}
