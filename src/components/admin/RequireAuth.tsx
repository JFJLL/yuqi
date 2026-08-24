import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/lib/auth"

// 路由守卫: 未登录一律跳转 /login (保留原路径, 登录后回跳)
export function RequireAuth() {
  const { me, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">正在加载…</div>
    )
  }
  if (!me) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <Outlet />
}
