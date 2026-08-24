import { ClipboardCheck, MessageSquareWarning, ShieldAlert } from "lucide-react"
import type { DashboardStats } from "@/lib/v1"

interface TodoRemindersProps {
  stats: DashboardStats | null
}

export function TodoReminders({ stats }: TodoRemindersProps) {
  const items = [
    {
      icon: MessageSquareWarning,
      title: stats ? `${stats.pending_appeals} 条申诉待复核` : "- 条申诉待复核",
      desc: stats ? `其中 ${stats.overdue_appeals} 条超过 24 小时。` : "数据加载中。",
    },
    {
      icon: ClipboardCheck,
      title: stats ? `${stats.open_tasks} 条整改进行中` : "- 条整改进行中",
      desc: stats ? `逾期 ${stats.overdue_tasks} 条，需要店长跟进。` : "数据加载中。",
    },
    {
      icon: ShieldAlert,
      title: stats ? `${stats.high_risk} 条高风险问题` : "- 条高风险问题",
      desc: "涉及夸大疗效、处方药核验等场景，优先处理。",
    },
  ]

  return (
    <section className="bg-card border border-border rounded-lg">
      <div className="min-h-[54px] px-4 py-3.5 border-b border-border flex items-center">
        <h2 className="m-0 text-base font-semibold">待办提醒</h2>
      </div>
      <div className="p-4 grid gap-2.5">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.title} className="grid grid-cols-[30px_1fr] gap-2.5 items-start">
              <div className="w-[30px] h-[30px] rounded-lg bg-accent text-primary grid place-items-center">
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <strong className="block text-[13px]">{item.title}</strong>
                <span className="text-muted-foreground text-xs leading-relaxed">{item.desc}</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
