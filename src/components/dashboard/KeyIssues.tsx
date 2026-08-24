import type { DashboardKeyIssue, DashboardTab } from "@/lib/v1"
import { Button } from "@/components/ui/button"
import { Pill, riskTone, stateTone } from "./Pill"

interface KeyIssuesProps {
  issues: DashboardKeyIssue[]
  tab: DashboardTab
  loading: boolean
  onTabChange: (tab: DashboardTab) => void
  onView: (issue: DashboardKeyIssue) => void
}

const TABS: { key: DashboardTab; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "high", label: "高风险" },
  { key: "appealing", label: "申诉中" },
]

export function KeyIssues({ issues, tab, loading, onTabChange, onView }: KeyIssuesProps) {
  return (
    <section className="bg-card border border-border rounded-lg">
      <div className="min-h-[54px] px-4 py-3.5 border-b border-border flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-base font-semibold">今日重点问题</h2>
          <p className="mt-0.5 mb-0 text-muted-foreground text-xs">按风险等级、门店影响和重复发生次数排序。</p>
        </div>
        <div className="inline-grid grid-flow-col gap-1 p-1 border border-border rounded-lg bg-background">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onTabChange(item.key)}
              className={`min-h-[30px] border-0 rounded-md px-3 text-sm cursor-pointer transition-colors ${
                tab === item.key
                  ? "bg-card text-primary shadow-sm"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 overflow-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {["员工", "门店", "问题类型", "风险", "状态", "操作"].map((head) => (
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
            {issues.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-2.5 py-10 text-center text-muted-foreground">
                  当前筛选条件下暂无问题记录
                </td>
              </tr>
            )}
            {issues.map((issue) => (
              <tr key={issue.id} className="hover:bg-accent/40">
                <td className="px-2.5 py-3 border-b border-border">{issue.employee_name || "-"}</td>
                <td className="px-2.5 py-3 border-b border-border">{issue.store_name || "-"}</td>
                <td className="px-2.5 py-3 border-b border-border">{issue.issue_type}</td>
                <td className="px-2.5 py-3 border-b border-border">
                  <Pill tone={riskTone(issue.risk)}>{issue.risk}风险</Pill>
                </td>
                <td className="px-2.5 py-3 border-b border-border">
                  <Pill tone={stateTone(issue.state)}>{issue.state}</Pill>
                </td>
                <td className="px-2.5 py-3 border-b border-border">
                  <Button variant="link" className="h-auto p-0 text-primary font-semibold" onClick={() => onView(issue)}>
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
