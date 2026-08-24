import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { authApi, setAccessToken, type MePayload } from "./api"

export interface AuthState {
  me: MePayload | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<MePayload | void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MePayload | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const payload = await authApi.me()
      setMe(payload)
      return payload
    } catch {
      setMe(null)
      setAccessToken(null)
      throw new Error("unauthorized")
    }
  }, [])

  useEffect(() => {
    // 启动时尝试用 Refresh Cookie 恢复会话
    ;(async () => {
      try {
        await refresh()
      } catch {
        // 未登录
      } finally {
        setLoading(false)
      }
    })()
  }, [refresh])

  const login = useCallback(
    async (username: string, password: string) => {
      const payload = await authApi.login(username, password)
      setAccessToken(payload.access_token)
      await refresh()
    },
    [refresh],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // 忽略登出接口错误
    }
    setAccessToken(null)
    setMe(null)
  }, [])

  return (
    <AuthContext.Provider value={{ me, loading, login, logout, refresh }}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth 必须在 AuthProvider 内使用")
  return ctx
}

// 权限工具: 超级管理员默认拥有全部权限
export function hasPermission(me: MePayload | null, permission: string): boolean {
  if (!me) return false
  if (me.is_super_admin) return true
  return me.permissions.includes(permission)
}
