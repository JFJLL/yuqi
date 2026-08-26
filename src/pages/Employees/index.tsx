import { EmployeesPage } from "./EmployeesPage"
import { useEmployees } from "./useEmployees"

export function EmployeesRoute() {
  const props = useEmployees()
  return <EmployeesPage {...props} />
}
