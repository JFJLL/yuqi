import { Download, Search } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface NamedOption {
  id: string
  name: string
}

type Employee = NamedOption
type Store = NamedOption

export interface RecordFilterState {
  keyword: string
  date: string
  storeId: string
  employeeId: string
  qcResult: string
}

export const QC_OPTIONS = ["有问题", "无问题"]

interface RecordFiltersProps {
  filters: RecordFilterState
  stores: Store[]
  employees: Employee[]
  onChange: (next: RecordFilterState) => void
  onExport: () => void
}

const fieldClass =
  "min-h-9 w-full border border-border rounded-lg bg-card text-foreground outline-none px-2.5 text-sm focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"

export function RecordFilters({ filters, stores, employees, onChange, onExport }: RecordFiltersProps) {
  return (
    <div className="grid grid-cols-[1.2fr_repeat(4,minmax(120px,0.7fr))_auto] gap-2.5 items-end mb-3.5 max-lg:grid-cols-3 max-sm:grid-cols-1">
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">关键词</label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${fieldClass} pl-8`}
            placeholder="搜索转写内容 / 药品名 / 员工"
            value={filters.keyword}
            onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
          />
        </div>
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
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">门店</label>
        <select
          className={fieldClass}
          value={filters.storeId}
          onChange={(e) => onChange({ ...filters, storeId: e.target.value })}
        >
          <option value="">全部门店</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">员工</label>
        <select
          className={fieldClass}
          value={filters.employeeId}
          onChange={(e) => onChange({ ...filters, employeeId: e.target.value })}
        >
          <option value="">全部员工</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">质检结果</label>
        <select
          className={fieldClass}
          value={filters.qcResult}
          onChange={(e) => onChange({ ...filters, qcResult: e.target.value })}
        >
          <option value="">全部</option>
          {QC_OPTIONS.map((qc) => (
            <option key={qc} value={qc}>
              {qc}
            </option>
          ))}
        </select>
      </div>
      <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={onExport}>
        <Download className="w-4 h-4" />
        导出
      </Button>
    </div>
  )
}
