import { Pill, stateTone, STATE_LABELS } from "@/components/dashboard/Pill"
import type { AppealItem } from "@/lib/v1"

// 申诉队列卡片: 直接消费 v1 AppealItem (含员工/门店/问题类型冗余字段)
export type AppealCard = AppealItem

interface AppealQueueProps {
  items: AppealCard[]
  selectedId: string
  loading: boolean
  onSelect: (item: AppealCard) => void
}

export function AppealQueue({ items, selectedId, loading, onSelect }: AppealQueueProps) {
  return (
    <section className="bg-card border border-border rounded-lg" style={{ boxShadow: "var(--elev-ring)" }}>
      <div className="min-h-[54px] px-4 py-3.5 border-b border-border">
        <h2 className="m-0 text-base font-semibold">申诉复核队列</h2>
        <p className="mt-0.5 mb-0 text-muted-foreground text-xs">复核员工对 AI 问题判断的异议。</p>
      </div>
      <div className="p-4 grid gap-2.5">
        {loading && items.length === 0 && (
          <p className="m-0 text-sm text-muted-foreground py-6 text-center">加载中…</p>
        )}
        {!loading && items.length === 0 && (
          <p className="m-0 text-sm text-muted-foreground py-6 text-center">暂无申诉记录</p>
        )}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={`text-left border rounded-lg p-3 bg-background grid gap-2 cursor-pointer transition-colors ${
              selectedId === item.id ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"
            }`}
          >
            <div className="flex items-center justify-between gap-2.5">
              <strong className="text-[13px]">
                {item.employee_name || "-"} · {item.issue_type || "-"}
              </strong>
              <Pill tone={stateTone(item.appeal_status)}>{STATE_LABELS[item.appeal_status] ?? item.appeal_status}</Pill>
            </div>
            <span className="text-muted-foreground text-xs">{item.store_name || "-"}</span>
            <div className="border-l-[3px] border-primary bg-card rounded-r-md px-2 py-1.5 text-xs leading-relaxed text-foreground/90">
              {item.appeal_reason}
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
