import { KnowledgeStats } from "@/components/knowledge/KnowledgeStats"
import { KnowledgePanel } from "@/components/knowledge/KnowledgePanel"
import { ModelEvalPanel } from "@/components/knowledge/ModelEvalPanel"
import type { KnowledgeProps } from "./useKnowledge"

// 知识库模型视图: 只消费 props, 不自调逻辑 hook
export function KnowledgePage({ knowledge, evals, stats, handleCreate }: KnowledgeProps) {
  return (
    <div>
      <div className="h-1 w-12 rounded-full bg-primary mb-3" aria-hidden />
      <KnowledgeStats
        knowledgeCount={stats.knowledgeCount}
        ruleTotal={stats.ruleTotal}
        ruleEnabled={stats.ruleEnabled}
      />
      <div
        className="grid grid-cols-2 gap-3.5 items-start mt-3.5 max-lg:grid-cols-1 rounded-lg hover:shadow-md transition-shadow"
        style={{ boxShadow: "var(--elev-ring)" }}
      >
        <KnowledgePanel items={knowledge} onCreate={handleCreate} />
        <ModelEvalPanel evals={evals} />
      </div>
    </div>
  )
}
