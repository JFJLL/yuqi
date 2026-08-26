import { useState, useEffect, type FormEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Employee, Store } from "@/lib/admin"

export interface CreateTaskFormValues {
  courseId: string
  employeeId: string
  storeId: string
  sourceIssue: string
  dueAt: string
}

interface CreateTaskDialogProps {
  open: boolean
  courses: Array<{ id: string; title: string }>
  employees: Employee[]
  stores: Store[]
  saving: boolean
  onCancel: () => void
  onSave: (values: CreateTaskFormValues) => void
}

export function CreateTaskDialog({ open, courses, employees, stores, saving, onCancel, onSave }: CreateTaskDialogProps) {
  const [values, setValues] = useState<CreateTaskFormValues>({
    courseId: "",
    employeeId: "",
    storeId: "",
    sourceIssue: "",
    dueAt: "",
  })

  useEffect(() => {
    if (!open) return
    const nextWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    setValues({
      courseId: courses[0]?.id || "",
      employeeId: employees[0]?.id || "",
      storeId: stores[0]?.id || "",
      sourceIssue: "",
      dueAt: nextWeek,
    })
  }, [open, courses, employees, stores])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!values.courseId) return
    onSave(values)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-4 border-b border-[#dbe3ec]">
            <DialogTitle className="text-base font-bold text-[#172033]">派发培训任务</DialogTitle>
          </DialogHeader>

          <div className="p-5 flex flex-col gap-3.5 text-xs">
            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-[#65738a]">选择课程 <span className="text-red-500">*</span></label>
              <select
                value={values.courseId}
                onChange={(e) => setValues({ ...values, courseId: e.target.value })}
                className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
                required
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[#65738a]">分配员工</label>
                <select
                  value={values.employeeId}
                  onChange={(e) => setValues({ ...values, employeeId: e.target.value })}
                  className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
                >
                  <option value="">全门店员工</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name} · {e.role}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[#65738a]">所属门店</label>
                <select
                  value={values.storeId}
                  onChange={(e) => setValues({ ...values, storeId: e.target.value })}
                  className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[#65738a]">截止完成日期</label>
                <Input
                  type="date"
                  value={values.dueAt}
                  onChange={(e) => setValues({ ...values, dueAt: e.target.value })}
                  className="h-9 border-[#cfd9e4]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[#65738a]">关联巡检问题 (可选)</label>
                <Input
                  value={values.sourceIssue}
                  onChange={(e) => setValues({ ...values, sourceIssue: e.target.value })}
                  placeholder="例如：ISSUE-202608-01"
                  className="h-9 border-[#cfd9e4]"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-[#dbe3ec] bg-[#f8fafc] flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8 border-[#dbe3ec]">
              取消
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="h-8 bg-[#1672a8] hover:bg-[#125c88] text-white">
              {saving ? "派发中…" : "确认派发"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
