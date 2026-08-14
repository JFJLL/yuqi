import { BadgeCheck, FileText, MessagesSquare, ScanSearch } from "lucide-react"
import type { DashboardStats } from "@/lib/admin"

interface StatCardsProps {
  stats: DashboardStats | null
}

export function StatCards({ stats }: StatCardsProps) {
  const cards = [
    {
      label: "今日巡检文本",
      icon: FileText,
      value: stats ? String(stats.transcripts_today) : "-",
      note: stats ? `覆盖 ${stats.stores_covered} 家门店` : "-",
    },
    {
      label: "发现问题",
      icon: ScanSearch,
      value: stats ? String(stats.issues_today) : "-",
      note: stats ? `高风险 ${stats.high_risk} 条` : "-",
    },
    {
      label: "整改完成率",
      icon: BadgeCheck,
      value: stats ? `${stats.rectify_rate}%` : "-",
      note: stats ? `待整改 ${stats.open_tasks} 条 · 逾期 ${stats.overdue_tasks} 条` : "-",
    },
    {
      label: "申诉待复核",
      icon: MessagesSquare,
      value: stats ? String(stats.pending_appeals) : "-",
      note: stats ? `超 24 小时 ${stats.overdue_appeals} 条` : "-",
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-3.5 max-lg:grid-cols-2 max-sm:grid-cols-1">
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
