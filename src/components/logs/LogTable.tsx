import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Pill } from "@/components/dashboard/Pill"
import type { AuditLogItem } from "@/lib/v1"

interface LogTableProps {
  rows: AuditLogItem[]
  loading: boolean
  onDetail: (row: AuditLogItem) => void
}

interface LogDetailDialogProps {
  log: AuditLogItem | null
  onClose: () => void
}

const HEADS = ["时间", "操作", "资源", "对象", "执行人", "详情", "操作"]

export function LogTable({ rows, loading, onDetail }: LogTableProps) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-[13px]">
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
                {row.created_at ? row.created_at.slice(0, 19).replace("T", " ") : "-"}
              </td>
              <td className="px-2.5 py-3 border-b border-border whitespace-nowrap font-medium">{row.action}</td>
              <td className="px-2.5 py-3 border-b border-border">{row.resource_type}</td>
              <td className="px-2.5 py-3 border-b border-border font-semibold max-w-[180px]">
                <span className="line-clamp-1">{row.resource_id ?? "-"}</span>
              </td>
              <td className="px-2.5 py-3 border-b border-border">{row.actor_name || "-"}</td>
              <td className="px-2.5 py-3 border-b border-border max-w-[280px]">
                <span className="line-clamp-2 text-muted-foreground">{row.detail ?? "-"}</span>
              </td>
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
      <DialogContent className="max-w-lg">
        {log && (
          <>
            <DialogHeader>
              <DialogTitle>日志详情</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">操作</span>
                <strong>{log.action}</strong>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">资源</span>
                <span>{log.resource_type}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">对象</span>
                <span className="max-w-[260px] break-all text-right">{log.resource_id || "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">执行人</span>
                <span>{log.actor_name || "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">时间</span>
                <span>{log.created_at ? log.created_at.slice(0, 19).replace("T", " ") : "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">状态</span>
                <Pill tone="green">已记录</Pill>
              </div>
              <div className="border border-border rounded-lg bg-background p-3 leading-relaxed text-foreground/90 break-all">
                {log.detail ?? "-"}
              </div>
              {(log.before || log.after) && (
                <div className="border border-border rounded-lg bg-background p-3 grid gap-1.5 text-xs leading-relaxed">
                  <strong className="text-sm">变更快照</strong>
                  <pre className="m-0 whitespace-pre-wrap break-all text-muted-foreground">
                    {JSON.stringify({ before: log.before, after: log.after }, null, 2)}
                  </pre>
                </div>
              )}
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
