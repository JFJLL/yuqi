import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Upload, Video, Loader2, CheckCircle2 } from "lucide-react"
import { uploadCourseVideo } from "@/lib/admin"
import { CustomSelect } from "@/components/ui/CustomSelect"
import { toast } from "sonner"

export interface CourseUnitForm {
  title: string
  content: string
  duration_seconds: number
}

export interface CourseFormValues {
  title: string
  category: string
  summary: string
  video_url?: string
  video_duration?: number
  allow_seek?: boolean
  target_issue_types: string[]
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
  units: CourseUnitForm[]
}

interface CourseDialogProps {
  open: boolean
  course?: {
    id: string
    title: string
    category: string
    summary: string
    video_url?: string
    video_duration?: number
    allow_seek?: boolean
    target_issue_types?: string[]
    units?: CourseUnitForm[]
  } | null
  saving: boolean
  onCancel: () => void
  onSave: (values: CourseFormValues) => void
}

const CATEGORY_OPTIONS = [
  { value: "合规规范", label: "合规规范" },
  { value: "药学知识", label: "药学知识" },
  { value: "荐药话术", label: "荐药话术" },
  { value: "服务标准", label: "服务标准" },
]

export function CourseDialog({ open, course, saving, onCancel, onSave }: CourseDialogProps) {
  const [values, setValues] = useState<CourseFormValues>({
    title: "",
    category: "合规规范",
    summary: "",
    video_url: "",
    video_duration: 300,
    allow_seek: true,
    target_issue_types: ["夸大疗效"],
    status: "PUBLISHED",
    units: [{ title: "第一章：合规原则与风险防范", content: "药品销售中应当遵守真实、客观原则，不得夸大功效。", duration_seconds: 300 }],
  })
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    if (course) {
      setValues({
        title: course.title || "",
        category: course.category || "合规规范",
        summary: course.summary || "",
        video_url: course.video_url || "",
        video_duration: course.video_duration || 300,
        allow_seek: course.allow_seek ?? true,
        target_issue_types: course.target_issue_types || ["夸大疗效"],
        status: "PUBLISHED",
        units: course.units || [{ title: "第一章：视频学习与规程", content: "", duration_seconds: course.video_duration || 300 }],
      })
    } else {
      setValues({
        title: "",
        category: "合规规范",
        summary: "",
        video_url: "",
        video_duration: 300,
        allow_seek: true,
        target_issue_types: ["夸大疗效"],
        status: "PUBLISHED",
        units: [{ title: "第一章：合规原则与风险防范", content: "药品销售中应当遵守真实、客观原则，不得夸大功效。", duration_seconds: 300 }],
      })
    }
  }, [open, course])

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await uploadCourseVideo(file)
      setValues((prev) => ({
        ...prev,
        video_url: res.videoUrl,
        title: prev.title || file.name.replace(/\.[^/.]+$/, ""),
      }))
      toast.success("视频上传成功！已存储在当前服务设备并生成在线访问地址")
    } catch (err: any) {
      toast.error(err.message || "视频上传失败")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function addUnit() {
    setValues({
      ...values,
      units: [...values.units, { title: `第 ${values.units.length + 1} 节：学习内容`, content: "", duration_seconds: 300 }],
    })
  }

  function removeUnit(index: number) {
    setValues({
      ...values,
      units: values.units.filter((_, i) => i !== index),
    })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!values.title.trim()) return
    onSave(values)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-[640px] p-0 overflow-hidden bg-white max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <DialogHeader className="p-4 border-b border-[#dbe3ec]">
            <DialogTitle className="text-base font-bold text-[#172033]">
              {course ? "编辑培训课程" : "新增视频培训课程"}
            </DialogTitle>
          </DialogHeader>

          <div className="p-5 flex flex-col gap-4 text-xs overflow-y-auto flex-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="font-medium text-[#65738a]">课程标题 <span className="text-red-500">*</span></label>
                <Input
                  value={values.title}
                  onChange={(e) => setValues({ ...values, title: e.target.value })}
                  placeholder="例如：药品销售话术规范与禁忌规避"
                  required
                  className="h-9 border-[#cfd9e4]"
                />
              </div>

              {/* 美化下拉框：课程分类 */}
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[#65738a]">课程分类</label>
                <CustomSelect
                  value={values.category}
                  onChange={(val) => setValues({ ...values, category: val })}
                  options={CATEGORY_OPTIONS}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[#65738a]">适用问题类型</label>
                <Input
                  value={values.target_issue_types.join(", ")}
                  onChange={(e) => setValues({ ...values, target_issue_types: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                  placeholder="例如：夸大疗效, 未提示禁忌"
                  className="h-9 border-[#cfd9e4]"
                />
              </div>

              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="font-medium text-[#65738a]">课程摘要</label>
                <textarea
                  value={values.summary}
                  onChange={(e) => setValues({ ...values, summary: e.target.value })}
                  placeholder="简述本课程学习目标及考核要点"
                  className="p-2 border border-[#cfd9e4] rounded bg-white text-xs min-h-[50px] resize-none"
                />
              </div>

              {/* 核心：视频上传与在线管理卡片 */}
              <div className="flex flex-col gap-2.5 col-span-2 p-3.5 bg-[#f8fafc] border border-[#dbe3ec] rounded-[6px]">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[#172033] flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-[#1672a8]" />
                    <span>教学视频文件与在线资源</span>
                  </label>
                  {values.video_url && (
                    <span className="text-[11px] text-[#126b59] font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 已绑定视频文件
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="video/mp4,video/webm,video/quicktime,video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 gap-1.5 bg-white border-[#1672a8] text-[#1672a8] hover:bg-[#e8f1fa]"
                  >
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {uploading ? "正在上传视频至服务器…" : "选择本地视频上传"}
                  </Button>
                  <span className="text-[11px] text-[#65738a]">视频将保存在当前部署设备存储目录，也可直接粘贴链接</span>
                </div>

                <div className="flex flex-col gap-1 mt-0.5">
                  <span className="text-[11px] text-[#65738a]">视频访问地址 (URL)</span>
                  <Input
                    value={values.video_url || ""}
                    onChange={(e) => setValues({ ...values, video_url: e.target.value })}
                    placeholder="视频相对路径或公网链接"
                    className="h-9 border-[#cfd9e4] bg-white text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <label className="flex items-center gap-1.5 text-xs text-[#65738a] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={values.allow_seek ?? true}
                      onChange={(e) => setValues({ ...values, allow_seek: e.target.checked })}
                      className="rounded text-[#1672a8]"
                    />
                    允许员工自由快进播放 (建议严肃合规培训取消勾选)
                  </label>
                </div>
              </div>
            </div>

            {/* 章节编排 */}
            <div className="flex flex-col gap-2 pt-2 border-t border-[#edf1f5]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#172033]">课程章节编排</span>
                <Button type="button" variant="outline" size="sm" onClick={addUnit} className="h-7 text-xs gap-1 border-[#dbe3ec]">
                  <Plus className="w-3.5 h-3.5" />
                  添加章节
                </Button>
              </div>
              {values.units.map((unit, idx) => (
                <div key={idx} className="p-3 bg-[#f8fafc] border border-[#dbe3ec] rounded-[6px] flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      value={unit.title}
                      onChange={(e) => {
                        const next = [...values.units]
                        next[idx].title = e.target.value
                        setValues({ ...values, units: next })
                      }}
                      placeholder="章节标题"
                      className="h-8 bg-white border-[#cfd9e4] text-xs font-semibold"
                    />
                    {values.units.length > 1 && (
                      <button type="button" onClick={() => removeUnit(idx)} className="p-1 text-[#b43c3c] hover:bg-[#fae9e9] rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <textarea
                    value={unit.content}
                    onChange={(e) => {
                      const next = [...values.units]
                      next[idx].content = e.target.value
                      setValues({ ...values, units: next })
                    }}
                    placeholder="章节教学内容（文字要点或考核说明）"
                    className="p-2 border border-[#cfd9e4] rounded bg-white text-xs min-h-[46px] resize-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-[#dbe3ec] bg-[#f8fafc] flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8 border-[#dbe3ec]">
              取消
            </Button>
            <Button type="submit" size="sm" disabled={saving || uploading} className="h-8 bg-[#1672a8] hover:bg-[#125c88] text-white">
              {saving ? "保存中…" : course ? "保存课程" : "创建课程"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}