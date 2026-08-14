import { KnowledgePage } from "./KnowledgePage"
import { useKnowledge } from "./useKnowledge"

// 知识库模型页入口: 组装逻辑与视图
export function KnowledgeRoute() {
  const knowledgeProps = useKnowledge()
  return <KnowledgePage {...knowledgeProps} />
}
