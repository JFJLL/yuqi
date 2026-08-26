import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useEffect } from "react"
import {
  AudioLines,
  Badge,
  Building2,
  FileBarChart,
  History,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageSquareWarning,
  RefreshCw,
  ScanSearch,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { triggerSync } from "@/lib/admin"
import { currentRole, currentUser, hasPermission, logout } from "@/lib/auth"

export interface NavItem {
  path: string
  label: string
  title: string
  subtitle: string
  icon: typeof LayoutDashboard
  group?: string
  permission?: string
}

export interface NavSection {
  label?: string
  items: NavItem[]
}

// 经理版 12 个目标模块（4个分组）
export const NAV_ITEMS: NavItem[] = [
  // 工作总览
  { path: "/", label: "工作总览", title: "工作总览", subtitle: "查看权限范围内的门店、设备、录音和巡检处理状态。", icon: LayoutDashboard, permission: "dashboard.view" },

  // 组织与设备
  { path: "/organization", label: "区域与门店", title: "区域与门店", subtitle: "维护区域负责人及门店归属与店长设置。", icon: Building2, group: "组织与设备", permission: "organization.manage" },
  { path: "/employees", label: "员工与店长", title: "员工与店长", subtitle: "员工岗位决定小程序角色和数据查看范围。", icon: Users, group: "组织与设备", permission: "employee.manage" },
  { path: "/devices", label: "设备管理", title: "设备管理", subtitle: "维护设备库存及员工、门店绑定关系与运行状态。", icon: Badge, group: "组织与设备", permission: "device.manage" },

  // 巡检业务
  { path: "/recordings", label: "录音与转写", title: "录音与转写", subtitle: "检索服务器文件索引、转写文本及识别通道。", icon: AudioLines, group: "巡检业务", permission: "recording.view" },
  { path: "/inspection", label: "AI巡检结果", title: "AI巡检结果", subtitle: "查看风险问题、命中文本与整改状态。", icon: ScanSearch, group: "巡检业务", permission: "inspection.manage" },
  { path: "/appeals", label: "申诉复核", title: "申诉复核", subtitle: "复核员工对 AI 问题判断的异议与整改情况。", icon: MessageSquareWarning, group: "巡检业务", permission: "appeal.review" },
  { path: "/activity", label: "员工业务记录", title: "员工业务记录", subtitle: "查看员工维度的荐药和学习记录。", icon: History, group: "巡检业务", permission: "activity.view" },

  // 管理配置
  { path: "/reports", label: "基础报表", title: "基础报表", subtitle: "导出组织、人员和巡检基础报表与合规经营指标。", icon: FileBarChart, group: "管理配置", permission: "report.export" },
  { path: "/permissions", label: "账号与权限", title: "账号与权限", subtitle: "配置后台账号、角色权限矩阵和数据范围。", icon: KeyRound, group: "管理配置", permission: "permission.manage" },
  { path: "/settings", label: "系统参数", title: "系统参数", subtitle: "配置转写、分析和数据保留参数及巡检规则、知识库。", icon: Settings2, group: "管理配置", permission: "system.manage" },
  { path: "/audit", label: "操作审计", title: "操作审计", subtitle: "追踪后台真实写操作、接口调用与数据同步日志。", icon: ListChecks, group: "管理配置", permission: "audit.view" },
]

export const NAV_SECTIONS: NavSection[] = [
  {
    items: NAV_ITEMS.filter((item) => !item.group),
  },
  {
    label: "组织与设备",
    items: NAV_ITEMS.filter((item) => item.group === "组织与设备"),
  },
  {
    label: "巡检业务",
    items: NAV_ITEMS.filter((item) => item.group === "巡检业务"),
  },
  {
    label: "管理配置",
    items: NAV_ITEMS.filter((item) => item.group === "管理配置"),
  },
]

export function useCurrentNav(): NavItem {
  const { pathname } = useLocation()
  // 兼容老路径别名
  const aliasMap: Record<string, string> = {
    "/org": "/organization",
    "/records": "/recordings",
    "/tasks": "/activity",
    "/logs": "/audit",
    "/device-ops": "/devices",
    "/knowledge": "/settings",
  }
  const targetPath = aliasMap[pathname] || pathname
  return NAV_ITEMS.find((item) => item.path === targetPath) ?? NAV_ITEMS[0]
}

export function visibleNavSections(): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => hasPermission(item.permission)),
  })).filter((section) => section.items.length > 0)
}

export function AdminLayout() {
  const current = useCurrentNav()
  const navigate = useNavigate()
  const user = currentUser()
  const role = currentRole()

  // 预加载后台核心模块，消除首次点击标签页时的网络等待
  useEffect(() => {
    const timer = setTimeout(() => {
      import("@/pages/Dashboard")
      import("@/pages/Org")
      import("@/pages/Employees")
      import("@/pages/Devices")
      import("@/pages/Records")
      import("@/pages/Inspection")
      import("@/pages/Appeals")
      import("@/pages/Activity")
      import("@/pages/Reports")
      import("@/pages/Permissions")
      import("@/pages/Settings")
      import("@/pages/Logs")
    }, 200)
    return () => clearTimeout(timer)
  }, [])

  async function handleSync() {
    try {
      await triggerSync()
      toast.success("数据已刷新")
    } catch {
      toast.error("同步失败，请稍后重试")
    }
  }

  async function handleLogout() {
    await logout()
    toast.success("已退出登录")
    navigate("/login", { replace: true })
  }

  // 范围提示文本
  const userStore = user?.assigned_store
  const userOrg = user?.assigned_org
  const scopeText = userStore ? "门店工作台" : userOrg ? "大区工作台" : "总部工作台"

  const roleLabel = role === "SUPER_ADMIN" ? "超级管理员" : role === "ADMIN" ? "管理员" : role === "STORE_MANAGER" ? "店长" : role === "REGION_MANAGER" ? "区域经理" : role || "管理员"

  return (
    <div className="min-h-screen grid grid-cols-[240px_minmax(0,1fr)] max-md:block bg-[#f3f6f9] text-[#172033]">
      <aside className="sticky top-0 h-screen flex flex-col gap-2 px-3.5 py-4 bg-[#102236] text-[#d8e4ef] max-md:static max-md:h-auto max-md:flex-row max-md:overflow-x-auto select-none">
        <div className="flex items-center gap-3 px-2 pt-1 pb-4 border-b border-[#ffffff18] max-md:hidden">
          <div className="w-[38px] h-[38px] rounded-[7px] bg-[#2587bf] grid place-items-center text-white shrink-0 shadow-sm">
            <ShieldCheck className="w-[23px] h-[23px]" />
          </div>
          <div>
            <strong className="block text-white text-base font-semibold leading-tight tracking-wide">集团巡检管理</strong>
            <span className="block mt-0.5 text-xs text-[#91a7bc]">{scopeText}</span>
          </div>
        </div>
        <nav className="grid gap-1 overflow-y-auto pr-0.5 max-md:grid-flow-col max-md:grid-cols-none max-md:w-max" aria-label="主导航">
          {visibleNavSections().map((section, sIndex) => (
            <div key={sIndex} className="grid gap-1">
              {section.label && (
                <div className="px-3 pt-3.5 pb-1 text-[11px] font-medium text-[#718ba2] tracking-wider select-none max-md:hidden">
                  {section.label}
                </div>
              )}
              {section.items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/"}
                    className={({ isActive }) =>
                      "flex items-center gap-2.5 h-[42px] px-3 rounded-[6px] text-sm no-underline transition-colors " +
                      (isActive
                        ? "bg-[#1d6f9f] text-white font-medium shadow-sm"
                        : "text-[#b9c9d8] hover:bg-[#ffffff0d] hover:text-white")
                    }
                  >
                    <Icon className="w-[17px] h-[17px] shrink-0" />
                    <span className="whitespace-nowrap tracking-wide">{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 px-6 pb-7 pt-5 max-md:px-3.5">
        <header className="min-h-14 mb-5 flex items-start justify-between gap-4 max-md:flex-col max-md:items-start">
          <div>
            <h1 className="m-0 text-2xl leading-tight font-bold text-[#172033]">{current.title}</h1>
            <p className="mt-1 mb-0 text-[#65738a] text-[13px]">{current.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 bg-white border-[#dbe3ec] text-[#172033] hover:bg-[#f8fafc] hover:border-[#9fb2c4]"
              onClick={handleSync}
            >
              <RefreshCw className="w-4 h-4" />
              刷新数据
            </Button>
            <div className="h-9 px-3 border border-[#dbe3ec] bg-white rounded-[6px] flex items-center gap-2 text-xs">
              <div className="flex flex-col leading-tight">
                <strong className="text-xs font-semibold text-[#172033]">{user?.display_name || user?.username || user?.email || "管理员"}</strong>
                <span className="text-[11px] text-[#65738a]">{roleLabel}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-1 rounded text-[#65738a] hover:text-[#b43c3c] hover:bg-[#fae9e9] transition-colors ml-1"
                title="退出登录"
                aria-label="退出登录"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  )
}
