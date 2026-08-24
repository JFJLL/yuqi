import { History, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Pill, riskTone } from "@/components/dashboard/Pill"
import type { RiskRuleItem } from "@/lib/v1"

export interface RuleRow {
  rule: RiskRuleItem
  onEdit: (rule: RiskRuleItem) => void
  onToggle: (rule: RiskRuleItem) => void
  onVersions: (rule: RiskRuleItem) => void
  onDelete: (rule: RiskRuleItem) => void
}

const SEVERITY_LABEL: Record<string, string> = { high: "高", medium: "中", low: "低" }

export function RuleTable({ rows }: { rows: RuleRow[] }) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {["编码", "名称", "分类", "风险", "关键词", "版本", "状态", "操作"].map((head) => (
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
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-2.5 py-10 text-center text-muted-foreground">
                暂无规则
              </td>
            </tr>
          )}
          {rows.map(({ rule, onEdit, onToggle, onVersions, onDelete }) => (
            <tr key={rule.id} className="hover:bg-accent/40">
              <td className="px-2.5 py-3 border-b border-border font-mono text-xs">{rule.code}</td>
              <td className="px-2.5 py-3 border-b border-border font-semibold">{rule.name}</td>
              <td className="px-2.5 py-3 border-b border-border whitespace-nowrap">{rule.category}</td>
              <td className="px-2.5 py-3 border-b border-border">
                <Pill tone={riskTone(SEVERITY_LABEL[rule.severity] ?? rule.severity)}>
                  {SEVERITY_LABEL[rule.severity] ?? rule.severity}风险
                </Pill>
              </td>
              <td className="px-2.5 py-3 border-b border-border max-w-[260px]">
                <span className="line-clamp-1 text-muted-foreground">{rule.keywords.join("、") || "-"}</span>
              </td>
              <td className="px-2.5 py-3 border-b border-border whitespace-nowrap">v{rule.version_no}</td>
              <td className="px-2.5 py-3 border-b border-border">
                <button
                  type="button"
                  onClick={() => onToggle(rule)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${rule.enabled ? "bg-primary" : "bg-muted"}`}
                  aria-label={rule.enabled ? "停用规则" : "启用规则"}
                >
                  <span
                    className={`inline-block size-4 transform rounded-full bg-card shadow transition-transform ${rule.enabled ? "translate-x-4" : "translate-x-0.5"}`}
                  />
                </button>
              </td>
              <td className="px-2.5 py-3 border-b border-border">
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <Button variant="link" className="h-auto p-0 text-primary font-semibold" onClick={() => onEdit(rule)}>
                    <Pencil className="size-3" /> 编辑
                  </Button>
                  <Button variant="link" className="h-auto p-0 text-muted-foreground font-semibold" onClick={() => onVersions(rule)}>
                    <History className="size-3" /> 版本
                  </Button>
                  <Button variant="link" className="h-auto p-0 text-destructive font-semibold" onClick={() => onDelete(rule)}>
                    <Trash2 className="size-3" /> 删除
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
