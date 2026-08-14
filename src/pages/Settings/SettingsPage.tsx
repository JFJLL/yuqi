import { RuleListPanel } from "@/components/settings/RuleListPanel"
import { SystemFormPanel } from "@/components/settings/SystemFormPanel"
import type { SettingsProps } from "./useSettings"

// 系统设置视图: 只消费 props, 不自调逻辑 hook
export function SettingsPage({ rules, form, saving, setForm, handleToggle, handleSave, handleTest }: SettingsProps) {
  return (
    <div>
      <div className="h-1 w-12 rounded-full bg-primary mb-3" aria-hidden />
      <div
        className="grid grid-cols-2 gap-3.5 items-start max-lg:grid-cols-1 rounded-lg hover:shadow-md transition-shadow"
        style={{ boxShadow: "var(--elev-ring)" }}
      >
        <RuleListPanel rules={rules} onToggle={handleToggle} />
        <SystemFormPanel
          values={form}
          saving={saving}
          onChange={setForm}
          onSave={handleSave}
          onTest={handleTest}
        />
      </div>
    </div>
  )
}
