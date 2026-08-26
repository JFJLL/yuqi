import { FileText, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Pill, riskTone } from "@/components/dashboard/Pill"
import type { AppealCard } from "./AppealQueue"

interface ReviewPanelProps {
  appeal: AppealCard | null
  issueQuote: string
  issueRisk: string
  reviewing: boolean
  onApprove: (appeal: AppealCard) => void
  onReject: (appeal: AppealCard) => void
  onPreview: () => void
  onViewContext: () => void
}

export function ReviewPanel({
  appeal,
  issueQuote,
  issueRisk,
  reviewing,
  onApprove,
  onReject,
  onPreview,
  onViewContext,
}: ReviewPanelProps) {
  return (
    <section className="bg-white border border-[#dbe3ec] rounded-[7px] overflow-hidden shadow-xs">
      <div className="p-4 border-b border-[#dbe3ec]">
        <h2 className="m-0 text-base font-bold text-[#172033]">申诉详情与决定</h2>
        <p className="mt-0.5 mb-0 text-[#65738a] text-xs">查看上下文并进行复核判定。</p>
      </div>
      <div className="p-4">
        {!appeal ? (
          <div className="border border-[#dbe3ec] rounded-[6px] p-6 bg-[#f8fafc] flex flex-col items-center justify-center gap-2 text-center">
            <div>
              <Pill tone="amber">待选择</Pill>
            </div>
            <strong className="text-xs font-semibold text-[#172033]">请在左侧选择一条申诉记录</strong>
            <span className="text-[#65738a] text-xs">查看原始证据、员工申诉理由及复核决定。</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="border border-[#dbe3ec] rounded-[6px] p-3.5 bg-white flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2.5">
                <strong className="text-sm font-bold text-[#172033]">
                  {appeal.employeeName || "-"} · {appeal.issueType || "-"}
                </strong>
                {issueRisk ? <Pill tone={riskTone(issueRisk)}>{issueRisk}风险</Pill> : null}
              </div>
              <span className="text-[#65738a] text-xs">
                {appeal.storeName || "-"} · 提交时间：{appeal.created ? appeal.created.slice(0, 16) : "-"}
              </span>
              <div className="border-l-3 border-[#1672a8] bg-[#f5f9fc] rounded-r p-2.5 text-xs leading-relaxed text-[#38475a] mt-1">
                <div className="font-semibold text-[#172033] mb-1">员工申诉理由：</div>
                {appeal.reason}
              </div>
              {issueQuote && (
                <div className="border-l-3 border-[#a96a12] bg-[#fffaf2] rounded-r p-2.5 text-xs leading-relaxed text-[#6d4408]">
                  <div className="font-semibold text-[#172033] mb-1">巡检命中文本：</div>
                  {issueQuote}
                </div>
              )}
            </div>

            <div className="border border-[#dbe3ec] rounded-[6px] p-3.5 bg-[#f8fafc] flex items-center justify-between">
              <span className="text-xs text-[#65738a]">关联沟通片段与完整录音上下文</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 gap-1 border-[#dbe3ec] bg-white text-xs" onClick={onPreview}>
                  <Play className="w-3.5 h-3.5" />
                  试听
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1 border-[#dbe3ec] bg-white text-xs" onClick={onViewContext}>
                  <FileText className="w-3.5 h-3.5" />
                  完整上下文
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#edf1f5]">
              <Button
                size="sm"
                className="h-9 bg-[#b43c3c] hover:bg-[#8f2b2b] text-white"
                disabled={reviewing || appeal.status !== "待复核"}
                onClick={() => onReject(appeal)}
              >
                驳回申诉
              </Button>
              <Button
                size="sm"
                className="h-9 bg-[#167a5b] hover:bg-[#115540] text-white"
                disabled={reviewing || appeal.status !== "待复核"}
                onClick={() => onApprove(appeal)}
              >
                通过申诉
              </Button>
            </div>
            {appeal.status !== "待复核" && (
              <p className="m-0 text-xs text-[#65738a] text-right">该申诉已完成复核判定（{appeal.status}）。</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
