import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Pill, riskTone, stateTone } from "@/components/dashboard/Pill"
import type { IssueDetail } from "@/lib/v1"
import type { IssueRow } from "./IssueTable"

export type DetailIssue = IssueDetail & { employeeName: string; storeName: string }

interface IssueDetailDialogProps {
  issue: DetailIssue | null
  pushing: boolean
  reviewing: boolean
  onClose: () => void
  onPushRectify: (issue: IssueRow) => void
  onReview: (approve: boolean, comment?: string) => void
  onCloseIssue: () => void
}

export function IssueDetailDialog({
  issue,
  pushing,
  reviewing,
  onClose,
  onPushRectify,
  onReview,
  onCloseIssue,
}: IssueDetailDialogProps) {
  const [comment, setComment] = useState("")

  if (!issue) return null
  const isPendingReview = issue.review_status === "PENDING"
  const isClosed = issue.close_status === "CLOSED"

  return (
    <Dialog open={!!issue} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>{issue.employeeName || "-"} · {issue.issue_type}</span>
            <Pill tone={stateTone(issue.state)}>{issue.state}</Pill>
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
          <div className="border border-border rounded-lg p-3 bg-background grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm">问题信息</strong>
              <Pill tone={riskTone(issue.risk)}>{issue.risk}风险</Pill>
            </div>
            <span className="text-muted-foreground text-xs">
              {issue.storeName || "-"} · {issue.occurred_at ? issue.occurred_at.slice(0, 16) : "-"} · {issue.issue_no}
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
        {issue.segments.length > 0 && (
          <div className="border border-border rounded-lg p-3 bg-background grid gap-1.5">
            <strong className="text-sm">命中片段 ({issue.segments.length})</strong>
            {issue.segments.map((seg) => (
              <div key={seg.id} className="flex items-start gap-2 text-[13px]">
                <Pill tone={seg.status === "ACCEPTED" ? "green" : seg.status === "DISMISSED" ? "red" : "gray"}>
                  {seg.status === "ACCEPTED" ? "已确认" : seg.status === "DISMISSED" ? "已驳回" : "待定"}
                </Pill>
                <span className="text-foreground/90">{seg.matched_text}</span>
              </div>
            ))}
          </div>
        )}
        {issue.review.reviewed_at && (
          <p className="m-0 text-xs text-muted-foreground">
            复核于 {issue.review.reviewed_at.slice(0, 16)}: {issue.review.review_comment || issue.review.dismissed_reason || "-"}
          </p>
        )}
        {isPendingReview && (
          <div className="grid gap-2">
            <input
              className="min-h-9 w-full border border-border rounded-lg bg-card text-foreground outline-none px-2.5 text-sm focus:border-primary"
              placeholder="复核意见（可选）"
              value={comment}
              maxLength={200}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        )}
        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
          {isPendingReview ? (
            <>
              <Button
                variant="outline"
                className="text-destructive border-destructive/40 hover:bg-destructive/10"
                disabled={reviewing}
                onClick={() => onReview(false, comment)}
              >
                {reviewing ? "处理中…" : "驳回"}
              </Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={reviewing}
                onClick={() => onReview(true, comment)}
              >
                {reviewing ? "处理中…" : "通过复核"}
              </Button>
            </>
          ) : (
            <>
              {!isClosed && (
                <>
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={pushing || issue.state === "已完成"}
                    onClick={() => onPushRectify(issue)}
                  >
                    {pushing ? "推送中…" : "推送整改"}
                  </Button>
                  <Button variant="outline" disabled={reviewing} onClick={onCloseIssue}>
                    关闭问题
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
