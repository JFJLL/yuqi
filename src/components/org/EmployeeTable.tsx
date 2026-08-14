import { Button } from "@/components/ui/button"
import { Pill, stateTone } from "@/components/dashboard/Pill"
import type { Employee } from "@/lib/admin"

export interface EmployeeRow extends Employee {
  storeName: string
  regionName: string
  issueCount: number
}

interface EmployeeTableProps {
  rows: EmployeeRow[]
  loading: boolean
  onEdit: (employee: EmployeeRow) => void
}

const HEADS = ["员工", "手机号", "岗位", "门店", "绑定设备", "本月问题", "状态", "操作"]

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
              <td className="px-2.5 py-3 border-b border-border font-semibold">{row.name}</td>
              <td className="px-2.5 py-3 border-b border-border">{row.phone || "-"}</td>
              <td className="px-2.5 py-3 border-b border-border">{row.role || "-"}</td>
              <td className="px-2.5 py-3 border-b border-border">
                {row.storeName || "-"}
                {row.regionName ? (
                  <span className="text-muted-foreground text-xs ml-1.5">{row.regionName}</span>
                ) : null}
              </td>
              {/* 设备模块建好后替换为真实绑定设备码 */}
              <td className="px-2.5 py-3 border-b border-border">-</td>
              <td className="px-2.5 py-3 border-b border-border">{row.issueCount}</td>
              <td className="px-2.5 py-3 border-b border-border">
                <Pill tone={stateTone(row.status)}>{row.status || "-"}</Pill>
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
