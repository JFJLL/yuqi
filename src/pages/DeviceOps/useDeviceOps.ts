import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  fetchList,
  type Device,
  type DeviceBinding,
  type DeviceLog,
  type Employee,
  type Store,
} from "@/lib/admin"
import type { DeviceLogRow } from "@/components/device-ops/DeviceLogTable"
import { selectCurrentBindings } from "../../../shared/device-binding-semantics.js"

// 设备运行页逻辑: 设备汇总计算 + 日志类型过滤
export function useDeviceOps() {
  const [devices, setDevices] = useState<Device[]>([])
  const [logs, setLogs] = useState<DeviceLog[]>([])
  const [bindings, setBindings] = useState<DeviceBinding[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [tab, setTab] = useState("全部")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchList<Device>("devices", { perPage: 200 }),
      fetchList<DeviceLog>("device_logs", { perPage: 500 }),
      fetchList<DeviceBinding>("device_bindings", { perPage: 500 }),
      fetchList<Employee>("employees", { perPage: 200 }),
      fetchList<Store>("stores", { perPage: 200 }),
    ])
      .then(([deviceData, logData, bindingData, employeeData, storeData]) => {
        if (cancelled) return
        setDevices(deviceData.items ?? [])
        setLogs(logData.items ?? [])
        setBindings(bindingData.items ?? [])
        setEmployees(employeeData.items ?? [])
        setStores(storeData.items ?? [])
      })
      .catch(() => {
        if (!cancelled) toast.error("设备运行数据加载失败，请稍后重试")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const deviceById = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices])
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])
  const storeById = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores])

  const activeBindingByDevice = useMemo(() => {
    const map = new Map<string, DeviceBinding>()
    const selections = selectCurrentBindings(bindings)
    for (const [deviceId, selection] of selections.byDevice) {
      if (selection.isActive && selection.binding) {
        map.set(deviceId, selection.binding)
      }
    }
    return map
  }, [bindings])

  const rows: DeviceLogRow[] = useMemo(() => {
    const sorted = [...logs].sort((a, b) => (b.occurred_at ?? "").localeCompare(a.occurred_at ?? ""))
    return sorted
      .filter((log) => tab === "全部" || log.type === tab)
      .map((log) => {
        const device = deviceById.get(log.device)
        const binding = activeBindingByDevice.get(log.device)
        const employee = binding ? employeeById.get(binding.employee) : undefined
        const store = binding ? storeById.get(binding.store) : undefined
        return {
          ...log,
          deviceNo: device?.device_no ?? "-",
          employeeName: employee?.name ?? "",
          storeName: store?.name ?? "",
        }
      })
  }, [logs, tab, deviceById, activeBindingByDevice, employeeById, storeById])

  return { devices, rows, tab, loading, setTab }
}

export type DeviceOpsProps = ReturnType<typeof useDeviceOps>
