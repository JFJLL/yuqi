import { AppealsPage } from "./AppealsPage"
import { useAppeals } from "./useAppeals"

// 申诉复核页入口: 组装逻辑与视图
export function AppealsRoute() {
  const appealsProps = useAppeals()
  return <AppealsPage {...appealsProps} />
}
