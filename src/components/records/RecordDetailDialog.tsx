import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Pill, stateTone, type PillTone } from "@/components/dashboard/Pill"
import type { RecordRow } from "./RecordTable"

interface RecordDetailDialogProps {
  record: RecordRow | null
  onClose: () => void
}

const ASR_STATE: Record<string, { label: string; tone: PillTone }> = {
  queued: { label: "ASR 排队中", tone: "gray" },
  running: { label: "ASR 转写中", tone: "blue" },
  succeeded: { label: "ASR 已完成", tone: "green" },
  failed: { label: "ASR 失败", tone: "red" },
}

function millisecondsLabel(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--:--"
  const totalSeconds = Math.max(0, Math.floor(value / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export function RecordDetailDialog({ record, onClose }: RecordDetailDialogProps) {
  const asrState = record?.asr_status ? ASR_STATE[record.asr_status] : null
  const segments = record?.segments_json ?? []

  return (
    <Dialog open={!!record} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        {record && (
          <>
            <DialogHeader>
              <DialogTitle>转写详情 · {record.employeeName || "-"}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{record.storeName || "-"}</span>
              <span>·</span>
              <span>设备 {record.device || "-"}</span>
              <span>·</span>
              <span>{record.occurred_at ? record.occurred_at.slice(0, 16) : "-"}</span>
              {record.audio_name && <span>· 文件 {record.audio_name}</span>}
              {asrState && <Pill tone={asrState.tone}>{asrState.label}</Pill>}
              <Pill tone={stateTone(record.qc_result)}>{record.qc_result || "-"}</Pill>
            </div>
            <div className="border border-border rounded-lg bg-background p-3.5 text-sm leading-relaxed whitespace-pre-wrap">
              {record.full_text || record.summary || "转写结果尚未生成"}
            </div>
            {segments.length > 0 && (
              <details className="rounded-lg border border-border bg-muted/20 px-3.5 py-2.5">
                <summary className="cursor-pointer text-sm font-medium">句子分段与时间戳（{segments.length} 条）</summary>
                <div className="mt-3 max-h-56 overflow-auto grid gap-2">
                  {segments.map((segment, index) => (
                    <div key={`${segment.start_ms}-${segment.end_ms}-${index}`} className="grid grid-cols-[90px_72px_1fr] gap-2 text-xs leading-relaxed max-sm:grid-cols-1">
                      <span className="text-muted-foreground">
                        {millisecondsLabel(segment.start_ms)} – {millisecondsLabel(segment.end_ms)}
                      </span>
                      <span className="text-muted-foreground">{segment.speaker || "unknown"}</span>
                      <span>{segment.text}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
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
