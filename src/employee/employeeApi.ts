import { pb } from "@/lib/pb"

// 员工自助服务 API (全部走后端守卫路由, 服务端强制 tenant+本人范围)

export interface EmployeeHome {
  issue_count: number
  rectification_count: number
  appeal_count: number
  unread_notifications: number
  binding: DeviceBinding | null
  consent: boolean
  server_time: string
}

export interface Issue {
  id: string
  tenant: string
  session: string
  employee: string
  store: string
  rule_code: string
  risk_level: string
  title: string
  summary: string
  evidence_text: string
  start_ms: number
  end_ms: number
  advice: string
  recommended_expression: string
  review_status: string
  employee_visibility: string
  appeal_status: string
  rectification_status: string
  close_status: string
  pushed_at: string
  created: string
}

export interface RiskSegment {
  id: string
  sequence: number
  start_ms: number
  end_ms: number
  speaker: string
  text: string
  risk_level: string
}

export interface DeviceBinding {
  id: string
  device: string
  employee: string
  store: string
  status: string
  effective_date: string
}

export interface Device {
  id: string
  device_no: string
  type: string
  status: string
  power: number
  last_online_at: string
}

export interface EmployeeProfile {
  user: {
    id: string
    display_name: string
    email: string
    mobile: string
    role_code: string
  }
  employee: {
    id: string
    name: string
    phone: string
    role: string
    status: string
  }
  store: { id: string; name: string } | null
}

export interface Rectification {
  id: string
  issue: string
  title: string
  status: string
  requirements: string
  due_at: string
  submission_text: string
  evidence_file: string
  confirmation_comment: string
  retry_count: number
  created: string
}

export interface Appeal {
  id: string
  issue_ref: string
  reason: string
  supplementary_text: string
  status: string
  review_comment: string
  submitted_at: string
  created: string
}

export interface Notification {
  id: string
  title: string
  body: string
  type: string
  link: string
  is_read: boolean
  created: string
}

export function fetchHome(): Promise<EmployeeHome> {
  return pb.send("/api/yuqi/employee/home", { method: "GET" })
}

export function fetchMyIssues(): Promise<{ items: Issue[]; totalItems: number }> {
  return pb.send("/api/yuqi/employee/issues", { method: "GET", query: { perPage: 100 } })
}

export function fetchIssueDetail(id: string): Promise<{ issue: Issue; segments: RiskSegment[] }> {
  return pb.send(`/api/yuqi/employee/issues/${id}`, { method: "GET" })
}

export function fetchDevice(): Promise<{ binding: DeviceBinding | null; device: Device | null; consent: boolean }> {
  return pb.send("/api/yuqi/employee/device", { method: "GET" })
}

export function fetchProfile(): Promise<EmployeeProfile> {
  return pb.send("/api/yuqi/employee/profile", { method: "GET" })
}

export function submitConsent(contentVersion = "v1"): Promise<{ ok: boolean }> {
  return pb.send("/api/yuqi/employee/consent", { method: "POST", body: { agreed: true, content_version: contentVersion } })
}

export function requestBinding(deviceNo: string): Promise<{ id: string; status: string }> {
  return pb.send("/api/yuqi/device-bindings/request", { method: "POST", body: { device_no: deviceNo } })
}

export function submitAppeal(issueId: string, reason: string): Promise<{ id: string }> {
  return pb.send("/api/yuqi/employee/appeals", { method: "POST", body: { issue_id: issueId, reason } })
}

export function supplementAppeal(appealId: string, supplementaryText: string): Promise<{ id: string }> {
  return pb.send(`/api/yuqi/employee/appeals/${appealId}/supplement`, {
    method: "POST",
    body: { supplementary_text: supplementaryText },
  })
}

export function submitRectification(rectId: string, submissionText: string, evidenceFile?: string): Promise<{ id: string }> {
  return pb.send(`/api/yuqi/rectifications/${rectId}/submit`, {
    method: "POST",
    body: { submission_text: submissionText, evidence_file: evidenceFile },
  })
}

export function fetchMyRectifications(): Promise<{ items: Rectification[]; totalItems: number }> {
  return pb.send("/api/rectifications", { method: "GET", query: { perPage: 100 } })
}

export function fetchMyAppeals(): Promise<{ items: Appeal[]; totalItems: number }> {
  return pb.send("/api/appeals", { method: "GET", query: { perPage: 100 } })
}

export function fetchNotifications(): Promise<{ items: Notification[]; totalItems: number }> {
  return pb.send("/api/notifications", { method: "GET", query: { perPage: 100 } })
}

export function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  return pb.send(`/api/yuqi/notifications/${id}/read`, { method: "POST" })
}

export function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  return pb.send("/api/yuqi/notifications/read-all", { method: "POST" })
}
