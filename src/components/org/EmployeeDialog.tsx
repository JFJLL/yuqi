import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { StoreItem } from "@/lib/v1"
import type { EmployeeItem } from "@/lib/v1"
import { ROLE_OPTIONS } from "./EmployeeFilters"

export interface EmployeeFormValues {
  employeeNo: string
  name: string
  mobile: string
  jobTitle: string
  store: string
  joinedAt: string
}

interface EmployeeDialogProps {
  open: boolean
  initial: EmployeeItem | null
  stores: StoreItem[]
  saving: boolean
  onCancel: () => void
  onSave: (values: EmployeeFormValues) => void
}

const fieldClass =
  "min-h-9 w-full border border-border rounded-lg bg-card text-foreground outline-none px-2.5 text-sm focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"

const EMPTY: EmployeeFormValues = { employeeNo: "", name: "", mobile: "", jobTitle: "营业员", store: "", joinedAt: "" }

export function EmployeeDialog({ open, initial, stores, saving, onCancel, onSave }: EmployeeDialogProps) {
  const [values, setValues] = useState<EmployeeFormValues>(EMPTY)

  useEffect(() => {
    if (!open) return
    setValues(
      initial
        ? {
            employeeNo: initial.employee_no ?? "",
            name: initial.name ?? "",
            mobile: initial.mobile ?? "",
            jobTitle: initial.job_title || "营业员",
            store: initial.store_id ?? "",
            joinedAt: initial.joined_at?.slice(0, 10) ?? "",
          }
        : { ...EMPTY, store: stores[0]?.id ?? "" },
    )
  }, [open, initial, stores])

  function set<K extends keyof EmployeeFormValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const canSave =
    values.employeeNo.trim().length > 0 && values.name.trim().length > 0 && values.mobile.trim().length >= 5

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑员工" : "新增员工"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs">员工号</label>
            <input
              className={fieldClass}
              placeholder="如 A001"
              value={values.employeeNo}
              onChange={(e) => set("employeeNo", e.target.value)}
            />
          </div>
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
              value={values.mobile}
              onChange={(e) => set("mobile", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs">岗位</label>
            <select className={fieldClass} value={values.jobTitle} onChange={(e) => set("jobTitle", e.target.value)}>
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
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs">入职日期</label>
            <input
              type="date"
              className={fieldClass}
              value={values.joinedAt}
              onChange={(e) => set("joinedAt", e.target.value)}
            />
          </div>
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
