import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { Employee, Store } from "@/lib/admin"
import { ROLE_OPTIONS, STATUS_OPTIONS } from "./EmployeeFilters"

export interface EmployeeFormValues {
  name: string
  phone: string
  role: string
  store: string
  status: string
}

interface EmployeeDialogProps {
  open: boolean
  initial: Employee | null
  stores: Store[]
  saving: boolean
  onCancel: () => void
  onSave: (values: EmployeeFormValues) => void
}

const fieldClass =
  "min-h-9 w-full border border-border rounded-lg bg-card text-foreground outline-none px-2.5 text-sm focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"

const EMPTY: EmployeeFormValues = { name: "", phone: "", role: "营业员", store: "", status: "在职" }

export function EmployeeDialog({ open, initial, stores, saving, onCancel, onSave }: EmployeeDialogProps) {
  const [values, setValues] = useState<EmployeeFormValues>(EMPTY)

  useEffect(() => {
    if (!open) return
    setValues(
      initial
        ? {
            name: initial.name ?? "",
            phone: initial.phone ?? "",
            role: initial.role || "营业员",
            store: initial.store ?? "",
            status: initial.status || "在职",
          }
        : { ...EMPTY, store: stores[0]?.id ?? "" },
    )
  }, [open, initial, stores])

  function set<K extends keyof EmployeeFormValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const canSave = values.name.trim().length > 0 && values.store.length > 0

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑员工" : "新增员工"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs">姓名</label>
            <input
              className={fieldClass}
              placeholder="请输入姓名"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs">手机号</label>
            <input
              className={fieldClass}
              placeholder="请输入手机号"
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs">岗位</label>
            <select className={fieldClass} value={values.role} onChange={(e) => set("role", e.target.value)}>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs">门店</label>
            <select className={fieldClass} value={values.store} onChange={(e) => set("store", e.target.value)}>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
          {initial && (
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs">状态</label>
              <select className={fieldClass} value={values.status} onChange={(e) => set("status", e.target.value)}>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
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
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
