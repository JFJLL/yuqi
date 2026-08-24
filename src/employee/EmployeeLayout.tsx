import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { Bell, FileText, Home, LogOut, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { logout } from "@/lib/auth"

export function EmployeeLayout() {
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate("/employee/login", { replace: true })
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-0.5 text-[11px] no-underline transition-colors ${
      isActive ? "text-primary font-medium" : "text-muted-foreground"
    }`

  return (
    <div className="min-h-screen max-w-md mx-auto bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 h-14 border-b bg-card">
        <strong className="text-[15px]">员工工作台</strong>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground" onClick={handleLogout}>
          <LogOut className="w-4 h-4" />
          退出
        </Button>
      </header>
      <main className="flex-1 px-4 py-4 pb-24">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-10 grid grid-cols-4 border-t bg-card py-1.5">
        <NavLink to="/employee/home" end className={navClass}>
          <Home className="w-5 h-5" />首页
        </NavLink>
        <NavLink to="/employee/issues" className={navClass}>
          <FileText className="w-5 h-5" />问题
        </NavLink>
        <NavLink to="/employee/notifications" className={navClass}>
          <Bell className="w-5 h-5" />消息
        </NavLink>
        <NavLink to="/employee/profile" className={navClass}>
          <UserRound className="w-5 h-5" />我的
        </NavLink>
      </nav>
    </div>
  )
}
