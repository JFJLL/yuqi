import { Hammer } from "lucide-react"
import { useCurrentNav } from "./AdminLayout"

// 一期未开发模块的统一占位页 (药品主数据 / AI荐药经营 / 培训考核 等)
export function ComingSoon() {
  const current = useCurrentNav()
  return (
    <section className="bg-card border border-border rounded-lg py-20 px-6 grid place-items-center gap-3 text-center">
      <div className="w-12 h-12 rounded-xl bg-accent grid place-items-center text-primary">
        <Hammer className="w-6 h-6" />
      </div>
      <h2 className="m-0 text-lg font-semibold">{current.title} · 建设中</h2>
      <p className="m-0 text-sm text-muted-foreground max-w-md leading-relaxed">
        该模块正在规划开发，一期暂不提供。页面里涉及本模块的数据将用「-」展示。
      </p>
    </section>
  )
}
