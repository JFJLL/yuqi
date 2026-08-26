import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  createRecord,
  fetchList,
  updateRecord,
  type AppSetting,
  type ComplianceRule,
  type KnowledgeItem,
} from "@/lib/admin"

export interface EngineSettingsForm {
  local_asr_url: string
  backup_asr_url: string
  analysis_api_url: string
  analysis_model: string
  asr_fallback_queue_threshold: number
  asr_timeout_seconds: number
  recording_retention_days: number
  transcript_retention_days: number
}

const DEFAULT_ENGINE_FORM: EngineSettingsForm = {
  local_asr_url: "http://127.0.0.1:8000/api/asr",
  backup_asr_url: "https://dashscope.aliyuncs.com/api/v1/services/audio/asr",
  analysis_api_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  analysis_model: "qwen-plus",
  asr_fallback_queue_threshold: 20,
  asr_timeout_seconds: 120,
  recording_retention_days: 30,
  transcript_retention_days: 365,
}

export function useSettings() {
  const [activeTab, setActiveTab] = useState<"engine" | "rules" | "knowledge">("engine")
  const [rules, setRules] = useState<ComplianceRule[]>([])
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([])
  const [engineForm, setEngineForm] = useState<EngineSettingsForm>(DEFAULT_ENGINE_FORM)
  const [settingRecords, setSettingRecords] = useState<AppSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [ruleData, knowledgeData, settingData] = await Promise.all([
        fetchList<ComplianceRule>("compliance_rules", { perPage: 200 }).catch(() => ({ items: [] as ComplianceRule[], page: 1, perPage: 200, totalItems: 0 })),
        fetchList<KnowledgeItem>("knowledge_items", { perPage: 500 }).catch(() => ({ items: [] as KnowledgeItem[], page: 1, perPage: 500, totalItems: 0 })),
        fetchList<AppSetting>("app_settings", { perPage: 100 }).catch(() => ({ items: [] as AppSetting[], page: 1, perPage: 100, totalItems: 0 })),
      ])

      setRules(ruleData.items || [])
      setKnowledgeItems(knowledgeData.items || [])
      const records = settingData.items || []
      setSettingRecords(records)

      const byKey = new Map(records.map((r) => [r.key, r.value]))
      setEngineForm({
        local_asr_url: byKey.get("local_asr_url") || DEFAULT_ENGINE_FORM.local_asr_url,
        backup_asr_url: byKey.get("backup_asr_url") || DEFAULT_ENGINE_FORM.backup_asr_url,
        analysis_api_url: byKey.get("analysis_api_url") || DEFAULT_ENGINE_FORM.analysis_api_url,
        analysis_model: byKey.get("analysis_model") || DEFAULT_ENGINE_FORM.analysis_model,
        asr_fallback_queue_threshold: Number(byKey.get("asr_fallback_queue_threshold")) || DEFAULT_ENGINE_FORM.asr_fallback_queue_threshold,
        asr_timeout_seconds: Number(byKey.get("asr_timeout_seconds")) || DEFAULT_ENGINE_FORM.asr_timeout_seconds,
        recording_retention_days: Number(byKey.get("recording_retention_days")) || DEFAULT_ENGINE_FORM.recording_retention_days,
        transcript_retention_days: Number(byKey.get("transcript_retention_days")) || DEFAULT_ENGINE_FORM.transcript_retention_days,
      })
    } catch {
      toast.error("系统参数加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleToggleRule(rule: ComplianceRule, enabled: boolean) {
    try {
      await updateRecord("compliance_rules", rule.id, { enabled })
      setRules((prev) => prev.map((item) => (item.id === rule.id ? { ...item, enabled } : item)))
      toast.success(enabled ? `已启用规则：${rule.name}` : `已停用规则：${rule.name}`)
    } catch {
      toast.error("更新规则状态失败")
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
    []
  )

  async function handleSaveEngineSettings() {
    setSaving(true)
    try {
      let records = settingRecords
      records = await upsertSetting(records, "local_asr_url", engineForm.local_asr_url)
      records = await upsertSetting(records, "backup_asr_url", engineForm.backup_asr_url)
      records = await upsertSetting(records, "analysis_api_url", engineForm.analysis_api_url)
      records = await upsertSetting(records, "analysis_model", engineForm.analysis_model)
      records = await upsertSetting(records, "asr_fallback_queue_threshold", String(engineForm.asr_fallback_queue_threshold))
      records = await upsertSetting(records, "asr_timeout_seconds", String(engineForm.asr_timeout_seconds))
      records = await upsertSetting(records, "recording_retention_days", String(engineForm.recording_retention_days))
      records = await upsertSetting(records, "transcript_retention_days", String(engineForm.transcript_retention_days))
      setSettingRecords(records)
      toast.success("系统参数已保存并实时生效")
    } catch {
      toast.error("保存系统参数失败")
    } finally {
      setSaving(false)
    }
  }

  return {
    activeTab,
    setActiveTab,
    rules,
    knowledgeItems,
    engineForm,
    setEngineForm,
    loading,
    saving,
    handleToggleRule,
    handleSaveEngineSettings,
    reload: loadData,
  }
}

export type SettingsProps = ReturnType<typeof useSettings>
