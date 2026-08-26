import { useState, useEffect, type FormEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Region } from "@/lib/admin"

export interface RegionFormValues {
  name: string
  code: string
  manager_name: string
  manager_mobile: string
  status: string
}

interface RegionDialogProps {
  open: boolean
  initial: Region | null
  saving: boolean
  onCancel: () => void
  onSave: (values: RegionFormValues) => void
}

export function RegionDialog({ open, initial, saving, onCancel, onSave }: RegionDialogProps) {
  const [values, setValues] = useState<RegionFormValues>({
    name: "",
    code: "",
    manager_name: "",
    manager_mobile: "",
    status: "启用",
  })

  useEffect(() => {
    if (!open) return
    setValues({
      name: initial?.name || "",
      code: initial?.code || "",
      manager_name: initial?.manager_name || "",
      manager_mobile: initial?.manager_mobile || "",
      status: initial?.status || "启用",
    })
  }, [open, initial])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!values.name.trim()) return
    onSave(values)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-4 border-b border-[#dbe3ec]">
            <DialogTitle className="text-base font-bold text-[#172033]">
              {initial ? "编辑区域" : "新增区域"}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 grid grid-cols-2 gap-4 text-xs">
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="font-medium text-[#65738a]">区域名称 <span className="text-red-500">*</span></label>
              <Input
                value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })}
                placeholder="例如：华东大区 / 华南大区"
                required
                className="h-9 border-[#cfd9e4]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-[#65738a]">区域编码</label>
              <Input
                value={values.code}
                onChange={(e) => setValues({ ...values, code: e.target.value })}
                placeholder="例如：REGION_EAST"
                className="h-9 border-[#cfd9e4]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-[#65738a]">状态</label>
              <select
                value={values.status}
                onChange={(e) => setValues({ ...values, status: e.target.value })}
                className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
              >
                <option value="启用">启用</option>
                <option value="停用">停用</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-[#65738a]">负责人姓名</label>
              <Input
                value={values.manager_name}
                onChange={(e) => setValues({ ...values, manager_name: e.target.value })}
                placeholder="例如：王经理"
                className="h-9 border-[#cfd9e4]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-[#65738a]">负责人联系电话</label>
              <Input
                value={values.manager_mobile}
                onChange={(e) => setValues({ ...values, manager_mobile: e.target.value })}
                placeholder="例如：13800000000"
                className="h-9 border-[#cfd9e4]"
              />
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-[#dbe3ec] bg-[#f8fafc] flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8 border-[#dbe3ec]">
              取消
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="h-8 bg-[#1672a8] hover:bg-[#125c88] text-white">
              {saving ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
