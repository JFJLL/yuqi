import { LogsPage } from "./LogsPage"
import { useLogs } from "./useLogs"

// 接口日志页入口: 组装逻辑与视图
export function LogsRoute() {
  const logsProps = useLogs()
  return <LogsPage {...logsProps} />
}
