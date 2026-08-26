import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"
import { AdminLayout } from "@/components/admin/AdminLayout"
import { RequireAuth } from "@/components/admin/RequireAuth"
import { ComingSoon } from "@/components/admin/ComingSoon"

// 路由级代码分割 (Route-level Code Splitting), 提升首屏加载速度
const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })))
const ForbiddenPage = lazy(() => import("@/pages/ForbiddenPage").then((m) => ({ default: m.ForbiddenPage })))
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })))
const DashboardRoute = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.DashboardRoute })))
const OrgRoute = lazy(() => import("@/pages/Org").then((m) => ({ default: m.OrgRoute })))
const EmployeesRoute = lazy(() => import("@/pages/Employees").then((m) => ({ default: m.EmployeesRoute })))
const DevicesRoute = lazy(() => import("@/pages/Devices").then((m) => ({ default: m.DevicesRoute })))
const DeviceOpsRoute = lazy(() => import("@/pages/DeviceOps").then((m) => ({ default: m.DeviceOpsRoute })))
const RecordsRoute = lazy(() => import("@/pages/Records").then((m) => ({ default: m.RecordsRoute })))
const InspectionRoute = lazy(() => import("@/pages/Inspection").then((m) => ({ default: m.InspectionRoute })))
const KnowledgeRoute = lazy(() => import("@/pages/Knowledge").then((m) => ({ default: m.KnowledgeRoute })))
const TasksRoute = lazy(() => import("@/pages/Tasks").then((m) => ({ default: m.TasksRoute })))
const AppealsRoute = lazy(() => import("@/pages/Appeals").then((m) => ({ default: m.AppealsRoute })))
const ActivityRoute = lazy(() => import("@/pages/Activity").then((m) => ({ default: m.ActivityRoute })))
const PermissionsRoute = lazy(() => import("@/pages/Permissions").then((m) => ({ default: m.PermissionsRoute })))
const ReportsRoute = lazy(() => import("@/pages/Reports").then((m) => ({ default: m.ReportsRoute })))
const LogsRoute = lazy(() => import("@/pages/Logs").then((m) => ({ default: m.LogsRoute })))
const SettingsRoute = lazy(() => import("@/pages/Settings").then((m) => ({ default: m.SettingsRoute })))

const EmployeeLayout = lazy(() => import("@/employee/EmployeeLayout").then((m) => ({ default: m.EmployeeLayout })))
const EmployeeLogin = lazy(() => import("@/employee/EmployeeLogin").then((m) => ({ default: m.EmployeeLogin })))
const EmployeeHome = lazy(() => import("@/employee/EmployeeHome").then((m) => ({ default: m.EmployeeHome })))
const EmployeeIssues = lazy(() => import("@/employee/EmployeeIssues").then((m) => ({ default: m.EmployeeIssues })))
const EmployeeIssueDetail = lazy(() => import("@/employee/EmployeeIssueDetail").then((m) => ({ default: m.EmployeeIssueDetail })))
const EmployeeAppeals = lazy(() => import("@/employee/EmployeeAppeals").then((m) => ({ default: m.EmployeeAppeals })))
const EmployeeRectifications = lazy(() => import("@/employee/EmployeeRectifications").then((m) => ({ default: m.EmployeeRectifications })))
const EmployeeNotifications = lazy(() => import("@/employee/EmployeeNotifications").then((m) => ({ default: m.EmployeeNotifications })))
const EmployeeDevice = lazy(() => import("@/employee/EmployeeDevice").then((m) => ({ default: m.EmployeeDevice })))
const EmployeeProfilePage = lazy(() => import("@/employee/EmployeeProfile").then((m) => ({ default: m.EmployeeProfilePage })))
const EmployeeConsent = lazy(() => import("@/employee/EmployeeConsent").then((m) => ({ default: m.EmployeeConsent })))

function PageLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <span>加载中…</span>
      </div>
    </div>
  )
}

function App() {
  return (
    <>
      <Suspense fallback={<PageLoading />}>
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

        {/* 管理端 12 个目标模块 */}
        <Route element={<RequireAuth roles={["SUPER_ADMIN", "ADMIN", "COMPLIANCE", "REGION_MANAGER", "STORE_MANAGER", "AUDITOR"]}><AdminLayout /></RequireAuth>}>
          <Route path="/" element={<RequireAuth permission="dashboard.view"><DashboardRoute /></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth permission="dashboard.view"><DashboardRoute /></RequireAuth>} />
          <Route path="/organization" element={<RequireAuth permission="organization.manage"><OrgRoute /></RequireAuth>} />
          <Route path="/org" element={<RequireAuth permission="organization.manage"><OrgRoute /></RequireAuth>} />
          <Route path="/employees" element={<RequireAuth permission="employee.manage"><EmployeesRoute /></RequireAuth>} />
          <Route path="/devices" element={<RequireAuth permission="device.manage"><DevicesRoute /></RequireAuth>} />
          <Route path="/device-ops" element={<RequireAuth permission="device.manage"><DeviceOpsRoute /></RequireAuth>} />
          <Route path="/recordings" element={<RequireAuth permission="recording.view"><RecordsRoute /></RequireAuth>} />
          <Route path="/records" element={<RequireAuth permission="recording.view"><RecordsRoute /></RequireAuth>} />
          <Route path="/inspection" element={<RequireAuth permission="inspection.manage"><InspectionRoute /></RequireAuth>} />
          <Route path="/appeals" element={<RequireAuth permission="appeal.review"><AppealsRoute /></RequireAuth>} />
          <Route path="/activity" element={<RequireAuth permission="activity.view"><ActivityRoute /></RequireAuth>} />
          <Route path="/tasks" element={<RequireAuth permission="activity.view"><TasksRoute /></RequireAuth>} />
          <Route path="/reports" element={<RequireAuth permission="report.export"><ReportsRoute /></RequireAuth>} />
          <Route path="/permissions" element={<RequireAuth permission="permission.manage"><PermissionsRoute /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth permission="system.manage"><SettingsRoute /></RequireAuth>} />
          <Route path="/knowledge" element={<RequireAuth permission="system.manage"><KnowledgeRoute /></RequireAuth>} />
          <Route path="/audit" element={<RequireAuth permission="audit.view"><LogsRoute /></RequireAuth>} />
          <Route path="/logs" element={<RequireAuth permission="audit.view"><LogsRoute /></RequireAuth>} />
          {/* 兼容历史占位路由 */}
          <Route path="/drug-data" element={<ComingSoon />} />
          <Route path="/sales-ai" element={<ComingSoon />} />
          <Route path="/training" element={<ComingSoon />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
      <Toaster richColors position="bottom-right" />
    </>
  )
}

export default App
