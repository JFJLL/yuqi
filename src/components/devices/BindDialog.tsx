import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { Employee, Store } from "@/lib/admin"
import { DEVICE_TYPE_OPTIONS } from "./DeviceFilters"

export interface BindFormValues {
  deviceNo: string
  employeeId: string
  storeId: string
  deviceType: string
  effectiveDate: string
}

interface BindDialogProps {
  open: boolean
  // 调整已有设备时带入设备码与类型, 新增绑定时为空
  deviceNo: string
  deviceType: string
  employees: Employee[]
  stores: Store[]
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

export function BindDialog({
  open,
  deviceNo,
  deviceType,
  employees,
  stores,
  saving,
  onCancel,
  onSave,
}: BindDialogProps) {
  const [values, setValues] = useState<BindFormValues>({
    deviceNo: "",
    employeeId: "",
    storeId: "",
    deviceType: "WiFi胸牌",
    effectiveDate: todayText(),
  })

  useEffect(() => {
    if (!open) return
    setValues({
      deviceNo,
      employeeId: employees[0]?.id ?? "",
      storeId: stores[0]?.id ?? "",
      deviceType: deviceType || "WiFi胸牌",
      effectiveDate: todayText(),
    })
  }, [open, deviceNo, deviceType, employees, stores])

  function set<K extends keyof BindFormValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const canSave = values.deviceNo.trim().length > 0 && values.employeeId.length > 0 && values.storeId.length > 0

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>绑定设备</DialogTitle>
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
            <label className="text-muted-foreground text-xs">门店</label>
            <select className={fieldClass} value={values.storeId} onChange={(e) => set("storeId", e.target.value)}>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs">设备类型</label>
            <select
              className={fieldClass}
              value={values.deviceType}
              disabled={deviceNo.length > 0}
              onChange={(e) => set("deviceType", e.target.value)}
            >
              {DEVICE_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
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
