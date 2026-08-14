import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { ReportSummary } from "./ReportCards"

interface ReportDialogProps {
  report: ReportSummary | null
  onClose: () => void
}

export function ReportDialog({ report, onClose }: ReportDialogProps) {
  return (
    <Dialog open={!!report} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        {report && (
          <>
            <DialogHeader>
              <DialogTitle>{report.title}</DialogTitle>
            </DialogHeader>
            <p className="m-0 text-muted-foreground text-sm">{report.desc}</p>
            <ul className="m-0 pl-4 grid gap-2 text-sm leading-relaxed">
              {report.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <div className="flex justify-end pt-1">
              <Button variant="outline" onClick={onClose}>
                关闭
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
