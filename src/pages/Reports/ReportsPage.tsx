import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ReportCards } from "@/components/reports/ReportCards"
import { ReportDialog } from "@/components/reports/ReportDialog"
import type { ReportsProps } from "./useReports"

export function ReportsPage({
  regions,
  stores,
  employees,
  storeRows,
  totals,
  reports,
  filters,
  loading,
  setFilters,
  viewing,
  openReport,
  closeReport,
  handleExport,
}: ReportsProps) {
  return (
    <div className="flex flex-col gap-4 text-xs font-sans">
      {/* 报表卡片与概览 */}
      <section className="bg-white border border-[#dbe3ec] rounded-[7px] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#dbe3ec] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-[#172033] m-0">基础报表与合规经营指标</h2>
            <p className="text-xs text-[#65738a] mt-0.5 m-0">导出组织、人员和巡检基础报表与合规经营指标。</p>
          </div>
          <Button
            size="sm"
            onClick={handleExport}
            className="h-9 bg-[#1672a8] hover:bg-[#125c88] text-white gap-1.5"
          >
            <Download className="w-4 h-4" />
            导出当前报表
          </Button>
        </div>

        {/* 核心指标统计 */}
        <div className="p-4 grid grid-cols-4 gap-3 bg-[#f8fafc] border-b border-[#edf1f5] max-md:grid-cols-2 max-sm:grid-cols-1">
          <article className="p-3 bg-white border border-[#dbe3ec] rounded-[6px] flex flex-col gap-1 shadow-2xs">
            <span className="text-[#65738a] font-medium">累计巡检录音</span>
            <strong className="text-2xl font-bold text-[#172033]">{totals.totalTranscripts}</strong>
            <small className="text-[#65738a]">全面覆盖门店业务会话</small>
          </article>
          <article className="p-3 bg-white border border-[#dbe3ec] rounded-[6px] flex flex-col gap-1 shadow-2xs">
            <span className="text-[#65738a] font-medium">有效巡检问题</span>
            <strong className="text-2xl font-bold text-[#a96a12]">{totals.totalIssues}</strong>
            <small className="text-[#65738a]">已人工复核确认</small>
          </article>
          <article className="p-3 bg-white border border-[#dbe3ec] rounded-[6px] flex flex-col gap-1 shadow-2xs">
            <span className="text-[#65738a] font-medium">高风险问题</span>
            <strong className="text-2xl font-bold text-[#b43c3c]">{totals.highRisk}</strong>
            <small className="text-[#65738a]">重点关注与退回培训</small>
          </article>
          <article className="p-3 bg-white border border-[#dbe3ec] rounded-[6px] flex flex-col gap-1 shadow-2xs">
            <span className="text-[#65738a] font-medium">整改完成率</span>
            <strong className="text-2xl font-bold text-[#167a5b]">{totals.rectifyRate}%</strong>
            <small className="text-[#65738a]">员工整改闭环达标</small>
          </article>
        </div>

        {/* 筛选区 */}
        <div className="p-4 border-b border-[#edf1f5] bg-[#fafcfe]">
          <div className="grid grid-cols-[repeat(4,minmax(130px,1fr))_auto] gap-3 items-end max-md:grid-cols-1">
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
              <label className="text-[11px] font-medium text-[#65738a]">员工</label>
              <select
                value={filters.employeeId}
                onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
                className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
              >
                <option value="">全部员工</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[#65738a]">时间范围</label>
              <input
                type="month"
                value={filters.date}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
              />
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

        {/* 门店明细表格 */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#f8fafc] text-[#607086] border-b border-[#edf1f5]">
                <th className="py-2.5 px-4 font-semibold">门店</th>
                <th className="py-2.5 px-4 font-semibold">区域</th>
                <th className="py-2.5 px-4 font-semibold text-center">员工数</th>
                <th className="py-2.5 px-4 font-semibold text-center">设备数</th>
                <th className="py-2.5 px-4 font-semibold text-center">录音总数</th>
                <th className="py-2.5 px-4 font-semibold text-center">巡检问题数</th>
                <th className="py-2.5 px-4 font-semibold text-center">待整改问题</th>
                <th className="py-2.5 px-4 font-semibold text-center">申诉复核数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f5]">
              {loading && storeRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#65738a]">
                    正在加载报表数据…
                  </td>
                </tr>
              ) : storeRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#65738a]">
                    暂无符合条件的报表数据
                  </td>
                </tr>
              ) : (
                storeRows.map((r) => (
                  <tr key={r.storeId} className="hover:bg-[#fafcfe] transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#172033]">{r.storeName}</td>
                    <td className="py-3 px-4 text-[#65738a]">{r.regionName}</td>
                    <td className="py-3 px-4 text-center text-[#172033]">{r.employeeCount}</td>
                    <td className="py-3 px-4 text-center text-[#172033]">{r.deviceCount}</td>
                    <td className="py-3 px-4 text-center text-[#172033]">{r.recordingCount}</td>
                    <td className="py-3 px-4 text-center text-[#a96a12] font-semibold">{r.issueCount}</td>
                    <td className="py-3 px-4 text-center">
                      {r.pendingRectifyCount > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-[#fff2dc] text-[#946013]">
                          {r.pendingRectifyCount}
                        </span>
                      ) : (
                        <span className="text-[#65738a]">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-[#172033]">{r.appealCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 专题分析报告卡片 */}
      <ReportCards reports={reports} onView={openReport} />
      <ReportDialog report={viewing} onClose={closeReport} />
    </div>
  )
}
