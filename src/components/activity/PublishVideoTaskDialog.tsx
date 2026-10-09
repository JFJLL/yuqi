import { useState, useEffect, useMemo, type FormEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Video, Users, Building2, MapPin, CheckCircle2 } from "lucide-react"
import type { Employee, Store, Region, PublishLearningTaskPayload } from "@/lib/admin"

export interface PublishVideoTaskDialogProps {
  open: boolean
  courses: Array<{ id: string; title: string; category?: string; video_url?: string; video_duration?: number }>
  regions: Region[]
  stores: Store[]
  employees: Employee[]
  saving: boolean
  onCancel: () => void
  onPublish: (payload: PublishLearningTaskPayload) => void
}

export function PublishVideoTaskDialog({
  open,
  courses,
  regions,
  stores,
  employees,
  saving,
  onCancel,
  onPublish,
}: PublishVideoTaskDialogProps) {
  const [courseId, setCourseId] = useState("")
  const [targetScope, setTargetScope] = useState<"ALL" | "REGION" | "STORE" | "EMPLOYEE">("ALL")
  const [regionId, setRegionId] = useState("")
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([])
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [dueAt, setDueAt] = useState("")
  const [note, setNote] = useState("")

  useEffect(() => {
    if (!open) return
    const nextWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    setCourseId(courses[0]?.id || "")
    setTargetScope("ALL")
    setRegionId(regions[0]?.id || "")
    setSelectedStoreIds([])
    setSelectedEmployeeIds([])
    setDueAt(nextWeek)
    setNote("")
  }, [open, courses, regions])

  // 依据选择范围，计算受众员工人数
  const targetAudienceEmployees = useMemo(() => {
    const activeEmps = employees.filter((e) => e.status !== "离职")
    if (targetScope === "EMPLOYEE") {
      return activeEmps.filter((e) => selectedEmployeeIds.includes(e.id))
    }
    if (targetScope === "STORE") {
      return activeEmps.filter((e) => selectedStoreIds.includes(e.store))
    }
    if (targetScope === "REGION") {
      const storeIdsInRegion = new Set(stores.filter((s) => s.region === regionId).map((s) => s.id))
      return activeEmps.filter((e) => storeIdsInRegion.has(e.store))
    }
    return activeEmps
  }, [targetScope, regionId, selectedStoreIds, selectedEmployeeIds, employees, stores])

  const selectedCourse = useMemo(() => courses.find((c) => c.id === courseId), [courses, courseId])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!courseId) return
    onPublish({
      courseId,
      targetScope,
      regionId: targetScope === "REGION" ? regionId : undefined,
      storeIds: targetScope === "STORE" ? selectedStoreIds : undefined,
      employeeIds: targetScope === "EMPLOYEE" ? selectedEmployeeIds : undefined,
      dueAt,
      note,
    })
  }

  function toggleStore(sId: string) {
    setSelectedStoreIds((prev) =>
      prev.includes(sId) ? prev.filter((id) => id !== sId) : [...prev, sId]
    )
  }

  function toggleEmployee(eId: string) {
    setSelectedEmployeeIds((prev) =>
      prev.includes(eId) ? prev.filter((id) => id !== eId) : [...prev, eId]
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-[620px] p-0 overflow-hidden bg-white max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
          <DialogHeader className="p-4 border-b border-[#dbe3ec] shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-[#e8f1fa] text-[#1672a8] grid place-items-center">
                <Video className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-[#172033]">发布学习任务</DialogTitle>
                <p className="text-xs text-[#65738a] mt-0.5 m-0">向指定区域、门店或员工精准派发视频培训与考核任务。</p>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 flex flex-col gap-4 text-xs overflow-y-auto">
            {/* 选择课程 */}
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-[#172033] flex items-center justify-between">
                <span>选择培训视频课程 <span className="text-red-500">*</span></span>
                {selectedCourse?.video_url && (
                  <span className="text-[11px] text-[#126b59] font-normal flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 已关联视频资源
                  </span>
                )}
              </label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs font-medium"
                required
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.category || "合规"} · {c.video_url ? "含视频" : "图文"})
                  </option>
                ))}
              </select>
            </div>

            {/* 发布范围模式选择 */}
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-[#172033]">定向发布范围 <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: "ALL", label: "全部员工", icon: Users },
                  { key: "REGION", label: "指定区域", icon: MapPin },
                  { key: "STORE", label: "指定门店", icon: Building2 },
                  { key: "EMPLOYEE", label: "指定员工", icon: Users },
                ].map((item) => {
                  const Icon = item.icon
                  const active = targetScope === item.key
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setTargetScope(item.key as any)}
                      className={`h-9 flex items-center justify-center gap-1.5 rounded border text-xs font-medium transition-all ${
                        active
                          ? "border-[#1672a8] bg-[#e8f1fa] text-[#1672a8] font-bold"
                          : "border-[#dbe3ec] bg-white text-[#65738a] hover:bg-[#f8fafc]"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 范围选项：指定区域 */}
            {targetScope === "REGION" && (
              <div className="flex flex-col gap-1.5 p-3 bg-[#f8fafc] border border-[#dbe3ec] rounded-[6px]">
                <label className="font-medium text-[#65738a]">选择目标区域</label>
                <select
                  value={regionId}
                  onChange={(e) => setRegionId(e.target.value)}
                  className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
                >
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.manager_name || "未指定负责人"})</option>
                  ))}
                </select>
              </div>
            )}

            {/* 范围选项：指定门店 (支持多选) */}
            {targetScope === "STORE" && (
              <div className="flex flex-col gap-1.5 p-3 bg-[#f8fafc] border border-[#dbe3ec] rounded-[6px]">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-[#65738a]">勾选目标门店 ({selectedStoreIds.length} 已选)</label>
                  <button
                    type="button"
                    onClick={() => setSelectedStoreIds(selectedStoreIds.length === stores.length ? [] : stores.map((s) => s.id))}
                    className="text-[11px] text-[#1672a8] hover:underline"
                  >
                    {selectedStoreIds.length === stores.length ? "取消全选" : "全选门店"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 border border-[#cfd9e4] bg-white rounded">
                  {stores.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 p-1.5 hover:bg-[#f0f4f8] rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedStoreIds.includes(s.id)}
                        onChange={() => toggleStore(s.id)}
                        className="rounded text-[#1672a8]"
                      />
                      <span className="truncate">{s.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 范围选项：指定员工 (支持多选) */}
            {targetScope === "EMPLOYEE" && (
              <div className="flex flex-col gap-1.5 p-3 bg-[#f8fafc] border border-[#dbe3ec] rounded-[6px]">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-[#65738a]">勾选目标员工 ({selectedEmployeeIds.length} 已选)</label>
                  <button
                    type="button"
                    onClick={() => setSelectedEmployeeIds(selectedEmployeeIds.length === employees.length ? [] : employees.map((e) => e.id))}
                    className="text-[11px] text-[#1672a8] hover:underline"
                  >
                    {selectedEmployeeIds.length === employees.length ? "取消全选" : "全选员工"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 border border-[#cfd9e4] bg-white rounded">
                  {employees.map((e) => (
                    <label key={e.id} className="flex items-center gap-2 p-1.5 hover:bg-[#f0f4f8] rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.includes(e.id)}
                        onChange={() => toggleEmployee(e.id)}
                        className="rounded text-[#1672a8]"
                      />
                      <span className="truncate font-medium">{e.name}</span>
                      <span className="text-[10px] text-[#65738a] truncate">({e.role})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 受众人数预览卡片 */}
            <div className="p-3 bg-[#e8f5e9] border border-[#c8e6c9] rounded-[6px] flex items-center justify-between">
              <span className="text-[#2e7d32] font-semibold">预计触达员工总数：</span>
              <span className="text-base font-bold text-[#1b5e20]">{targetAudienceEmployees.length} 人</span>
            </div>

            {/* 截止时间与备注 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-medium text-[#65738a]">截止完成日期</label>
                <Input
                  type="date"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="h-9 bg-white border-[#cfd9e4]"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-medium text-[#65738a]">任务说明 / 学习要求</label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="如：请在周日前完成视频学习并复核"
                  className="h-9 bg-white border-[#cfd9e4]"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-[#dbe3ec] bg-[#f8fafc] shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-9">
              取消
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving || targetAudienceEmployees.length === 0}
              className="h-9 bg-[#1672a8] hover:bg-[#125c88] text-white"
            >
              {saving ? "正在发布…" : `确认派发任务 (${targetAudienceEmployees.length}人)`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}