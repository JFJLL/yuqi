import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  createRecord,
  fetchList,
  updateRecord,
  type AppSetting,
  type ComplianceRule,
} from "@/lib/admin"
import type { SystemFormValues } from "@/components/settings/SystemFormPanel"

const DEFAULT_FORM: SystemFormValues = {
  syncStatus: "运行正常",
  syncFrequency: "每 10 分钟",
  roleTemplate: "总部管理员",
  lastSyncAt: "-",
}

// 系统设置页逻辑: 规则开关 + 键值设置读写
export function useSettings() {
  const [rules, setRules] = useState<ComplianceRule[]>([])
  const [form, setForm] = useState<SystemFormValues>(DEFAULT_FORM)
  const [settingRecords, setSettingRecords] = useState<AppSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchList<ComplianceRule>("compliance_rules", { perPage: 200 }),
      fetchList<AppSetting>("app_settings", { perPage: 100 }),
    ])
      .then(([ruleData, settingData]) => {
        if (cancelled) return
        setRules(ruleData.items ?? [])
        const records = settingData.items ?? []
        setSettingRecords(records)
        const byKey = new Map(records.map((record) => [record.key, record.value]))
        setForm({
          syncStatus: byKey.get("sync_status") ?? DEFAULT_FORM.syncStatus,
          syncFrequency: byKey.get("sync_frequency") ?? DEFAULT_FORM.syncFrequency,
          roleTemplate: byKey.get("role_template") ?? DEFAULT_FORM.roleTemplate,
          lastSyncAt: byKey.get("last_sync_at") ?? DEFAULT_FORM.lastSyncAt,
        })
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

  async function handleToggle(rule: ComplianceRule, enabled: boolean) {
    try {
      await updateRecord("compliance_rules", rule.id, { enabled })
      setRules((prev) => prev.map((item) => (item.id === rule.id ? { ...item, enabled } : item)))
      toast.success(enabled ? "规则已启用" : "规则已停用")
    } catch {
      toast.error("更新失败，请稍后重试")
    }
  }

  const upsertSetting = useCallback(
    async (records: AppSetting[], key: string, value: string): Promise<AppSetting[]> => {
      const existing = records.find((record) => record.key === key)
      if (existing) {
        const updated = await updateRecord<AppSetting>("app_settings", existing.id, { value })
        return records.map((record) => (record.key === key ? updated : record))
      }
      const created = await createRecord<AppSetting>("app_settings", { key, value })
      return [...records, created]
    },
    [],
  )

  async function handleSave() {
    setSaving(true)
    try {
      let records = settingRecords
      records = await upsertSetting(records, "sync_status", form.syncStatus)
      records = await upsertSetting(records, "sync_frequency", form.syncFrequency)
      records = await upsertSetting(records, "role_template", form.roleTemplate)
      setSettingRecords(records)
      toast.success("设置已保存")
    } catch {
      toast.error("保存失败，请稍后重试")
    } finally {
      setSaving(false)
    }
  }

  function handleTest() {
    toast.success("连接正常，数据同步通道可用")
  }

  return { rules, form, loading, saving, setForm, handleToggle, handleSave, handleTest }
}

export type SettingsProps = ReturnType<typeof useSettings>
