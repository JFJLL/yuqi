import { Pill, stateTone } from "@/components/dashboard/Pill"
import type { AppealRecord } from "@/lib/admin"

export interface AppealCard extends AppealRecord {
  employeeName: string
  storeName: string
  issueType: string
}

interface AppealQueueProps {
  items: AppealCard[]
  selectedId: string
  onSelect: (item: AppealCard) => void
}

export function AppealQueue({ items, selectedId, onSelect }: AppealQueueProps) {
  return (
    <section className="bg-card border border-border rounded-lg" style={{ boxShadow: "var(--elev-ring)" }}>
      <div className="min-h-[54px] px-4 py-3.5 border-b border-border">
        <h2 className="m-0 text-base font-semibold">申诉复核队列</h2>
        <p className="mt-0.5 mb-0 text-muted-foreground text-xs">复核员工对 AI 问题判断的异议。</p>
      </div>
      <div className="p-4 grid gap-2.5">
        {items.length === 0 && (
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
                {item.employeeName || "-"} · {item.issueType || "-"}
              </strong>
              <Pill tone={stateTone(item.status)}>{item.status}</Pill>
            </div>
            <span className="text-muted-foreground text-xs">{item.storeName || "-"}</span>
            <div className="border-l-[3px] border-primary bg-card rounded-r-md px-2 py-1.5 text-xs leading-relaxed text-foreground/90">
              {item.reason}
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
