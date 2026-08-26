import { BookOpen, Download, Info, Plus, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { CourseDialog } from "@/components/activity/CourseDialog"
import { CreateTaskDialog } from "@/components/activity/CreateTaskDialog"
import type { ActivityProps } from "./useActivity"

export function ActivityPage({
  activeTab,
  setActiveTab,
  items,
  courses,
  learningRows,
  stores,
  employees,
  filters,
  loading,
  saving,
  setFilters,
  viewingItem,
  openDetail,
  closeDetail,
  courseDialogOpen,
  openCourseDialog,
  closeCourseDialog,
  handleCreateCourse,
  taskDialogOpen,
  openTaskDialog,
  closeTaskDialog,
  handleCreateTask,
  handleExport,
}: ActivityProps) {
  return (
    <div className="flex flex-col gap-4 text-xs font-sans">
      <section className="bg-white border border-[#dbe3ec] rounded-[7px] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#dbe3ec] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-[#172033] m-0">员工业务记录</h2>
            <p className="text-xs text-[#65738a] mt-0.5 m-0">检索员工维度的荐药、学习培训与考核记录。</p>
          </div>
          {activeTab === "courses" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={openTaskDialog}
                className="h-8 gap-1 bg-white border-[#dbe3ec] text-[#172033] text-xs"
              >
                <Send className="w-3.5 h-3.5" />
                派发培训任务
              </Button>
              <Button
                size="sm"
                onClick={openCourseDialog}
                className="h-8 bg-[#1672a8] hover:bg-[#125c88] text-white gap-1 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                新增课程
              </Button>
            </div>
          )}
        </div>

        {/* 标签栏 */}
        <div className="px-4 pt-3 pb-0 border-b border-[#edf1f5] flex items-center justify-between bg-[#f8fafc] flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("recommendation")}
              className={`px-4 py-2 text-xs font-semibold rounded-t-[5px] border-b-2 transition-colors ${
                activeTab === "recommendation"
                  ? "bg-white text-[#1672a8] border-[#1672a8]"
                  : "text-[#65738a] hover:text-[#172033] border-transparent"
              }`}
            >
              AI 智能荐药记录
            </button>
            <button
              onClick={() => setActiveTab("learning")}
              className={`px-4 py-2 text-xs font-semibold rounded-t-[5px] border-b-2 transition-colors ${
                activeTab === "learning"
                  ? "bg-white text-[#1672a8] border-[#1672a8]"
                  : "text-[#65738a] hover:text-[#172033] border-transparent"
              }`}
            >
              学习记录与考核
            </button>
            <button
              onClick={() => setActiveTab("courses")}
              className={`px-4 py-2 text-xs font-semibold rounded-t-[5px] border-b-2 transition-colors ${
                activeTab === "courses"
                  ? "bg-white text-[#1672a8] border-[#1672a8]"
                  : "text-[#65738a] hover:text-[#172033] border-transparent"
              }`}
            >
              课程与培训管理
            </button>
          </div>
          {activeTab === "recommendation" && (
            <div className="flex items-center gap-1.5 text-[#65738a] text-[11px] pb-2">
              <Info className="w-3.5 h-3.5 text-[#a96a12]" />
              <span>数据来源状态：外部 ERP 未接入（当前使用内置测试知识图谱）</span>
            </div>
          )}
        </div>

        {/* 1. 荐药记录 Tab */}
        {activeTab === "recommendation" && (
          <div>
            {/* 筛选区 */}
            <div className="p-4 border-b border-[#edf1f5] bg-[#fafcfe]">
              <div className="grid grid-cols-[repeat(3,minmax(140px,1fr))_auto] gap-3 items-end max-md:grid-cols-1">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[#65738a]">搜索</label>
                  <Input
                    value={filters.keyword}
                    onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                    placeholder="主诉 / 员工 / 门店 / 推荐药品"
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
                  <label className="text-[11px] font-medium text-[#65738a]">安全性</label>
                  <select
                    value={filters.safety}
                    onChange={(e) => setFilters({ ...filters, safety: e.target.value })}
                    className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
                  >
                    <option value="">全部安全性</option>
                    <option value="未发现明确冲突">未发现明确冲突</option>
                    <option value="需药师复核">需药师复核</option>
                    <option value="存在禁忌风险">存在禁忌风险</option>
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
                    <th className="py-2.5 px-4 font-semibold">时间</th>
                    <th className="py-2.5 px-4 font-semibold">员工</th>
                    <th className="py-2.5 px-4 font-semibold">门店</th>
                    <th className="py-2.5 px-4 font-semibold">顾客主诉/咨询</th>
                    <th className="py-2.5 px-4 font-semibold">推荐结果</th>
                    <th className="py-2.5 px-4 font-semibold text-center">安全性</th>
                    <th className="py-2.5 px-4 font-semibold text-center">医学依据</th>
                    <th className="py-2.5 px-4 font-semibold text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f5]">
                  {loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#65738a]">
                        正在加载荐药记录…
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#65738a]">
                        暂无符合条件的荐药记录
                      </td>
                    </tr>
                  ) : (
                    items.map((r) => (
                      <tr key={r.id} className="hover:bg-[#fafcfe] transition-colors">
                        <td className="py-3 px-4 text-[#65738a] whitespace-nowrap">
                          {r.occurred_at ? r.occurred_at.slice(0, 16) : "-"}
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#172033]">{r.employeeName}</td>
                        <td className="py-3 px-4 text-[#172033]">{r.storeName}</td>
                        <td className="py-3 px-4 font-medium text-[#172033] max-w-[200px] truncate" title={r.query}>
                          {r.query}
                        </td>
                        <td className="py-3 px-4 text-[#172033] max-w-[220px] truncate" title={r.productsText}>
                          {r.productsText}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            r.safety === "需药师复核"
                              ? "bg-[#fff2dc] text-[#946013]"
                              : r.safety === "存在禁忌风险"
                              ? "bg-[#fae9e9] text-[#a83434]"
                              : "bg-[#e6f4ef] text-[#147054]"
                          }`}>
                            {r.safety || "未发现明确冲突"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-[#65738a]">
                          {r.source_count ?? 3} 条依据
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => openDetail(r)}
                            className="text-[#1672a8] hover:underline font-medium p-1"
                          >
                            查看
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. 学习记录 Tab */}
        {activeTab === "learning" && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#f8fafc] text-[#607086] border-b border-[#edf1f5]">
                  <th className="py-2.5 px-4 font-semibold">任务时间</th>
                  <th className="py-2.5 px-4 font-semibold">员工</th>
                  <th className="py-2.5 px-4 font-semibold">门店</th>
                  <th className="py-2.5 px-4 font-semibold">课程</th>
                  <th className="py-2.5 px-4 font-semibold">来源问题</th>
                  <th className="py-2.5 px-4 font-semibold text-center">学习进度</th>
                  <th className="py-2.5 px-4 font-semibold text-center">状态</th>
                  <th className="py-2.5 px-4 font-semibold text-center">考试成绩</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1f5]">
                {learningRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#65738a]">
                      暂无员工学习与考核记录
                    </td>
                  </tr>
                ) : (
                  learningRows.map((lr) => (
                    <tr key={lr.id} className="hover:bg-[#fafcfe]">
                      <td className="py-3 px-4 text-[#65738a]">{lr.updatedAt}</td>
                      <td className="py-3 px-4 font-semibold text-[#172033]">{lr.employeeName}</td>
                      <td className="py-3 px-4 text-[#172033]">{lr.storeName}</td>
                      <td className="py-3 px-4 font-medium text-[#172033]">{lr.courseTitle}</td>
                      <td className="py-3 px-4 text-[#65738a]">{lr.sourceIssue}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-1.5 bg-[#edf2f6] rounded-full overflow-hidden">
                            <div className="h-full bg-[#1672a8]" style={{ width: `${lr.progress}%` }} />
                          </div>
                          <span>{lr.progress}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          lr.status === "已完成" ? "bg-[#e6f4ef] text-[#147054]" : "bg-[#e5f1f9] text-[#176d9e]"
                        }`}>
                          {lr.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-[#172033] font-medium">{lr.score}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. 课程与培训管理 Tab */}
        {activeTab === "courses" && (
          <div className="p-4 grid grid-cols-3 gap-3.5 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {courses.length === 0 ? (
              <div className="col-span-3 py-12 text-center text-[#65738a]">
                暂无课程，请点击右上角「新增课程」发布新课
              </div>
            ) : (
              courses.map((c) => (
                <article key={c.id} className="p-4 bg-white border border-[#dbe3ec] rounded-[6px] flex flex-col justify-between gap-2.5 shadow-2xs hover:border-[#1672a8] transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-[#e5f1f9] grid place-items-center text-[#1672a8] shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <strong className="text-xs font-bold text-[#172033] block leading-tight">{c.title}</strong>
                        <span className="text-[11px] text-[#65738a]">{c.category || "合规规范"}</span>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#e6f4ef] text-[#147054]">
                      {c.status || "已发布"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#65738a] line-clamp-2 m-0 leading-relaxed">
                    {c.summary || "包含标准化合规问答、销售话术指引与结业考核。"}
                  </p>
                  <div className="pt-2 border-t border-[#edf1f5] flex items-center justify-between">
                    <span className="text-[10px] text-[#65738a]">创建时间：{c.created ? c.created.slice(0, 10) : "2026-08-26"}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={openTaskDialog}
                      className="h-7 text-xs border-[#dbe3ec] text-[#1672a8] hover:bg-[#e5f1f9] gap-1"
                    >
                      <Send className="w-3 h-3" />
                      派发
                    </Button>
                  </div>
                </article>
              ))
            )}
          </div>
        )}
      </section>

      {/* 荐药详情弹窗 */}
      <Dialog open={!!viewingItem} onOpenChange={(v) => !v && closeDetail()}>
        <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden bg-white">
          <DialogHeader className="p-4 border-b border-[#dbe3ec]">
            <DialogTitle className="text-base font-bold text-[#172033]">
              {viewingItem?.employeeName} · 荐药记录详情
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 flex flex-col gap-3.5 text-xs">
            <div className="p-3.5 bg-[#f8fafc] border border-[#dbe3ec] rounded-[6px] flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <strong className="text-sm font-bold text-[#172033]">{viewingItem?.query}</strong>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  viewingItem?.safety === "需药师复核"
                    ? "bg-[#fff2dc] text-[#946013]"
                    : "bg-[#e6f4ef] text-[#147054]"
                }`}>
                  {viewingItem?.safety}
                </span>
              </div>
              <span className="text-[#65738a]">
                门店：{viewingItem?.storeName} · 时间：{viewingItem?.occurred_at || viewingItem?.created}
              </span>
            </div>

            <div className="border-l-3 border-[#1672a8] bg-[#f5f9fc] rounded-r p-3 text-xs leading-relaxed text-[#38475a]">
              <div className="font-semibold text-[#172033] mb-1">药学推荐逻辑 / 依据：</div>
              {viewingItem?.result_json?.rationale || "根据顾客主诉的咽干咽痛症状，推荐具有清利咽喉作用的药物，并结合体质提示禁忌事项。"}
            </div>

            <div className="p-3 bg-white border border-[#dbe3ec] rounded-[6px] flex flex-col gap-1.5">
              <span className="font-semibold text-[#172033]">推荐结果商品：</span>
              <p className="text-[#172033] m-0 font-medium">{viewingItem?.productsText}</p>
            </div>

            <div className="flex items-center justify-between text-[#65738a] pt-1">
              <span>医学指南证据引用：{viewingItem?.source_count ?? 3} 条</span>
              <span className="text-[11px] text-[#a96a12]">外部 ERP 未接入 · 测试数据</span>
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-[#dbe3ec] bg-[#f8fafc]">
            <Button size="sm" onClick={closeDetail} className="h-8 bg-[#1672a8] hover:bg-[#125c88] text-white">
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新增课程弹窗 */}
      <CourseDialog
        open={courseDialogOpen}
        saving={saving}
        onCancel={closeCourseDialog}
        onSave={handleCreateCourse}
      />

      {/* 派发培训任务弹窗 */}
      <CreateTaskDialog
        open={taskDialogOpen}
        courses={courses}
        employees={employees}
        stores={stores}
        saving={saving}
        onCancel={closeTaskDialog}
        onSave={handleCreateTask}
      />
    </div>
  )
}
