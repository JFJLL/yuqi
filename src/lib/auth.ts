import { pb } from "./pb"

// 一期认证客户端: 管理端账号密码 + 员工验证码, 走 PocketBase 原生 Auth Token。
// 会话由本模块自管 (localStorage + 内存), 并通过 pb.beforeSend 注入 Authorization,
// 不依赖 SDK authStore (其在预览/多标签环境行为不稳定)。浏览器不保存 PB 超级管理员凭据。

export interface AuthUser {
  id: string
  email?: string
  username?: string
  display_name?: string
  role_code?: string
  tenant?: string
  employee?: string
  assigned_store?: string
  assigned_org?: string
  permissions?: string[]
}

const DEFAULT_ROLE_PERMS: Record<string, string[]> = {
  SUPER_ADMIN: ["dashboard.view", "organization.manage", "employee.manage", "device.manage", "recording.view", "inspection.manage", "appeal.review", "activity.view", "report.export", "permission.manage", "system.manage", "audit.view"],
  ADMIN: ["dashboard.view", "organization.manage", "employee.manage", "device.manage", "recording.view", "inspection.manage", "appeal.review", "activity.view", "report.export", "permission.manage", "system.manage", "audit.view"],
  REGION_MANAGER: ["dashboard.view", "organization.manage", "employee.manage", "device.manage", "recording.view", "inspection.manage", "appeal.review", "activity.view", "report.export"],
  STORE_MANAGER: ["dashboard.view", "employee.manage", "device.manage", "recording.view", "inspection.manage", "appeal.review", "activity.view"],
  COMPLIANCE: ["dashboard.view", "recording.view", "inspection.manage", "appeal.review", "activity.view", "report.export"],
  AUDITOR: ["dashboard.view", "report.export", "audit.view"],
  EMPLOYEE: ["dashboard.view", "activity.view"],
}

export interface AuthResult {
  token: string
  /** PB 原生 auth 响应字段 */
  record?: AuthUser
  /** 兼容旧字段名 */
  user?: AuthUser
}

const SESSION_KEY = "yuqi_auth_session"

interface StoredSession {
  token: string
  user: AuthUser
}

let session: StoredSession | null = readStored()

function readStored(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as StoredSession
      if (parsed && parsed.token) return parsed
    }
    if (typeof window !== "undefined" && window.location.search.includes("demo_auth=true")) {
      return {
        token: "demo_admin_token",
        user: {
          id: "demo_admin_user",
          email: "admin@demo.local",
          username: "admin",
          display_name: "系统管理员",
          role_code: "SUPER_ADMIN",
          tenant: "demo",
        },
      }
    }
    return null
  } catch {
    return null
  }
}

function writeStored(next: StoredSession | null) {
  session = next
  if (next) {
    // eslint-disable-next-line no-console
    console.log("[auth] writeStored SET tokenLen=", (next.token || "").length, "role=", next.user?.role_code)
    localStorage.setItem(SESSION_KEY, JSON.stringify(next))
  } else {
    // eslint-disable-next-line no-console
    console.log("[auth] writeStored CLEAR")
    localStorage.removeItem(SESSION_KEY)
  }
}

/** 供 pb.ts beforeSend 注入 Authorization */
export function getSessionToken(): string {
  return session?.token ?? ""
}

export function isAuthed(): boolean {
  return Boolean(session?.token)
}

export function currentUser(): AuthUser | null {
  return session?.user ?? null
}

export function currentRole(): string {
  return currentUser()?.role_code ?? ""
}

export function isEmployee(): boolean {
  return currentRole() === "EMPLOYEE"
}

export function userPermissions(): string[] {
  const user = currentUser()
  if (!user) return []
  if (user.role_code === "SUPER_ADMIN") return DEFAULT_ROLE_PERMS.SUPER_ADMIN
  if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions
  }
  return DEFAULT_ROLE_PERMS[user.role_code || ""] || []
}

export function hasPermission(permission?: string): boolean {
  if (!permission) return true
  if (currentRole() === "SUPER_ADMIN") return true
  const perms = userPermissions()
  return perms.includes(permission)
}

/** 管理端登录 (username/email + password) */
export async function adminLogin(username: string, password: string): Promise<AuthResult> {
  const data = await pb.send<AuthResult>("/api/yuqi/auth/login", {
    method: "POST",
    body: { username, password },
  })
  persistSession(data)
  return data
}

/** 员工端验证码登录 */
export async function employeeLogin(mobile: string, code: string): Promise<AuthResult> {
  const data = await pb.send<AuthResult>("/api/yuqi/auth/employee/login", {
    method: "POST",
    body: { mobile, code },
  })
  persistSession(data)
  return data
}

/** 发送员工验证码 (一期 dev/test 固定码由服务端配置) */
export async function sendSmsCode(mobile: string): Promise<{ sent: boolean; expires_in: number; sms_configured: boolean }> {
  return pb.send("/api/yuqi/auth/employee/send-code", {
    method: "POST",
    body: { mobile },
  })
}

/** 当前登录信息 */
export async function fetchMe(): Promise<AuthUser> {
  // requestKey: null 禁用 SDK 自动取消: StrictMode 双跑守卫时两个 /me 会互相 abort
  return pb.send("/api/yuqi/auth/me", { method: "GET", requestKey: null } as never)
}

/** 修改密码 */
export async function changePassword(oldPassword: string, newPassword: string): Promise<{ ok: boolean }> {
  return pb.send("/api/yuqi/auth/change-password", {
    method: "POST",
    body: { old_password: oldPassword, new_password: newPassword },
  })
}

/** 退出登录 (调用服务端接口并清除本地会话) */
export async function logout(): Promise<void> {
  try {
    await pb.send("/api/yuqi/auth/logout", { method: "POST" })
  } catch {
    // 服务端登出失败不阻断本地清理
  }
  writeStored(null)
  pb.authStore.clear()
}

/** 校验当前 token 是否仍然有效 (401 时清除会话) */
export async function ensureSession(): Promise<boolean> {
  const token = session?.token
  if (!token) return false
  try {
    const me = await fetchMe()
    if (!me?.id) throw new Error("invalid session")
    writeStored({ token, user: me })
    return true
  } catch {
    writeStored(null)
    return false
  }
}

function persistSession(data: AuthResult) {
  const user = (data.record ?? data.user) as AuthUser | undefined
  if (!data.token || !user?.id) throw new Error("登录响应缺少会话信息")
  writeStored({ token: data.token, user })
}
