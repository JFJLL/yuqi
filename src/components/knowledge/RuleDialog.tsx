import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { RiskRuleItem } from "@/lib/v1"

export const RULE_CATEGORIES = ["夸大疗效表达", "处方药提醒缺失", "联合用药风险", "基础疾病询问缺失", "服务态度问题", "general"]
const SEVERITY_OPTIONS = ["high", "medium", "low"]

interface RuleDialogProps {
  open: boolean
  editing: RiskRuleItem | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: {
    code: string
    name: string
    category: string
    severity: string
    keywords: string[]
    description: string
    enabled: boolean
    change_note?: string
  }) => Promise<void>
}

const fieldClass =
  "min-h-9 w-full border border-border rounded-lg bg-card text-foreground outline-none px-2.5 text-sm focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"

export function RuleDialog({ open, editing, saving, onOpenChange, onSubmit }: RuleDialogProps) {
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [category, setCategory] = useState(RULE_CATEGORIES[0])
  const [severity, setSeverity] = useState("high")
  const [keywordsText, setKeywordsText] = useState("")
  const [description, setDescription] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [changeNote, setChangeNote] = useState("")

  useEffect(() => {
    if (open) {
      setCode(editing?.code ?? "")
      setName(editing?.name ?? "")
      setCategory(editing?.category ?? RULE_CATEGORIES[0])
      setSeverity(editing?.severity ?? "high")
      setKeywordsText(editing ? editing.keywords.join(" ") : "")
      setDescription(editing?.description ?? "")
      setEnabled(editing?.enabled ?? true)
      setChangeNote("")
    }
  }, [open, editing])

  async function handleSave() {
    if (!code.trim() || !name.trim()) return
    const keywords = keywordsText.split(/[\s,，、]+/).map((k) => k.trim()).filter(Boolean)
    await onSubmit({
      code: code.trim(),
      name: name.trim(),
      category,
      severity,
      keywords,
      description: description.trim(),
      enabled,
      change_note: changeNote.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "编辑规则" : "新增规则"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs">编码</label>
              <input className={fieldClass} placeholder="如 R-OVERPROMISE" value={code} disabled={!!editing} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs">名称</label>
              <input className={fieldClass} placeholder="如 夸大疗效" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs">分类</label>
              <select className={fieldClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                {RULE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs">风险等级</label>
              <select className={fieldClass} value={severity} onChange={(e) => setSeverity(e.target.value)}>
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === "high" ? "高" : s === "medium" ? "中" : "低"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs">匹配关键词（空格/逗号分隔）</label>
            <input className={fieldClass} placeholder="如 重点介绍 阿莫西林" value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs">整改建议</label>
            <textarea className={`${fieldClass} min-h-[72px] py-2`} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {editing && (
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs">变更说明</label>
              <input className={fieldClass} placeholder="如 调整关键词范围" value={changeNote} onChange={(e) => setChangeNote(e.target.value)} />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-3.5" />
            启用
          </label>
        </div>
        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={!code.trim() || !name.trim() || saving} onClick={() => void handleSave()}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
