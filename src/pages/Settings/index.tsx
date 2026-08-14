import { SettingsPage } from "./SettingsPage"
import { useSettings } from "./useSettings"

// 系统设置页入口: 组装逻辑与视图
export function SettingsRoute() {
  const settingsProps = useSettings()
  return <SettingsPage {...settingsProps} />
}
