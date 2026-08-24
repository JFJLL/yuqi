import { HardDriveDownload, Save } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface RetentionFormValues {
  retentionDays: string
}

interface RetentionPanelProps {
  values: RetentionFormValues
  saving: boolean
  onChange: (next: RetentionFormValues) => void
  onSave: () => void
}

const fieldClass =
  "min-h-9 w-full border border-border rounded-lg bg-card text-foreground outline-none px-2.5 text-sm focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"

export function RetentionPanel({ values, saving, onChange, onSave }: RetentionPanelProps) {
  return (
    <section className="bg-card border border-border rounded-lg">
      <div className="min-h-[54px] px-4 py-3.5 border-b border-border">
        <h2 className="m-0 text-base font-semibold">录音保留策略</h2>
        <p className="mt-0.5 mb-0 text-muted-foreground text-xs">
          超过保留期的录音将被自动清理（被疑似问题引用的证据录音除外）。
        </p>
      </div>
      <div className="p-4">
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-xs">保留天数</label>
          <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <input
              type="number"
              min={0}
              max={3650}
              className={fieldClass}
              value={values.retentionDays}
              onChange={(e) => onChange({ retentionDays: e.target.value })}
            />
            <span className="text-muted-foreground text-sm">天（0 = 不清理）</span>
          </div>
        </div>
        <div className="grid gap-2.5 mt-4">
          <div className="border border-border rounded-lg p-3 bg-background grid gap-1.5">
            <div className="flex items-center gap-2 text-[13px]">
              <HardDriveDownload className="w-4 h-4 text-muted-foreground" />
              <strong>每日 04:00 定时清理</strong>
            </div>
            <span className="text-muted-foreground text-xs leading-relaxed">
              系统调度器将扫描超过保留期的录音文件并执行软删除；涉及疑似问题的会话受证据锁保护，不会被清理。
            </span>
          </div>
        </div>
        <div className="flex justify-end mt-3.5">
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
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
