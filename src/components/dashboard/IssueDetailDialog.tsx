import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { KeyIssue } from "@/lib/admin"
import { Pill, riskTone, stateTone } from "./Pill"

interface IssueDetailDialogProps {
  issue: KeyIssue | null
  onClose: () => void
}

export function IssueDetailDialog({ issue, onClose }: IssueDetailDialogProps) {
  return (
    <Dialog open={!!issue} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        {issue && (
          <>
            <DialogHeader>
              <DialogTitle>
                {issue.employee_name || "-"} · {issue.issue_type}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
              <div className="border border-border rounded-lg p-3 bg-background grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">问题信息</strong>
                  <Pill tone={riskTone(issue.risk)}>{issue.risk}风险</Pill>
                </div>
                <span className="text-muted-foreground text-xs">
                  {issue.store_name || "-"} · {issue.occurred_at?.slice(0, 16) || "-"} ·{" "}
                  <Pill tone={stateTone(issue.state)}>{issue.state}</Pill>
                </span>
                <div className="border-l-[3px] border-primary bg-card rounded-r-lg px-2.5 py-2 text-[13px] leading-relaxed text-foreground/90">
                  {issue.quote}
                </div>
              </div>
              <div className="border border-border rounded-lg p-3 bg-background grid gap-2">
                <strong className="text-sm">整改建议</strong>
                <span className="text-muted-foreground text-[13px] leading-relaxed">{issue.advice}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-1">
              <Button variant="outline" onClick={onClose}>
                关闭
              </Button>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={onClose}>
                推送整改
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
