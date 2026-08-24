import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ReportsRoute } from "."

const fetchReportOverview = vi.fn()
const fetchReportRegions = vi.fn()

vi.mock("@/lib/v1", () => ({
  fetchReportOverview: (...args: unknown[]) => fetchReportOverview(...args),
  fetchReportRegions: (...args: unknown[]) => fetchReportRegions(...args),
}))

const overview = {
  issues_total: 12,
  high_risk: 3,
  issues_today: 2,
  rectify_rate: 75,
  rectify_total: 8,
  overdue_tasks: 1,
  recordings_total: 120,
  transcripts_total: 100,
  pending_appeals: 2,
  stores_total: 5,
}

const regions = {
  items: [
    {
      region_id: "r1",
      region_name: "华东",
      store_count: 2,
      recording_count: 60,
      issue_count: 8,
      high_risk: 2,
      rectify_rate: 80,
      appeal_pass_rate: 50,
    },
  ],
}

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchReportOverview.mockResolvedValue(overview)
    fetchReportRegions.mockResolvedValue(regions)
  })

  it("渲染统计卡片与区域表格", async () => {
    render(<ReportsRoute />)
    await waitFor(() => expect(screen.getByText("华东")).toBeInTheDocument())
    expect(screen.getByText("门店合规月报")).toBeInTheDocument()
    expect(screen.getByText("员工成长报告")).toBeInTheDocument()
    expect(screen.getByText("品类服务分析")).toBeInTheDocument()
    expect(screen.getByText("80%")).toBeInTheDocument()
    expect(screen.getByText("50%")).toBeInTheDocument()
  })

  it("打开报表详情对话框展示真实数据要点", async () => {
    const user = (await import("@testing-library/user-event")).default
    render(<ReportsRoute />)
    const buttons = await screen.findAllByRole("button", { name: "查看报表" })
    await user.click(buttons[0])
    await waitFor(() =>
      expect(screen.getByText(/本月共记录巡检问题 12 条，其中高风险 3 条/)).toBeInTheDocument(),
    )
    expect(screen.getByText(/整改完成率 75%/)).toBeInTheDocument()
  })
})
