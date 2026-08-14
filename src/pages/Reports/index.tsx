import { ReportsPage } from "./ReportsPage"
import { useReports } from "./useReports"

// 统计报表页入口: 组装逻辑与视图
export function ReportsRoute() {
  const reportsProps = useReports()
  return <ReportsPage {...reportsProps} />
}
