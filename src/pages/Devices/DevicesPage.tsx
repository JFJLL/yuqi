import { FileUp, Link2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BindDialog } from "@/components/devices/BindDialog"
import { BatchImportDialog } from "@/components/org/BatchImportDialog"
import type { DevicesProps } from "./useDevices"

export function DevicesPage({
  activeTab,
  setActiveTab,
  rows,
  deviceLogs,
  bindings,
  employees,
  stores,
  filters,
  opsStats,
  loading,
  saving,
  setFilters,
  reload,
  dialogOpen,
  adjusting,
  openCreate,
  openAdjust,
  closeDialog,
  handleSave,
  handleUnbind,
  importDialogOpen,
  openImport,
  closeImport,
  handleBatchImport,
}: DevicesProps) {
  return (
    <div className="flex flex-col gap-4 text-xs font-sans">
      <section className="bg-white border border-[#dbe3ec] rounded-[7px] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#dbe3ec] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-[#172033] m-0">设备管理</h2>
            <p className="text-xs text-[#65738a] mt-0.5 m-0">维护设备库存及员工、门店绑定关系与运行状态。</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={openImport}
              className="h-9 gap-1.5 bg-white border-[#dbe3ec] text-[#172033] hover:bg-[#f8fafc]"
            >
              <FileUp className="w-4 h-4" />
              批量导入设备
            </Button>
            <Button
              size="sm"
              onClick={openCreate}
              className="h-9 bg-[#1672a8] hover:bg-[#125c88] text-white gap-1"
            >
              <Link2 className="w-4 h-4" />
              绑定设备
            </Button>
          </div>
        </div>

        {/* 标签页切换 */}
        <div className="px-4 pt-3 pb-0 border-b border-[#edf1f5] flex items-center gap-1 bg-[#f8fafc]">
          <button
            onClick={() => setActiveTab("ledger")}
            className={`px-4 py-2 text-xs font-semibold rounded-t-[5px] border-b-2 transition-colors ${
              activeTab === "ledger"
                ? "bg-white text-[#1672a8] border-[#1672a8]"
                : "text-[#65738a] hover:text-[#172033] border-transparent"
            }`}
          >
            设备台账与绑定
          </button>
          <button
            onClick={() => setActiveTab("ops")}
            className={`px-4 py-2 text-xs font-semibold rounded-t-[5px] border-b-2 transition-colors ${
              activeTab === "ops"
                ? "bg-white text-[#1672a8] border-[#1672a8]"
                : "text-[#65738a] hover:text-[#172033] border-transparent"
            }`}
          >
            运行状态与运维
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 text-xs font-semibold rounded-t-[5px] border-b-2 transition-colors ${
              activeTab === "history"
                ? "bg-white text-[#1672a8] border-[#1672a8]"
                : "text-[#65738a] hover:text-[#172033] border-transparent"
            }`}
          >
            绑定与调拨历史
          </button>
        </div>

        {/* Tab 1: 设备台账与绑定 */}
        {activeTab === "ledger" && (
          <div>
            <div className="p-4 border-b border-[#edf1f5] bg-[#fafcfe]">
              <div className="grid grid-cols-[repeat(3,minmax(140px,1fr))_auto] gap-3 items-end max-md:grid-cols-1">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[#65738a]">搜索</label>
                  <Input
                    value={filters.keyword}
                    onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                    placeholder="设备码 / 员工 / 门店"
                    className="h-9 bg-white border-[#cfd9e4]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[#65738a]">状态</label>
                  <select
                    value={filters.deviceStatus}
                    onChange={(e) => setFilters({ ...filters, deviceStatus: e.target.value })}
                    className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
                  >
                    <option value="">全部状态</option>
                    <option value="在线">在线</option>
                    <option value="离线">离线</option>
                    <option value="录音中">录音中</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[#65738a]">绑定</label>
                  <select
                    value={filters.bindStatus}
                    onChange={(e) => setFilters({ ...filters, bindStatus: e.target.value })}
                    className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
                  >
                    <option value="">全部</option>
                    <option value="bound">已绑定</option>
                    <option value="unbound">未绑定</option>
                  </select>
                </div>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={reload}
                    className="h-9 gap-1 bg-white border-[#dbe3ec] text-[#172033]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    刷新
                  </Button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-[#f8fafc] text-[#607086] border-b border-[#edf1f5]">
                    <th className="py-2.5 px-4 font-semibold">设备码</th>
                    <th className="py-2.5 px-4 font-semibold">类型</th>
                    <th className="py-2.5 px-4 font-semibold">员工</th>
                    <th className="py-2.5 px-4 font-semibold">门店</th>
                    <th className="py-2.5 px-4 font-semibold text-center">状态</th>
                    <th className="py-2.5 px-4 font-semibold text-center">电量</th>
                    <th className="py-2.5 px-4 font-semibold text-center">今日录音</th>
                    <th className="py-2.5 px-4 font-semibold">最近在线</th>
                    <th className="py-2.5 px-4 font-semibold text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f5]">
                  {loading && rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-[#65738a]">
                        正在加载设备台账…
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-[#65738a]">
                        未检索到符合条件的设备
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="hover:bg-[#fafcfe] transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-[#172033]">{row.device_no}</td>
                        <td className="py-3 px-4 text-[#65738a]">{row.type || "4G智能工牌"}</td>
                        <td className="py-3 px-4">
                          {row.bound ? (
                            <strong className="font-semibold text-[#172033]">{row.employeeName}</strong>
                          ) : (
                            <span className="text-[#65738a]">未绑定</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#172033]">{row.storeName}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            row.status === "离线"
                              ? "bg-[#fae9e9] text-[#a83434]"
                              : row.status === "录音中"
                              ? "bg-[#fff2dc] text-[#946013]"
                              : "bg-[#e6f4ef] text-[#147054]"
                          }`}>
                            {row.status || "在线"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-[#172033]">{row.power ? `${row.power}%` : "100%"}</td>
                        <td className="py-3 px-4 text-center text-[#172033]">{row.texts_today ?? 0} 段</td>
                        <td className="py-3 px-4 text-[#65738a]">{row.last_online_at || "今天"}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                            <button
                              onClick={() => openAdjust(row)}
                              className="text-[#1672a8] hover:underline font-medium p-1"
                            >
                              {row.bound ? "调拨" : "绑定"}
                            </button>
                            {row.bound && (
                              <button
                                onClick={() => handleUnbind(row)}
                                className="text-[#b43c3c] hover:underline font-medium p-1"
                              >
                                解绑
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
          </div>
        )}

        {/* Tab 2: 运行状态与运维 */}
        {activeTab === "ops" && (
          <div className="p-4 flex flex-col gap-4">
            <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
              <article className="p-3.5 bg-[#f8fafc] border border-[#dbe3ec] rounded-[6px] flex flex-col gap-1">
                <span className="text-[#65738a] font-medium">设备总数</span>
                <strong className="text-2xl font-bold text-[#172033]">{opsStats.total}</strong>
                <small className="text-[#65738a]">已绑定 {opsStats.bound} 台</small>
              </article>
              <article className="p-3.5 bg-[#f8fafc] border border-[#dbe3ec] rounded-[6px] flex flex-col gap-1">
                <span className="text-[#65738a] font-medium">在线设备</span>
                <strong className="text-2xl font-bold text-[#167a5b]">{opsStats.online}</strong>
                <small className="text-[#65738a]">实时通信正常</small>
              </article>
              <article className="p-3.5 bg-[#f8fafc] border border-[#dbe3ec] rounded-[6px] flex flex-col gap-1">
                <span className="text-[#65738a] font-medium">离线设备</span>
                <strong className="text-2xl font-bold text-[#b43c3c]">{opsStats.offline}</strong>
                <small className="text-[#65738a]">需排查工牌电量/网络</small>
              </article>
              <article className="p-3.5 bg-[#f8fafc] border border-[#dbe3ec] rounded-[6px] flex flex-col gap-1">
                <span className="text-[#65738a] font-medium">未绑定库存</span>
                <strong className="text-2xl font-bold text-[#a96a12]">{opsStats.unbound}</strong>
                <small className="text-[#65738a]">可用于调拨或替换</small>
              </article>
            </div>

            <div className="border border-[#dbe3ec] rounded-[6px] overflow-hidden">
              <div className="p-3 bg-[#f8fafc] border-b border-[#dbe3ec] font-semibold text-[#172033]">
                设备操作与运维日志
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-white text-[#607086] border-b border-[#edf1f5]">
                      <th className="py-2.5 px-4 font-semibold">时间</th>
                      <th className="py-2.5 px-4 font-semibold">设备</th>
                      <th className="py-2.5 px-4 font-semibold">操作类型</th>
                      <th className="py-2.5 px-4 font-semibold">日志内容</th>
                      <th className="py-2.5 px-4 font-semibold text-center">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1f5]">
                    {deviceLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[#65738a]">
                          暂无设备日志
                        </td>
                      </tr>
                    ) : (
                      deviceLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#fafcfe]">
                          <td className="py-2.5 px-4 text-[#65738a]">{log.occurred_at || log.created || "-"}</td>
                          <td className="py-2.5 px-4 font-mono font-medium text-[#172033]">{log.device}</td>
                          <td className="py-2.5 px-4 font-medium text-[#172033]">{log.type}</td>
                          <td className="py-2.5 px-4 text-[#65738a]">{log.content}</td>
                          <td className="py-2.5 px-4 text-center">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-[#e6f4ef] text-[#147054]">
                              {log.status || "成功"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: 绑定与调拨历史 */}
        {activeTab === "history" && (
          <div className="p-4">
            <div className="border border-[#dbe3ec] rounded-[6px] overflow-hidden">
              <div className="p-3 bg-[#f8fafc] border-b border-[#dbe3ec] font-semibold text-[#172033]">
                历史绑定与调拨记录
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-white text-[#607086] border-b border-[#edf1f5]">
                      <th className="py-2.5 px-4 font-semibold">绑定时间</th>
                      <th className="py-2.5 px-4 font-semibold">设备</th>
                      <th className="py-2.5 px-4 font-semibold">员工</th>
                      <th className="py-2.5 px-4 font-semibold">生效日期</th>
                      <th className="py-2.5 px-4 font-semibold text-center">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1f5]">
                    {bindings.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[#65738a]">
                          暂无历史绑定记录
                        </td>
                      </tr>
                    ) : (
                      bindings.map((b) => (
                        <tr key={b.id} className="hover:bg-[#fafcfe]">
                          <td className="py-2.5 px-4 text-[#65738a]">{b.created || "-"}</td>
                          <td className="py-2.5 px-4 font-mono font-medium text-[#172033]">{b.device}</td>
                          <td className="py-2.5 px-4 text-[#172033]">{b.employee}</td>
                          <td className="py-2.5 px-4 text-[#65738a]">{b.effective_date}</td>
                          <td className="py-2.5 px-4 text-center">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${
                              b.status === "已解绑" ? "bg-[#fae9e9] text-[#a83434]" : "bg-[#e6f4ef] text-[#147054]"
                            }`}>
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 绑定弹窗 */}
      <BindDialog
        open={dialogOpen}
        deviceNo={adjusting?.device_no || ""}
        deviceType={adjusting?.type || "4G智能工牌"}
        employees={employees}
        stores={stores}
        saving={saving}
        onCancel={closeDialog}
        onSave={handleSave}
      />

      {/* 批量导入设备 */}
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
