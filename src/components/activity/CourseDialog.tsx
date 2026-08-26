import { useState, useEffect, type FormEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"

export interface CourseUnitForm {
  title: string
  content: string
  duration_seconds: number
}

export interface CourseFormValues {
  title: string
  category: string
  summary: string
  target_issue_types: string[]
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
  units: CourseUnitForm[]
}

interface CourseDialogProps {
  open: boolean
  saving: boolean
  onCancel: () => void
  onSave: (values: CourseFormValues) => void
}

export function CourseDialog({ open, saving, onCancel, onSave }: CourseDialogProps) {
  const [values, setValues] = useState<CourseFormValues>({
    title: "",
    category: "合规规范",
    summary: "",
    target_issue_types: ["夸大疗效"],
    status: "PUBLISHED",
    units: [{ title: "第一章：合规原则与风险防范", content: "药品销售中应当遵守真实、客观原则，不得夸大功效。", duration_seconds: 300 }],
  })

  useEffect(() => {
    if (!open) return
    setValues({
      title: "",
      category: "合规规范",
      summary: "",
      target_issue_types: ["夸大疗效"],
      status: "PUBLISHED",
      units: [{ title: "第一章：合规原则与风险防范", content: "药品销售中应当遵守真实、客观原则，不得夸大功效。", duration_seconds: 300 }],
    })
  }, [open])

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
      <DialogContent className="sm:max-w-[620px] p-0 overflow-hidden bg-white max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <DialogHeader className="p-4 border-b border-[#dbe3ec]">
            <DialogTitle className="text-base font-bold text-[#172033]">新增培训课程</DialogTitle>
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
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[#65738a]">课程分类</label>
                <select
                  value={values.category}
                  onChange={(e) => setValues({ ...values, category: e.target.value })}
                  className="h-9 border border-[#cfd9e4] rounded px-2.5 bg-white text-xs"
                >
                  <option value="合规规范">合规规范</option>
                  <option value="药学知识">药学知识</option>
                  <option value="荐药话术">荐药话术</option>
                  <option value="服务标准">服务标准</option>
                </select>
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
                  placeholder="简要说明本课程的核心学习要点与考核目标"
                  className="p-2.5 border border-[#cfd9e4] rounded text-xs min-h-[60px] resize-none"
                />
              </div>
            </div>

            {/* 章节列表 */}
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
                    placeholder="章节教学内容（支持图文或标准规范说明）"
                    className="p-2 border border-[#cfd9e4] rounded bg-white text-xs min-h-[50px] resize-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-[#dbe3ec] bg-[#f8fafc] flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8 border-[#dbe3ec]">
              取消
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="h-8 bg-[#1672a8] hover:bg-[#125c88] text-white">
              {saving ? "发布中…" : "发布课程"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
