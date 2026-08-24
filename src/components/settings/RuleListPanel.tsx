import { Switch } from "@/components/ui/switch"
import { Pill, riskTone } from "@/components/dashboard/Pill"
import type { RiskRuleItem } from "@/lib/v1"

interface RuleListPanelProps {
  rules: RiskRuleItem[]
  onToggle: (rule: RiskRuleItem, enabled: boolean) => void
}

export function RuleListPanel({ rules, onToggle }: RuleListPanelProps) {
  return (
    <section className="bg-card border border-border rounded-lg">
      <div className="min-h-[54px] px-4 py-3.5 border-b border-border">
        <h2 className="m-0 text-base font-semibold">合规规则库</h2>
        <p className="mt-0.5 mb-0 text-muted-foreground text-xs">配置 AI 巡检规则、风险等级和整改建议。</p>
      </div>
      <div className="p-4 grid gap-2.5">
        {rules.length === 0 && (
          <p className="m-0 text-sm text-muted-foreground py-6 text-center">暂无合规规则</p>
        )}
        {rules.map((rule) => (
          <div key={rule.id} className="border border-border rounded-lg p-3 bg-background grid gap-2">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <strong className="text-sm truncate">{rule.name}</strong>
                <Pill tone={riskTone(rule.severity)}>{rule.severity}风险</Pill>
              </div>
              <Switch checked={!!rule.enabled} onCheckedChange={(next) => onToggle(rule, next)} />
            </div>
            <span className="text-muted-foreground text-xs line-clamp-2">
              {rule.description || rule.keywords.join("、")}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
