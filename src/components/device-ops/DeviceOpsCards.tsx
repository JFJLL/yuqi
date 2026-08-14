import { Pill } from "@/components/dashboard/Pill"
import type { Device } from "@/lib/admin"

interface DeviceOpsCardsProps {
  devices: Device[]
}

export function DeviceOpsCards({ devices }: DeviceOpsCardsProps) {
  const wifi = devices.filter((d) => d.type === "WiFi胸牌")
  const fourG = devices.filter((d) => d.type === "4G胸牌")
  const offline = devices.filter((d) => d.status === "离线")

  const wifiOnline = wifi.filter((d) => d.status !== "离线").length
  const wifiRecording = wifi.filter((d) => d.status === "录音中").length
  const wifiLowPower = wifi.filter((d) => d.power <= 20).length
  const fourGOnline = fourG.filter((d) => d.status !== "离线").length
  const fourGOffline = fourG.filter((d) => d.status === "离线").length
  const textsTotal = devices.reduce((sum, d) => sum + (d.texts_today ?? 0), 0)

  const cards = [
    {
      title: "WiFi胸牌",
      pill: <Pill tone="green">在线 {wifiOnline}</Pill>,
      desc: `录音中 ${wifiRecording} 台，低电量 ${wifiLowPower} 台。`,
      percent: wifi.length ? Math.round((wifiOnline / wifi.length) * 100) : 0,
    },
    {
      title: "4G胸牌",
      pill: <Pill tone="blue">在线 {fourGOnline}</Pill>,
      desc: `今日上传 ${textsTotal} 段，离线 ${fourGOffline} 台。`,
      percent: fourG.length ? Math.round((fourGOnline / fourG.length) * 100) : 0,
    },
    {
      title: "离线设备",
      pill: <Pill tone="amber">{offline.length} 台</Pill>,
      desc: offline.length ? "需要店长确认设备状态后重新上线。" : "所有设备运行正常。",
      percent: devices.length ? Math.round((offline.length / devices.length) * 100) : 0,
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
