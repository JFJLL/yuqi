import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { OrgRoute } from "."

const fetchEmployees = vi.fn()
const fetchOrgTree = vi.fn()
const fetchStores = vi.fn()

vi.mock("@/lib/v1", () => ({
  fetchEmployees: (...args: unknown[]) => fetchEmployees(...args),
  fetchOrgTree: (...args: unknown[]) => fetchOrgTree(...args),
  fetchStores: (...args: unknown[]) => fetchStores(...args),
  createEmployee: vi.fn(),
  totalPages: (total: number, pageSize: number) => Math.max(1, Math.ceil(total / pageSize)),
}))

function makeEmployee(id: string, name: string) {
  return {
    id,
    employee_no: `E${id}`,
    name,
    mobile: null,
    mobile_masked: "138****0000",
    job_title: "营业员",
    organization_node_id: null,
    store_id: "s1",
    store_name: "A 店",
    manager_id: null,
    employment_status: "ACTIVE",
    account_status: "ACTIVE",
    joined_at: null,
    left_at: null,
    created_at: "2026-08-01T00:00:00Z",
  }
}

describe("OrgPage server-side pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchOrgTree.mockResolvedValue([{ id: "r1", parent_id: null, node_type: "REGION", name: "华东", code: "R-E", sort_order: 0, status: "ACTIVE", children: [] }])
    fetchStores.mockResolvedValue({ items: [{ id: "s1", node_id: "n1", name: "A 店", code: "S-A", address: null, phone: null, status: "ACTIVE" }], page: 1, page_size: 200, total: 1, total_pages: 1 })
    fetchEmployees.mockResolvedValue({
      items: [makeEmployee("1", "店员甲"), makeEmployee("2", "店员乙")],
      page: 1,
      page_size: 20,
      total: 22,
      total_pages: 2,
    })
  })

  it("请求服务端分页参数并渲染员工列表", async () => {
    render(<OrgRoute />)
    await waitFor(() => expect(screen.getByText("店员甲")).toBeInTheDocument())
    expect(screen.getByText("店员乙")).toBeInTheDocument()
    expect(fetchEmployees).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, page_size: 20, keyword: "" }),
    )
    // 共 22 条 → 第 1/2 页
    expect(screen.getByText(/共 22 条/)).toBeInTheDocument()
  })

  it("点击下一页携带 page=2 重新请求", async () => {
    const user = userEvent.setup()
    render(<OrgRoute />)
    await waitFor(() => expect(screen.getByText("店员甲")).toBeInTheDocument())
    fetchEmployees.mockResolvedValueOnce({
      items: [makeEmployee("3", "店员丙")],
      page: 2,
      page_size: 20,
      total: 22,
      total_pages: 2,
    })
    await user.click(screen.getByRole("button", { name: /下一页/ }))
    await waitFor(() => expect(screen.getByText("店员丙")).toBeInTheDocument())
    expect(fetchEmployees).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
  })

  it("手机号展示脱敏结果", async () => {
    render(<OrgRoute />)
    await waitFor(() => expect(screen.getAllByText("138****0000").length).toBeGreaterThan(0))
  })
})
