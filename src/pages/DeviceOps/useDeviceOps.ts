import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  fetchDeviceEvents,
  fetchDeviceSummary,
  totalPages,
  type DeviceEventItem,
  type DeviceSummary,
} from "@/lib/v1"
import type { DeviceLogRow } from "@/components/device-ops/DeviceLogTable"

const PAGE_SIZE = 20

// 设备运行页: 汇总卡片由服务端计算, 事件流来自审计日志 (服务端分页+筛选)
export function useDeviceOps() {
  const [summary, setSummary] = useState<DeviceSummary>({ total: 0, online: 0, offline: 0, bound: 0, unbound: 0, low_power: 0 })
  const [events, setEvents] = useState<DeviceEventItem[]>([])
  const [tab, setTab] = useState("全部")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadEvents = useCallback(
    async (nextTab: string, nextPage = 1) => {
      setLoading(true)
      try {
        const data = await fetchDeviceEvents({
          page: nextPage,
          page_size: PAGE_SIZE,
          event_type: nextTab === "全部" ? undefined : nextTab,
        })
        setEvents(data.items)
        setTotal(data.total)
        setPage(data.page)
      } catch {
        toast.error("设备运行数据加载失败，请稍后重试")
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    fetchDeviceSummary()
      .then(setSummary)
      .catch(() => toast.error("设备汇总加载失败，请稍后重试"))
  }, [])

  useEffect(() => {
    loadEvents(tab, 1)
  }, [tab, loadEvents])

  const goToPage = (next: number) => {
    loadEvents(tab, next)
  }

  const rows: DeviceLogRow[] = events.map((event) => ({
    id: event.id,
    occurred_at: event.occurred_at,
    type: event.type,
    content: event.content,
    status: event.status,
    deviceNo: event.device_code ?? "-",
    employeeName: event.employee_name ?? "",
    storeName: "",
    actorName: event.actor_name,
  }))

  return { summary, rows, tab, page, total, totalPages: totalPages(total, PAGE_SIZE), loading, setTab, setPage: goToPage }
}

export type DeviceOpsProps = ReturnType<typeof useDeviceOps>
