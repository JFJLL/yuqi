import { Pill } from "@/components/dashboard/Pill"

interface TaskQueueCardsProps {
  doneCount: number
  pendingCount: number
  failedCount: number
  mergeCount: number
  resendCount: number
}

export function TaskQueueCards({ doneCount, pendingCount, failedCount, mergeCount, resendCount }: TaskQueueCardsProps) {
  const cards = [
    {
      title: "转写任务",
      pill: <Pill tone="green">{doneCount} 已完成</Pill>,
      desc: `待转写 ${pendingCount}，失败 ${failedCount}，可在任务队列中重试。`,
    },
    {
      title: "合并录音",
      pill: <Pill tone="blue">{mergeCount} 个任务</Pill>,
      desc: "用于长对话按顾客接待过程生成完整片段索引。",
    },
    {
      title: "文本转发",
      pill: <Pill tone="amber">{resendCount} 条待重发</Pill>,
      desc: "异常转发会进入队列，由系统自动重试。",
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-3.5 mt-3.5 max-lg:grid-cols-1">
      {cards.map((card) => (
        <article key={card.title} className="bg-card border border-border rounded-lg p-3.5 grid gap-2.5">
          <div className="flex items-center justify-between gap-2.5">
            <strong className="text-[15px]">{card.title}</strong>
            {card.pill}
          </div>
          <p className="m-0 text-muted-foreground text-[13px] leading-relaxed">{card.desc}</p>
        </article>
      ))}
    </div>
  )
}
