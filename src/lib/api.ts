// FastAPI 前端客户端: Access Token 内存持有 + Refresh Cookie 轮换 + 401 自动刷新
// 类型来自 OpenAPI 自动生成 (src/lib/api.gen.ts), 禁止手工维护不一致的类型。

let accessToken: string | null = null
let refreshPromise: Promise<string | null> | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken(): string | null {
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

async function requestId(): Promise<string> {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const resp = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: { "X-Request-Id": await requestId() },
      })
      if (!resp.ok) return null
      const body = (await resp.json()) as { access_token: string }
      accessToken = body.access_token
      return body.access_token
    } catch {
      return null
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

export interface ApiInit extends RequestInit {
  /** 401 时不自动刷新 Token (如登录接口自身) */
  skipRefresh?: boolean
}

export async function apiFetch<T>(path: string, init: ApiInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "X-Request-Id": await requestId(),
    ...(init.headers as Record<string, string> | undefined),
  }
  // multipart 上传时由浏览器自动生成 boundary, 不得预设 Content-Type
  if (!(init.body instanceof FormData)) headers["Content-Type"] = "application/json"
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  let resp = await fetch(`/api/v1${path}`, { ...init, headers, credentials: "include" })

  if (resp.status === 401 && !init.skipRefresh) {
    const fresh = await refreshAccessToken()
    if (fresh) {
      headers.Authorization = `Bearer ${fresh}`
      resp = await fetch(`/api/v1${path}`, { ...init, headers, credentials: "include" })
    }
  }

  if (!resp.ok) {
    let code = "http_error"
    let message = `请求失败 (HTTP ${resp.status})`
    try {
      const body = (await resp.json()) as { error?: { code?: string; message?: string } }
      code = body.error?.code ?? code
      message = body.error?.message ?? message
    } catch {
      // 非 JSON 响应
    }
    throw new ApiError(resp.status, code, message)
  }
  return (await resp.json()) as T
}

export interface MePayload {
  user: {
    id: string
    tenant_id: string
    username: string
    mobile: string | null
    display_name: string
    status: string
    is_super_admin: boolean
    created_at: string
    roles: { id: string; code: string; name: string }[]
  }
  tenant: { id: string; code: string; name: string; status: string; is_demo: boolean }
  roles: { id: string; code: string; name: string }[]
  permissions: string[]
  data_scope_types: string[]
  is_super_admin: boolean
}

export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<{ access_token: string; expires_in: number; user: MePayload["user"]; permissions: string[] }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => apiFetch<MePayload>("/me"),
  logout: () => apiFetch<{ ok: boolean; message: string }>("/auth/logout", { method: "POST" }),
  changePassword: (old_password: string, new_password: string) =>
    apiFetch<{ ok: boolean; message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ old_password, new_password }),
    }),
}
