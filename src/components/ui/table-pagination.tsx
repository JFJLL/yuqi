import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TablePaginationProps {
  page: number
  totalPages: number
  total: number
  onChange: (page: number) => void
}

/** 服务端分页控件: 上一页 / 页码信息 / 下一页 */
export function TablePagination({ page, totalPages: pages, total, onChange }: TablePaginationProps) {
  if (total === 0) return null
  return (
    <div className="flex items-center justify-between gap-3 pt-3 border-t border-border mt-3">
      <span className="text-muted-foreground text-xs">
        共 {total} 条 · 第 {page}/{pages} 页
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          下一页
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
