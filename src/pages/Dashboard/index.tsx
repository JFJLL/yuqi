import { DashboardPage } from "./DashboardPage"
import { useDashboard } from "./useDashboard"

// 工作台页入口: 组装逻辑与视图
export function DashboardRoute() {
  const dashboardProps = useDashboard()
  return <DashboardPage {...dashboardProps} />
}
