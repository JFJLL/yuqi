import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AppealsRoute } from "."

const fetchAppeals = vi.fn()
const reviewAppeal = vi.fn()

vi.mock("@/lib/v1", () => ({
  fetchAppeals: (...args: unknown[]) => fetchAppeals(...args),
  reviewAppeal: (...args: unknown[]) => reviewAppeal(...args),
}))

const appeal = {
  id: "i1",
  issue_no: "ISS-20260824-00001",
  occurred_at: "2026-08-24T10:30:00+08:00",
  employee: "e1",
  store: "s1",
  employee_name: "店员甲",
  store_name: "A 店",
  issue_type: "夸大疗效表达",
  risk: "高",
  quote: "重点介绍了 阿莫西林胶囊",
  advice: "需复核",
  source: "ANALYZER",
  state: "申诉中",
  review_status: "APPROVED",
  appeal_status: "APPEALING",
  remediation_status: "NONE",
  close_status: "OPEN",
  employee_view_status: "SEEN",
  segment_count: 1,
  due_date: null,
  appeal_reason: "我是在正常推荐药品，没有夸大",
  appeal_reviewed_at: null,
  appeal_review_comment: null,
}

describe("AppealsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchAppeals.mockResolvedValue({ items: [appeal], page: 1, page_size: 20, total: 1, total_pages: 1 })
    reviewAppeal.mockResolvedValue({ ok: true, appeal_status: "APPEAL_APPROVED" })
  })

  it("渲染申诉队列与复核面板", async () => {
    render(<AppealsRoute />)
    await waitFor(() => expect(screen.getByText("店员甲 · 夸大疗效表达")).toBeInTheDocument())
    expect(screen.getByText("我是在正常推荐药品，没有夸大")).toBeInTheDocument()
    expect(screen.getAllByText("申诉中").length).toBeGreaterThan(0)
  })

  it("选择申诉后可通过复核", async () => {
    const user = userEvent.setup()
    render(<AppealsRoute />)
    await user.click(await screen.findByRole("button", { name: /店员甲 · 夸大疗效表达/ }))
    await user.click(screen.getByRole("button", { name: "通过" }))
    await waitFor(() => expect(reviewAppeal).toHaveBeenCalledWith("i1", { approve: true }))
  })

  it("驳回调用 reviewAppeal approve=false", async () => {
    const user = userEvent.setup()
    render(<AppealsRoute />)
    await user.click(await screen.findByRole("button", { name: /店员甲 · 夸大疗效表达/ }))
    await user.click(screen.getByRole("button", { name: "驳回" }))
    await waitFor(() => expect(reviewAppeal).toHaveBeenCalledWith("i1", { approve: false }))
  })
})
