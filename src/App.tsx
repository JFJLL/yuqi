import { Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"
import { AdminLayout } from "@/components/admin/AdminLayout"
import { RequireAuth } from "@/components/admin/RequireAuth"
import { ComingSoon } from "@/components/admin/ComingSoon"
import { LoginPage } from "@/pages/LoginPage"
import { ForbiddenPage } from "@/pages/ForbiddenPage"
import { NotFoundPage } from "@/pages/NotFoundPage"
import { DashboardRoute } from "@/pages/Dashboard"
import { OrgRoute } from "@/pages/Org"
import { DevicesRoute } from "@/pages/Devices"
import { DeviceOpsRoute } from "@/pages/DeviceOps"
import { RecordsRoute } from "@/pages/Records"
import { InspectionRoute } from "@/pages/Inspection"
import { KnowledgeRoute } from "@/pages/Knowledge"
import { TasksRoute } from "@/pages/Tasks"
import { AppealsRoute } from "@/pages/Appeals"
import { ReportsRoute } from "@/pages/Reports"
import { LogsRoute } from "@/pages/Logs"
import { SettingsRoute } from "@/pages/Settings"
import { EmployeeLayout } from "@/employee/EmployeeLayout"
import { EmployeeLogin } from "@/employee/EmployeeLogin"
import { EmployeeHome } from "@/employee/EmployeeHome"
import { EmployeeIssues } from "@/employee/EmployeeIssues"
import { EmployeeIssueDetail } from "@/employee/EmployeeIssueDetail"
import { EmployeeAppeals } from "@/employee/EmployeeAppeals"
import { EmployeeRectifications } from "@/employee/EmployeeRectifications"
import { EmployeeNotifications } from "@/employee/EmployeeNotifications"
import { EmployeeDevice } from "@/employee/EmployeeDevice"
import { EmployeeProfilePage } from "@/employee/EmployeeProfile"
import { EmployeeConsent } from "@/employee/EmployeeConsent"

function App() {
  return (
    <>
      <Routes>
        {/* 管理端登录 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="/404" element={<NotFoundPage />} />

        {/* 员工端 */}
        <Route path="/employee/login" element={<EmployeeLogin />} />
        <Route element={<RequireAuth employeeOnly><EmployeeLayout /></RequireAuth>}>
          <Route path="/employee/home" element={<EmployeeHome />} />
          <Route path="/employee/issues" element={<EmployeeIssues />} />
          <Route path="/employee/issues/:id" element={<EmployeeIssueDetail />} />
          <Route path="/employee/appeals" element={<EmployeeAppeals />} />
          <Route path="/employee/rectifications" element={<EmployeeRectifications />} />
          <Route path="/employee/notifications" element={<EmployeeNotifications />} />
          <Route path="/employee/device" element={<EmployeeDevice />} />
          <Route path="/employee/consent" element={<EmployeeConsent />} />
          <Route path="/employee/profile" element={<EmployeeProfilePage />} />
        </Route>

        {/* 管理端 */}
        <Route element={<RequireAuth roles={["SUPER_ADMIN", "ADMIN", "COMPLIANCE", "REGION_MANAGER", "STORE_MANAGER", "AUDITOR"]}><AdminLayout /></RequireAuth>}>
          <Route path="/" element={<DashboardRoute />} />
          <Route path="/org" element={<OrgRoute />} />
          <Route path="/devices" element={<DevicesRoute />} />
          <Route path="/device-ops" element={<DeviceOpsRoute />} />
          <Route path="/records" element={<RecordsRoute />} />
          <Route path="/inspection" element={<InspectionRoute />} />
          <Route path="/knowledge" element={<KnowledgeRoute />} />
          <Route path="/tasks" element={<TasksRoute />} />
          <Route path="/appeals" element={<AppealsRoute />} />
          <Route path="/reports" element={<ReportsRoute />} />
          <Route path="/logs" element={<LogsRoute />} />
          <Route path="/settings" element={<SettingsRoute />} />
          {/* 一期占位模块, 后续再开发 */}
          <Route path="/drug-data" element={<ComingSoon />} />
          <Route path="/sales-ai" element={<ComingSoon />} />
          <Route path="/training" element={<ComingSoon />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster richColors position="bottom-right" />
    </>
  )
}

export default App
