import { useState, type FormEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, FileUp, CheckCircle2 } from "lucide-react"

export type ImportType = "stores" | "managers"

interface BatchImportDialogProps {
  open: boolean
  type: ImportType
  saving: boolean
  onCancel: () => void
  onImport: (type: ImportType, csvText: string) => Promise<{ success: number; failed: number; errors: string[] }>
}

export function BatchImportDialog({ open, type, saving, onCancel, onImport }: BatchImportDialogProps) {
  const [csvContent, setCsvContent] = useState("")
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null)

  const isStore = type === "stores"
  const title = isStore ? "批量导入门店" : "批量设置店长"

  function handleDownloadTemplate() {
    const header = isStore ? "门店编号,门店名称,所属区域,门店地址,状态" : "门店名称,店长姓名,店长手机号"
    const sample = isStore
      ? "STORE-001,上海中山路店,华东大区,上海市中山西路100号,营业中\nSTORE-002,杭州武林店,华东大区,杭州市武林广场1号,营业中"
      : "上海中山路店,李店长,13800000001\n杭州武林店,王店长,13800000002"
    const blob = new Blob(["\uFEFF" + header + "\n" + sample], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = isStore ? "门店导入模板.csv" : "店长设置模板.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setCsvContent(String(event.target?.result || ""))
    }
    reader.readAsText(file)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!csvContent.trim()) return
    const res = await onImport(type, csvContent)
    setResult(res)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden bg-white">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-4 border-b border-[#dbe3ec] flex flex-row items-center justify-between">
            <DialogTitle className="text-base font-bold text-[#172033]">{title}</DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="h-7 text-xs border-[#dbe3ec] gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              下载模板
            </Button>
          </DialogHeader>

          <div className="p-5 flex flex-col gap-4 text-xs">
            <div className="p-3 bg-[#f8fafc] border border-[#dbe3ec] rounded-[6px] text-[#65738a] leading-relaxed">
              请上传标准 CSV 文件，首行为字段表头。支持部分成功、行级校验和错误明细反馈。
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-[#172033]">选择 CSV 文件</label>
              <div className="border border-dashed border-[#cfd9e4] rounded-[6px] p-4 text-center hover:bg-[#fafcfe] cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-[#65738a]"
                />
              </div>
            </div>

            {csvContent && (
              <div className="flex flex-col gap-1">
                <span className="font-medium text-[#172033]">已加载内容预览（前 3 行）：</span>
                <pre className="p-2 bg-[#f1f5f9] rounded text-[11px] font-mono text-[#172033] overflow-x-auto max-h-24">
                  {csvContent.split("\n").slice(0, 3).join("\n")}
                </pre>
              </div>
            )}

            {result && (
              <div className="p-3 bg-white border border-[#dbe3ec] rounded-[6px] flex flex-col gap-1.5">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-[#167a5b]" />
                  <span>成功导入 {result.success} 条</span>
                  {result.failed > 0 && (
                    <span className="text-[#b43c3c]">（失败 {result.failed} 条）</span>
                  )}
                </div>
                {result.errors.length > 0 && (
                  <div className="text-[11px] text-[#b43c3c] mt-1 max-h-24 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <div key={i}>• {err}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t border-[#dbe3ec] bg-[#f8fafc] flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8 border-[#dbe3ec]">
              关闭
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving || !csvContent.trim()}
              className="h-8 bg-[#1672a8] hover:bg-[#125c88] text-white gap-1.5"
            >
              <FileUp className="w-3.5 h-3.5" />
              {saving ? "处理中…" : "开始导入"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
