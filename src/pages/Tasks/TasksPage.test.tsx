import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TasksRoute } from "."

const fetchRectifications = vi.fn()
const fetchRectificationSummary = vi.fn()
const updateRectification = vi.fn()
const confirmRectification = vi.fn()

vi.mock("@/lib/v1", () => ({
  fetchRectifications: (...args: unknown[]) => fetchRectifications(...args),
  fetchRectificationSummary: (...args: unknown[]) => fetchRectificationSummary(...args),
  updateRectification: (...args: unknown[]) => updateRectification(...args),
  confirmRectification: (...args: unknown[]) => confirmRectification(...args),
}))

const rect = {
  id: "r1",
  issue_id: "i1",
  title: "规范用药话术",
  issue_type: "夸大疗效表达",
  quote: "重点介绍了 阿莫西林胶囊",
  employee_id: "e1",
  employee_name: "店员甲",
  store_name: "A 店",
  due_date: "2026-08-27",
  status: "PENDING",
  progress: 30,
  submit_comment: null,
  overdue: false,
  escalation_count: 0,
  created_at: "2026-08-24T10:00:00+08:00",
}

const summary = {
  total: 1,
  pending: 1,
  submitted: 0,
  confirmed: 0,
  rejected: 0,
  overdue: 0,
  escalated: 0,
  new_today: 1,
  completion_rate: 0,
}

describe("TasksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchRectifications.mockResolvedValue({ items: [rect], page: 1, page_size: 20, total: 1, total_pages: 1 })
    fetchRectificationSummary.mockResolvedValue(summary)
    updateRectification.mockResolvedValue({ ok: true, id: "r1" })
    confirmRectification.mockResolvedValue({ ok: true, status: "CONFIRMED" })
  })

  it("渲染整改任务列表与统计", async () => {
    render(<TasksRoute />)
    await waitFor(() => expect(screen.getByText("规范用药话术")).toBeInTheDocument())
    expect(screen.getAllByText("待整改").length).toBeGreaterThan(0)
    expect(screen.getByText("店员甲")).toBeInTheDocument()
  })

  it("跟进任务调用 updateRectification", async () => {
    const user = userEvent.setup()
    render(<TasksRoute />)
    await user.click(await screen.findByRole("button", { name: "跟进" }))
    await user.click(screen.getByRole("button", { name: "更新" }))
    await waitFor(() =>
      expect(updateRectification).toHaveBeenCalledWith("r1", { due_date: "2026-08-27", progress: 30 }),
    )
  })

  it("确认提交调用 confirmRectification", async () => {
    const submitted = { ...rect, status: "SUBMITTED", submit_comment: "已按规范整改" }
    fetchRectifications.mockResolvedValue({ items: [submitted], page: 1, page_size: 20, total: 1, total_pages: 1 })
    const user = userEvent.setup()
    render(<TasksRoute />)
    await user.click(await screen.findByRole("button", { name: "确认" }))
    await user.type(screen.getByPlaceholderText("填写确认或驳回意见"), "确认无误")
    await user.click(screen.getByRole("button", { name: "确认完成" }))
    await waitFor(() =>
      expect(confirmRectification).toHaveBeenCalledWith("r1", { approve: true, comment: "确认无误" }),
    )
  })
})
