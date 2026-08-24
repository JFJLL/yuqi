import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { InspectionRoute } from "."

const fetchIssues = vi.fn()
const fetchIssueDetail = vi.fn()
const reviewIssue = vi.fn()
const pushRectify = vi.fn()
const closeIssue = vi.fn()
const rerunAnalysis = vi.fn()

vi.mock("@/lib/v1", () => ({
  fetchIssues: (...args: unknown[]) => fetchIssues(...args),
  fetchIssueDetail: (...args: unknown[]) => fetchIssueDetail(...args),
  reviewIssue: (...args: unknown[]) => reviewIssue(...args),
  pushRectify: (...args: unknown[]) => pushRectify(...args),
  closeIssue: (...args: unknown[]) => closeIssue(...args),
  rerunAnalysis: (...args: unknown[]) => rerunAnalysis(...args),
}))

const issue = {
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
  state: "待复核",
  review_status: "PENDING",
  appeal_status: "NONE",
  remediation_status: "NONE",
  close_status: "OPEN",
  employee_view_status: "UNSEEN",
  segment_count: 1,
  due_date: null,
}

const detail = {
  ...issue,
  segments: [
    {
      id: "s1",
      rule_code: "R-OVERPROMISE",
      rule_name: "夸大疗效",
      matched_text: "重点介绍了 阿莫西林胶囊",
      matched_keywords: ["重点介绍"],
      speaker: "staff",
      start_ms: 0,
      end_ms: 1000,
      status: "PENDING",
    },
  ],
  review: { reviewed_by: null, reviewed_at: null, review_comment: null, dismissed_reason: null },
}

describe("InspectionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchIssues.mockResolvedValue({ items: [issue], page: 1, page_size: 20, total: 1, total_pages: 1 })
    fetchIssueDetail.mockResolvedValue(detail)
    reviewIssue.mockResolvedValue({ ok: true, review_status: "APPROVED" })
    pushRectify.mockResolvedValue({ ok: true, rectify_task_id: "r1", status: "PENDING" })
    closeIssue.mockResolvedValue({ ok: true, close_status: "CLOSED" })
    rerunAnalysis.mockResolvedValue({ ok: true, issues_created: 1, segments_created: 1, rules_matched: 1 })
  })

  it("渲染疑似问题列表", async () => {
    render(<InspectionRoute />)
    await waitFor(() => expect(screen.getByText("重点介绍了 阿莫西林胶囊")).toBeInTheDocument())
    expect(screen.getAllByText("夸大疗效表达").length).toBeGreaterThan(0)
    expect(screen.getAllByText("待复核").length).toBeGreaterThan(0)
  })

  it("详情复核通过调用 reviewIssue", async () => {
    const user = userEvent.setup()
    render(<InspectionRoute />)
    await user.click(await screen.findByRole("button", { name: "详情" }))
    await waitFor(() => expect(screen.getByText(/ISS-20260824-00001/)).toBeInTheDocument())
    await user.type(screen.getByPlaceholderText("复核意见（可选）"), "确认属实")
    await user.click(screen.getByRole("button", { name: "通过复核" }))
    await waitFor(() => expect(reviewIssue).toHaveBeenCalledWith("i1", { approve: true, comment: "确认属实" }))
  })

  it("重跑分析按钮触发 rerunAnalysis", async () => {
    const user = userEvent.setup()
    render(<InspectionRoute />)
    await user.click(screen.getByRole("button", { name: /重跑分析/ }))
    await waitFor(() => expect(rerunAnalysis).toHaveBeenCalled())
  })
})
