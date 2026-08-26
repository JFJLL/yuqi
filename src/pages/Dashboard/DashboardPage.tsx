import { AlertCircle, AlertTriangle, CheckCircle2, RadioTower, RefreshCw, Store as StoreIcon, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { KeyIssues } from "@/components/dashboard/KeyIssues"
import { IssueDetailDialog } from "@/components/dashboard/IssueDetailDialog"
import type { DashboardProps } from "./useDashboard"

export function DashboardPage({
  managerStats,
  storeSummaries,
  systemHealth,
  keyIssues,
  tab,
  loading,
  error,
  reload,
  setTab,
  detailIssue,
  openDetail,
  closeDetail,
}: DashboardProps) {
  if (loading && storeSummaries.length === 0) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-[#65738a]">
        <div className="w-8 h-8 border-3 border-[#1672a8]/30 border-t-[#1672a8] rounded-full animate-spin" />
        <span className="text-sm">正在加载工作总览数据…</span>
      </div>
    )
  }

  if (error && storeSummaries.length === 0) {
    return (
      <div className="p-8 text-center bg-white border border-[#dbe3ec] rounded-[7px]">
        <AlertCircle className="w-10 h-10 text-[#b43c3c] mx-auto mb-2" />
        <h3 className="text-base font-semibold text-[#172033] mb-1">数据加载失败</h3>
        <p className="text-xs text-[#65738a] mb-4">{error}</p>
        <Button size="sm" onClick={reload} className="bg-[#1672a8] hover:bg-[#125c88] text-white gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          重新加载
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* 4 项核心指标卡片（经理版布局） */}
      <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <article className="bg-white border border-[#dbe3ec] rounded-[7px] p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#65738a] text-xs font-medium">
            <span>营业门店</span>
            <StoreIcon className="w-4 h-4 text-[#65738a]" />
          </div>
          <strong className="text-[28px] leading-tight font-bold text-[#172033] my-1">
            {managerStats.activeStores}
          </strong>
          <small className="text-xs text-[#65738a]">{managerStats.regionCount} 个区域</small>
        </article>

        <article className="bg-white border border-[#dbe3ec] rounded-[7px] p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#65738a] text-xs font-medium">
            <span>在职员工</span>
            <Users className="w-4 h-4 text-[#65738a]" />
          </div>
          <strong className="text-[28px] leading-tight font-bold text-[#172033] my-1">
            {managerStats.activeEmployees}
          </strong>
          <small className="text-xs text-[#65738a]">{managerStats.managerCount} 名店长</small>
        </article>

        <article className="bg-white border border-[#dbe3ec] rounded-[7px] p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#65738a] text-xs font-medium">
            <span>在线设备</span>
            <RadioTower className="w-4 h-4 text-[#65738a]" />
          </div>
          <strong className="text-[28px] leading-tight font-bold text-[#172033] my-1">
            {managerStats.onlineDevices}
          </strong>
          <small className="text-xs text-[#65738a]">共 {managerStats.totalDevices} 台设备</small>
        </article>

        <article className="bg-white border border-[#dbe3ec] rounded-[7px] p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#65738a] text-xs font-medium">
            <span>待处理问题</span>
            <AlertCircle className="w-4 h-4 text-[#a96a12]" />
          </div>
          <strong className="text-[28px] leading-tight font-bold text-[#a96a12] my-1">
            {managerStats.openIssues}
          </strong>
          <small className="text-xs text-[#65738a]">
            {managerStats.pendingAppeals > 0 ? managerStats.pendingAppeals + " 条申诉待复核" : "全部申诉已闭环"}
          </small>
        </article>
      </div>

      {/* 2栏主栅格：左栏 门店巡检概况 (1.5fr)，右栏 系统运行状态 (0.7fr) */}
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(320px,0.7fr)] gap-3.5 items-start max-xl:grid-cols-1">
        {/* 左侧：门店巡检概况表格 */}
        <section className="bg-white border border-[#dbe3ec] rounded-[7px] overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#dbe3ec] flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#172033] m-0">门店巡检概况</h2>
              <p className="text-xs text-[#65738a] mt-0.5 m-0">按实际问题数和设备在线状态汇总。</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#f8fafc] text-[#607086] border-b border-[#edf1f5]">
                  <th className="py-2.5 px-3 font-semibold">门店</th>
                  <th className="py-2.5 px-3 font-semibold">区域</th>
                  <th className="py-2.5 px-3 font-semibold">店长</th>
                  <th className="py-2.5 px-3 font-semibold text-center">员工</th>
                  <th className="py-2.5 px-3 font-semibold text-center">设备</th>
                  <th className="py-2.5 px-3 font-semibold text-center">待处理</th>
                  <th className="py-2.5 px-3 font-semibold text-center">高风险</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1f5]">
                {storeSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#65738a]">
                      暂无门店数据
                    </td>
                  </tr>
                ) : (
                  storeSummaries.map((st) => (
                    <tr key={st.id} className="hover:bg-[#fafcfe] transition-colors">
                      <td className="py-3 px-3">
                        <strong className="font-semibold text-[#172033]">{st.name}</strong>
                      </td>
                      <td className="py-3 px-3 text-[#65738a]">{st.region}</td>
                      <td className="py-3 px-3">
                        {st.managerName === "未设置" ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-[#fff2dc] text-[#946013]">
                            未设置
                          </span>
                        ) : (
                          <span className="text-[#172033] font-medium">{st.managerName}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center text-[#172033]">{st.employeeCount}</td>
                      <td className="py-3 px-3 text-center text-[#172033]">{st.deviceCount}</td>
                      <td className="py-3 px-3 text-center">
                        {st.openIssues > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-[#fff2dc] text-[#946013]">
                            {st.openIssues}
                          </span>
                        ) : (
                          <span className="text-[#65738a]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {st.highRisk > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-[#fae9e9] text-[#a83434]">
                            {st.highRisk}
                          </span>
                        ) : (
                          <span className="text-[#65738a]">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 右侧：系统运行状态 */}
        <aside className="bg-white border border-[#dbe3ec] rounded-[7px] overflow-hidden shadow-xs flex flex-col">
          <div className="p-4 border-b border-[#dbe3ec]">
            <h2 className="text-base font-bold text-[#172033] m-0">系统运行状态</h2>
            <p className="text-xs text-[#65738a] mt-0.5 m-0">转写、分析任务与组织配置状态。</p>
          </div>
          <div className="p-4 flex flex-col gap-3.5 text-xs">
            {/* 本地 ASR */}
            <div className="pb-3 border-b border-[#edf1f5] flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#172033]">本地 ASR</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#e6f4ef] text-[#147054]">
                  <CheckCircle2 className="w-3 h-3" />
                  已配置
                </span>
              </div>
              <span className="text-[#65738a] font-mono text-[11px]">{systemHealth.localAsrEndpoint}</span>
            </div>

            {/* 备用 ASR */}
            <div className="pb-3 border-b border-[#edf1f5] flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#172033]">备用 ASR</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#e6f4ef] text-[#147054]">
                  <CheckCircle2 className="w-3 h-3" />
                  已配置
                </span>
              </div>
              <span className="text-[#65738a] text-[11px]">{systemHealth.backupAsrEndpoint}</span>
            </div>

            {/* 通用 AI 分析 */}
            <div className="pb-3 border-b border-[#edf1f5] flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#172033]">通用 AI 分析</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#e6f4ef] text-[#147054]">
                  <CheckCircle2 className="w-3 h-3" />
                  已配置
                </span>
              </div>
              <span className="text-[#65738a] text-[11px]">{systemHealth.aiAnalysisModel}</span>
            </div>

            {/* 转写与分析队列 */}
            <div className="pb-3 border-b border-[#edf1f5] flex items-center justify-between">
              <span className="font-semibold text-[#172033]">转写与分析队列</span>
              <span className="text-[#65738a]">{systemHealth.transcriptionQueueText}</span>
            </div>

            {/* 未设置店长 */}
            <div className="pb-3 border-b border-[#edf1f5] flex items-center justify-between">
              <span className="font-semibold text-[#172033]">未设置店长门店</span>
              {systemHealth.unassignedManagers > 0 ? (
                <span className="inline-flex items-center gap-1 text-[#a96a12] font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {systemHealth.unassignedManagers} 家
                </span>
              ) : (
                <span className="text-[#147054] font-medium">已全部分配</span>
              )}
            </div>

            {/* 闭环监控指标 */}
            <div className="pt-1 flex flex-col gap-1.5 bg-[#f8fafc] p-2.5 rounded-[5px] border border-[#edf1f5]">
              <span className="font-semibold text-[#172033] text-[11px]">闭环监控</span>
              <div className="flex items-center justify-between text-[11px] text-[#65738a]">
                <span>待人工复核：<strong className="text-[#172033]">{systemHealth.pendingReviewCount}</strong></span>
                <span>待整改：<strong className="text-[#172033]">{systemHealth.pendingRectifyCount}</strong></span>
                <span>申诉待审：<strong className="text-[#172033]">{systemHealth.pendingAppealsCount}</strong></span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* 保留一期深度问题闭环与详情（可联动查看） */}
      <div className="mt-2">
        <KeyIssues issues={keyIssues} tab={tab} loading={loading} onTabChange={setTab} onView={openDetail} />
      </div>

      <IssueDetailDialog issue={detailIssue} onClose={closeDetail} />
    </div>
  )
}
