import { Plus, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AdminUserDialog } from "./AdminUserDialog"
import type { PermissionsProps } from "./usePermissions"

export function PermissionsPage({
  roles,
  activeRole,
  activeRoleCode,
  setActiveRoleCode,
  allPermissions,
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
  closeDialog,
  handleSaveAdmin,
}: PermissionsProps) {
  return (
    <div className="flex flex-col gap-4 text-xs font-sans">
      {/* 角色卡与权限矩阵 */}
      <div className="grid grid-cols-[260px_minmax(0,1fr)] gap-3.5 max-lg:grid-cols-1">
        {/* 左侧角色卡列表 */}
        <div className="flex flex-col gap-2">
          {roles.map((role) => (
            <button
              key={role.code}
              type="button"
              onClick={() => setActiveRoleCode(role.code)}
              className={`text-left p-3.5 rounded-[6px] border transition-colors flex flex-col gap-1 cursor-pointer ${
                activeRoleCode === role.code
                  ? "border-[#1672a8] bg-[#f1f8fc] shadow-xs"
                  : "border-[#dbe3ec] bg-white hover:bg-[#fafcfe]"
              }`}
            >
              <strong className="text-xs font-bold text-[#172033]">{role.name}</strong>
              <span className="text-[11px] text-[#65738a] leading-relaxed">{role.description}</span>
            </button>
          ))}
        </div>

        {/* 右侧权限配置矩阵 */}
        <section className="bg-white border border-[#dbe3ec] rounded-[7px] overflow-hidden shadow-xs flex flex-col">
          <div className="p-4 border-b border-[#dbe3ec] flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#172033] m-0">{activeRole.name} · 权限矩阵</h2>
              <p className="text-xs text-[#65738a] mt-0.5 m-0">勾选该角色可操作的功能模块与管理权限。</p>
            </div>
            <Button
              size="sm"
              onClick={handleSavePermissions}
              className="h-8 bg-[#1672a8] hover:bg-[#125c88] text-white gap-1.5 text-xs"
            >
              <Save className="w-3.5 h-3.5" />
              保存权限配置
            </Button>
          </div>

          <div className="p-4 grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
            {allPermissions.map((perm) => {
              const checked = activeRole.permissions.includes(perm.code)
              return (
                <label
                  key={perm.code}
                  className={`flex items-start gap-2.5 p-3 rounded-[5px] border transition-colors cursor-pointer ${
                    checked ? "border-[#9fb2c4] bg-[#f8fafc]" : "border-[#edf1f5] bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePermission(perm.code)}
                    disabled={activeRole.code === "SUPER_ADMIN"}
                    className="mt-0.5 w-4 h-4 rounded text-[#1672a8] focus:ring-[#1672a8]"
                  />
                  <div className="flex flex-col leading-tight">
                    <strong className="text-xs font-semibold text-[#172033]">{perm.name}</strong>
                    <small className="text-[11px] text-[#65738a] mt-0.5">{perm.module} · {perm.code}</small>
                  </div>
                </label>
              )
            })}
          </div>
        </section>
      </div>

      {/* 后台管理员账号 */}
      <section className="bg-white border border-[#dbe3ec] rounded-[7px] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#dbe3ec] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#172033] m-0">后台管理员账号</h2>
            <p className="text-xs text-[#65738a] mt-0.5 m-0">
              维护后台账号、绑定角色及分配数据查看范围（集团全部 / 指定区域 / 指定门店）。
            </p>
          </div>
          <Button
            size="sm"
            onClick={openCreateAdmin}
            className="h-9 bg-[#1672a8] hover:bg-[#125c88] text-white gap-1"
          >
            <Plus className="w-4 h-4" />
            新增管理员
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#f8fafc] text-[#607086] border-b border-[#edf1f5]">
                <th className="py-2.5 px-4 font-semibold">姓名</th>
                <th className="py-2.5 px-4 font-semibold">用户名 / 邮箱</th>
                <th className="py-2.5 px-4 font-semibold">角色</th>
                <th className="py-2.5 px-4 font-semibold">数据范围</th>
                <th className="py-2.5 px-4 font-semibold text-center">状态</th>
                <th className="py-2.5 px-4 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f5]">
              {loading && adminList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#65738a]">
                    正在加载管理员列表…
                  </td>
                </tr>
              ) : adminList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#65738a]">
                    暂无管理员账号
                  </td>
                </tr>
              ) : (
                adminList.map((admin) => (
                  <tr key={admin.id} className="hover:bg-[#fafcfe] transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#172033]">{admin.name}</td>
                    <td className="py-3 px-4 text-[#65738a]">{admin.username}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#e5f1f9] text-[#176d9e]">
                        {admin.roleName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#172033]">
                      <span className="font-medium">{admin.scopeLabel}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        admin.status === "DISABLED" ? "bg-[#fae9e9] text-[#a83434]" : "bg-[#e6f4ef] text-[#147054]"
                      }`}>
                        {admin.status === "DISABLED" ? "停用" : "启用"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openEditAdmin(admin)}
                        className="text-[#1672a8] hover:underline font-medium p-1"
                      >
                        编辑
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 弹窗 */}
      <AdminUserDialog
        open={dialogOpen}
        initial={editingAdmin}
        roles={roles}
        regions={regions}
        stores={stores}
        saving={saving}
        onCancel={closeDialog}
        onSave={handleSaveAdmin}
      />
    </div>
  )
}
