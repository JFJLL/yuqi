import { Pill } from "@/components/dashboard/Pill"
import type { DeviceSummary } from "@/lib/v1"

interface DeviceOpsCardsProps {
  summary: DeviceSummary
}

export function DeviceOpsCards({ summary }: DeviceOpsCardsProps) {
  const cards = [
    {
      title: "设备总数",
      pill: <Pill tone="blue">{summary.total} 台</Pill>,
      desc: `已绑定 ${summary.bound} 台，未绑定 ${summary.unbound} 台。`,
      percent: summary.total ? Math.round((summary.bound / summary.total) * 100) : 0,
    },
    {
      title: "在线设备",
      pill: <Pill tone="green">在线 {summary.online}</Pill>,
      desc: `离线 ${summary.offline} 台，需关注设备状态。`,
      percent: summary.total ? Math.round((summary.online / summary.total) * 100) : 0,
    },
    {
      title: "低电量",
      pill: <Pill tone="amber">{summary.low_power} 台</Pill>,
      desc: summary.low_power ? "电量 ≤ 20% 的设备需要及时充电。" : "所有设备电量充足。",
      percent: summary.total ? Math.round((summary.low_power / summary.total) * 100) : 0,
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-3.5 max-lg:grid-cols-1">
      {cards.map((card) => (
        <article key={card.title} className="bg-card border border-border rounded-lg p-3.5 grid gap-2.5">
          <div className="flex items-center justify-between gap-2.5">
            <strong className="text-[15px]">{card.title}</strong>
            {card.pill}
          </div>
          <p className="m-0 text-muted-foreground text-[13px] leading-relaxed">{card.desc}</p>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(card.percent, 3)}%` }} />
          </div>
        </article>
      ))}
    </div>
  )
}
