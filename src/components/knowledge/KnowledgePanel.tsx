import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Pill, stateTone } from "@/components/dashboard/Pill"
import type { KnowledgeItem } from "@/lib/admin"

export const KNOWLEDGE_CATEGORIES = ["药品词库", "疾病症状", "处方药规则", "联合用药"]

interface KnowledgePanelProps {
  items: KnowledgeItem[]
  onCreate: (values: { category: string; name: string; rule: string }) => Promise<void> | void
}

const fieldClass =
  "min-h-9 w-full border border-border rounded-lg bg-card text-foreground outline-none px-2.5 text-sm focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"

export function KnowledgePanel({ items, onCreate }: KnowledgePanelProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [category, setCategory] = useState(KNOWLEDGE_CATEGORIES[0])
  const [displayName, setDisplayName] = useState("")
  const [rule, setRule] = useState("")

  useEffect(() => {
    if (open) {
      setCategory(KNOWLEDGE_CATEGORIES[0])
      setDisplayName("")
      setRule("")
    }
  }, [open])

  async function handleSave() {
    if (!displayName.trim()) return
    setSaving(true)
    try {
      await onCreate({ category, name: displayName.trim(), rule: rule.trim() })
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-card border border-border rounded-lg">
      <div className="min-h-[54px] px-4 py-3.5 border-b border-border flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-base font-semibold">医药知识库</h2>
          <p className="mt-0.5 mb-0 text-muted-foreground text-xs">维护病症、药品、禁忌和组合销售规则。</p>
        </div>
        <Button
          size="sm"
          className="h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:shadow-[var(--focus-ring)]"
          onClick={() => setOpen(true)}
        >
          <Plus className="w-4 h-4" />
          新增知识
        </Button>
      </div>
      <div className="p-4 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {["分类", "名称", "关联规则", "更新时间", "状态"].map((head) => (
                <th
                  key={head}
                  className="px-2.5 py-3 border-b border-border text-left font-semibold bg-muted/60 text-muted-foreground whitespace-nowrap"
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2.5 py-10 text-center text-muted-foreground">
                  暂无知识条目
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-accent/40">
                <td className="px-2.5 py-3 border-b border-border">{item.category}</td>
                <td className="px-2.5 py-3 border-b border-border font-semibold">{item.name}</td>
                <td className="px-2.5 py-3 border-b border-border">{item.rule || "-"}</td>
                <td className="px-2.5 py-3 border-b border-border whitespace-nowrap">
                  {item.updated ? item.updated.slice(0, 16) : "-"}
                </td>
                <td className="px-2.5 py-3 border-b border-border">
                  <Pill tone={stateTone(item.status)}>{item.status}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增知识</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs">分类</label>
              <select className={fieldClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                {KNOWLEDGE_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs">名称</label>
              <input
                className={fieldClass}
                placeholder="如：布洛芬缓释胶囊"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs">关联规则</label>
              <input
                className={fieldClass}
                placeholder="如：退热镇痛、禁忌提醒"
                value={rule}
                onChange={(e) => setRule(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-1">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!displayName.trim() || saving}
              onClick={handleSave}
            >
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
