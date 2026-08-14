import { RecordsPage } from "./RecordsPage"
import { useRecords } from "./useRecords"

// 录音转写页入口: 组装逻辑与视图
export function RecordsRoute() {
  const recordsProps = useRecords()
  return <RecordsPage {...recordsProps} />
}
