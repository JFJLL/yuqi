import { Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"
import { AdminLayout } from "@/components/admin/AdminLayout"
import { ComingSoon } from "@/components/admin/ComingSoon"
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

function App() {
  return (
    <>
      <Routes>
        <Route element={<AdminLayout />}>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster richColors position="bottom-right" />
    </>
  )
}

export default App
