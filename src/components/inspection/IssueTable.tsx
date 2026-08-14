import { Button } from "@/components/ui/button"
import { Pill, riskTone, stateTone } from "@/components/dashboard/Pill"
import type { InspectionIssueRecord } from "@/lib/admin"

export interface IssueRow extends InspectionIssueRecord {
  employeeName: string
  storeName: string
}

interface IssueTableProps {
  rows: IssueRow[]
  loading: boolean
  onDetail: (row: IssueRow) => void
}

const HEADS = ["时间", "员工", "门店", "问题类型", "命中文本", "风险", "状态", "操作"]

export function IssueTable({ rows, loading, onDetail }: IssueTableProps) {
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
                没有符合条件的巡检问题
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
              <td className="px-2.5 py-3 border-b border-border whitespace-nowrap">{row.issue_type}</td>
              <td className="px-2.5 py-3 border-b border-border max-w-[320px]">
                <span className="inline-block border-l-[3px] border-primary bg-background rounded-r-md px-2 py-1 leading-relaxed text-foreground/90">
                  {row.quote}
                </span>
              </td>
              <td className="px-2.5 py-3 border-b border-border">
                <Pill tone={riskTone(row.risk)}>{row.risk}风险</Pill>
              </td>
              <td className="px-2.5 py-3 border-b border-border">
                <Pill tone={stateTone(row.state)}>{row.state}</Pill>
              </td>
              <td className="px-2.5 py-3 border-b border-border">
                <Button variant="link" className="h-auto p-0 text-primary font-semibold" onClick={() => onDetail(row)}>
                  详情
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
