import { Download, FileUp, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmployeeDialog } from "@/components/org/EmployeeDialog"
import { BatchImportDialog } from "@/components/org/BatchImportDialog"
import type { EmployeesProps } from "./useEmployees"

export function EmployeesPage({
  items,
  stores,
  filters,
  loading,
  saving,
  setFilters,
  dialogOpen,
  editingEmployee,
  openCreate,
  openEdit,
  closeDialog,
  handleSave,
  handleUnbindWechat,
  importDialogOpen,
  openImport,
  closeImport,
  handleBatchImport,
  handleExport,
}: EmployeesProps) {
  return (
    <div className="flex flex-col gap-4 text-xs font-sans">
      <section className="bg-white border border-[#dbe3ec] rounded-[7px] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#dbe3ec] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-[#172033] m-0">员工与店长</h2>
            <p className="text-xs text-[#65738a] mt-0.5 m-0">员工岗位决定小程序角色和数据查看范围。</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={openImport}
              className="h-9 gap-1.5 bg-white border-[#dbe3ec] text-[#172033] hover:bg-[#f8fafc]"
            >
              <FileUp className="w-4 h-4" />
              批量导入员工
            </Button>
            <Button
              size="sm"
              onClick={openCreate}
              className="h-9 bg-[#1672a8] hover:bg-[#125c88] text-white gap-1"
            >
              <Plus className="w-4 h-4" />
              新增员工
            </Button>
          </div>
        </div>

        {/* 筛选区 */}
        <div className="p-4 border-b border-[#edf1f5] bg-[#fafcfe]">
          <div className="grid grid-cols-[repeat(4,minmax(130px,1fr))_auto] gap-3 items-end max-md:grid-cols-1">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[#65738a]">搜索</label>
              <Input
                value={filters.keyword}
                onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                placeholder="姓名 / 手机号 / 门店"
                className="h-9 bg-white border-[#cfd9e4]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[#65738a]">门店</label>
              <select
                value={filters.storeId}
                onChange={(e) => setFilters({ ...filters, storeId: e.target.value })}
                className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
              >
                <option value="">全部门店</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[#65738a]">岗位</label>
              <select
                value={filters.role}
                onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
              >
                <option value="">全部岗位</option>
                <option value="店长">店长</option>
                <option value="营业员">营业员</option>
                <option value="执业药师">执业药师</option>
                <option value="收银员">收银员</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[#65738a]">状态</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
              >
                <option value="">全部状态</option>
                <option value="在职">在职</option>
                <option value="离职">离职</option>
              </select>
            </div>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="h-9 gap-1.5 bg-white border-[#dbe3ec] text-[#172033]"
              >
                <Download className="w-3.5 h-3.5" />
                导出
              </Button>
            </div>
          </div>
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#f8fafc] text-[#607086] border-b border-[#edf1f5]">
                <th className="py-2.5 px-4 font-semibold">员工编号</th>
                <th className="py-2.5 px-4 font-semibold">姓名</th>
                <th className="py-2.5 px-4 font-semibold">手机号</th>
                <th className="py-2.5 px-4 font-semibold">岗位</th>
                <th className="py-2.5 px-4 font-semibold">门店</th>
                <th className="py-2.5 px-4 font-semibold text-center">微信绑定</th>
                <th className="py-2.5 px-4 font-semibold text-center">设备</th>
                <th className="py-2.5 px-4 font-semibold text-center">待处理问题</th>
                <th className="py-2.5 px-4 font-semibold text-center">状态</th>
                <th className="py-2.5 px-4 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f5]">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#65738a]">
                    正在加载员工数据…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#65738a]">
                    未检索到符合条件的员工
                  </td>
                </tr>
              ) : (
                items.map((emp) => (
                  <tr key={emp.id} className="hover:bg-[#fafcfe] transition-colors">
                    <td className="py-3 px-4 text-[#65738a] font-mono text-[11px]">{emp.code}</td>
                    <td className="py-3 px-4 font-semibold text-[#172033]">{emp.name}</td>
                    <td className="py-3 px-4 text-[#65738a]">{emp.phone}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        emp.role === "店长"
                          ? "bg-[#e5f1f9] text-[#176d9e]"
                          : emp.role === "执业药师"
                          ? "bg-[#f0eafa] text-[#7351a2]"
                          : "bg-[#edf2f6] text-[#5e6b7c]"
                      }`}>
                        {emp.role || "营业员"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#172033]">{emp.storeName}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        emp.wechatStatus === "已绑定" ? "bg-[#e6f4ef] text-[#147054]" : "bg-[#fff2dc] text-[#946013]"
                      }`}>
                        {emp.wechatStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-[#65738a] font-mono text-[11px]">
                      {emp.deviceSn}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {emp.issueCount > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-[#fff2dc] text-[#946013]">
                          {emp.issueCount}
                        </span>
                      ) : (
                        <span className="text-[#65738a]">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        emp.status === "离职" ? "bg-[#fae9e9] text-[#a83434]" : "bg-[#e6f4ef] text-[#147054]"
                      }`}>
                        {emp.status || "在职"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                        <button
                          onClick={() => openEdit(emp)}
                          className="text-[#1672a8] hover:underline font-medium p-1"
                        >
                          编辑
                        </button>
                        {emp.wechatStatus === "已绑定" && (
                          <button
                            onClick={() => handleUnbindWechat(emp)}
                            className="text-[#b43c3c] hover:underline font-medium p-1"
                            title="解除微信账号绑定"
                          >
                            解绑微信
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 员工弹窗 */}
      <EmployeeDialog
        open={dialogOpen}
        initial={editingEmployee}
        stores={stores}
        saving={saving}
        onCancel={closeDialog}
        onSave={handleSave}
      />

      {/* 批量导入 */}
      <BatchImportDialog
        open={importDialogOpen}
        type="stores"
        saving={saving}
        onCancel={closeImport}
        onImport={async (_, text) => handleBatchImport(text)}
      />
    </div>
  )
}
