import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  createRecord,
  fetchList,
  updateRecord,
  type AppSetting,
  type Region,
  type Store,
} from "@/lib/admin"
import { currentUser } from "@/lib/auth"
import type { AdminUserFormValues } from "./AdminUserDialog"

export interface RoleDef {
  code: string
  name: string
  description: string
  permissions: string[]
}

export interface PermissionItem {
  code: string
  name: string
  module: string
}

export interface AdminUserListItem {
  id: string
  name: string
  username: string
  roleCode: string
  roleName: string
  scopeType: "GLOBAL" | "REGION" | "STORE"
  scopeId: string
  scopeLabel: string
  status: string
  lastLoginAt?: string
}

export interface AppUserRecord {
  id: string
  email?: string
  username?: string
  display_name?: string
  role_code?: string
  status?: string
  assigned_org?: string
  assigned_store?: string
  last_login_at?: string
  tenant?: string
  employee?: string
}

export interface UserDataScopeRecord {
  id: string
  user: string
  tenant?: string
  scope_type?: string
  org_node?: string
  store?: string
  status?: string
}

export const ALL_PERMISSIONS: PermissionItem[] = [
  { code: "dashboard.view", name: "查看工作总览", module: "工作总览" },
  { code: "organization.manage", name: "管理区域与门店", module: "组织与设备" },
  { code: "employee.manage", name: "维护员工与店长", module: "组织与设备" },
  { code: "device.manage", name: "设备管理与运维", module: "组织与设备" },
  { code: "recording.view", name: "录音与转写调取", module: "巡检业务" },
  { code: "inspection.manage", name: "AI巡检与整改派发", module: "巡检业务" },
  { code: "appeal.review", name: "申诉复核与判定", module: "巡检业务" },
  { code: "activity.view", name: "员工业务与学习记录", module: "巡检业务" },
  { code: "report.export", name: "基础报表与数据导出", module: "管理配置" },
  { code: "permission.manage", name: "账号与权限矩阵配置", module: "管理配置" },
  { code: "system.manage", name: "系统参数与规则配置", module: "管理配置" },
  { code: "audit.view", name: "操作审计与日志查看", module: "管理配置" },
]

export const DEFAULT_ROLES: RoleDef[] = [
  {
    code: "SUPER_ADMIN",
    name: "超级管理员",
    description: "拥有全系统所有业务、配置、权限和审计的完全控制权。",
    permissions: ALL_PERMISSIONS.map((p) => p.code),
  },
  {
    code: "REGION_MANAGER",
    name: "区域管理员",
    description: "管理管辖区域内的门店、设备、员工、巡检结果与业务记录。",
    permissions: ["dashboard.view", "organization.manage", "employee.manage", "device.manage", "recording.view", "inspection.manage", "appeal.review", "activity.view", "report.export"],
  },
  {
    code: "STORE_MANAGER",
    name: "门店店长",
    description: "管理本店员工、设备绑定、巡检整改与申诉跟进。",
    permissions: ["dashboard.view", "employee.manage", "device.manage", "recording.view", "inspection.manage", "appeal.review", "activity.view"],
  },
  {
    code: "COMPLIANCE",
    name: "合规质检员",
    description: "负责录音转写检索、AI 巡检结果人工复核、整改派发与申诉复核。",
    permissions: ["dashboard.view", "recording.view", "inspection.manage", "appeal.review", "activity.view", "report.export"],
  },
  {
    code: "AUDITOR",
    name: "安全审计员",
    description: "只读审查后台操作审计日志、接口同步日志与统计报表。",
    permissions: ["dashboard.view", "report.export", "audit.view"],
  },
]

export function usePermissions() {
  const [roles, setRoles] = useState<RoleDef[]>(DEFAULT_ROLES)
  const [activeRoleCode, setActiveRoleCode] = useState<string>("SUPER_ADMIN")
  const [adminUsers, setAdminUsers] = useState<AppUserRecord[]>([])
  const [userScopes, setUserScopes] = useState<UserDataScopeRecord[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 弹窗
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<AdminUserListItem | null>(null)

  const activeRole = useMemo(() => roles.find((r) => r.code === activeRoleCode) || roles[0], [roles, activeRoleCode])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, scopesRes, regionsRes, storesRes, settingsRes] = await Promise.all([
        fetchList<AppUserRecord>("app_users", { perPage: 200 }),
        fetchList<UserDataScopeRecord>("user_data_scopes", { perPage: 200 }),
        fetchList<Region>("regions", { perPage: 100 }),
        fetchList<Store>("stores", { perPage: 200 }),
        fetchList<AppSetting>("app_settings", { perPage: 100 }),
      ])

      setAdminUsers(usersRes.items || [])
      setUserScopes(scopesRes.items || [])
      setRegions(regionsRes.items || [])
      setStores(storesRes.items || [])

      // 加载持久化的角色权限配置
      const roleSetting = (settingsRes.items || []).find((s) => s.key === "role_permissions_v1")
      if (roleSetting && roleSetting.value) {
        try {
          const parsed = JSON.parse(roleSetting.value) as RoleDef[]
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRoles(parsed)
          }
        } catch {
          // use default roles
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "权限与账号数据加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const roleNameMap = useMemo(() => new Map(roles.map((r) => [r.code, r.name])), [roles])
  const regionMap = useMemo(() => new Map(regions.map((r) => [r.id, r.name])), [regions])
  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id, s.name])), [stores])

  const adminList: AdminUserListItem[] = useMemo(() => {
    return adminUsers.map((u) => {
      const scope = userScopes.find((s) => s.user === u.id)
      let scopeType: "GLOBAL" | "REGION" | "STORE" = "GLOBAL"
      let scopeId = ""
      let scopeLabel = "集团全部"

      if (u.assigned_org || (scope && scope.scope_type === "ORG_TREE")) {
        scopeType = "REGION"
        scopeId = u.assigned_org || scope?.org_node || ""
        scopeLabel = regionMap.get(scopeId) || "指定区域"
      } else if (u.assigned_store || (scope && scope.scope_type === "STORE")) {
        scopeType = "STORE"
        scopeId = u.assigned_store || scope?.store || ""
        scopeLabel = storeMap.get(scopeId) || "指定门店"
      }

      return {
        id: u.id,
        name: u.display_name || u.email || "管理员",
        username: u.email || u.username || "-",
        roleCode: u.role_code || "ADMIN",
        roleName: roleNameMap.get(u.role_code || "") || u.role_code || "管理员",
        scopeType,
        scopeId,
        scopeLabel,
        status: u.status || "ACTIVE",
        lastLoginAt: u.last_login_at ? u.last_login_at.slice(0, 16) : "-",
      }
    })
  }, [adminUsers, userScopes, roleNameMap, regionMap, storeMap])

  function togglePermission(permCode: string) {
    if (activeRole.code === "SUPER_ADMIN") {
      toast.info("超级管理员默认拥有所有权限，不可移除")
      return
    }
    setRoles((prev) =>
      prev.map((r) => {
        if (r.code !== activeRole.code) return r
        const has = r.permissions.includes(permCode)
        const nextPerms = has ? r.permissions.filter((p) => p !== permCode) : [...r.permissions, permCode]
        return { ...r, permissions: nextPerms }
      })
    )
  }

  async function handleSavePermissions() {
    setSaving(true)
    try {
      const settingsRes = await fetchList<AppSetting>("app_settings", { perPage: 100 }).catch(() => ({ items: [] as AppSetting[] }))
      const existing = (settingsRes.items || []).find((s) => s.key === "role_permissions_v1")
      const value = JSON.stringify(roles)
      if (existing) {
        await updateRecord<AppSetting>("app_settings", existing.id, { value })
      } else {
        await createRecord<AppSetting>("app_settings", { key: "role_permissions_v1", value })
      }
      toast.success(`${activeRole.name} 的权限配置已保存并持久化生效`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存权限配置失败")
    } finally {
      setSaving(false)
    }
  }

  function openCreateAdmin() {
    setEditingAdmin(null)
    setDialogOpen(true)
  }

  function openEditAdmin(admin: AdminUserListItem) {
    setEditingAdmin(admin)
    setDialogOpen(true)
  }

  async function handleSaveAdmin(values: AdminUserFormValues) {
    setSaving(true)
    try {
      const me = currentUser()
      // 自锁保护：禁止停用当前登录的管理员账号
      if (editingAdmin && editingAdmin.id === me?.id && values.status === "DISABLED") {
        toast.error("不可停用当前正在登录的管理员账号")
        return
      }

      const body: Record<string, unknown> = {
        display_name: values.name.trim(),
        role_code: values.roleCode,
        status: values.status,
        assigned_org: values.scopeType === "REGION" ? values.scopeId : "",
        assigned_store: values.scopeType === "STORE" ? values.scopeId : "",
      }
      if (values.password) {
        body.password = values.password
        body.passwordConfirm = values.password
      }

      if (editingAdmin) {
        await updateRecord("app_users", editingAdmin.id, body)
        toast.success("管理员账号已更新")
      } else {
        body.email = values.username.trim()
        body.username = values.username.trim()
        await createRecord("app_users", body)
        toast.success("管理员账号已创建")
      }
      setDialogOpen(false)
      await loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存管理员账号失败")
    } finally {
      setSaving(false)
    }
  }

  return {
    roles,
    activeRole,
    activeRoleCode,
    setActiveRoleCode,
    allPermissions: ALL_PERMISSIONS,
    adminList,
    regions,
    stores,
    loading,
    saving,
    togglePermission,
    handleSavePermissions,
    dialogOpen,
    editingAdmin,
    openCreateAdmin,
    openEditAdmin,
    closeDialog: () => setDialogOpen(false),
    handleSaveAdmin,
  }
}

export type PermissionsProps = ReturnType<typeof usePermissions>
