import { Search, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RecordFilters } from "@/components/records/RecordFilters"
import { RecordTable } from "@/components/records/RecordTable"
import { RecordDetailDialog } from "@/components/records/RecordDetailDialog"
import { TaskQueueCards } from "@/components/records/TaskQueueCards"
import { AsrUploadDialog } from "@/components/records/AsrUploadDialog"
import type { RecordsProps } from "./useRecords"

// 录音转写视图：只消费 props，不自行调用数据逻辑。
export function RecordsPage({
  stores,
  employees,
  rows,
  asrJobs,
  filters,
  loading,
  queue,
  viewing,
  uploadOpen,
  submitting,
  setFilters,
  setUploadOpen,
  openDetail,
  closeDetail,
  handleSubmitAudio,
  handleRetry,
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
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" className="gap-1.5" onClick={() => setUploadOpen(true)}>
              <Upload className="w-4 h-4" />
              上传录音
            </Button>
            <div className="w-9 h-9 rounded-full bg-accent text-primary grid place-items-center">
              <Search className="w-4 h-4" />
            </div>
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
          <RecordTable
            rows={rows}
            loading={loading}
            onView={openDetail}
            onRetry={(jobId) => {
              const job = asrJobs.find((item) => item.id === jobId)
              if (job) void handleRetry(job)
            }}
          />
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
      <AsrUploadDialog
        open={uploadOpen}
        stores={stores}
        employees={employees}
        submitting={submitting}
        onOpenChange={setUploadOpen}
        onSubmit={handleSubmitAudio}
      />
    </div>
  )
}
