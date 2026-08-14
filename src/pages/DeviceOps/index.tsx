import { DeviceOpsPage } from "./DeviceOpsPage"
import { useDeviceOps } from "./useDeviceOps"

// 设备运行页入口: 组装逻辑与视图
export function DeviceOpsRoute() {
  const deviceOpsProps = useDeviceOps()
  return <DeviceOpsPage {...deviceOpsProps} />
}
