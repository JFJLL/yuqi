import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DevicesRoute } from "."

const fetchDevices = vi.fn()
const fetchEmployees = vi.fn()
const fetchStores = vi.fn()
const createDevice = vi.fn()
const bindDevice = vi.fn()
const unbindDevice = vi.fn()

vi.mock("@/lib/v1", () => ({
  fetchDevices: (...args: unknown[]) => fetchDevices(...args),
  fetchEmployees: (...args: unknown[]) => fetchEmployees(...args),
  fetchStores: (...args: unknown[]) => fetchStores(...args),
  createDevice: (...args: unknown[]) => createDevice(...args),
  bindDevice: (...args: unknown[]) => bindDevice(...args),
  unbindDevice: (...args: unknown[]) => unbindDevice(...args),
  totalPages: (total: number, pageSize: number) => Math.max(1, Math.ceil(total / pageSize)),
}))

const device = {
  id: "d1",
  device_code: "WF-TEST-001",
  device_type: "BADGE",
  vendor: null,
  model: null,
  status: "ACTIVE",
  online_status: "ONLINE",
  last_heartbeat_at: null,
  battery_level: 80,
  firmware_version: null,
  bound: false,
  employee_id: null,
  employee_name: null,
  store_id: null,
  store_name: null,
}

describe("DevicesPage binding flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchDevices.mockResolvedValue({ items: [device], page: 1, page_size: 20, total: 1, total_pages: 1 })
    fetchEmployees.mockResolvedValue({
      items: [{ id: "e1", employee_no: "A001", name: "店员甲", mobile: null, mobile_masked: "138****0001", job_title: "营业员", organization_node_id: null, store_id: "s1", store_name: "A 店", manager_id: null, employment_status: "ACTIVE", account_status: "ACTIVE", joined_at: null, left_at: null, created_at: "2026-08-01T00:00:00Z" }],
      page: 1, page_size: 200, total: 1, total_pages: 1,
    })
    fetchStores.mockResolvedValue({ items: [{ id: "s1", node_id: "n1", name: "A 店", code: "S-A", address: null, phone: null, status: "ACTIVE" }], page: 1, page_size: 200, total: 1, total_pages: 1 })
    createDevice.mockResolvedValue({ ...device, id: "d2", device_code: "WF-NEW-999" })
    bindDevice.mockResolvedValue({ ok: true })
  })

  it("新增绑定: 建档设备后调用 bindDevice", async () => {
    const user = userEvent.setup()
    render(<DevicesRoute />)
    await waitFor(() => expect(screen.getByText("WF-TEST-001")).toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: /新增绑定/ }))
    await user.type(screen.getByPlaceholderText("请输入或扫描设备码"), "WF-NEW-999")
    await user.click(screen.getByRole("button", { name: /确认绑定/ }))
    await waitFor(() => expect(createDevice).toHaveBeenCalled())
    expect(createDevice).toHaveBeenCalledWith(expect.objectContaining({ device_code: "WF-NEW-999" }))
    await waitFor(() => expect(bindDevice).toHaveBeenCalled())
    expect(bindDevice).toHaveBeenCalledWith(expect.objectContaining({ device_id: "d2", employee_id: "e1" }))
  })

  it("渲染未绑定设备并显示解绑/调整操作", async () => {
    render(<DevicesRoute />)
    await waitFor(() => expect(screen.getByText("WF-TEST-001")).toBeInTheDocument())
    expect(screen.getAllByText("未绑定").length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "调整" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "解绑" })).not.toBeInTheDocument()
  })
})
