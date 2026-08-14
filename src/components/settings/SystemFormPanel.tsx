import { PlugZap, Save } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface SystemFormValues {
  syncStatus: string
  syncFrequency: string
  roleTemplate: string
  lastSyncAt: string
}

export const SYNC_FREQUENCY_OPTIONS = ["每 10 分钟", "每 30 分钟", "每小时"]
export const ROLE_TEMPLATE_OPTIONS = ["总部管理员", "区域经理", "门店店长", "合规专员"]

interface SystemFormPanelProps {
  values: SystemFormValues
  saving: boolean
  onChange: (next: SystemFormValues) => void
  onSave: () => void
  onTest: () => void
}

const fieldClass =
  "min-h-9 w-full border border-border rounded-lg bg-card text-foreground outline-none px-2.5 text-sm focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"

export function SystemFormPanel({ values, saving, onChange, onSave, onTest }: SystemFormPanelProps) {
  return (
    <section className="bg-card border border-border rounded-lg">
      <div className="min-h-[54px] px-4 py-3.5 border-b border-border">
        <h2 className="m-0 text-base font-semibold">接口与权限</h2>
        <p className="mt-0.5 mb-0 text-muted-foreground text-xs">维护数据同步、角色权限和操作日志。</p>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <div className="grid gap-1.5 col-span-2 max-sm:col-span-1">
            <label className="text-muted-foreground text-xs">数据同步状态</label>
            <input
              className={fieldClass}
              value={values.syncStatus}
              onChange={(e) => onChange({ ...values, syncStatus: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs">同步频率</label>
            <select
              className={fieldClass}
              value={values.syncFrequency}
              onChange={(e) => onChange({ ...values, syncFrequency: e.target.value })}
            >
              {SYNC_FREQUENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs">角色模板</label>
            <select
              className={fieldClass}
              value={values.roleTemplate}
              onChange={(e) => onChange({ ...values, roleTemplate: e.target.value })}
            >
              {ROLE_TEMPLATE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5 col-span-2 max-sm:col-span-1">
            <label className="text-muted-foreground text-xs">最近同步</label>
            <input className={fieldClass} value={values.lastSyncAt} disabled />
          </div>
        </div>
        <div className="flex justify-end gap-2.5 mt-3.5">
          <Button variant="outline" className="gap-1.5" onClick={onTest}>
            <PlugZap className="w-4 h-4" />
            测试连接
          </Button>
          <Button
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:shadow-[var(--focus-ring)]"
            disabled={saving}
            onClick={onSave}
          >
            <Save className="w-4 h-4" />
            {saving ? "保存中…" : "保存设置"}
          </Button>
        </div>
      </div>
    </section>
  )
}
