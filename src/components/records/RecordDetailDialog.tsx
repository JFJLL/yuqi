import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Pill, stateTone } from "@/components/dashboard/Pill"
import type { RecordRow } from "./RecordTable"

interface RecordDetailDialogProps {
  record: RecordRow | null
  onClose: () => void
}

export function RecordDetailDialog({ record, onClose }: RecordDetailDialogProps) {
  return (
    <Dialog open={!!record} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        {record && (
          <>
            <DialogHeader>
              <DialogTitle>
                转写详情 · {record.employeeName || "-"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{record.storeName || "-"}</span>
              <span>·</span>
              <span>设备 {record.device || "-"}</span>
              <span>·</span>
              <span>{record.occurred_at ? record.occurred_at.slice(0, 16) : "-"}</span>
              <Pill tone={stateTone(record.qc_result)}>{record.qc_result || "-"}</Pill>
            </div>
            <div className="border border-border rounded-lg bg-background p-3.5 text-sm leading-relaxed whitespace-pre-wrap">
              {record.full_text || record.summary}
            </div>
            <div className="flex justify-end pt-1">
              <Button variant="outline" onClick={onClose}>
                关闭
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
