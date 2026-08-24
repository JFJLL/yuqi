import { ClipboardCheck } from "lucide-react"
import { TaskStats } from "@/components/tasks/TaskStats"
import { TaskTable } from "@/components/tasks/TaskTable"
import { TaskDialog } from "@/components/tasks/TaskDialog"
import { TablePagination } from "@/components/ui/table-pagination"
import { ConfirmDialog } from "@/components/tasks/ConfirmDialog"
import type { TasksProps } from "./useTasks"

// 整改任务视图: 跟进 + 确认员工提交
export function TasksPage({
  rows,
  stats,
  loading,
  saving,
  dialogOpen,
  following,
  confirming,
  confirmBusy,
  confirmComment,
  setConfirmComment,
  page,
  total,
  totalPages,
  statusFilter,
  setStatusFilter,
  setPage,
  openFollow,
  closeDialog,
  handleSave,
  openConfirm,
  closeConfirm,
  handleConfirm,
}: TasksProps) {
  return (
    <div>
      <TaskStats
        openCount={stats.openCount}
        newToday={stats.newToday}
        overdueCount={stats.overdueCount}
        completionRate={stats.completionRate}
      />
      <section className="bg-card border border-border rounded-lg mt-3.5" style={{ boxShadow: "var(--elev-ring)" }}>
        <div className="min-h-[54px] px-4 py-3.5 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-base font-semibold">整改任务</h2>
            <p className="mt-0.5 mb-0 text-muted-foreground text-xs">
              跟进整改闭环：确认员工提交、调整截止日期与进度。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="min-h-9 border border-border rounded-lg bg-card text-foreground outline-none px-2.5 text-sm focus:border-primary"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="按状态筛选"
            >
              <option value="">全部状态</option>
              <option value="PENDING">待整改</option>
              <option value="SUBMITTED">待确认</option>
              <option value="CONFIRMED">已完成</option>
              <option value="REJECTED">已驳回</option>
            </select>
            <div className="w-9 h-9 rounded-full bg-accent text-primary grid place-items-center">
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div className="p-4">
          <TaskTable rows={rows} loading={loading} onFollowUp={openFollow} onConfirm={openConfirm} />
          <TablePagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      </section>
      <TaskDialog open={dialogOpen} task={following} saving={saving} onCancel={closeDialog} onSave={handleSave} />
      {confirming && (
        <ConfirmDialog
          task={confirming}
          busy={confirmBusy}
          comment={confirmComment}
          onCommentChange={setConfirmComment}
          onClose={closeConfirm}
          onConfirm={(approve: boolean) => void handleConfirm(approve)}
        />
      )}
    </div>
  )
}
