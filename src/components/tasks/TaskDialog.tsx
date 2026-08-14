import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { Employee } from "@/lib/admin"
import type { TaskRow } from "./TaskTable"

export interface TaskFormValues {
  ownerId: string
  dueDate: string
  requirement: string
  progress: number
  state: string
}

export const TASK_STATE_OPTIONS = ["待整改", "进行中", "逾期", "已完成"]

interface TaskDialogProps {
  open: boolean
  mode: "create" | "follow"
  task: TaskRow | null
  employees: Employee[]
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

export function TaskDialog({ open, mode, task, employees, saving, onCancel, onSave }: TaskDialogProps) {
  const [values, setValues] = useState<TaskFormValues>({
    ownerId: "",
    dueDate: duePlus3(),
    requirement: "",
    progress: 0,
    state: "待整改",
  })

  useEffect(() => {
    if (!open) return
    if (mode === "follow" && task) {
      setValues({
        ownerId: task.owner,
        dueDate: task.due_date ? task.due_date.slice(0, 10) : duePlus3(),
        requirement: task.title,
        progress: task.progress ?? 0,
        state: task.state,
      })
    } else {
      setValues({
        ownerId: employees[0]?.id ?? "",
        dueDate: duePlus3(),
        requirement: "",
        progress: 0,
        state: "待整改",
      })
    }
  }, [open, mode, task, employees])

  const canSave = mode === "follow" ? true : values.ownerId.length > 0 && values.requirement.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "派发整改任务" : "跟进整改任务"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs">负责人</label>
            {mode === "create" ? (
              <select
                className={fieldClass}
                value={values.ownerId}
                onChange={(e) => setValues((prev) => ({ ...prev, ownerId: e.target.value }))}
              >
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            ) : (
              <input className={fieldClass} value={task?.ownerName ?? "-"} disabled />
            )}
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
          <div className="grid gap-1.5 col-span-2 max-sm:col-span-1">
            <label className="text-muted-foreground text-xs">{mode === "create" ? "整改要求" : "任务内容"}</label>
            <textarea
              className={`${fieldClass} min-h-[88px] py-2 resize-y`}
              disabled={mode === "follow"}
              value={values.requirement}
              onChange={(e) => setValues((prev) => ({ ...prev, requirement: e.target.value }))}
            />
          </div>
          {mode === "follow" && (
            <>
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
              <div className="grid gap-1.5">
                <label className="text-muted-foreground text-xs">状态</label>
                <select
                  className={fieldClass}
                  value={values.state}
                  onChange={(e) => setValues((prev) => ({ ...prev, state: e.target.value }))}
                >
                  {TASK_STATE_OPTIONS.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!canSave || saving}
            onClick={() => onSave(values)}
          >
            {saving ? "保存中…" : mode === "create" ? "派发" : "更新"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
