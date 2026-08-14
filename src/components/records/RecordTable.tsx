import { Button } from "@/components/ui/button"
import { Pill, stateTone } from "@/components/dashboard/Pill"
import type { TranscriptRecord } from "@/lib/admin"

export interface RecordRow extends TranscriptRecord {
  employeeName: string
  storeName: string
}

interface RecordTableProps {
  rows: RecordRow[]
  loading: boolean
  onView: (row: RecordRow) => void
}

const HEADS = ["时间", "员工", "门店", "设备码", "文本摘要", "质检", "操作"]

export function RecordTable({ rows, loading, onView }: RecordTableProps) {
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
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-accent/40">
              <td className="px-2.5 py-3 border-b border-border whitespace-nowrap">
                {row.occurred_at ? row.occurred_at.slice(11, 16) : "-"}
              </td>
              <td className="px-2.5 py-3 border-b border-border">{row.employeeName || "-"}</td>
              <td className="px-2.5 py-3 border-b border-border">{row.storeName || "-"}</td>
              <td className="px-2.5 py-3 border-b border-border whitespace-nowrap">{row.device || "-"}</td>
              <td className="px-2.5 py-3 border-b border-border max-w-[360px]">
                <span className="line-clamp-2">{row.summary}</span>
              </td>
              <td className="px-2.5 py-3 border-b border-border">
                <Pill tone={stateTone(row.qc_result)}>{row.qc_result || "-"}</Pill>
              </td>
              <td className="px-2.5 py-3 border-b border-border">
                <Button variant="link" className="h-auto p-0 text-primary font-semibold" onClick={() => onView(row)}>
                  查看文本
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
