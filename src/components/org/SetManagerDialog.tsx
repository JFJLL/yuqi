import { useState, useEffect, type FormEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { Employee, Store } from "@/lib/admin"

interface SetManagerDialogProps {
  open: boolean
  store: Store | null
  employees: Employee[]
  saving: boolean
  onCancel: () => void
  onSave: (storeId: string, employeeId: string) => void
}

export function SetManagerDialog({ open, store, employees, saving, onCancel, onSave }: SetManagerDialogProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("")

  useEffect(() => {
    if (!open) return
    const currentMgr = employees.find(
      (e) => (e.store === store?.id || e.store === store?.name) && (e.role === "店长" || e.role === "STORE_MANAGER")
    )
    setSelectedEmployeeId(currentMgr?.id || "")
  }, [open, store, employees])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!store) return
    onSave(store.id, selectedEmployeeId)
  }

  // 筛选属于当前门店或全部在职员工
  const activeEmployees = employees.filter((e) => e.status === "在职" || e.status === "ACTIVE" || !e.status)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-white">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-4 border-b border-[#dbe3ec]">
            <DialogTitle className="text-base font-bold text-[#172033]">
              设置店长 · {store?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 flex flex-col gap-3 text-xs">
            <p className="text-[#65738a] m-0">
              设置店长后，该员工在小程序将拥有本店的管理工作台权限，并在巡检报告中作为责任人展示。
            </p>
            <div className="flex flex-col gap-1.5 mt-2">
              <label className="font-medium text-[#172033]">选择店长员工</label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="h-10 border border-[#cfd9e4] rounded px-3 bg-white text-xs focus:border-[#438cb5]"
              >
                <option value="">未设置店长 (清空)</option>
                {activeEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} · {e.phone} · {e.role || "营业员"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-[#dbe3ec] bg-[#f8fafc] flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8 border-[#dbe3ec]">
              取消
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="h-8 bg-[#1672a8] hover:bg-[#125c88] text-white">
              {saving ? "保存中…" : "确认设置"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
