import { Button } from "@/components/ui/button"
import { Pill, stateTone } from "@/components/dashboard/Pill"
import type { Device } from "@/lib/admin"

export interface DeviceRow extends Device {
  employeeName: string
  storeName: string
  bound: boolean
}

interface DeviceTableProps {
  rows: DeviceRow[]
  loading: boolean
  onAdjust: (row: DeviceRow) => void
}

const HEADS = ["设备码", "类型", "员工", "门店", "状态", "电量", "今日文本", "最近在线", "操作"]

function formatPower(power: number): string {
  if (power === null || power === undefined) return "-"
  return `${power}%`
}

function formatOnline(at: string): string {
  if (!at) return "-"
  const date = new Date(at.includes("T") ? at : at.replace(" ", "T"))
  if (Number.isNaN(date.getTime())) return at
  const diffMin = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000))
  if (diffMin < 1) return "刚刚"
  if (diffMin < 60) return `${diffMin}分钟前`
  if (diffMin < 24 * 60) return `${Math.round(diffMin / 60)}小时前`
  return `${date.getMonth() + 1}-${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

export function DeviceTable({ rows, loading, onAdjust }: DeviceTableProps) {
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
                没有符合条件的设备
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-accent/40">
              <td className="px-2.5 py-3 border-b border-border font-semibold whitespace-nowrap">{row.device_no}</td>
              <td className="px-2.5 py-3 border-b border-border">{row.type}</td>
              <td className="px-2.5 py-3 border-b border-border">{row.bound ? row.employeeName : "未绑定"}</td>
              <td className="px-2.5 py-3 border-b border-border">{row.bound ? row.storeName : "未绑定"}</td>
              <td className="px-2.5 py-3 border-b border-border">
                <Pill tone={stateTone(row.status)}>{row.status}</Pill>
              </td>
              <td className="px-2.5 py-3 border-b border-border">
                <span className={row.power <= 20 ? "text-[hsl(var(--destructive))] font-semibold" : ""}>
                  {formatPower(row.power)}
                </span>
              </td>
              <td className="px-2.5 py-3 border-b border-border">{row.texts_today ?? 0}</td>
              <td className="px-2.5 py-3 border-b border-border whitespace-nowrap">{formatOnline(row.last_online_at)}</td>
              <td className="px-2.5 py-3 border-b border-border">
                <Button variant="link" className="h-auto p-0 text-primary font-semibold" onClick={() => onAdjust(row)}>
                  调整
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
