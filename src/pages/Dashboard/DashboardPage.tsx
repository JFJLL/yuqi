import { StatCards } from "@/components/dashboard/StatCards"
import { KeyIssues } from "@/components/dashboard/KeyIssues"
import { StoreRank } from "@/components/dashboard/StoreRank"
import { TodoReminders } from "@/components/dashboard/TodoReminders"
import { IssueDetailDialog } from "@/components/dashboard/IssueDetailDialog"
import type { DashboardProps } from "./useDashboard"

// 工作台视图: 只消费 props, 不自调逻辑 hook
export function DashboardPage({
  stats,
  keyIssues,
  storeRank,
  tab,
  loading,
  setTab,
  detailIssue,
  openDetail,
  closeDetail,
}: DashboardProps) {
  return (
    <div>
      <div className="h-1 w-12 rounded-full bg-primary mb-3" aria-hidden />
      <StatCards stats={stats} />
      <div className="grid grid-cols-[minmax(0,1.45fr)_360px] gap-3.5 items-start mt-3.5 max-xl:grid-cols-1">
        <KeyIssues issues={keyIssues} tab={tab} loading={loading} onTabChange={setTab} onView={openDetail} />
        <aside className="grid gap-3.5">
          <StoreRank items={storeRank} />
          <TodoReminders stats={stats} />
        </aside>
      </div>
      <IssueDetailDialog issue={detailIssue} onClose={closeDetail} />
    </div>
  )
}
