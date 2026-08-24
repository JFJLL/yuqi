import { Link } from "react-router-dom"
import { FileQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="text-center">
        <FileQuestion className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h1 className="text-2xl font-semibold mb-1">404 · 页面不存在</h1>
        <p className="text-sm text-muted-foreground mb-5">您访问的页面不存在或已被移除。</p>
        <Button asChild>
          <Link to="/">返回工作台</Link>
        </Button>
      </div>
    </div>
  )
}
