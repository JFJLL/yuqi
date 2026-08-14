import { AppealQueue } from "@/components/appeals/AppealQueue"
import { ReviewPanel } from "@/components/appeals/ReviewPanel"
import { ContextDialog } from "@/components/appeals/ContextDialog"
import { toast } from "sonner"
import type { AppealsProps } from "./useAppeals"

// 申诉复核视图: 只消费 props, 不自调逻辑 hook
export function AppealsPage({
  items,
  reviewing,
  selected,
  selectedIssue,
  selectedTranscript,
  contextOpen,
  setSelectedId,
  handleApprove,
  handleReject,
  openContext,
  closeContext,
}: AppealsProps) {
  return (
    <div>
      <div className="h-1 w-12 rounded-full bg-primary mb-3" aria-hidden />
      <div
        className="grid grid-cols-2 gap-3.5 items-start max-lg:grid-cols-1 rounded-lg hover:shadow-md transition-shadow"
        style={{ boxShadow: "var(--elev-ring)" }}
      >
        <AppealQueue items={items} selectedId={selected?.id ?? ""} onSelect={setSelectedId} />
        <ReviewPanel
          appeal={selected}
          issueQuote={selectedIssue?.quote ?? ""}
          issueRisk={selectedIssue?.risk ?? ""}
          reviewing={reviewing}
          onApprove={handleApprove}
          onReject={handleReject}
          onPreview={() => toast.info("试听功能将在接入设备音频后开放")}
          onViewContext={openContext}
        />
      </div>
      <ContextDialog
        open={contextOpen}
        title="沟通上下文"
        content={selectedTranscript?.full_text ?? selectedIssue?.quote ?? ""}
        onClose={closeContext}
      />
    </div>
  )
}
