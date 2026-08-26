import { Download, FileUp, Plus, UserRoundCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RegionDialog } from "@/components/org/RegionDialog"
import { StoreDialog } from "@/components/org/StoreDialog"
import { SetManagerDialog } from "@/components/org/SetManagerDialog"
import { BatchImportDialog } from "@/components/org/BatchImportDialog"
import type { OrgProps } from "./useOrg"

export function OrgPage({
  regions,
  stores,
  employees,
  filters,
  loading,
  saving,
  setFilters,
  // 区域弹窗
  regionDialogOpen,
  editingRegion,
  openCreateRegion,
  openEditRegion,
  closeRegionDialog,
  handleSaveRegion,
  // 门店弹窗
  storeDialogOpen,
  editingStore,
  openCreateStore,
  openEditStore,
  closeStoreDialog,
  handleSaveStore,
  // 设置店长
  setManagerDialogOpen,
  managerStore,
  openSetManager,
  closeSetManagerDialog,
  handleSaveManager,
  // 批量导入
  importDialogOpen,
  importType,
  openBatchImport,
  closeImportDialog,
  handleBatchImport,
  // 导出
  handleExportStores,
}: OrgProps) {
  return (
    <div className="flex flex-col gap-4 text-xs font-sans">
      {/* Panel 1: 区域管理 */}
      <section className="bg-white border border-[#dbe3ec] rounded-[7px] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#dbe3ec] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#172033] m-0">区域管理</h2>
            <p className="text-xs text-[#65738a] mt-0.5 m-0">维护区域负责人及门店归属。</p>
          </div>
          <Button
            size="sm"
            onClick={openCreateRegion}
            className="h-9 bg-[#1672a8] hover:bg-[#125c88] text-white gap-1 text-xs"
          >
            <Plus className="w-4 h-4" />
            新增区域
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#f8fafc] text-[#607086] border-b border-[#edf1f5]">
                <th className="py-2.5 px-4 font-semibold">区域</th>
                <th className="py-2.5 px-4 font-semibold">负责人</th>
                <th className="py-2.5 px-4 font-semibold">联系电话</th>
                <th className="py-2.5 px-4 font-semibold text-center">门店数</th>
                <th className="py-2.5 px-4 font-semibold text-center">员工数</th>
                <th className="py-2.5 px-4 font-semibold text-center">状态</th>
                <th className="py-2.5 px-4 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f5]">
              {regions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#65738a]">
                    暂无区域数据
                  </td>
                </tr>
              ) : (
                regions.map((reg) => (
                  <tr key={reg.id} className="hover:bg-[#fafcfe] transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#172033]">{reg.name}</td>
                    <td className="py-3 px-4 text-[#172033]">{reg.manager_name || "未设置"}</td>
                    <td className="py-3 px-4 text-[#65738a]">{reg.manager_mobile || "-"}</td>
                    <td className="py-3 px-4 text-center text-[#172033]">{reg.storeCount ?? 0}</td>
                    <td className="py-3 px-4 text-center text-[#172033]">{reg.employeeCount ?? 0}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        reg.status === "停用" ? "bg-[#fae9e9] text-[#a83434]" : "bg-[#e6f4ef] text-[#147054]"
                      }`}>
                        {reg.status || "启用"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openEditRegion(reg)}
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

      {/* Panel 2: 门店管理 */}
      <section className="bg-white border border-[#dbe3ec] rounded-[7px] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#dbe3ec] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-[#172033] m-0">门店管理</h2>
            <p className="text-xs text-[#65738a] mt-0.5 m-0">新增门店、批量导入并配置门店店长。</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openBatchImport("stores")}
              className="h-9 gap-1.5 bg-white border-[#dbe3ec] text-[#172033] hover:bg-[#f8fafc]"
            >
              <FileUp className="w-4 h-4" />
              批量导入门店
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openBatchImport("managers")}
              className="h-9 gap-1.5 bg-white border-[#dbe3ec] text-[#172033] hover:bg-[#f8fafc]"
            >
              <UserRoundCheck className="w-4 h-4" />
              批量设置店长
            </Button>
            <Button
              size="sm"
              onClick={openCreateStore}
              className="h-9 bg-[#1672a8] hover:bg-[#125c88] text-white gap-1"
            >
              <Plus className="w-4 h-4" />
              新增门店
            </Button>
          </div>
        </div>

        {/* 筛选区 */}
        <div className="p-4 border-b border-[#edf1f5] bg-[#fafcfe]">
          <div className="grid grid-cols-[repeat(3,minmax(140px,1fr))_auto] gap-3 items-end max-md:grid-cols-1">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[#65738a]">搜索</label>
              <Input
                value={filters.keyword}
                onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                placeholder="门店名称 / 编号 / 店长"
                className="h-9 bg-white border-[#cfd9e4]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[#65738a]">区域</label>
              <select
                value={filters.regionId}
                onChange={(e) => setFilters({ ...filters, regionId: e.target.value })}
                className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
              >
                <option value="">全部区域</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
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
                <option value="营业中">营业中</option>
                <option value="停业">停业</option>
              </select>
            </div>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportStores}
                className="h-9 gap-1.5 bg-white border-[#dbe3ec] text-[#172033]"
              >
                <Download className="w-3.5 h-3.5" />
                导出
              </Button>
            </div>
          </div>
        </div>

        {/* 门店表格 */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#f8fafc] text-[#607086] border-b border-[#edf1f5]">
                <th className="py-2.5 px-4 font-semibold">门店编号</th>
                <th className="py-2.5 px-4 font-semibold">门店</th>
                <th className="py-2.5 px-4 font-semibold">区域</th>
                <th className="py-2.5 px-4 font-semibold">地址</th>
                <th className="py-2.5 px-4 font-semibold">店长</th>
                <th className="py-2.5 px-4 font-semibold text-center">员工</th>
                <th className="py-2.5 px-4 font-semibold text-center">设备</th>
                <th className="py-2.5 px-4 font-semibold text-center">状态</th>
                <th className="py-2.5 px-4 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f5]">
              {loading && stores.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#65738a]">
                    正在加载门店数据…
                  </td>
                </tr>
              ) : stores.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#65738a]">
                    未检索到符合条件的门店
                  </td>
                </tr>
              ) : (
                stores.map((st) => (
                  <tr key={st.id} className="hover:bg-[#fafcfe] transition-colors">
                    <td className="py-3 px-4 text-[#65738a] font-mono text-[11px]">{st.code || st.id}</td>
                    <td className="py-3 px-4">
                      <strong className="font-semibold text-[#172033]">{st.name}</strong>
                    </td>
                    <td className="py-3 px-4 text-[#65738a]">{st.region}</td>
                    <td className="py-3 px-4 text-[#65738a] max-w-[200px] truncate" title={st.address}>
                      {st.address || "-"}
                    </td>
                    <td className="py-3 px-4">
                      {st.manager_name && st.manager_name !== "未设置" ? (
                        <div className="flex flex-col leading-tight">
                          <span className="font-medium text-[#172033]">{st.manager_name}</span>
                          {st.manager_mobile && (
                            <small className="text-[#65738a] text-[11px]">{st.manager_mobile}</small>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-[#fff2dc] text-[#946013]">
                          未设置
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-[#172033]">{st.employeeCount ?? 0}</td>
                    <td className="py-3 px-4 text-center text-[#172033]">{st.deviceCount ?? 0}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        st.status === "停业" ? "bg-[#fae9e9] text-[#a83434]" : "bg-[#e6f4ef] text-[#147054]"
                      }`}>
                        {st.status || "营业中"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                        <button
                          onClick={() => openEditStore(st)}
                          className="text-[#1672a8] hover:underline font-medium p-1"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => openSetManager(st)}
                          className="text-[#1672a8] hover:underline font-medium p-1"
                        >
                          设置店长
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 弹窗组件 */}
      <RegionDialog
        open={regionDialogOpen}
        initial={editingRegion}
        saving={saving}
        onCancel={closeRegionDialog}
        onSave={handleSaveRegion}
      />

      <StoreDialog
        open={storeDialogOpen}
        initial={editingStore}
        regions={regions}
        saving={saving}
        onCancel={closeStoreDialog}
        onSave={handleSaveStore}
      />

      <SetManagerDialog
        open={setManagerDialogOpen}
        store={managerStore}
        employees={employees}
        saving={saving}
        onCancel={closeSetManagerDialog}
        onSave={handleSaveManager}
      />

      <BatchImportDialog
        open={importDialogOpen}
        type={importType}
        saving={saving}
        onCancel={closeImportDialog}
        onImport={handleBatchImport}
      />
    </div>
  )
}
