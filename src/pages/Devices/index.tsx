import { DevicesPage } from "./DevicesPage"
import { useDevices } from "./useDevices"

// 设备绑定页入口: 组装逻辑与视图
export function DevicesRoute() {
  const devicesProps = useDevices()
  return <DevicesPage {...devicesProps} />
}
