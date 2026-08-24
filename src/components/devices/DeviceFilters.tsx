import { Search } from "lucide-react"
import type { StoreItem } from "@/lib/v1"

export interface DeviceFilterState {
  keyword: string
  deviceStatus: string
  deviceType: string
  bindStatus: string
  storeId: string
}

export const DEVICE_STATUS_OPTIONS = ["在线", "离线"]
export const DEVICE_TYPE_OPTIONS = ["BADGE"]
export const BIND_STATUS_OPTIONS = ["已绑定", "未绑定"]

interface DeviceFiltersProps {
  filters: DeviceFilterState
  stores: StoreItem[]
  onChange: (next: DeviceFilterState) => void
}

const fieldClass =
  "min-h-9 w-full border border-border rounded-lg bg-card text-foreground outline-none px-2.5 text-sm focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"

export function DeviceFilters({ filters, stores, onChange }: DeviceFiltersProps) {
  return (
    <div className="grid grid-cols-[1.2fr_repeat(4,minmax(120px,0.7fr))_auto] gap-2.5 items-end mb-3.5 max-lg:grid-cols-3 max-sm:grid-cols-1">
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">搜索</label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${fieldClass} pl-8`}
            placeholder="设备码"
            value={filters.keyword}
            onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">设备状态</label>
        <select
          className={fieldClass}
          value={filters.deviceStatus}
          onChange={(e) => onChange({ ...filters, deviceStatus: e.target.value })}
        >
          <option value="">全部</option>
          {DEVICE_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">绑定状态</label>
        <select
          className={fieldClass}
          value={filters.bindStatus}
          onChange={(e) => onChange({ ...filters, bindStatus: e.target.value })}
        >
          <option value="">全部</option>
          {BIND_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
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
      <span className="text-muted-foreground text-xs leading-9 hidden lg:block">筛选由服务端执行</span>
    </div>
  )
}
