import { BadgeCheck, ClipboardList, ClockAlert } from "lucide-react"

interface TaskStatsProps {
  openCount: number
  newToday: number
  overdueCount: number
  completionRate: number
}

export function TaskStats({ openCount, newToday, overdueCount, completionRate }: TaskStatsProps) {
  const cards = [
    {
      label: "待整改",
      icon: ClipboardList,
      value: String(openCount),
      note: `今日新增 ${newToday} 条`,
    },
    {
      label: "逾期任务",
      icon: ClockAlert,
      value: String(overdueCount),
      note: "需店长跟进",
    },
    {
      label: "整改完成率",
      icon: BadgeCheck,
      value: `${completionRate}%`,
      note: "本周目标 80%",
    },
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
