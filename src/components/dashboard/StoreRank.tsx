import type { DashboardStoreRankItem } from "@/lib/v1"
import { Pill } from "./Pill"

interface StoreRankProps {
  items: DashboardStoreRankItem[]
}

function countTone(count: number): "red" | "amber" | "green" {
  if (count >= 4) return "red"
  if (count >= 2) return "amber"
  return "green"
}

export function StoreRank({ items }: StoreRankProps) {
  return (
    <section className="bg-card border border-border rounded-lg">
      <div className="min-h-[54px] px-4 py-3.5 border-b border-border flex items-center">
        <h2 className="m-0 text-base font-semibold">门店排行</h2>
      </div>
      <div className="p-4 grid gap-2.5">
        {items.length === 0 && (
          <p className="m-0 text-sm text-muted-foreground py-6 text-center">暂无门店问题数据</p>
        )}
        {items.map((item) => (
          <div key={item.store_id} className="border border-border rounded-lg p-3 bg-background grid gap-2">
            <div className="flex items-center justify-between gap-2.5">
              <strong className="text-sm">{item.store_name}</strong>
              <Pill tone={countTone(item.issue_count)}>{item.issue_count} 个问题</Pill>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="block h-full rounded-full bg-primary"
                style={{ width: `${Math.max(item.share, 4)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
