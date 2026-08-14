import { DeviceOpsCards } from "@/components/device-ops/DeviceOpsCards"
import { DeviceLogTable } from "@/components/device-ops/DeviceLogTable"
import type { DeviceOpsProps } from "./useDeviceOps"

// 设备运行视图: 只消费 props, 不自调逻辑 hook
export function DeviceOpsPage({ devices, rows, tab, loading, setTab }: DeviceOpsProps) {
  return (
    <div>
      <div className="h-1 w-12 rounded-full bg-primary mb-3" aria-hidden />
      <DeviceOpsCards devices={devices} />
      <DeviceLogTable rows={rows} tab={tab} loading={loading} onTabChange={setTab} />
    </div>
  )
}
