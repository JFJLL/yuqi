import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Pill, stateTone } from "@/components/dashboard/Pill"
import type { SyncLog } from "@/lib/admin"

interface LogTableProps {
  rows: SyncLog[]
  loading: boolean
  onDetail: (row: SyncLog) => void
}

interface LogDetailDialogProps {
  log: SyncLog | null
  onClose: () => void
}

const HEADS = ["时间", "类型", "对象", "门店", "状态", "结果", "操作"]

export function LogTable({ rows, loading, onDetail }: LogTableProps) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {HEADS.map((head) => (
              <th
                key={head}
                className="px-2.5 py-3 border-b border-border text-left font-semibold bg-muted/60 text-muted-foreground whitespace-nowrap"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && !loading && (
            <tr>
              <td colSpan={HEADS.length} className="px-2.5 py-10 text-center text-muted-foreground">
                没有符合条件的日志
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-accent/40">
              <td className="px-2.5 py-3 border-b border-border whitespace-nowrap">
                {row.occurred_at ? row.occurred_at.slice(11, 19) : "-"}
              </td>
              <td className="px-2.5 py-3 border-b border-border">{row.type}</td>
              <td className="px-2.5 py-3 border-b border-border font-semibold">{row.object}</td>
              <td className="px-2.5 py-3 border-b border-border">{row.store || "-"}</td>
              <td className="px-2.5 py-3 border-b border-border">
                <Pill tone={stateTone(row.status)}>{row.status}</Pill>
              </td>
              <td className="px-2.5 py-3 border-b border-border">{row.result}</td>
              <td className="px-2.5 py-3 border-b border-border">
                <Button variant="link" className="h-auto p-0 text-primary font-semibold" onClick={() => onDetail(row)}>
                  详情
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function LogDetailDialog({ log, onClose }: LogDetailDialogProps) {
  return (
    <Dialog open={!!log} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        {log && (
          <>
            <DialogHeader>
              <DialogTitle>日志详情</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">类型</span>
                <strong>{log.type}</strong>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">对象</span>
                <strong>{log.object}</strong>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">门店</span>
                <span>{log.store || "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">时间</span>
                <span>{log.occurred_at ? log.occurred_at.slice(0, 19) : "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">状态</span>
                <Pill tone={stateTone(log.status)}>{log.status}</Pill>
              </div>
              <div className="border border-border rounded-lg bg-background p-3 leading-relaxed text-foreground/90">
                {log.result}
              </div>
            </div>
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
