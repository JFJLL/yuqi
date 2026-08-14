import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  createRecord,
  fetchList,
  type ComplianceRule,
  type KnowledgeItem,
  type ModelEval,
} from "@/lib/admin"

// 知识库模型页逻辑: 知识条目 + 规则统计 + 评测展示
export function useKnowledge() {
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([])
  const [rules, setRules] = useState<ComplianceRule[]>([])
  const [evals, setEvals] = useState<ModelEval[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const data = await fetchList<KnowledgeItem>("knowledge_items", { perPage: 500 })
    setKnowledge(data.items ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchList<KnowledgeItem>("knowledge_items", { perPage: 500 }),
      fetchList<ComplianceRule>("compliance_rules", { perPage: 200 }),
      fetchList<ModelEval>("model_evals", { perPage: 100 }),
    ])
      .then(([knowledgeData, ruleData, evalData]) => {
        if (cancelled) return
        setKnowledge(knowledgeData.items ?? [])
        setRules(ruleData.items ?? [])
        setEvals(evalData.items ?? [])
      })
      .catch(() => {
        if (!cancelled) toast.error("知识库数据加载失败，请稍后重试")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    const ruleEnabled = rules.filter((rule) => rule.enabled).length
    return { knowledgeCount: knowledge.length, ruleTotal: rules.length, ruleEnabled }
  }, [knowledge, rules])

  async function handleCreate(values: { category: string; name: string; rule: string }) {
    try {
      await createRecord("knowledge_items", { ...values, status: "已启用" })
      toast.success("知识已保存")
      await reload()
    } catch {
      toast.error("保存失败，请稍后重试")
    }
  }

  return { knowledge, evals, stats, loading, handleCreate }
}

export type KnowledgeProps = ReturnType<typeof useKnowledge>
