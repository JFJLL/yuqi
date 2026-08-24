import { useCallback, useEffect, useState } from "react"
import { CheckCheck, Inbox } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationsRead,
  type NotificationItem,
} from "@/lib/v1"

interface NotificationsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUnreadChange?: (count: number) => void
}

// 通知中心: 我的通知 + 未读计数 (管理端/员工共用)
export function NotificationsDialog({ open, onOpenChange, onUnreadChange }: NotificationsDialogProps) {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const refreshUnread = useCallback(async () => {
    try {
      const data = await fetchUnreadCount()
      onUnreadChange?.(data.count)
    } catch {
      // 静默失败, 不影响主界面
    }
  }, [onUnreadChange])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    fetchNotifications({ page: 1, page_size: 50 })
      .then((data) => {
        if (!cancelled) setItems(data.items)
      })
      .catch(() => {
        if (!cancelled) toast.error("通知加载失败，请稍后重试")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    void refreshUnread()
    return () => {
      cancelled = true
    }
  }, [open, refreshUnread])

  const markRead = useCallback(
    async (id?: string) => {
      if (busy) return
      setBusy(true)
      try {
        await markNotificationsRead(id)
        if (id) {
          setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)))
        } else {
          setItems((prev) => prev.map((item) => ({ ...item, read: true })))
        }
        await refreshUnread()
      } catch {
        toast.error("操作失败，请稍后重试")
      } finally {
        setBusy(false)
      }
    },
    [busy, refreshUnread],
  )

  const unreadCount = items.filter((item) => !item.read).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>通知中心{unreadCount > 0 ? `（${unreadCount} 条未读）` : ""}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 max-h-[420px] overflow-auto pr-0.5">
          {loading && items.length === 0 && (
            <p className="m-0 text-sm text-muted-foreground py-8 text-center">加载中…</p>
          )}
          {!loading && items.length === 0 && (
            <div className="grid justify-items-center gap-2 py-10 text-muted-foreground">
              <Inbox className="w-8 h-8" />
              <span className="text-sm">暂无通知</span>
            </div>
          )}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`text-left border rounded-lg p-3 grid gap-1.5 cursor-pointer transition-colors ${
                item.read ? "border-border bg-background" : "border-primary/60 bg-primary/5"
              }`}
              onClick={() => !item.read && void markRead(item.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <strong className="text-[13px]">{item.title}</strong>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${item.read ? "bg-muted-foreground/40" : "bg-primary"}`}
                  aria-hidden
                />
              </div>
              <span className="text-muted-foreground text-xs leading-relaxed">{item.body}</span>
              <span className="text-muted-foreground/70 text-[11px]">
                {item.created_at ? item.created_at.slice(0, 16).replace("T", " ") : ""}
              </span>
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2.5 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={busy || unreadCount === 0}
            onClick={() => void markRead()}
          >
            <CheckCheck className="w-3.5 h-3.5" />
            全部已读
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
