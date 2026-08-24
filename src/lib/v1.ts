// 阶段二端点类型化客户端: 组织 / 员工 / 门店 / 设备 / 绑定 / 运行事件
// 全部使用 FastAPI 服务端分页, 不再拉全量后在浏览器聚合。

import { apiFetch } from "./api"

export interface PageMeta {
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface Page<T> extends PageMeta {
  items: T[]
}

export interface OrgNodeItem {
  id: string
  parent_id: string | null
  node_type: string
  name: string
  code: string
  sort_order: number
  status: string
  children?: OrgNodeItem[]
}

export interface StoreItem {
  id: string
  node_id: string
  name: string
  code: string
  address: string | null
  phone: string | null
  status: string
}

export interface EmployeeItem {
  id: string
  employee_no: string
  name: string
  mobile: string | null
  mobile_masked: string | null
  job_title: string | null
  organization_node_id: string | null
  store_id: string | null
  store_name: string | null
  manager_id: string | null
  employment_status: string
  account_status: string
  joined_at: string | null
  left_at: string | null
  created_at: string
}

export interface DeviceItem {
  id: string
  device_code: string
  device_type: string
  vendor: string | null
  model: string | null
  status: string
  online_status: string
  last_heartbeat_at: string | null
  battery_level: number | null
  firmware_version: string | null
  // 服务端联查的当前生效绑定
  bound?: boolean
  employee_id?: string | null
  employee_name?: string | null
  store_id?: string | null
  store_name?: string | null
}

export interface DeviceSummary {
  total: number
  online: number
  offline: number
  bound: number
  unbound: number
  low_power: number
}

export interface DeviceEventItem {
  id: string
  occurred_at: string
  type: string
  content: string
  status: string
  device_code: string | null
  employee_name: string | null
  actor_name: string | null
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ""
}

// ---- 组织 ----
export const fetchOrgTree = () => apiFetch<OrgNodeItem[]>("/org/tree")

export const fetchStores = (params: { page?: number; page_size?: number; keyword?: string } = {}) =>
  apiFetch<Page<StoreItem>>(`/stores${qs(params)}`)

// ---- 员工 ----
export const fetchEmployees = (params: {
  page?: number
  page_size?: number
  keyword?: string
  store_id?: string
  region_id?: string
  job_title?: string
  status?: string
} = {}) => apiFetch<Page<EmployeeItem>>(`/employees${qs(params)}`)

export const createEmployee = (body: {
  employee_no: string
  name: string
  mobile: string
  job_title?: string | null
  organization_node_id?: string | null
  store_id?: string | null
  joined_at?: string | null
}) => apiFetch<EmployeeItem>("/employees", { method: "POST", body: JSON.stringify(body) })

// ---- 设备 ----
export const fetchDevices = (params: {
  page?: number
  page_size?: number
  keyword?: string
  status?: string
} = {}) => apiFetch<Page<DeviceItem>>(`/devices${qs(params)}`)

export const fetchDeviceSummary = () => apiFetch<DeviceSummary>("/devices/summary")

export const createDevice = (body: { device_code: string; device_type?: string; vendor?: string | null; model?: string | null }) =>
  apiFetch<DeviceItem>("/devices", { method: "POST", body: JSON.stringify(body) })

export const bindDevice = (body: { device_id: string; employee_id: string; start_at?: string | null }) =>
  apiFetch<Record<string, unknown>>("/devices/bind", { method: "POST", body: JSON.stringify(body) })

export const unbindDevice = (body: { device_id: string; end_at?: string | null }) =>
  apiFetch<Record<string, unknown>>("/devices/unbind", { method: "POST", body: JSON.stringify(body) })

export const fetchDeviceEvents = (params: {
  page?: number
  page_size?: number
  event_type?: string
} = {}) => apiFetch<Page<DeviceEventItem>>(`/device-events${qs(params)}`)

// ---- 录音/转写 (阶段三) ----
export interface RecordingListItem {
  id: string
  occurred_at: string
  employee: string | null
  store: string | null
  employee_name: string | null
  store_name: string | null
  device: string | null
  source: string
  audio_name: string | null
  summary: string
  qc_result: string
  asr_status: string
  asr_job: string | null
  file_size: number | null
}

export interface TranscriptSegmentV1 {
  text: string
  start_ms: number | null
  end_ms: number | null
  speaker: string
}

export interface TranscriptMarkV1 {
  speaker: string
  start_ms: number | null
  end_ms: number | null
  color: string
  note: string
  created_at: string | null
}

export interface RecordingDetail {
  id: string
  audio_file_id: string
  device: string | null
  employee: string | null
  store: string | null
  employee_name: string | null
  store_name: string | null
  summary: string
  full_text: string
  segments_json: TranscriptSegmentV1[] | null
  asr_job: string | null
  asr_status: string
  model: string | null
  audio_name: string | null
  source: string
  qc_result: string
  occurred_at: string | null
  speaker_aliases: Record<string, string> | null
  marks_json: TranscriptMarkV1[] | null
  current_version: number
  file_size: number | null
}

export interface RecordingSummary {
  total: number
  done_count: number
  pending_count: number
  failed_count: number
  retryable_count: number
  merge_count: number
  resend_count: number
}

export interface TextVersionV1 {
  id: string
  version_no: number
  full_text: string
  summary: string
  segments_json: TranscriptSegmentV1[] | null
  marks_json: TranscriptMarkV1[] | null
  speaker_aliases: Record<string, string> | null
  source: string
  edited_by: string | null
  created_at: string
}

export const fetchRecordings = (params: {
  page?: number
  page_size?: number
  keyword?: string
  date?: string
  store_id?: string
  employee_id?: string
  qc_result?: string
  asr_status?: string
} = {}) => apiFetch<Page<RecordingListItem>>(`/recordings${qs(params)}`)

export const fetchRecordingSummary = () => apiFetch<RecordingSummary>("/recordings/summary")

export const fetchRecordingDetail = (id: string) => apiFetch<RecordingDetail>(`/recordings/${id}`)

export const uploadRecording = (form: FormData) =>
  apiFetch<{ id: string; asr_job: string; status: string }>("/recordings/upload", {
    method: "POST",
    body: form,
  })

export const retryRecording = (id: string) =>
  apiFetch<{ id: string; asr_job: string; status: string }>(`/recordings/${id}/retry`, { method: "POST" })

export const updateTranscript = (id: string, body: {
  segments: TranscriptSegmentV1[]
  full_text: string
  summary: string
  marks: TranscriptMarkV1[]
  speaker_aliases: Record<string, string>
  edit_reason?: string | null
}) => apiFetch<{ ok: boolean; version: number }>(`/recordings/${id}/transcript`, {
  method: "PATCH",
  body: JSON.stringify(body),
})

export const fetchRecordVersions = (id: string) => apiFetch<TextVersionV1[]>(`/recordings/${id}/versions`)

export const deleteRecording = (id: string) => apiFetch<{ ok: boolean }>(`/recordings/${id}`, { method: "DELETE" })

// ---- 风险规则 / 疑似问题 (阶段四) ----
export interface RiskRuleItem {
  id: string
  rule_set: string
  code: string
  name: string
  description: string
  category: string
  severity: string
  keywords: string[]
  enabled: boolean
  version_no: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface RiskRuleVersionItem {
  id: string
  version_no: number
  snapshot: Record<string, unknown>
  changed_by: string | null
  change_note: string | null
  created_at: string
}

export interface IssueItem {
  id: string
  issue_no: string
  occurred_at: string | null
  employee: string | null
  store: string | null
  employee_name: string | null
  store_name: string | null
  issue_type: string
  risk: string
  quote: string
  advice: string
  source: string
  state: string
  review_status: string
  appeal_status: string
  remediation_status: string
  close_status: string
  employee_view_status: string
  segment_count: number
  due_date: string | null
}

export interface IssueSegmentItem {
  id: string
  rule_code: string
  rule_name: string
  matched_text: string
  matched_keywords: string[]
  speaker: string
  start_ms: number | null
  end_ms: number | null
  status: string
}

export interface IssueDetail extends IssueItem {
  segments: IssueSegmentItem[]
  review: {
    reviewed_by: string | null
    reviewed_at: string | null
    review_comment: string | null
    dismissed_reason: string | null
  }
}

export const fetchRules = (params: {
  page?: number
  page_size?: number
  keyword?: string
  enabled?: string
} = {}) => apiFetch<Page<RiskRuleItem>>(`/rules${qs(params)}`)

export const createRule = (body: {
  code: string
  name: string
  category: string
  severity: string
  keywords: string[]
  description?: string
  enabled?: boolean
  change_note?: string
}) => apiFetch<RiskRuleItem>("/rules", { method: "POST", body: JSON.stringify(body) })

export const updateRule = (id: string, body: Partial<{
  name: string
  description: string
  category: string
  severity: string
  keywords: string[]
  enabled: boolean
  change_note: string
}>) => apiFetch<RiskRuleItem>(`/rules/${id}`, { method: "PATCH", body: JSON.stringify(body) })

export const fetchRuleVersions = (id: string) => apiFetch<RiskRuleVersionItem[]>(`/rules/${id}/versions`)

export const deleteRule = (id: string) => apiFetch<{ ok: boolean }>(`/rules/${id}`, { method: "DELETE" })

export const fetchIssues = (params: {
  page?: number
  page_size?: number
  keyword?: string
  risk?: string
  state?: string
  issue_type?: string
  date?: string
  store_id?: string
  employee_id?: string
} = {}) => apiFetch<Page<IssueItem>>(`/issues${qs(params)}`)

export const fetchIssueDetail = (id: string) => apiFetch<IssueDetail>(`/issues/${id}`)

export const reviewIssue = (id: string, body: { approve: boolean; comment?: string | null }) =>
  apiFetch<{ ok: boolean; review_status: string }>(`/issues/${id}/review`, { method: "POST", body: JSON.stringify(body) })

export const closeIssue = (id: string, body: { comment?: string | null } = {}) =>
  apiFetch<{ ok: boolean; close_status: string }>(`/issues/${id}/close`, { method: "POST", body: JSON.stringify(body) })

export const pushRectify = (id: string, body: { due_date?: string | null } = {}) =>
  apiFetch<{ ok: boolean; rectify_task_id: string; status: string }>(`/issues/${id}/push-rectify`, { method: "POST", body: JSON.stringify(body) })

export const rerunAnalysis = () =>
  apiFetch<{ ok: boolean; issues_created: number; segments_created: number; rules_matched: number }>("/analysis/rerun", { method: "POST", body: JSON.stringify({}) })

// ---- 整改任务 / 申诉 (阶段五) ----
export interface RectificationItem {
  id: string
  issue_id: string
  title: string
  issue_type: string
  quote: string
  employee_id: string | null
  employee_name: string | null
  store_name: string | null
  due_date: string
  status: string
  progress: number
  submit_comment: string | null
  overdue: boolean
  escalation_count: number
  created_at: string
}

export interface RectificationSummary {
  total: number
  pending: number
  submitted: number
  confirmed: number
  rejected: number
  overdue: number
  escalated: number
  new_today: number
  completion_rate: number
}

export interface AppealItem extends IssueItem {
  appeal_reason: string | null
  appeal_reviewed_at: string | null
  appeal_review_comment: string | null
}

export interface NotificationItem {
  id: string
  title: string
  body: string
  notif_type: string
  ref_type: string | null
  ref_id: string | null
  read: boolean
  created_at: string
}

export interface MyIssueItem {
  id: string
  issue_no: string
  issue_type: string
  risk: string
  quote: string
  advice: string
  state: string
  review_status: string
  appeal_status: string
  remediation_status: string
  close_status: string
  appeal_reason: string | null
  occurred_at: string | null
  due_date: string | null
}

export interface MyRectificationItem {
  id: string
  issue_id: string
  title: string
  issue_type: string
  quote: string
  due_date: string
  status: string
  progress: number
  submit_comment: string | null
  escalation_count: number
  escalated_at: string | null
  created_at: string
}

export const fetchRectifications = (params: {
  page?: number
  page_size?: number
  status?: string
  keyword?: string
} = {}) => apiFetch<Page<RectificationItem>>(`/rectifications${qs(params)}`)

export const fetchRectificationSummary = () => apiFetch<RectificationSummary>("/rectifications/summary")

export const updateRectification = (id: string, body: { due_date?: string | null; progress?: number | null }) =>
  apiFetch<{ ok: boolean; id: string }>(`/rectifications/${id}`, { method: "PATCH", body: JSON.stringify(body) })

export const confirmRectification = (id: string, body: { approve: boolean; comment?: string | null }) =>
  apiFetch<{ ok: boolean; status: string }>(`/rectifications/${id}/confirm`, { method: "POST", body: JSON.stringify(body) })

export const fetchAppeals = (params: {
  page?: number
  page_size?: number
  status?: string
} = {}) => apiFetch<Page<AppealItem>>(`/appeals${qs(params)}`)

export const reviewAppeal = (id: string, body: { approve: boolean; comment?: string | null }) =>
  apiFetch<{ ok: boolean; appeal_status: string }>(`/issues/${id}/appeal-review`, { method: "POST", body: JSON.stringify(body) })

export const fetchNotifications = (params: {
  page?: number
  page_size?: number
  unread_only?: boolean
} = {}) => apiFetch<Page<NotificationItem>>(`/notifications${qs(params)}`)

export const fetchUnreadCount = () => apiFetch<{ count: number }>("/notifications/unread-count")

export const markNotificationsRead = (id?: string) =>
  apiFetch<{ ok: boolean; marked: number }>("/notifications/read", {
    method: "POST",
    body: JSON.stringify(id ? { id } : {}),
  })

export const fetchMyIssues = (params: { page?: number; page_size?: number; status?: string } = {}) =>
  apiFetch<Page<MyIssueItem>>(`/me/issues${qs(params)}`)

export const appealMyIssue = (id: string, reason: string) =>
  apiFetch<{ ok: boolean; appeal_status: string }>(`/me/issues/${id}/appeal`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })

export const fetchMyRectifications = (params: { page?: number; page_size?: number; status?: string } = {}) =>
  apiFetch<Page<MyRectificationItem>>(`/me/rectifications${qs(params)}`)

export const submitMyRectification = (id: string, comment: string) =>
  apiFetch<{ ok: boolean; status: string }>(`/me/rectifications/${id}/submit`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  })

// ---- 报表 / 审计 / 设置 (阶段六) ----
export interface ReportOverview {
  issues_total: number
  high_risk: number
  issues_today: number
  rectify_rate: number
  rectify_total: number
  overdue_tasks: number
  recordings_total: number
  transcripts_total: number
  pending_appeals: number
  stores_total: number
}

export interface RegionReportItem {
  region_id: string
  region_name: string
  store_count: number
  recording_count: number
  issue_count: number
  high_risk: number
  rectify_rate: number
  appeal_pass_rate: number
}

export interface AuditLogItem {
  id: string
  actor_id: string | null
  actor_name: string | null
  action: string
  resource_type: string
  resource_id: string | null
  detail: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  created_at: string | null
}

export const fetchReportOverview = (params: { from?: string; to?: string } = {}) =>
  apiFetch<ReportOverview>(`/reports/overview${qs(params)}`)

export const fetchReportRegions = () => apiFetch<{ items: RegionReportItem[] }>("/reports/regions")

export const fetchAuditLogs = (params: {
  page?: number
  page_size?: number
  keyword?: string
  action?: string
  date?: string
} = {}) => apiFetch<Page<AuditLogItem>>(`/audit-logs${qs(params)}`)

export const fetchSettings = () => apiFetch<{ retention_days: string }>("/settings")

export const updateSettings = (body: { retention_days: number }) =>
  apiFetch<{ ok: boolean; retention_days: string }>("/settings", { method: "PUT", body: JSON.stringify(body) })

// ---- 录音上传 (multipart) ----
export interface AsrSubmission {
  file: File
  device?: string
  employee?: string
  store?: string
  occurred_at?: string
  language?: string
  hotwords?: string
}

// ---- 工作台 (阶段六) ----
export type DashboardTab = "all" | "high" | "appealing"

export interface DashboardStats {
  transcripts_today: number
  stores_covered: number
  stores_total: number
  issues_today: number
  high_risk: number
  rectify_rate: number
  open_tasks: number
  overdue_tasks: number
  pending_appeals: number
  overdue_appeals: number
}

export interface DashboardKeyIssue {
  id: string
  employee_name: string | null
  store_name: string | null
  issue_type: string
  risk: string
  state: string
  quote: string
  advice: string
  occurred_at: string | null
}

export interface DashboardStoreRankItem {
  store_id: string
  store_name: string
  issue_count: number
  share: number
}

export interface DashboardSummary {
  stats: DashboardStats
  key_issues: DashboardKeyIssue[]
  store_rank: DashboardStoreRankItem[]
}

export const fetchDashboardSummary = (tab: DashboardTab = "all") =>
  apiFetch<DashboardSummary>(`/dashboard/summary${qs({ tab })}`)

// ---- 通用分页工具 ----
export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}
