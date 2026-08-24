import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { TaskRow } from "./TaskTable"

export interface TaskFormValues {
  dueDate: string
  progress: number
}

interface TaskDialogProps {
  open: boolean
  task: TaskRow | null
  saving: boolean
  onCancel: () => void
  onSave: (values: TaskFormValues) => void
}

const fieldClass =
  "min-h-9 w-full border border-border rounded-lg bg-card text-foreground outline-none px-2.5 text-sm focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"

function duePlus3(): string {
  const due = new Date(Date.now() + 3 * 24 * 3600 * 1000)
  return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`
}

// 跟进整改任务: 调整截止日期与进度
export function TaskDialog({ open, task, saving, onCancel, onSave }: TaskDialogProps) {
  const [values, setValues] = useState<TaskFormValues>({
    dueDate: duePlus3(),
    progress: 0,
  })

  useEffect(() => {
    if (!open || !task) return
    setValues({
      dueDate: task.due_date ? task.due_date.slice(0, 10) : duePlus3(),
      progress: task.progress ?? 0,
    })
  }, [open, task])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>跟进整改任务</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs">任务内容</label>
            <textarea className={`${fieldClass} min-h-[72px] py-2 resize-y`} value={task?.title ?? ""} disabled />
          </div>
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs">截止日期</label>
            <input
              type="date"
              className={fieldClass}
              value={values.dueDate}
              onChange={(e) => setValues((prev) => ({ ...prev, dueDate: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs">进度（{values.progress}%）</label>
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={values.progress}
              onChange={(e) => setValues((prev) => ({ ...prev, progress: Number(e.target.value) }))}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={() => onSave(values)}
          >
            {saving ? "保存中…" : "更新"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
