import { Button } from "@/components/ui/button"
import { Pill, stateTone, type PillTone } from "@/components/dashboard/Pill"
import { formatBeijingTime } from "@/lib/beijingTime"
import type { TranscriptRecord } from "@/lib/admin"

export interface RecordRow extends TranscriptRecord {
  employeeName: string
  storeName: string
}

interface RecordTableProps {
  rows: RecordRow[]
  loading: boolean
  onView: (row: RecordRow) => void
  onRetry?: (asrJobId: string) => void
  onDelete?: (row: RecordRow) => void
}

const HEADS = ["时间", "员工", "门店", "设备码", "时长", "ASR通道", "识别状态", "AI分析", "操作"]

const ASR_STATUS: Record<string, { label: string; tone: PillTone }> = {
  queued: { label: "排队中", tone: "gray" },
  running: { label: "转写中", tone: "blue" },
  succeeded: { label: "已完成", tone: "green" },
  failed: { label: "失败", tone: "red" },
}

function asrStatusInfo(status?: string) {
  return ASR_STATUS[status || ""] ?? { label: status ? "未知" : "-", tone: "gray" as PillTone }
}

function sourceInfo(source?: string): { label: string; tone: PillTone } {
  return source === "oss_auto"
    ? { label: "自动采集", tone: "blue" }
    : { label: "手动上传", tone: "gray" }
}

export function RecordTable({ rows, loading, onView, onRetry, onDelete }: RecordTableProps) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {HEADS.map((head) => (
              <th
                key={head}
                className="px-2.5 py-3 border-b border-border text-left font-semibold bg-muted/60 text-muted-foreground whitespace-nowrap"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && !loading && (
            <tr>
              <td colSpan={HEADS.length} className="px-2.5 py-10 text-center text-muted-foreground">
                没有符合条件的转写记录
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const asr = asrStatusInfo(row.asr_status)
            const source = sourceInfo(row.source)
            return (
              <tr key={row.id} className="hover:bg-accent/40">
                <td className="px-2.5 py-3 border-b border-border whitespace-nowrap">
                  {formatBeijingTime(row.occurred_at)}
                </td>
                <td className="px-2.5 py-3 border-b border-border">{row.employeeName || "-"}</td>
                <td className="px-2.5 py-3 border-b border-border">{row.storeName || "-"}</td>
                <td className="px-2.5 py-3 border-b border-border whitespace-nowrap">{row.device || "-"}</td>
                <td className="px-2.5 py-3 border-b border-border whitespace-nowrap">
                  <Pill tone={source.tone}>{source.label}</Pill>
                </td>
                <td className="px-2.5 py-3 border-b border-border max-w-[360px]">
                  <span className="line-clamp-2">{row.summary || row.audio_name || "-"}</span>
                </td>
                <td className="px-2.5 py-3 border-b border-border">
                  <Pill tone={asr.tone}>{asr.label}</Pill>
                </td>
                <td className="px-2.5 py-3 border-b border-border">
                  <Pill tone={stateTone(row.qc_result)}>{row.qc_result || "-"}</Pill>
                </td>
                <td className="px-2.5 py-3 border-b border-border">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <Button variant="link" className="h-auto p-0 text-primary font-semibold" onClick={() => onView(row)}>
                      查看文本
                    </Button>
                    {row.asr_status === "failed" && row.asr_job && onRetry && (
                      <Button variant="link" className="h-auto p-0 text-destructive font-semibold" onClick={() => onRetry(row.asr_job!)}>
                        重试
                      </Button>
                    )}
                    {onDelete && (
                      <Button variant="link" className="h-auto p-0 text-destructive font-semibold" onClick={() => onDelete(row)}>
                        删除
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
