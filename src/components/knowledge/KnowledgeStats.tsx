import { BookMarked, BrainCircuit, ShieldCheck } from "lucide-react"

interface KnowledgeStatsProps {
  knowledgeCount: number
  ruleTotal: number
  ruleEnabled: number
}

export function KnowledgeStats({ knowledgeCount, ruleTotal, ruleEnabled }: KnowledgeStatsProps) {
  const cards = [
    { label: "专业词库", icon: BookMarked, value: String(knowledgeCount), note: "药品名、病症名、品类别名" },
    { label: "合规规则", icon: ShieldCheck, value: String(ruleTotal), note: `已启用 ${ruleEnabled} 条` },
    { label: "模型版本", icon: BrainCircuit, value: "V2.1", note: "医药零售场景" },
  ]

  return (
    <div className="grid grid-cols-3 gap-3.5 max-lg:grid-cols-1">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <article key={card.label} className="bg-card border border-border rounded-lg p-4 grid gap-2">
            <div className="text-muted-foreground text-[13px] flex items-center justify-between gap-2">
              {card.label}
              <Icon className="w-4 h-4" />
            </div>
            <strong className="text-[28px] leading-none font-semibold">{card.value}</strong>
            <small className="text-muted-foreground">{card.note}</small>
          </article>
        )
      })}
    </div>
  )
}
