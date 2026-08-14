import { Button } from "@/components/ui/button"
import { Pill, stateTone, type PillTone } from "@/components/dashboard/Pill"
import type { DeviceLog } from "@/lib/admin"

export interface DeviceLogRow extends DeviceLog {
  deviceNo: string
  employeeName: string
  storeName: string
}

interface DeviceLogTableProps {
  rows: DeviceLogRow[]
  tab: string
  loading: boolean
  onTabChange: (tab: string) => void
}

const TABS = ["全部", "心跳", "上传", "操控"]
const HEADS = ["时间", "设备码", "员工", "门店", "类型", "内容", "状态", "操作"]

function logTypeTone(type: string): PillTone {
  if (type === "心跳") return "blue"
  if (type === "上传") return "green"
  return "violet"
}

export function DeviceLogTable({ rows, tab, loading, onTabChange }: DeviceLogTableProps) {
  return (
    <section className="bg-card border border-border rounded-lg mt-3.5">
      <div className="min-h-[54px] px-4 py-3.5 border-b border-border flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-base font-semibold">设备运行监控</h2>
          <p className="mt-0.5 mb-0 text-muted-foreground text-xs">查看设备在线、心跳、上传、登录和操控记录。</p>
        </div>
        <div className="inline-grid grid-flow-col gap-1 p-1 border border-border rounded-lg bg-background">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onTabChange(item)}
              className={`min-h-[30px] border-0 rounded-md px-3 text-sm cursor-pointer transition-colors ${
                tab === item
                  ? "bg-card text-primary shadow-sm"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 overflow-auto">
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
                  暂无该类型的设备日志
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-accent/40">
                <td className="px-2.5 py-3 border-b border-border whitespace-nowrap">
                  {row.occurred_at ? row.occurred_at.slice(11, 19) : "-"}
                </td>
                <td className="px-2.5 py-3 border-b border-border font-semibold whitespace-nowrap">{row.deviceNo}</td>
                <td className="px-2.5 py-3 border-b border-border">{row.employeeName || "未绑定"}</td>
                <td className="px-2.5 py-3 border-b border-border">{row.storeName || "未绑定"}</td>
                <td className="px-2.5 py-3 border-b border-border">
                  <Pill tone={logTypeTone(row.type)}>{row.type}</Pill>
                </td>
                <td className="px-2.5 py-3 border-b border-border">{row.content}</td>
                <td className="px-2.5 py-3 border-b border-border">
                  <Pill tone={stateTone(row.status)}>{row.status}</Pill>
                </td>
                <td className="px-2.5 py-3 border-b border-border">
                  <Button variant="link" className="h-auto p-0 text-primary font-semibold">
                    查看
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
