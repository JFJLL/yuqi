import { PermissionsPage } from "./PermissionsPage"
import { usePermissions } from "./usePermissions"

export function PermissionsRoute() {
  const props = usePermissions()
  return <PermissionsPage {...props} />
}
