import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { TaskRow } from "./TaskTable"

interface ConfirmDialogProps {
  task: TaskRow
  busy: boolean
  comment: string
  onCommentChange: (comment: string) => void
  onClose: () => void
  onConfirm: (approve: boolean) => void
}

// 确认员工提交的整改结果: 通过 / 驳回(可附意见)
export function ConfirmDialog({ task, busy, comment, onCommentChange, onClose, onConfirm }: ConfirmDialogProps) {
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>确认整改结果</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="border border-border rounded-lg p-3 bg-background grid gap-1.5">
            <strong className="text-sm">{task.title}</strong>
            <span className="text-muted-foreground text-xs">
              {task.ownerName || "-"} · {task.storeName || "-"}
            </span>
            {task.submit_comment ? (
              <p className="m-0 text-sm text-foreground/90 bg-card border border-border rounded-md px-2.5 py-2">
                员工说明：{task.submit_comment}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs">复核意见（可选）</label>
            <textarea
              className="min-h-20 w-full border border-border rounded-lg bg-card text-foreground outline-none px-2.5 py-2 text-sm resize-y focus:border-primary"
              placeholder="填写确认或驳回意见"
              value={comment}
              onChange={(e) => onCommentChange(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="outline"
            className="border-[hsl(var(--destructive)/0.3)] text-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.06)] hover:bg-[hsl(var(--destructive)/0.12)]"
            disabled={busy}
            onClick={() => onConfirm(false)}
          >
            驳回
          </Button>
          <Button
            className="bg-[hsl(var(--success))] text-primary-foreground hover:bg-[hsl(var(--success)/0.9)]"
            disabled={busy}
            onClick={() => onConfirm(true)}
          >
            确认完成
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
