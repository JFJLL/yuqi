import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Pill, riskTone, stateTone } from "@/components/dashboard/Pill"
import type { IssueRow } from "./IssueTable"

interface IssueDetailDialogProps {
  issue: IssueRow | null
  pushing: boolean
  onClose: () => void
  onPushRectify: (issue: IssueRow) => void
  onDismiss?: (issue: IssueRow) => void
  onCloseIssue?: (issue: IssueRow) => void
}

export function IssueDetailDialog({ issue, pushing, onClose, onPushRectify, onDismiss, onCloseIssue }: IssueDetailDialogProps) {
  return (
    <Dialog open={!!issue} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        {issue && (
          <>
            <DialogHeader>
              <DialogTitle>
                {issue.employeeName || "-"} · {issue.issue_type}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
              <div className="border border-border rounded-lg p-3 bg-background grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">问题信息</strong>
                  <Pill tone={riskTone(issue.risk)}>{issue.risk}风险</Pill>
                </div>
                <span className="text-muted-foreground text-xs">
                  {issue.storeName || "-"} · {issue.occurred_at ? issue.occurred_at.slice(0, 16) : "-"} ·{" "}
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
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#edf1f5]">
              <div className="flex items-center gap-2">
                {onDismiss && issue.state !== "已完成" && issue.state !== "误报关闭" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[#c2410c] border-[#ffedd5] bg-[#ffedd5]/50 hover:bg-[#ffedd5]"
                    disabled={pushing}
                    onClick={() => onDismiss(issue)}
                  >
                    判定为误报/忽略
                  </Button>
                )}
                {onCloseIssue && issue.state !== "已完成" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[#147054] border-[#e6f4ef] bg-[#e6f4ef]/50 hover:bg-[#e6f4ef]"
                    disabled={pushing}
                    onClick={() => onCloseIssue(issue)}
                  >
                    审核通过并关闭
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onClose} className="border-[#dbe3ec]">
                  关闭
                </Button>
                <Button
                  size="sm"
                  className="bg-[#1672a8] hover:bg-[#125c88] text-white"
                  disabled={pushing || issue.state === "已完成" || issue.state === "误报关闭"}
                  onClick={() => onPushRectify(issue)}
                >
                  {pushing ? "处理中…" : "审核通过并推送整改"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
