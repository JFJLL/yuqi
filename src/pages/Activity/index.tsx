import { ActivityPage } from "./ActivityPage"
import { useActivity } from "./useActivity"

export function ActivityRoute() {
  const props = useActivity()
  return <ActivityPage {...props} />
}
