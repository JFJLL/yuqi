import { InspectionPage } from "./InspectionPage"
import { useInspection } from "./useInspection"

// 合规巡检页入口: 组装逻辑与视图
export function InspectionRoute() {
  const inspectionProps = useInspection()
  return <InspectionPage {...inspectionProps} />
}
