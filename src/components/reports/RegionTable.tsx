export interface RegionRow {
  regionId: string
  regionName: string
  storeCount: number
  recordingCount: number
  issueCount: number
  highRisk: number
  rectifyRate: number
  appealPassRate: number
}

interface RegionTableProps {
  rows: RegionRow[]
  loading: boolean
}

const HEADS = ["区域", "门店数", "录音数", "问题数", "高风险", "整改完成率", "申诉通过率"]

export function RegionTable({ rows, loading }: RegionTableProps) {
  return (
    <section className="bg-card border border-border rounded-lg mt-3.5">
      <div className="min-h-[54px] px-4 py-3.5 border-b border-border">
        <h2 className="m-0 text-base font-semibold">区域经营概览</h2>
        <p className="mt-0.5 mb-0 text-muted-foreground text-xs">按区域、门店和员工汇总巡检结果。</p>
      </div>
      <div className="p-4 overflow-auto">
        <table className="w-full border-collapse text-sm">
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
                  暂无区域数据
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.regionId} className="hover:bg-accent/40">
                <td className="px-2.5 py-3 border-b border-border font-semibold">{row.regionName}</td>
                <td className="px-2.5 py-3 border-b border-border">{row.storeCount}</td>
                <td className="px-2.5 py-3 border-b border-border">{row.recordingCount}</td>
                <td className="px-2.5 py-3 border-b border-border">{row.issueCount}</td>
                <td className="px-2.5 py-3 border-b border-border">
                  <span className={row.highRisk > 0 ? "text-[hsl(var(--destructive))] font-semibold" : ""}>
                    {row.highRisk}
                  </span>
                </td>
                <td className="px-2.5 py-3 border-b border-border">{row.rectifyRate}%</td>
                <td className="px-2.5 py-3 border-b border-border">{row.appealPassRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
