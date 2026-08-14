import { Download, Search } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface IssueFilterState {
  keyword: string
  risk: string
  state: string
  issueType: string
  date: string
}

export const RISK_OPTIONS = ["高", "中", "低"]
export const STATE_OPTIONS = ["待整改", "申诉中", "已完成"]
export const TYPE_OPTIONS = [
  "夸大疗效表达",
  "处方药提醒缺失",
  "联合用药风险",
  "基础疾病询问缺失",
  "服务态度问题",
]

interface IssueFiltersProps {
  filters: IssueFilterState
  typeOptions: string[]
  onChange: (next: IssueFilterState) => void
  onExport: () => void
}

const fieldClass =
  "min-h-9 w-full border border-border rounded-lg bg-card text-foreground outline-none px-2.5 text-sm focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"

export function IssueFilters({ filters, typeOptions, onChange, onExport }: IssueFiltersProps) {
  return (
    <div className="grid grid-cols-[1.2fr_repeat(4,minmax(120px,0.7fr))_auto] gap-2.5 items-end mb-3.5 max-lg:grid-cols-3 max-sm:grid-cols-1">
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">搜索</label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${fieldClass} pl-8`}
            placeholder="员工 / 门店 / 问题类型"
            value={filters.keyword}
            onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">风险</label>
        <select
          className={fieldClass}
          value={filters.risk}
          onChange={(e) => onChange({ ...filters, risk: e.target.value })}
        >
          <option value="">全部</option>
          {RISK_OPTIONS.map((risk) => (
            <option key={risk} value={risk}>
              {risk}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">状态</label>
        <select
          className={fieldClass}
          value={filters.state}
          onChange={(e) => onChange({ ...filters, state: e.target.value })}
        >
          <option value="">全部</option>
          {STATE_OPTIONS.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">类型</label>
        <select
          className={fieldClass}
          value={filters.issueType}
          onChange={(e) => onChange({ ...filters, issueType: e.target.value })}
        >
          <option value="">全部类型</option>
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
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
