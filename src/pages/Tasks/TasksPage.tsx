import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TaskStats } from "@/components/tasks/TaskStats"
import { TaskTable } from "@/components/tasks/TaskTable"
import { TaskDialog } from "@/components/tasks/TaskDialog"
import type { TasksProps } from "./useTasks"

// 整改任务视图: 只消费 props, 不自调逻辑 hook
export function TasksPage({
  employees,
  rows,
  stats,
  loading,
  saving,
  dialogOpen,
  dialogMode,
  following,
  openCreate,
  openFollow,
  closeDialog,
  handleSave,
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
            <p className="mt-0.5 mb-0 text-muted-foreground text-xs">按员工、门店和问题类型跟进整改闭环。</p>
          </div>
          <Button
            size="sm"
            className="h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:shadow-[var(--focus-ring)]"
            onClick={openCreate}
          >
            <Plus className="w-4 h-4" />
            派发任务
          </Button>
        </div>
        <div className="p-4">
          <TaskTable rows={rows} loading={loading} onFollowUp={openFollow} />
        </div>
      </section>
      <TaskDialog
        open={dialogOpen}
        mode={dialogMode}
        task={following}
        employees={employees}
        saving={saving}
        onCancel={closeDialog}
        onSave={handleSave}
      />
    </div>
  )
}
