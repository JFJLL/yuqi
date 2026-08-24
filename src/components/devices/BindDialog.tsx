import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { EmployeeItem, StoreItem } from "@/lib/v1"

export interface BindFormValues {
  deviceNo: string
  employeeId: string
  effectiveDate: string
}

interface BindDialogProps {
  open: boolean
  // 调整已有设备时带入设备码, 新增绑定时为空
  deviceNo: string
  employees: EmployeeItem[]
  stores: StoreItem[]
  saving: boolean
  onCancel: () => void
  onSave: (values: BindFormValues) => void
}

const fieldClass =
  "min-h-9 w-full border border-border rounded-lg bg-card text-foreground outline-none px-2.5 text-sm focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"

function todayText(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function BindDialog({ open, deviceNo, employees, stores, saving, onCancel, onSave }: BindDialogProps) {
  const [values, setValues] = useState<BindFormValues>({
    deviceNo: "",
    employeeId: "",
    effectiveDate: todayText(),
  })

  useEffect(() => {
    if (!open) return
    setValues({
      deviceNo,
      employeeId: employees[0]?.id ?? "",
      effectiveDate: todayText(),
    })
  }, [open, deviceNo, employees, stores])

  function set<K extends keyof BindFormValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const canSave = values.deviceNo.trim().length > 0 && values.employeeId.length > 0

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{deviceNo ? "调整设备绑定" : "绑定设备"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <div className="grid gap-1.5 col-span-2 max-sm:col-span-1">
            <label className="text-muted-foreground text-xs">设备码</label>
            <input
              className={fieldClass}
              placeholder="请输入或扫描设备码"
              value={values.deviceNo}
              disabled={deviceNo.length > 0}
              onChange={(e) => set("deviceNo", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs">员工</label>
            <select
              className={fieldClass}
              value={values.employeeId}
              onChange={(e) => set("employeeId", e.target.value)}
            >
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs">生效日期</label>
            <input
              type="date"
              className={fieldClass}
              value={values.effectiveDate}
              onChange={(e) => set("effectiveDate", e.target.value)}
            />
          </div>
          <p className="text-muted-foreground text-xs col-span-2 m-0">
            门店归属按员工档案自动确定；调整绑定将先解绑当前生效绑定，再建立新绑定。
          </p>
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
            {saving ? "绑定中…" : "确认绑定"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
