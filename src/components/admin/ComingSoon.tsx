import { Sparkles } from "lucide-react"
import { useCurrentNav } from "./AdminLayout"

// 经理版统一建设中/空状态容器
export function ComingSoon() {
  const current = useCurrentNav()
  return (
    <section className="bg-white border border-[#dbe3ec] rounded-[7px] py-16 px-6 flex flex-col items-center justify-center gap-3 text-center shadow-xs">
      <div className="w-12 h-12 rounded-full bg-[#e5f1f9] grid place-items-center text-[#1672a8]">
        <Sparkles className="w-6 h-6" />
      </div>
      <h2 className="m-0 text-base font-bold text-[#172033]">{current.title} · 模块接入中</h2>
      <p className="m-0 text-xs text-[#65738a] max-w-md leading-relaxed">
        正在按经理版产品架构与信息标准接入数据。当前暂无未读待办，完整功能将在对应迭代就绪。
      </p>
    </section>
  )
}
