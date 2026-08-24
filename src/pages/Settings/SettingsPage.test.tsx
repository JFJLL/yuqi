import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SettingsRoute } from "."

const fetchRules = vi.fn()
const fetchSettings = vi.fn()
const updateRule = vi.fn()
const updateSettings = vi.fn()

vi.mock("@/lib/v1", () => ({
  fetchRules: (...args: unknown[]) => fetchRules(...args),
  fetchSettings: (...args: unknown[]) => fetchSettings(...args),
  updateRule: (...args: unknown[]) => updateRule(...args),
  updateSettings: (...args: unknown[]) => updateSettings(...args),
}))

const rule = {
  id: "rule1",
  rule_set: "default",
  code: "R-OVERPROMISE",
  name: "夸大疗效",
  description: "禁止夸大疗效",
  category: "夸大疗效表达",
  severity: "高",
  keywords: ["重点介绍"],
  enabled: true,
  version_no: 1,
  sort_order: 1,
  created_at: "2026-08-01T00:00:00+08:00",
  updated_at: "2026-08-01T00:00:00+08:00",
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchRules.mockResolvedValue({ items: [rule], page: 1, page_size: 200, total: 1, total_pages: 1 })
    fetchSettings.mockResolvedValue({ retention_days: "365" })
    updateRule.mockResolvedValue({ ...rule, enabled: false })
    updateSettings.mockResolvedValue({ ok: true, retention_days: "180" })
  })

  it("渲染规则开关与保留策略表单", async () => {
    render(<SettingsRoute />)
    await waitFor(() => expect(screen.getByText("夸大疗效")).toBeInTheDocument())
    expect(screen.getByText("录音保留策略")).toBeInTheDocument()
    expect(screen.getByDisplayValue("365")).toBeInTheDocument()
  })

  it("切换规则调用 updateRule", async () => {
    const user = userEvent.setup()
    render(<SettingsRoute />)
    const toggle = await screen.findByRole("switch")
    await user.click(toggle)
    await waitFor(() => expect(updateRule).toHaveBeenCalledWith("rule1", expect.objectContaining({ enabled: false })))
  })

  it("保存保留天数调用 updateSettings", async () => {
    const user = userEvent.setup()
    render(<SettingsRoute />)
    const input = await screen.findByDisplayValue("365")
    await user.clear(input)
    await user.type(input, "180")
    await user.click(screen.getByRole("button", { name: "保存设置" }))
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ retention_days: 180 }))
  })
})
