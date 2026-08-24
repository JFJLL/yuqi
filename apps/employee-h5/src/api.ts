// 员工 H5 API 客户端: 全部走真实后端 /api/v1 (登录后持有 Bearer Token)

let accessToken: string | null = null

export function setToken(token: string | null) {
  accessToken = token
}

export function getToken(): string | null {
  return accessToken
}

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const resp = await fetch(`/api/v1${path}`, { ...init, headers, credentials: "include" })
  if (!resp.ok) {
    let code = "http_error"
    let message = `请求失败 (HTTP ${resp.status})`
    try {
      const body = (await resp.json()) as { error?: { code?: string; message?: string } }
      code = body.error?.code ?? code
      message = body.error?.message ?? message
    } catch {
      // 非 JSON
    }
    throw new ApiError(resp.status, code, message)
  }
  return (await resp.json()) as T
}

export interface LoginPayload {
  access_token: string
  expires_in: number
  user: { id: string; display_name: string; mobile: string | null }
  tenant: { id: string; code: string; name: string }
  permissions: string[]
}

export const authApi = {
  sendSms: (mobile: string) =>
    request<{ ok: boolean; expires_in: number; debug_code?: string | null }>("/auth/sms/send", {
      method: "POST",
      body: JSON.stringify({ mobile }),
    }),
  loginBySms: (mobile: string, code: string) =>
    request<LoginPayload>("/auth/sms/login", {
      method: "POST",
      body: JSON.stringify({ mobile, code }),
    }),
}

export interface MyIssue {
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

export interface MyRectification {
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

interface Page<T> {
  items: T[]
  page: number
  page_size: number
  total: number
  total_pages: number
}

export const meApi = {
  issues: (status = "") => request<Page<MyIssue>>(`/me/issues${status ? `?status=${status}` : ""}`),
  appeal: (id: string, reason: string) =>
    request<{ ok: boolean; appeal_status: string }>(`/me/issues/${id}/appeal`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  rectifications: (status = "") =>
    request<Page<MyRectification>>(`/me/rectifications${status ? `?status=${status}` : ""}`),
  submitRectification: (id: string, comment: string) =>
    request<{ ok: boolean; status: string }>(`/me/rectifications/${id}/submit`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    }),
}
