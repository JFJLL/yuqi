import { Download, Search } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface LogFilterState {
  keyword: string
  action: string
  date: string
}

export const AUDIT_ACTION_OPTIONS = [
  "device.create",
  "binding.create",
  "binding.end",
  "file.upload",
  "transcript.edit",
  "issue.review",
  "issue.push_rectify",
  "appeal.review",
  "rectification.confirm",
  "rule.update",
]

interface LogFiltersProps {
  filters: LogFilterState
  onChange: (next: LogFilterState) => void
  onExport: () => void
}

const fieldClass =
  "min-h-9 w-full border border-border rounded-lg bg-card text-foreground outline-none px-2.5 text-sm focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"

export function LogFilters({ filters, onChange, onExport }: LogFiltersProps) {
  return (
    <div className="grid grid-cols-[1.4fr_repeat(2,minmax(150px,0.8fr))_auto] gap-2.5 items-end mb-3.5 max-lg:grid-cols-2 max-sm:grid-cols-1">
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">搜索</label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${fieldClass} pl-8`}
            placeholder="操作 / 资源 / 详情关键字"
            value={filters.keyword}
            onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">操作</label>
        <select
          className={fieldClass}
          value={filters.action}
          onChange={(e) => onChange({ ...filters, action: e.target.value })}
        >
          <option value="">全部</option>
          {AUDIT_ACTION_OPTIONS.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">日期</label>
        <input
          type="date"
          className={fieldClass}
          value={filters.date}
          onChange={(e) => onChange({ ...filters, date: e.target.value })}
        />
      </div>
      <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={onExport}>
        <Download className="w-4 h-4" />
        导出
      </Button>
    </div>
  )
}
