import { Download, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import type { LogsProps } from "./useLogs"

export function LogsPage({
  activeTab,
  setActiveTab,
  auditRows,
  syncRows,
  filters,
  loading,
  retrying,
  detail,
  setFilters,
  reload,
  handleRetry,
  handleExport,
  openDetail,
  closeDetail,
}: LogsProps) {
  return (
    <div className="flex flex-col gap-4 text-xs font-sans">
      <section className="bg-white border border-[#dbe3ec] rounded-[7px] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#dbe3ec] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-[#172033] m-0">操作审计与接口日志</h2>
            <p className="text-xs text-[#65738a] mt-0.5 m-0">
              追踪后台真实写操作、关键决定与接口数据同步记录。
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "sync" && (
              <Button
                variant="outline"
                size="sm"
                disabled={retrying}
                onClick={handleRetry}
                className="h-9 gap-1.5 bg-white border-[#dbe3ec] text-[#172033]"
              >
                <RefreshCw className="w-4 h-4" />
                {retrying ? "重试中…" : "重试失败项"}
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleExport}
              className="h-9 bg-[#1672a8] hover:bg-[#125c88] text-white gap-1.5"
            >
              <Download className="w-4 h-4" />
              导出日志
            </Button>
          </div>
        </div>

        {/* 标签栏 */}
        <div className="px-4 pt-3 pb-0 border-b border-[#edf1f5] flex items-center gap-1 bg-[#f8fafc]">
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 text-xs font-semibold rounded-t-[5px] border-b-2 transition-colors ${
              activeTab === "audit"
                ? "bg-white text-[#1672a8] border-[#1672a8]"
                : "text-[#65738a] hover:text-[#172033] border-transparent"
            }`}
          >
            管理员操作审计
          </button>
          <button
            onClick={() => setActiveTab("sync")}
            className={`px-4 py-2 text-xs font-semibold rounded-t-[5px] border-b-2 transition-colors ${
              activeTab === "sync"
                ? "bg-white text-[#1672a8] border-[#1672a8]"
                : "text-[#65738a] hover:text-[#172033] border-transparent"
            }`}
          >
            接口与数据同步
          </button>
        </div>

        {/* 搜索区 */}
        <div className="p-4 border-b border-[#edf1f5] bg-[#fafcfe]">
          <div className="grid grid-cols-[1.5fr_auto] gap-3 items-end max-md:grid-cols-1">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[#65738a]">搜索过滤</label>
              <Input
                value={filters.keyword}
                onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                placeholder="操作人 / 操作类型 / 关联对象ID / 说明"
                className="h-9 bg-white border-[#cfd9e4]"
              />
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

        {/* 1. 操作审计表格 */}
        {activeTab === "audit" && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#f8fafc] text-[#607086] border-b border-[#edf1f5]">
                  <th className="py-2.5 px-4 font-semibold">时间</th>
                  <th className="py-2.5 px-4 font-semibold">操作人</th>
                  <th className="py-2.5 px-4 font-semibold">操作类型</th>
                  <th className="py-2.5 px-4 font-semibold">关联对象</th>
                  <th className="py-2.5 px-4 font-semibold">所属门店/范围</th>
                  <th className="py-2.5 px-4 font-semibold text-center">状态</th>
                  <th className="py-2.5 px-4 font-semibold">操作说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1f5]">
                {loading && auditRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#65738a]">
                      正在加载审计日志…
                    </td>
                  </tr>
                ) : auditRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#65738a]">
                      暂无操作审计记录
                    </td>
                  </tr>
                ) : (
                  auditRows.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => openDetail(r)}
                      className="hover:bg-[#fafcfe] transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 text-[#65738a] whitespace-nowrap font-mono text-[11px]">{r.time}</td>
                      <td className="py-3 px-4 font-semibold text-[#172033]">{r.operator}</td>
                      <td className="py-3 px-4 text-[#1672a8] font-medium">{r.type}</td>
                      <td className="py-3 px-4 font-mono text-[#65738a]">{r.objectId}</td>
                      <td className="py-3 px-4 text-[#172033]">{r.store}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#e6f4ef] text-[#147054]">
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#65738a] max-w-[280px] truncate" title={r.message}>
                        {r.message}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. 同步日志表格 */}
        {activeTab === "sync" && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#f8fafc] text-[#607086] border-b border-[#edf1f5]">
                  <th className="py-2.5 px-4 font-semibold">时间</th>
                  <th className="py-2.5 px-4 font-semibold">类型</th>
                  <th className="py-2.5 px-4 font-semibold">对象</th>
                  <th className="py-2.5 px-4 font-semibold">门店</th>
                  <th className="py-2.5 px-4 font-semibold text-center">状态</th>
                  <th className="py-2.5 px-4 font-semibold">同步结果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1f5]">
                {syncRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#65738a]">
                      暂无接口同步记录
                    </td>
                  </tr>
                ) : (
                  syncRows.map((log) => (
                    <tr key={log.id} className="hover:bg-[#fafcfe]">
                      <td className="py-3 px-4 text-[#65738a] font-mono text-[11px]">{log.occurred_at || "-"}</td>
                      <td className="py-3 px-4 font-semibold text-[#172033]">{log.type}</td>
                      <td className="py-3 px-4 text-[#172033] font-mono">{log.object}</td>
                      <td className="py-3 px-4 text-[#172033]">{log.store}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          log.status === "失败" ? "bg-[#fae9e9] text-[#a83434]" : log.status === "重试中" ? "bg-[#fff2dc] text-[#946013]" : "bg-[#e6f4ef] text-[#147054]"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#65738a] max-w-[280px] truncate" title={log.result}>
                        {log.result}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 审计详情弹窗 */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && closeDetail()}>
        <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden bg-white">
          <DialogHeader className="p-4 border-b border-[#dbe3ec]">
            <DialogTitle className="text-base font-bold text-[#172033]">
              操作审计详情 · {detail?.type}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 flex flex-col gap-3 text-xs">
            <div className="grid grid-cols-2 gap-2 p-3 bg-[#f8fafc] border border-[#dbe3ec] rounded-[6px]">
              <div><strong>操作人：</strong>{detail?.operator}</div>
              <div><strong>时间：</strong>{detail?.time}</div>
              <div><strong>关联对象：</strong>{detail?.objectId}</div>
              <div><strong>范围：</strong>{detail?.store}</div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-[#172033]">操作详细载荷：</span>
              <pre className="p-3 bg-[#f1f5f9] rounded text-[11px] font-mono text-[#172033] overflow-x-auto max-h-48">
                {JSON.stringify(detail?.detailJson || {}, null, 2)}
              </pre>
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-[#dbe3ec] bg-[#f8fafc]">
            <Button size="sm" onClick={closeDetail} className="h-8 bg-[#1672a8] hover:bg-[#125c88] text-white">
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
