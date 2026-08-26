import { useEffect, useState, type ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { currentRole, ensureSession, hasPermission, isAuthed } from "@/lib/auth"

interface RequireAuthProps {
  children: ReactNode
  /** 允许的角色; 不传表示任意已登录用户 */
  roles?: string[]
  /** 页面所需权限标识 */
  permission?: string
  /** 员工端专用 (EMPLOYEE 角色) */
  employeeOnly?: boolean
}

/** 路由守卫: 未登录跳转 /login, 角色不符跳转 /403 */
export function RequireAuth({ children, roles, permission, employeeOnly }: RequireAuthProps) {
  const location = useLocation()
  const [authed, setAuthed] = useState(() => isAuthed())
  const [checking, setChecking] = useState(() => !isAuthed())

  useEffect(() => {
    let alive = true
    if (!isAuthed()) {
      ensureSession().then((valid) => {
        if (!alive) return
        setAuthed(valid)
        setChecking(false)
      })
    } else {
      // 静默后台校验会话有效性，零阻塞页面即时渲染
      ensureSession().then((valid) => {
        if (!alive) return
        if (!valid) setAuthed(false)
      })
    }
    return () => {
      alive = false
    }
  }, [location.pathname])

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        正在验证登录状态…
      </div>
    )
  }
  if (!authed) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  const role = currentRole()
  if (employeeOnly && role !== "EMPLOYEE") return <Navigate to="/403" replace />
  if (roles && roles.length > 0 && !roles.includes(role)) return <Navigate to="/403" replace />
  if (permission && !hasPermission(permission)) return <Navigate to="/403" replace />
  return <>{children}</>
}
