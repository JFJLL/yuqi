import { useState, useEffect, useMemo, useCallback } from "react"
import { Video, Send, Plus, Download, Play, Pencil, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  fetchList,
  exportCsv,
  publishLearningTasks,
  updateCourse,
  deleteCourse,
  createRecord,
  type Employee,
  type Store,
  type Region,
  type PublishLearningTaskPayload,
} from "@/lib/admin"
import { CourseDialog, type CourseFormValues } from "@/components/activity/CourseDialog"
import { PublishVideoTaskDialog } from "@/components/activity/PublishVideoTaskDialog"

export interface CourseRecord {
  id: string
  title: string
  category: string
  summary: string
  video_url?: string
  video_duration?: number
  allow_seek?: boolean
  status: string
  created?: string
}

export interface TaskRecord {
  id: string
  course: string
  employee: string
  store: string
  region?: string
  target_scope?: string
  note?: string
  source_issue?: string
  due_at?: string
  video_progress_seconds?: number
  status: string
  created?: string
  completed_at?: string
}

export interface LearningProgressRecord {
  id: string
  task: string
  employee: string
  course: string
  progress_percent: number
  status: string
  completed_at?: string
}

export function LearningTasksRoute() {
  const [courses, setCourses] = useState<CourseRecord[]>([])
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [progressList, setProgressList] = useState<LearningProgressRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [regions, setRegions] = useState<Region[]>([])

  const [activeTab, setActiveTab] = useState<"tasks" | "courses">("tasks")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 筛选器
  const [keyword, setKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [storeFilter, setStoreFilter] = useState("")

  // 弹窗
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [courseDialogOpen, setCourseDialogOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<CourseRecord | null>(null)
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null)
  const [previewVideoTitle, setPreviewVideoTitle] = useState<string>("")

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, tRes, pRes, eRes, sRes, rRes] = await Promise.all([
        fetchList<CourseRecord>("learning_courses", { perPage: 200 }).catch(() => ({ items: [] })),
        fetchList<TaskRecord>("learning_tasks", { perPage: 1000 }).catch(() => ({ items: [] })),
        fetchList<LearningProgressRecord>("learning_progress", { perPage: 1000 }).catch(() => ({ items: [] })),
        fetchList<Employee>("employees", { perPage: 1000 }).catch(() => ({ items: [] })),
        fetchList<Store>("stores", { perPage: 500 }).catch(() => ({ items: [] })),
        fetchList<Region>("regions", { perPage: 100 }).catch(() => ({ items: [] })),
      ])
      setCourses(cRes.items || [])
      setTasks(tRes.items || [])
      setProgressList(pRes.items || [])
      setEmployees(eRes.items || [])
      setStores(sRes.items || [])
      setRegions(rRes.items || [])
    } catch {
      toast.error("加载学习任务数据失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const empMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])
  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id, s.name])), [stores])
  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])

  const progressByTaskId = useMemo(() => {
    const map = new Map<string, number>()
    progressList.forEach((p) => {
      map.set(p.task, Number(p.progress_percent) || 0)
    })
    return map
  }, [progressList])

  const taskRows = useMemo(() => {
    return tasks.map((t) => {
      const emp = empMap.get(t.employee)
      const course = courseMap.get(t.course)
      const storeName = storeMap.get(t.store) || storeMap.get(emp?.store || "") || "总部/未分配"
      const progress = progressByTaskId.get(t.id) ?? (t.status === "COMPLETED" ? 100 : 0)

      let scopeLabel = "员工专属"
      if (t.target_scope === "REGION") scopeLabel = "按区域下发"
      else if (t.target_scope === "STORE") scopeLabel = "按门店下发"
      else if (t.target_scope === "ALL") scopeLabel = "全员通识"

      return {
        id: t.id,
        employeeName: emp?.name || "未知员工",
        employeeRole: emp?.role || "营业员",
        storeName,
        courseTitle: course?.title || "视频培训课程",
        category: course?.category || "合规培训",
        videoUrl: course?.video_url,
        scopeLabel,
        dueAt: t.due_at ? t.due_at.slice(0, 10) : "-",
        progress,
        status: t.status === "COMPLETED" ? "已完成" : progress > 0 ? "学习中" : "待学习",
        statusColor: t.status === "COMPLETED" ? "green" : progress > 0 ? "blue" : "amber",
        created: t.created ? t.created.slice(0, 16) : "-",
      }
    })
  }, [tasks, empMap, storeMap, courseMap, progressByTaskId])

  const filteredRows = useMemo(() => {
    return taskRows.filter((r) => {
      if (keyword) {
        const kw = keyword.toLowerCase()
        const match =
          r.employeeName.toLowerCase().includes(kw) ||
          r.courseTitle.toLowerCase().includes(kw) ||
          r.storeName.toLowerCase().includes(kw)
        if (!match) return false
      }
      if (statusFilter && r.status !== statusFilter) return false
      if (storeFilter && r.storeName !== storeFilter) return false
      return true
    })
  }, [taskRows, keyword, statusFilter, storeFilter])

  const metrics = useMemo(() => {
    const total = tasks.length
    const completed = taskRows.filter((r) => r.status === "已完成").length
    const inProgress = taskRows.filter((r) => r.status === "学习中").length
    const pending = total - completed - inProgress
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, inProgress, pending, rate }
  }, [tasks, taskRows])

  async function handlePublishTask(payload: PublishLearningTaskPayload) {
    setSaving(true)
    try {
      const res = await publishLearningTasks(payload)
      toast.success(res.message || "任务派发成功")
      setPublishDialogOpen(false)
      await loadData()
    } catch (err: any) {
      toast.error(err?.message || "派发任务失败，请检查参数")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteCourse(c: CourseRecord) {
    if (!confirm(`确定要删除课程《${c.title}》吗？关联的任务记录将受到影响。`)) return
    try {
      await deleteCourse(c.id)
      toast.success("课程已成功删除")
      await loadData()
    } catch (err: any) {
      toast.error(err.message || "删除课程失败")
    }
  }

  function handlePlayVideo(title: string, url?: string) {
    if (!url) {
      toast.error("该课程尚未关联视频资源")
      return
    }
    setPreviewVideoTitle(title)
    setPreviewVideoUrl(url)
  }

  function handleExportTasks() {
    if (filteredRows.length === 0) {
      toast.error("当前列表没有可导出的任务数据")
      return
    }
    const head = ["下发时间", "员工姓名", "岗位", "所属门店", "课程名称", "课程分类", "发布模式", "截止日期", "学习进度", "当前状态"]
    const rows = filteredRows.map((r) => [
      r.created,
      r.employeeName,
      r.employeeRole,
      r.storeName,
      r.courseTitle,
      r.category,
      r.scopeLabel,
      r.dueAt,
      `${r.progress}%`,
      r.status,
    ])
    exportCsv("员工视频学习任务明细.csv", head, rows)
    toast.success(`已导出 ${filteredRows.length} 条学习任务`)
  }

  return (
    <div className="flex flex-col gap-4 text-xs font-sans">
      {/* 顶部统计卡片 */}
      <section className="grid grid-cols-4 gap-3.5 max-md:grid-cols-2">
        <div className="p-4 bg-white border border-[#dbe3ec] rounded-[7px] shadow-2xs">
          <span className="text-[#65738a] text-[11px] font-medium block">已分发任务总人次</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#172033]">{metrics.total}</span>
            <span className="text-xs text-[#65738a]">人次</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-[#dbe3ec] rounded-[7px] shadow-2xs">
          <span className="text-[#65738a] text-[11px] font-medium block">已完成考核与观看</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#126b59]">{metrics.completed}</span>
            <span className="text-xs text-[#126b59] font-medium">({metrics.rate}%)</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-[#dbe3ec] rounded-[7px] shadow-2xs">
          <span className="text-[#65738a] text-[11px] font-medium block">正在学习进行中</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#1672a8]">{metrics.inProgress}</span>
            <span className="text-xs text-[#65738a]">人</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-[#dbe3ec] rounded-[7px] shadow-2xs">
          <span className="text-[#65738a] text-[11px] font-medium block">待开始学习</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#b45309]">{metrics.pending}</span>
            <span className="text-xs text-[#65738a]">人</span>
          </div>
        </div>
      </section>

      {/* 主面板 */}
      <section className="bg-white border border-[#dbe3ec] rounded-[7px] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#dbe3ec] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-[#172033] m-0">学习任务管理</h2>
            <p className="text-xs text-[#65738a] mt-0.5 m-0">
              面向指定区域、门店或员工定向派发视频培训任务；发布完成后小程序端即刻收到待办通知。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingCourse(null)
                setCourseDialogOpen(true)
              }}
              className="h-9 gap-1.5 bg-white border-[#dbe3ec] text-[#172033]"
            >
              <Plus className="w-4 h-4" />
              创建视频课程
            </Button>
            <Button
              size="sm"
              onClick={() => setPublishDialogOpen(true)}
              className="h-9 bg-[#1672a8] hover:bg-[#125c88] text-white gap-1.5 font-medium shadow-xs"
            >
              <Send className="w-4 h-4" />
              定向发布任务
            </Button>
          </div>
        </div>

        {/* 标签栏 */}
        <div className="px-4 pt-3 border-b border-[#edf1f5] flex items-center gap-1 bg-[#f8fafc]">
          <button
            onClick={() => setActiveTab("tasks")}
            className={`px-4 py-2 text-xs font-semibold rounded-t-[5px] border-b-2 transition-colors ${
              activeTab === "tasks"
                ? "bg-white text-[#1672a8] border-[#1672a8]"
                : "text-[#65738a] hover:text-[#172033] border-transparent"
            }`}
          >
            任务追踪与完成度 ({taskRows.length})
          </button>
          <button
            onClick={() => setActiveTab("courses")}
            className={`px-4 py-2 text-xs font-semibold rounded-t-[5px] border-b-2 transition-colors ${
              activeTab === "courses"
                ? "bg-white text-[#1672a8] border-[#1672a8]"
                : "text-[#65738a] hover:text-[#172033] border-transparent"
            }`}
          >
            视频课程库 ({courses.length})
          </button>
        </div>

        {/* Tab 1: 任务追踪 */}
        {activeTab === "tasks" && (
          <div>
            <div className="p-4 border-b border-[#edf1f5] bg-[#fafcfe]">
              <div className="grid grid-cols-[repeat(3,minmax(140px,1fr))_auto] gap-3 items-end max-md:grid-cols-1">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[#65738a]">搜索</label>
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="员工姓名 / 课程名称 / 门店"
                    className="h-9 bg-white border-[#cfd9e4]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[#65738a]">门店</label>
                  <select
                    value={storeFilter}
                    onChange={(e) => setStoreFilter(e.target.value)}
                    className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
                  >
                    <option value="">全部门店</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[#65738a]">状态</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
                  >
                    <option value="">全部状态</option>
                    <option value="待学习">待学习</option>
                    <option value="学习中">学习中</option>
                    <option value="已完成">已完成</option>
                  </select>
                </div>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportTasks}
                    className="h-9 gap-1.5 bg-white border-[#dbe3ec] text-[#172033]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    导出明细
                  </Button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-[#f8fafc] text-[#607086] border-b border-[#edf1f5]">
                    <th className="py-2.5 px-4 font-semibold">发布时间</th>
                    <th className="py-2.5 px-4 font-semibold">员工姓名</th>
                    <th className="py-2.5 px-4 font-semibold">所属门店</th>
                    <th className="py-2.5 px-4 font-semibold">视频培训课程</th>
                    <th className="py-2.5 px-4 font-semibold">发布模式</th>
                    <th className="py-2.5 px-4 font-semibold text-center">观看进度</th>
                    <th className="py-2.5 px-4 font-semibold text-center">状态</th>
                    <th className="py-2.5 px-4 font-semibold text-right">截止时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f5]">
                  {loading && filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#65738a]">
                        正在加载学习任务数据…
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#65738a]">
                        暂无符合条件的学习任务记录，可点击右上角「定向发布任务」派发
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r) => (
                      <tr key={r.id} className="hover:bg-[#fafcfe] transition-colors">
                        <td className="py-3 px-4 text-[#65738a] whitespace-nowrap">{r.created}</td>
                        <td className="py-3 px-4 font-semibold text-[#172033]">
                          {r.employeeName}
                          <span className="text-[10px] text-[#65738a] font-normal ml-1">({r.employeeRole})</span>
                        </td>
                        <td className="py-3 px-4 text-[#172033]">{r.storeName}</td>
                        <td className="py-3 px-4 font-medium text-[#172033]">
                          <div className="flex items-center gap-1.5">
                            <Video className="w-3.5 h-3.5 text-[#1672a8] shrink-0" />
                            <span className="truncate max-w-[220px]" title={r.courseTitle}>{r.courseTitle}</span>
                            {r.videoUrl && (
                              <button
                                type="button"
                                onClick={() => handlePlayVideo(r.courseTitle, r.videoUrl)}
                                className="text-[11px] text-[#1672a8] hover:underline shrink-0 ml-1 flex items-center gap-0.5"
                              >
                                <Play className="w-3 h-3 fill-current" /> 预览
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[#65738a]">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-[#f0f4f8] text-[#475569]">
                            {r.scopeLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 h-1.5 bg-[#edf2f6] rounded-full overflow-hidden">
                              <div
                                className={`h-full ${r.progress >= 100 ? "bg-[#126b59]" : "bg-[#1672a8]"}`}
                                style={{ width: `${r.progress}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-medium">{r.progress}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              r.status === "已完成"
                                ? "bg-[#e6f4ef] text-[#147054]"
                                : r.status === "学习中"
                                ? "bg-[#e8f1fa] text-[#1672a8]"
                                : "bg-[#fff2dc] text-[#946013]"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-[#65738a] whitespace-nowrap">{r.dueAt}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: 课程库 (支持增、删、改、查与在线看视频) */}
        {activeTab === "courses" && (
          <div className="p-4 grid grid-cols-3 gap-3.5 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {courses.length === 0 ? (
              <div className="col-span-3 py-12 text-center text-[#65738a]">
                暂无课程，请点击右上角「创建视频课程」录入新视频
              </div>
            ) : (
              courses.map((c) => (
                <article
                  key={c.id}
                  className="p-4 bg-white border border-[#dbe3ec] rounded-[6px] flex flex-col justify-between gap-3 shadow-2xs hover:border-[#1672a8] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded bg-[#e8f1fa] text-[#1672a8] grid place-items-center shrink-0">
                        <Video className="w-5 h-5" />
                      </div>
                      <div>
                        <strong className="text-xs font-bold text-[#172033] block leading-tight">{c.title}</strong>
                        <span className="text-[11px] text-[#65738a] mt-0.5 block">{c.category || "合规培训"}</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      c.video_url ? "bg-[#e6f4ef] text-[#147054]" : "bg-[#f1f5f9] text-[#475569]"
                    }`}>
                      {c.video_url ? "含视频" : "图文"}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#65738a] line-clamp-2 m-0 leading-relaxed">
                    {c.summary || "包含规范话术指引、实操案例视频与学习考核闭环。"}
                  </p>

                  <div className="pt-2 border-t border-[#edf1f5] flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[10px] text-[#65738a]">
                      时长：{Math.round((c.video_duration || 300) / 60)} 分钟
                    </span>

                    <div className="flex items-center gap-1.5">
                      {c.video_url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePlayVideo(c.title, c.video_url)}
                          className="h-7 text-xs text-[#126b59] hover:bg-[#e6f4ef] px-2 gap-1"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          预览
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingCourse(c)
                          setCourseDialogOpen(true)
                        }}
                        className="h-7 text-xs text-[#65738a] hover:bg-[#f1f5f9] px-2 gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteCourse(c)}
                        className="h-7 text-xs text-[#b43c3c] hover:bg-[#fae9e9] px-2 gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        删除
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPublishDialogOpen(true)}
                        className="h-7 text-xs border-[#dbe3ec] text-[#1672a8] hover:bg-[#e8f1fa] px-2 gap-1"
                      >
                        <Send className="w-3 h-3" />
                        派发
                      </Button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        )}
      </section>

      {/* 定向派发任务弹窗 */}
      <PublishVideoTaskDialog
        open={publishDialogOpen}
        courses={courses}
        regions={regions}
        stores={stores}
        employees={employees}
        saving={saving}
        onCancel={() => setPublishDialogOpen(false)}
        onPublish={handlePublishTask}
      />

      {/* 创建 / 编辑课程弹窗 (含上传视频功能) */}
      <CourseDialog
        open={courseDialogOpen}
        course={editingCourse}
        saving={saving}
        onCancel={() => {
          setCourseDialogOpen(false)
          setEditingCourse(null)
        }}
        onSave={async (values: CourseFormValues) => {
          setSaving(true)
          try {
            if (editingCourse) {
              await updateCourse(editingCourse.id, {
                title: values.title,
                category: values.category,
                summary: values.summary,
                video_url: values.video_url || "",
                video_duration: values.video_duration || 300,
                allow_seek: values.allow_seek ?? true,
                target_issue_types: values.target_issue_types,
              })
              toast.success("课程已成功更新")
            } else {
              await createRecord("learning_courses", {
                title: values.title,
                category: values.category,
                summary: values.summary,
                video_url: values.video_url || "",
                video_duration: values.video_duration || 300,
                allow_seek: values.allow_seek ?? true,
                target_issue_types: values.target_issue_types,
                status: "PUBLISHED",
              })
              toast.success("新课程已成功创建")
            }
            setCourseDialogOpen(false)
            setEditingCourse(null)
            await loadData()
          } catch (err: any) {
            toast.error(err.message || "操作课程失败")
          } finally {
            setSaving(false)
          }
        }}
      />

      {/* Web 端视频在线播放预览弹窗 */}
      <Dialog open={!!previewVideoUrl} onOpenChange={(v) => !v && setPreviewVideoUrl(null)}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-black text-white">
          <DialogHeader className="p-4 bg-[#141d28] border-b border-[#2d3748] flex items-center justify-between flex-row">
            <DialogTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Video className="w-4 h-4 text-[#1672a8]" />
              {previewVideoTitle || "培训视频在线预览"}
            </DialogTitle>
            <button
              type="button"
              onClick={() => setPreviewVideoUrl(null)}
              className="text-gray-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>
          <div className="w-full bg-black flex items-center justify-center p-2 min-h-[360px]">
            {previewVideoUrl && (
              <video
                src={previewVideoUrl}
                controls
                autoPlay
                className="w-full max-h-[500px] rounded bg-black"
              >
                您的浏览器不支持视频播放。
              </video>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}