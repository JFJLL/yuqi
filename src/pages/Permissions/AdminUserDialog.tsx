import { useState, useEffect, type FormEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Region, Store } from "@/lib/admin"

export interface AdminUserFormValues {
  name: string
  username: string
  password?: string
  roleCode: string
  status: string
  scopeType: "GLOBAL" | "REGION" | "STORE"
  scopeId: string
}

interface AdminUserDialogProps {
  open: boolean
  initial: {
    id?: string
    name: string
    username: string
    roleCode: string
    status: string
    scopeType: "GLOBAL" | "REGION" | "STORE"
    scopeId: string
  } | null
  roles: Array<{ code: string; name: string }>
  regions: Region[]
  stores: Store[]
  saving: boolean
  onCancel: () => void
  onSave: (values: AdminUserFormValues) => void
}

export function AdminUserDialog({ open, initial, roles, regions, stores, saving, onCancel, onSave }: AdminUserDialogProps) {
  const [values, setValues] = useState<AdminUserFormValues>({
    name: "",
    username: "",
    password: "",
    roleCode: "ADMIN",
    status: "ACTIVE",
    scopeType: "GLOBAL",
    scopeId: "",
  })

  useEffect(() => {
    if (!open) return
    setValues({
      name: initial?.name || "",
      username: initial?.username || "",
      password: "",
      roleCode: initial?.roleCode || roles[0]?.code || "ADMIN",
      status: initial?.status || "ACTIVE",
      scopeType: initial?.scopeType || "GLOBAL",
      scopeId: initial?.scopeId || "",
    })
  }, [open, initial, roles])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!values.username.trim() || (!initial && !values.password)) return
    onSave(values)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden bg-white">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-4 border-b border-[#dbe3ec]">
            <DialogTitle className="text-base font-bold text-[#172033]">
              {initial ? "编辑管理员账号" : "新增管理员账号"}
            </DialogTitle>
          </DialogHeader>

          <div className="p-5 grid grid-cols-2 gap-3.5 text-xs">
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="font-medium text-[#65738a]">管理员姓名 <span className="text-red-500">*</span></label>
              <Input
                value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })}
                placeholder="例如：张主管"
                required
                className="h-9 border-[#cfd9e4]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-[#65738a]">用户名 / 登录邮箱 <span className="text-red-500">*</span></label>
              <Input
                value={values.username}
                onChange={(e) => setValues({ ...values, username: e.target.value })}
                placeholder="例如：zhang@demo.local"
                required
                disabled={Boolean(initial)}
                className="h-9 border-[#cfd9e4]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-[#65738a]">登录密码 {initial ? "(留空保持原密码)" : <span className="text-red-500">*</span>}</label>
              <Input
                type="password"
                value={values.password}
                onChange={(e) => setValues({ ...values, password: e.target.value })}
                placeholder={initial ? "不修改请留空" : "至少 8 位密码"}
                required={!initial}
                className="h-9 border-[#cfd9e4]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-[#65738a]">分配角色</label>
              <select
                value={values.roleCode}
                onChange={(e) => setValues({ ...values, roleCode: e.target.value })}
                className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
              >
                {roles.map((r) => (
                  <option key={r.code} value={r.code}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-[#65738a]">账号状态</label>
              <select
                value={values.status}
                onChange={(e) => setValues({ ...values, status: e.target.value })}
                className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
              >
                <option value="ACTIVE">启用</option>
                <option value="DISABLED">停用</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-[#65738a]">数据查看范围</label>
              <select
                value={values.scopeType}
                onChange={(e) => setValues({ ...values, scopeType: e.target.value as "GLOBAL" | "REGION" | "STORE", scopeId: "" })}
                className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
              >
                <option value="GLOBAL">集团全部 (无限制)</option>
                <option value="REGION">指定区域</option>
                <option value="STORE">指定门店</option>
              </select>
            </div>

            {values.scopeType === "REGION" && (
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[#65738a]">授权区域</label>
                <select
                  value={values.scopeId}
                  onChange={(e) => setValues({ ...values, scopeId: e.target.value })}
                  className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
                >
                  <option value="">请选择区域</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}

            {values.scopeType === "STORE" && (
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[#65738a]">授权门店</label>
                <select
                  value={values.scopeId}
                  onChange={(e) => setValues({ ...values, scopeId: e.target.value })}
                  className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
                >
                  <option value="">请选择门店</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t border-[#dbe3ec] bg-[#f8fafc] flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8 border-[#dbe3ec]">
              取消
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="h-8 bg-[#1672a8] hover:bg-[#125c88] text-white">
              {saving ? "保存中…" : "保存账号"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
