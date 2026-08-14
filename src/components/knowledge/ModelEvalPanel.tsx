import { Pill } from "@/components/dashboard/Pill"
import type { ModelEval } from "@/lib/admin"

interface ModelEvalPanelProps {
  evals: ModelEval[]
}

function evalTone(item: ModelEval): "green" | "amber" | "blue" {
  if (item.status === "已达标") return "green"
  if (item.status === "优化中") return "amber"
  return "blue"
}

export function ModelEvalPanel({ evals }: ModelEvalPanelProps) {
  return (
    <section className="bg-card border border-border rounded-lg">
      <div className="min-h-[54px] px-4 py-3.5 border-b border-border">
        <h2 className="m-0 text-base font-semibold">模型评测</h2>
        <p className="mt-0.5 mb-0 text-muted-foreground text-xs">对高频场景进行样本评测和误报优化。</p>
      </div>
      <div className="p-4 grid gap-2.5">
        {evals.length === 0 && (
          <p className="m-0 text-sm text-muted-foreground py-6 text-center">暂无评测数据</p>
        )}
        {evals.map((item) => (
          <div key={item.id} className="border border-border rounded-lg p-3 bg-background grid gap-2">
            <div className="flex items-center justify-between gap-2.5">
              <strong className="text-sm">{item.scenario}</strong>
              <Pill tone={evalTone(item)}>准确率 {item.accuracy}</Pill>
            </div>
            <span className="text-muted-foreground text-xs">{item.note}</span>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(item.progress, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
