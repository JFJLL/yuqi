import { Button } from "@/components/ui/button"
import { Pill, stateTone } from "@/components/dashboard/Pill"
import type { RectifyTaskRecord } from "@/lib/admin"

export interface TaskRow extends RectifyTaskRecord {
  ownerName: string
  storeName: string
  sourceIssueType: string
}

interface TaskTableProps {
  rows: TaskRow[]
  loading: boolean
  onFollowUp: (row: TaskRow) => void
}

const HEADS = ["任务", "负责人", "门店", "来源问题", "截止时间", "进度", "状态", "操作"]

export function TaskTable({ rows, loading, onFollowUp }: TaskTableProps) {
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
                暂无整改任务
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-accent/40">
              <td className="px-2.5 py-3 border-b border-border font-semibold">{row.title}</td>
              <td className="px-2.5 py-3 border-b border-border">{row.ownerName || "-"}</td>
              <td className="px-2.5 py-3 border-b border-border">{row.storeName || "-"}</td>
              <td className="px-2.5 py-3 border-b border-border">{row.sourceIssueType || "-"}</td>
              <td className="px-2.5 py-3 border-b border-border whitespace-nowrap">
                {row.due_date ? row.due_date.slice(0, 10) : "-"}
              </td>
              <td className="px-2.5 py-3 border-b border-border min-w-[120px]">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(Math.max(row.progress ?? 0, 0), 100)}%` }}
                  />
                </div>
              </td>
              <td className="px-2.5 py-3 border-b border-border">
                <Pill tone={stateTone(row.state)}>{row.state}</Pill>
              </td>
              <td className="px-2.5 py-3 border-b border-border">
                <Button variant="link" className="h-auto p-0 text-primary font-semibold" onClick={() => onFollowUp(row)}>
                  跟进
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
