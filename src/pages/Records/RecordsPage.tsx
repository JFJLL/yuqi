import { Search, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RecordFilters } from "@/components/records/RecordFilters"
import { RecordTable } from "@/components/records/RecordTable"
import { RecordDetailDialog } from "@/components/records/RecordDetailDialog"
import { TaskQueueCards } from "@/components/records/TaskQueueCards"
import { AsrUploadDialog } from "@/components/records/AsrUploadDialog"
import { TablePagination } from "@/components/ui/table-pagination"
import type { RecordsProps } from "./useRecords"

// 录音转写视图：只消费 props，不自行调用数据逻辑。
export function RecordsPage({
  stores,
  employees,
  rows,
  summary,
  filters,
  loading,
  queue,
  viewing,
  uploadOpen,
  submitting,
  deleting,
  deleteBusy,
  page,
  totalPages,
  setFilters,
  setPage,
  setUploadOpen,
  openDetail,
  closeDetail,
  handleSubmitAudio,
  handleRetry,
  requestDelete,
  cancelDelete,
  confirmDelete,
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
            onRetry={(audioId) => void handleRetry(audioId)}
            onDelete={requestDelete}
          />
          <div className="flex justify-end pt-3">
            <TablePagination page={page} totalPages={totalPages} total={summary.total} onChange={setPage} />
          </div>
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
      {deleting && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={cancelDelete}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-card p-5 text-card-foreground shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              <h2 className="text-base font-semibold">删除转写记录</h2>
            </div>
            <p className="mb-1 text-sm text-muted-foreground">
              确定删除这条转写记录吗？关联的 ASR 任务会一并清理，操作不可恢复。
            </p>
            <p className="mb-4 truncate text-xs text-muted-foreground/80">
              {deleting.audio_name || deleting.summary || deleting.id}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" disabled={deleteBusy} onClick={cancelDelete}>
                取消
              </Button>
              <Button variant="destructive" size="sm" disabled={deleteBusy} onClick={() => void confirmDelete()}>
                {deleteBusy ? "删除中…" : "确认删除"}
              </Button>
            </div>
          </div>
        </div>
      )}
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
