import { useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  Activity,
  Badge,
  BarChart3,
  Bell,
  Bot,
  Brain,
  ClipboardCheck,
  Cross,
  FileText,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessagesSquare,
  Pill,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Store,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useAuth, hasPermission } from "@/lib/auth"
import { ChangePasswordDialog } from "./ChangePasswordDialog"

export interface NavItem {
  path: string
  label: string
  title: string
  subtitle: string
  icon: typeof Store
  /** 需要的后端权限; 为空表示登录即可见 */
  requiredPermission?: string
  /** 一期占位: 导航隐藏但保留路由 */
  phase1Hidden?: boolean
}

// 导航 (一期隐藏: 药品主数据 / AI荐药经营 / 培训考核)
export const NAV_ITEMS: NavItem[] = [
  { path: "/", label: "工作台", title: "工作台", subtitle: "查看门店合规风险、员工整改进度和设备运行状态。", icon: LayoutDashboard },
  { path: "/org", label: "门店员工", title: "门店员工", subtitle: "维护组织、门店、员工档案和账号状态。", icon: Store, requiredPermission: "employee:read" },
  { path: "/devices", label: "设备绑定", title: "设备绑定", subtitle: "设备码绑定销售人员、门店和使用状态。", icon: Badge, requiredPermission: "device:read" },
  { path: "/device-ops", label: "设备运行", title: "设备运行", subtitle: "查看设备在线、心跳、上传、操控和异常状态。", icon: Activity, requiredPermission: "device:read" },
  { path: "/records", label: "录音转写", title: "录音转写", subtitle: "按门店、员工、设备和时间检索音频索引与转写文本。", icon: FileText, requiredPermission: "records:read" },
  { path: "/inspection", label: "合规巡检", title: "合规巡检", subtitle: "查看 AI 识别的疑似问题、命中文本、风险等级和整改建议。", icon: ShieldAlert, requiredPermission: "issue:review" },
  { path: "/knowledge", label: "知识库模型", title: "知识库模型", subtitle: "维护医药词库、合规规则、评测样本和模型版本。", icon: Brain, requiredPermission: "rules:manage" },
  { path: "/drug-data", label: "药品主数据", title: "药品主数据", subtitle: "把 ERP 药品名和品牌匹配为标准药品。", icon: Pill, phase1Hidden: true },
  { path: "/sales-ai", label: "AI荐药经营", title: "AI荐药经营", subtitle: "管理 ERP 库存、组合用药、毛利排序。", icon: Bot, phase1Hidden: true },
  { path: "/tasks", label: "整改任务", title: "整改任务", subtitle: "按员工、门店和问题类型跟进整改闭环。", icon: ClipboardCheck, requiredPermission: "rectify:confirm" },
  { path: "/appeals", label: "申诉复核", title: "申诉复核", subtitle: "复核员工对 AI 问题判断的异议。", icon: MessagesSquare, requiredPermission: "appeal:review" },
  { path: "/training", label: "培训考核", title: "培训考核", subtitle: "根据巡检问题推荐课程和考试。", icon: GraduationCap, phase1Hidden: true },
  { path: "/reports", label: "统计报表", title: "统计报表", subtitle: "查看区域、门店、员工维度的合规分析。", icon: BarChart3, requiredPermission: "report:view" },
  { path: "/logs", label: "接口日志", title: "接口日志", subtitle: "查看转写推送、文本同步、重试和审计记录。", icon: ListChecks, requiredPermission: "audit:view" },
  { path: "/settings", label: "系统设置", title: "系统设置", subtitle: "配置规则、权限和数据同步。", icon: Settings2, requiredPermission: "users:manage" },
]

export function useCurrentNav(): NavItem {
  const { pathname } = useLocation()
  return NAV_ITEMS.find((item) => item.path === pathname) ?? NAV_ITEMS[0]
}

export function AdminLayout() {
  const current = useCurrentNav()
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  const [pwdOpen, setPwdOpen] = useState(false)
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.phase1Hidden && (!item.requiredPermission || hasPermission(me, item.requiredPermission)),
  )

  async function handleSync() {
    toast.error("数据同步已迁移至 FastAPI, 请在新版接口日志中查看")
  }

  async function handleLogout() {
    await logout()
    navigate("/login", { replace: true })
    toast.success("已退出登录")
  }

  return (
    <div className="min-h-screen grid grid-cols-[248px_minmax(0,1fr)] max-md:block bg-background text-foreground">
      <aside className="sticky top-0 h-screen flex flex-col gap-3.5 px-3 py-4 bg-sidebar text-sidebar-foreground max-md:static max-md:h-auto max-md:flex-row max-md:overflow-x-auto">
        <div className="flex items-center gap-2.5 px-2.5 pt-2 pb-3.5 border-b border-sidebar-border max-md:hidden">
          <div className="w-9 h-9 rounded-lg bg-primary grid place-items-center text-primary-foreground shrink-0">
            <Cross className="w-[18px] h-[18px]" />
          </div>
          <div>
            <strong className="block text-white text-base leading-tight">药店AI运营</strong>
            <span className="block mt-0.5 text-xs text-sidebar-foreground/70">巡检合规 + 智能工牌</span>
          </div>
        </div>
        <nav className="grid gap-1 overflow-auto pr-0.5 max-md:grid-flow-col max-md:grid-cols-none max-md:w-max" aria-label="主导航">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 min-h-10 px-2.5 rounded-lg text-sm no-underline transition-colors ${
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`
                }
              >
                <Icon className="w-[17px] h-[17px] shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <main className="min-w-0 px-6 pb-7 pt-5 max-md:px-3.5">
        <header className="min-h-14 mb-4 flex items-center justify-between gap-3.5 max-md:flex-col max-md:items-start">
          <div>
            <h1 className="m-0 text-[22px] leading-tight font-semibold">{current.title}</h1>
            <p className="mt-1 mb-0 text-muted-foreground text-[13px]">{current.subtitle}</p>
          </div>
          <div className="flex items-center gap-2.5">
            {me && (
              <span className="text-sm text-muted-foreground hidden md:inline">
                {me.user.display_name} · {me.tenant.name}
              </span>
            )}
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleSync} title="旧同步接口已废弃">
              <RefreshCw className="w-4 h-4" />
              同步数据
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setPwdOpen(true)}>
              <KeyRound className="w-4 h-4" />
              修改密码
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
              退出
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9" title="通知">
              <Bell className="w-4 h-4" />
            </Button>
          </div>
        </header>
        <Outlet />
      </main>
      <ChangePasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} />
    </div>
  )
}
