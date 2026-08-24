import { Button } from "@/components/ui/button"
import { Pill, stateTone } from "@/components/dashboard/Pill"
import type { EmployeeItem } from "@/lib/v1"

export interface EmployeeRow extends EmployeeItem {
  storeName: string
  regionName: string
  issueCount: number
}

interface EmployeeTableProps {
  rows: EmployeeRow[]
  loading: boolean
  onEdit: (employee: EmployeeRow) => void
}

const HEADS = ["员工号", "员工", "手机号", "岗位", "门店", "状态", "操作"]

function employmentLabel(status: string): string {
  if (status === "LEAVING") return "离职中"
  if (status === "LEFT") return "已离职"
  return "在职"
}

export function EmployeeTable({ rows, loading, onEdit }: EmployeeTableProps) {
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
                没有符合条件的员工
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-accent/40">
              <td className="px-2.5 py-3 border-b border-border font-mono text-xs">{row.employee_no}</td>
              <td className="px-2.5 py-3 border-b border-border font-semibold">{row.name}</td>
              <td className="px-2.5 py-3 border-b border-border">{row.mobile_masked || "-"}</td>
              <td className="px-2.5 py-3 border-b border-border">{row.job_title || "-"}</td>
              <td className="px-2.5 py-3 border-b border-border">{row.storeName || "-"}</td>
              <td className="px-2.5 py-3 border-b border-border">
                <Pill tone={stateTone(row.employment_status)}>{employmentLabel(row.employment_status)}</Pill>
              </td>
              <td className="px-2.5 py-3 border-b border-border">
                <Button variant="link" className="h-auto p-0 text-primary font-semibold" onClick={() => onEdit(row)}>
                  编辑
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
