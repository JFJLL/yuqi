import { Download, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { OrgNodeItem } from "@/lib/v1"

export interface OrgFilterState {
  keyword: string
  regionId: string
  role: string
  status: string
}

export const ROLE_OPTIONS = ["店长", "营业员", "执业药师"]
export const STATUS_OPTIONS = ["在职", "停用"]

interface EmployeeFiltersProps {
  filters: OrgFilterState
  regions: OrgNodeItem[]
  onChange: (next: OrgFilterState) => void
  onExport: () => void
}

const fieldClass =
  "min-h-9 w-full border border-border rounded-lg bg-card text-foreground outline-none px-2.5 text-sm focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"

/** 从组织树中提取全部 REGION 节点 (任意层级) */
function collectRegions(nodes: OrgNodeItem[], acc: OrgNodeItem[] = []): OrgNodeItem[] {
  for (const node of nodes) {
    if (node.node_type === "REGION") acc.push(node)
    if (node.children?.length) collectRegions(node.children, acc)
  }
  return acc
}

export function EmployeeFilters({ filters, regions, onChange, onExport }: EmployeeFiltersProps) {
  const regionOptions = collectRegions(regions)
  return (
    <div className="grid grid-cols-[1.4fr_repeat(3,minmax(130px,0.75fr))_auto] gap-2.5 items-end mb-3.5 max-lg:grid-cols-3 max-sm:grid-cols-1">
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">搜索</label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${fieldClass} pl-8`}
            placeholder="员工 / 员工号 / 手机号"
            value={filters.keyword}
            onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">区域</label>
        <select
          className={fieldClass}
          value={filters.regionId}
          onChange={(e) => onChange({ ...filters, regionId: e.target.value })}
        >
          <option value="">全部区域</option>
          {regionOptions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">岗位</label>
        <select
          className={fieldClass}
          value={filters.role}
          onChange={(e) => onChange({ ...filters, role: e.target.value })}
        >
          <option value="">全部岗位</option>
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {role}
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
          <option value="">全部状态</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
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
