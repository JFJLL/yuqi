import { Button } from "@/components/ui/button"
import { Pill, stateTone } from "@/components/dashboard/Pill"
import type { RectificationItem } from "@/lib/v1"

export interface TaskRow extends RectificationItem {
  ownerName: string
  storeName: string
}

interface TaskTableProps {
  rows: TaskRow[]
  loading: boolean
  onFollowUp: (row: TaskRow) => void
  onConfirm: (row: TaskRow) => void
}

const HEADS = ["任务", "负责人", "门店", "来源问题", "截止时间", "进度", "状态", "操作"]

const STATUS_LABEL: Record<string, string> = {
  PENDING: "待整改",
  SUBMITTED: "待确认",
  CONFIRMED: "已完成",
  REJECTED: "已驳回",
}

export function TaskTable({ rows, loading, onFollowUp, onConfirm }: TaskTableProps) {
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
          {rows.map((row) => {
            const label = STATUS_LABEL[row.status] ?? row.status
            return (
              <tr key={row.id} className="hover:bg-accent/40">
                <td className="px-2.5 py-3 border-b border-border font-semibold max-w-[220px]">
                  <span className="line-clamp-1">{row.title}</span>
                </td>
                <td className="px-2.5 py-3 border-b border-border">{row.ownerName || "-"}</td>
                <td className="px-2.5 py-3 border-b border-border">{row.storeName || "-"}</td>
                <td className="px-2.5 py-3 border-b border-border whitespace-nowrap">{row.issue_type || "-"}</td>
                <td className="px-2.5 py-3 border-b border-border whitespace-nowrap">
                  {row.due_date ? row.due_date.slice(0, 10) : "-"}
                  {row.overdue ? <span className="ml-1.5 text-destructive text-xs">已逾期</span> : null}
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
                  <Pill tone={stateTone(label)}>{label}</Pill>
                </td>
                <td className="px-2.5 py-3 border-b border-border">
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    {row.status === "PENDING" && (
                      <Button variant="link" className="h-auto p-0 text-primary font-semibold" onClick={() => onFollowUp(row)}>
                        跟进
                      </Button>
                    )}
                    {row.status === "SUBMITTED" && (
                      <Button variant="link" className="h-auto p-0 text-primary font-semibold" onClick={() => onConfirm(row)}>
                        确认
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
