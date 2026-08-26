import { useState, useEffect, type FormEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Region, Store } from "@/lib/admin"

export interface StoreFormValues {
  code: string
  name: string
  region: string
  address: string
  status: string
}

interface StoreDialogProps {
  open: boolean
  initial: Store | null
  regions: Region[]
  saving: boolean
  onCancel: () => void
  onSave: (values: StoreFormValues) => void
}

export function StoreDialog({ open, initial, regions, saving, onCancel, onSave }: StoreDialogProps) {
  const [values, setValues] = useState<StoreFormValues>({
    code: "",
    name: "",
    region: "",
    address: "",
    status: "营业中",
  })

  useEffect(() => {
    if (!open) return
    setValues({
      code: initial?.code || initial?.id || "",
      name: initial?.name || "",
      region: initial?.region || regions[0]?.id || "",
      address: initial?.address || "",
      status: initial?.status || "营业中",
    })
  }, [open, initial, regions])

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
              {initial ? "编辑门店" : "新增门店"}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 grid grid-cols-2 gap-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-[#65738a]">门店编号</label>
              <Input
                value={values.code}
                onChange={(e) => setValues({ ...values, code: e.target.value })}
                placeholder="例如：STORE-001"
                className="h-9 border-[#cfd9e4]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-[#65738a]">所属区域 <span className="text-red-500">*</span></label>
              <select
                value={values.region}
                onChange={(e) => setValues({ ...values, region: e.target.value })}
                className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
                required
              >
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="font-medium text-[#65738a]">门店名称 <span className="text-red-500">*</span></label>
              <Input
                value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })}
                placeholder="例如：中山路第一分店"
                required
                className="h-9 border-[#cfd9e4]"
              />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="font-medium text-[#65738a]">门店地址</label>
              <Input
                value={values.address}
                onChange={(e) => setValues({ ...values, address: e.target.value })}
                placeholder="例如：某某市某某区中山路 128 号"
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
                <option value="营业中">营业中</option>
                <option value="停业">停业</option>
              </select>
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
