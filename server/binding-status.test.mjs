import { describe, expect, it } from "vitest"
import { isActiveBindingStatus, selectLatestActiveBindings } from "./binding-status.mjs"

describe("设备绑定有效状态兼容性", () => {
  it.each([
    ["已绑定", true],
    ["ACTIVE", true],
    ["active", true],
    ["  已绑定  ", true],
    ["  ACTIVE  ", true],
    ["  active  ", true],
    ["已解绑", false],
    ["INACTIVE", false],
    ["inactive", false],
    ["", false],
    ["   ", false],
    [null, false],
    [undefined, false],
  ])("%j 的有效性为 %j", (status, expected) => {
    expect(isActiveBindingStatus(status)).toBe(expected)
  })

  it("多条历史绑定只选择排序结果中最新的有效绑定", () => {
    const latest = { device: "device-1", status: "  ACTIVE  ", created: "2026-08-31 00:00:00Z" }
    const ended = { device: "device-1", status: "已解绑", created: "2026-08-30 00:00:00Z" }
    const older = { device: "device-1", status: "已绑定", created: "2026-08-29 00:00:00Z" }

    const selected = selectLatestActiveBindings([latest, ended, older])

    expect(selected.size).toBe(1)
    expect(selected.get("device-1")).toBe(latest)
  })

  it("已解绑不会在历史有效绑定选择中被误判为有效", () => {
    const selected = selectLatestActiveBindings([
      { device: "device-2", status: "已解绑" },
      { device: "device-2", status: "INACTIVE" },
      { device: "device-2", status: "inactive" },
    ])

    expect(selected.size).toBe(0)
  })
})
