import { OrgPage } from "./OrgPage"
import { useOrg } from "./useOrg"

// 门店员工页入口: 组装逻辑与视图
export function OrgRoute() {
  const orgProps = useOrg()
  return <OrgPage {...orgProps} />
}
