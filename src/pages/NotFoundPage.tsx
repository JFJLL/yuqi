import { Link } from "react-router-dom"
import { FileQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="text-center flex flex-col items-center gap-3">
        <FileQuestion className="w-12 h-12 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">404 · 页面不存在</h1>
        <p className="text-sm text-muted-foreground">您访问的页面不存在或已被移除。</p>
        <Button asChild>
          <Link to="/">返回首页</Link>
        </Button>
      </div>
    </div>
  )
}
