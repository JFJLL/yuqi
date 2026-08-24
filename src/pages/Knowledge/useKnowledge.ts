import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  createRule,
  deleteRule,
  fetchRuleVersions,
  fetchRules,
  updateRule,
  type RiskRuleItem,
  type RiskRuleVersionItem,
} from "@/lib/v1"
import type { RuleRow } from "@/components/knowledge/RuleTable"

const PAGE_SIZE = 20

// 规则库页逻辑: 规则 CRUD + 启停 + 版本历史 (服务端分页)
export function useKnowledge() {
  const [rules, setRules] = useState<RiskRuleItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RiskRuleItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [versionsRule, setVersionsRule] = useState<RiskRuleItem | null>(null)
  const [versions, setVersions] = useState<RiskRuleVersionItem[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)

  const reload = useCallback(async (pageNum: number, kw: string) => {
    const data = await fetchRules({ page: pageNum, page_size: PAGE_SIZE, keyword: kw || undefined })
    setRules(data.items)
    setTotal(data.total)
    return data
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    reload(1, "")
      .catch(() => {
        if (!cancelled) toast.error("规则库加载失败，请稍后重试")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reload])

  useEffect(() => {
    let cancelled = false
    reload(page, keyword).catch(() => {
      if (!cancelled) toast.error("规则库刷新失败，请稍后重试")
    })
    return () => {
      cancelled = true
    }
  }, [page, keyword, reload])

  const rows: RuleRow[] = rules.map((rule) => ({
    rule,
    onEdit: (r) => {
      setEditing(r)
      setDialogOpen(true)
    },
    onToggle: async (r) => {
      try {
        await updateRule(r.id, { enabled: !r.enabled, change_note: r.enabled ? "停用规则" : "启用规则" })
        toast.success(r.enabled ? "已停用" : "已启用")
        await reload(page, keyword)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "操作失败")
      }
    },
    onVersions: async (r) => {
      setVersionsRule(r)
      setVersionsLoading(true)
      setVersions([])
      try {
        setVersions(await fetchRuleVersions(r.id))
      } catch {
        toast.error("版本加载失败")
      } finally {
        setVersionsLoading(false)
      }
    },
    onDelete: async (r) => {
      if (!window.confirm(`确定删除规则「${r.name}」吗？`)) return
      try {
        await deleteRule(r.id)
        toast.success("已删除")
        await reload(page, keyword)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "删除失败")
      }
    },
  }))

  async function handleSubmit(values: Parameters<typeof createRule>[0] & { change_note?: string }) {
    setSaving(true)
    try {
      if (editing) {
        await updateRule(editing.id, { ...values, change_note: values.change_note })
        toast.success("规则已更新")
      } else {
        await createRule(values)
        toast.success("规则已创建")
      }
      setDialogOpen(false)
      setEditing(null)
      await reload(page, keyword)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const stats = {
    ruleTotal: total,
    ruleEnabled: rules.filter((r) => r.enabled).length,
  }

  return {
    rows,
    loading,
    stats,
    keyword,
    page,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    setKeyword: (v: string) => {
      setKeyword(v)
      setPage(1)
    },
    setPage,
    dialogOpen,
    editing,
    saving,
    setDialogOpen,
    setEditing,
    handleSubmit,
    versionsRule,
    versions,
    versionsLoading,
    closeVersions: () => setVersionsRule(null),
  }
}

export type KnowledgeProps = ReturnType<typeof useKnowledge>
