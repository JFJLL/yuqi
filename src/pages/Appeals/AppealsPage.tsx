import { AppealQueue } from "@/components/appeals/AppealQueue"
import { ReviewPanel } from "@/components/appeals/ReviewPanel"
import { ContextDialog } from "@/components/appeals/ContextDialog"
import { TablePagination } from "@/components/ui/table-pagination"
import { toast } from "sonner"
import type { AppealsProps } from "./useAppeals"

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "APPEALING", label: "申诉中" },
  { key: "", label: "全部" },
]

// 申诉复核视图: 只消费 props, 不自调逻辑 hook
export function AppealsPage({
  items,
  loading,
  reviewing,
  selected,
  status,
  page,
  total,
  totalPages,
  contextOpen,
  setSelectedId,
  changeStatus,
  changePage,
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
        <div className="grid gap-2.5">
          <div className="inline-grid grid-flow-col gap-1 p-1 border border-border rounded-lg bg-background justify-self-start">
            {STATUS_TABS.map((item) => (
              <button
                key={item.key || "all"}
                type="button"
                onClick={() => changeStatus(item.key)}
                className={`min-h-[30px] border-0 rounded-md px-3 text-sm cursor-pointer transition-colors ${
                  status === item.key
                    ? "bg-card text-primary shadow-sm"
                    : "bg-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <AppealQueue items={items} selectedId={selected?.id ?? ""} loading={loading} onSelect={setSelectedId} />
          <TablePagination page={page} totalPages={totalPages} total={total} onChange={changePage} />
        </div>
        <ReviewPanel
          appeal={selected}
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
        content={selected?.quote ?? ""}
        onClose={closeContext}
      />
    </div>
  )
}
