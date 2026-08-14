import { FileText, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Pill, riskTone } from "@/components/dashboard/Pill"
import type { AppealCard } from "./AppealQueue"

interface ReviewPanelProps {
  appeal: AppealCard | null
  issueQuote: string
  issueRisk: string
  reviewing: boolean
  onApprove: (appeal: AppealCard) => void
  onReject: (appeal: AppealCard) => void
  onPreview: () => void
  onViewContext: () => void
}

export function ReviewPanel({
  appeal,
  issueQuote,
  issueRisk,
  reviewing,
  onApprove,
  onReject,
  onPreview,
  onViewContext,
}: ReviewPanelProps) {
  return (
    <section className="bg-card border border-border rounded-lg" style={{ boxShadow: "var(--elev-ring)" }}>
      <div className="min-h-[54px] px-4 py-3.5 border-b border-border">
        <h2 className="m-0 text-base font-semibold">复核工作台</h2>
      </div>
      <div className="p-4">
        {!appeal ? (
          <div className="border border-border rounded-lg p-3 bg-background grid gap-2">
            <div>
              <Pill tone="amber">待选择</Pill>
            </div>
            <strong className="text-sm">请选择一条申诉记录</strong>
            <span className="text-muted-foreground text-xs">查看命中文本、员工说明和复核动作。</span>
          </div>
        ) : (
          <div className="grid gap-2.5">
            <div className="border border-border rounded-lg p-3 bg-background grid gap-2">
              <div className="flex items-center justify-between gap-2.5">
                <strong className="text-sm">
                  {appeal.employeeName || "-"} · {appeal.issueType || "-"}
                </strong>
                {issueRisk ? <Pill tone={riskTone(issueRisk)}>{issueRisk}风险</Pill> : null}
              </div>
              <span className="text-muted-foreground text-xs">{appeal.storeName || "-"}</span>
              <div className="border-l-[3px] border-primary bg-card rounded-r-md px-2.5 py-2 text-sm leading-relaxed text-foreground/90">
                {issueQuote || "未关联命中文本"}
              </div>
            </div>
            <div className="border border-border rounded-lg p-3 bg-background grid gap-2">
              <strong className="text-sm">员工说明</strong>
              <span className="text-muted-foreground text-sm leading-relaxed">{appeal.reason}</span>
            </div>
            <div className="border border-border rounded-lg p-3 bg-background grid gap-2">
              <strong className="text-sm">复核记录</strong>
              <span className="text-muted-foreground text-xs">已关联对应沟通片段，可由店长或合规专员复核。</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onPreview}>
                  <Play className="w-3.5 h-3.5" />
                  试听
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onViewContext}>
                  <FileText className="w-3.5 h-3.5" />
                  查看上下文
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-1">
              <Button
                variant="outline"
                className="border-[hsl(var(--destructive)/0.3)] text-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.06)] hover:bg-[hsl(var(--destructive)/0.12)]"
                disabled={reviewing || appeal.status !== "待复核"}
                onClick={() => onReject(appeal)}
              >
                驳回
              </Button>
              <Button
                className="bg-[hsl(var(--success))] text-primary-foreground hover:bg-[hsl(var(--success)/0.9)]"
                disabled={reviewing || appeal.status !== "待复核"}
                onClick={() => onApprove(appeal)}
              >
                通过
              </Button>
            </div>
            {appeal.status !== "待复核" && (
              <p className="m-0 text-xs text-muted-foreground text-right">该申诉已完成复核（{appeal.status}）。</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
