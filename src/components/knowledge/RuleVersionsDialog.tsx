import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Pill } from "@/components/dashboard/Pill"
import type { RiskRuleVersionItem } from "@/lib/v1"

interface RuleVersionsDialogProps {
  ruleName: string
  versions: RiskRuleVersionItem[]
  loading: boolean
  onClose: () => void
}

export function RuleVersionsDialog({ ruleName, versions, loading, onClose }: RuleVersionsDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>规则版本历史 · {ruleName}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">加载中…</p>
          ) : versions.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">暂无版本记录</p>
          ) : (
            versions.map((v) => {
              const snapshot = v.snapshot as { severity?: string; keywords?: string[]; enabled?: boolean }
              return (
                <article key={v.id} className="border-b border-border py-3 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm">v{v.version_no}</strong>
                    <span className="text-xs text-muted-foreground">{v.created_at.slice(0, 16)}</span>
                  </div>
                  <p className="m-0 mt-1 text-xs text-muted-foreground">{v.change_note || "—"}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Pill tone="gray">
                      {snapshot.severity === "high" ? "高风险" : snapshot.severity === "low" ? "低风险" : "中风险"}
                    </Pill>
                    <Pill tone={snapshot.enabled === false ? "red" : "green"}>
                      {snapshot.enabled === false ? "停用" : "启用"}
                    </Pill>
                    <span className="text-xs text-muted-foreground">{(snapshot.keywords ?? []).join("、")}</span>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
