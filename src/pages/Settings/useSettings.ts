import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  fetchRules,
  fetchSettings,
  updateRule,
  updateSettings,
  type RiskRuleItem,
} from "@/lib/v1"
import type { RetentionFormValues } from "@/components/settings/RetentionPanel"

// 系统设置页逻辑: 规则启停 + 录音保留策略
export function useSettings() {
  const [rules, setRules] = useState<RiskRuleItem[]>([])
  const [retentionDays, setRetentionDays] = useState("365")
  const [form, setForm] = useState<RetentionFormValues>({ retentionDays: "365" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchRules({ page_size: 200 }), fetchSettings()])
      .then(([ruleData, settingData]) => {
        if (cancelled) return
        setRules(ruleData.items)
        setRetentionDays(settingData.retention_days)
        setForm({ retentionDays: settingData.retention_days })
      })
      .catch(() => {
        if (!cancelled) toast.error("设置数据加载失败，请稍后重试")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleToggle = useCallback(async (rule: RiskRuleItem, enabled: boolean) => {
    try {
      await updateRule(rule.id, { enabled, change_note: enabled ? "后台启停" : "后台停用" })
      setRules((prev) => prev.map((item) => (item.id === rule.id ? { ...item, enabled } : item)))
      toast.success(enabled ? "规则已启用" : "规则已停用")
    } catch {
      toast.error("更新失败，请稍后重试")
    }
  }, [])

  async function handleSave() {
    const days = Number(form.retentionDays)
    if (!Number.isInteger(days) || days < 0 || days > 3650) {
      toast.error("保留天数须为 0-3650 的整数（0 表示不自动清理）")
      return
    }
    setSaving(true)
    try {
      await updateSettings({ retention_days: days })
      setRetentionDays(String(days))
      toast.success("设置已保存")
    } catch {
      toast.error("保存失败，请稍后重试")
    } finally {
      setSaving(false)
    }
  }

  return { rules, form, retentionDays, loading, saving, setForm, handleToggle, handleSave }
}

export type SettingsProps = ReturnType<typeof useSettings>
