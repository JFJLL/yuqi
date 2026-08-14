import { Download, Search } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface LogFilterState {
  keyword: string
  type: string
  status: string
  date: string
}

export const LOG_TYPE_OPTIONS = ["转写推送", "设备心跳", "文本同步", "申诉片段", "合并录音"]
export const LOG_STATUS_OPTIONS = ["成功", "失败", "重试中"]

interface LogFiltersProps {
  filters: LogFilterState
  onChange: (next: LogFilterState) => void
  onExport: () => void
}

const fieldClass =
  "min-h-9 w-full border border-border rounded-lg bg-card text-foreground outline-none px-2.5 text-sm focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"

export function LogFilters({ filters, onChange, onExport }: LogFiltersProps) {
  return (
    <div className="grid grid-cols-[1.4fr_repeat(3,minmax(130px,0.75fr))_auto] gap-2.5 items-end mb-3.5 max-lg:grid-cols-3 max-sm:grid-cols-1">
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">搜索</label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${fieldClass} pl-8`}
            placeholder="设备码 / 任务号 / 门店"
            value={filters.keyword}
            onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">类型</label>
        <select
          className={fieldClass}
          value={filters.type}
          onChange={(e) => onChange({ ...filters, type: e.target.value })}
        >
          <option value="">全部</option>
          {LOG_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">状态</label>
        <select
          className={fieldClass}
          value={filters.status}
          onChange={(e) => onChange({ ...filters, status: e.target.value })}
        >
          <option value="">全部</option>
          {LOG_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
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
