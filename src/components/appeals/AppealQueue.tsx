import { Pill, stateTone } from "@/components/dashboard/Pill"
import type { AppealRecord } from "@/lib/admin"

export interface AppealCard extends AppealRecord {
  employeeName: string
  storeName: string
  issueType: string
}

interface AppealQueueProps {
  items: AppealCard[]
  selectedId: string
  onSelect: (item: AppealCard) => void
}

export function AppealQueue({ items, selectedId, onSelect }: AppealQueueProps) {
  return (
    <section className="bg-white border border-[#dbe3ec] rounded-[7px] overflow-hidden shadow-xs">
      <div className="p-4 border-b border-[#dbe3ec]">
        <h2 className="m-0 text-base font-bold text-[#172033]">申诉复核队列</h2>
        <p className="mt-0.5 mb-0 text-[#65738a] text-xs">总部可查看员工提交的申诉理由与证据。</p>
      </div>
      <div className="p-4 flex flex-col gap-2 max-h-[680px] overflow-y-auto">
        {items.length === 0 && (
          <p className="m-0 text-xs text-[#65738a] py-8 text-center">暂无申诉记录</p>
        )}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={`text-left border rounded-[6px] p-3 transition-colors cursor-pointer flex flex-col gap-1.5 ${
              selectedId === item.id
                ? "border-[#1672a8] bg-[#f1f8fc]"
                : "border-[#dbe3ec] bg-white hover:bg-[#fafcfe]"
            }`}
          >
            <div className="flex items-center justify-between gap-2.5">
              <strong className="text-xs font-semibold text-[#172033]">
                {item.employeeName || "-"} · {item.issueType || "-"}
              </strong>
              <Pill tone={stateTone(item.status)}>{item.status}</Pill>
            </div>
            <span className="text-[11px] text-[#65738a]">
              {item.storeName || "-"} · {item.created ? item.created.slice(0, 16) : "-"}
            </span>
            <div className="border-l-2 border-[#1672a8] bg-[#f5f9fc] rounded-r p-2 text-[11px] leading-relaxed text-[#38475a] line-clamp-2">
              理由：{item.reason}
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
