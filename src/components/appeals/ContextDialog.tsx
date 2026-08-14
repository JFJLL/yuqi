import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ContextDialogProps {
  open: boolean
  title: string
  content: string
  onClose: () => void
}

export function ContextDialog({ open, title, content, onClose }: ContextDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="border border-border rounded-lg bg-background p-3.5 text-sm leading-relaxed whitespace-pre-wrap">
          {content || "暂无关联的上下文内容。"}
        </div>
        <div className="flex justify-end pt-1">
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
