import { describe, expect, it } from "vitest"
import { beijingDayRangeMs, formatBeijingTime, parsePbDate } from "./beijingTime"

describe("formatBeijingTime", () => {
  it("withDate 输出完整北京时间 (年月日 时分秒)", () => {
    expect(formatBeijingTime("2026-06-17 08:43:53Z", { withDate: true })).toBe("2026-06-17 16:43:53")
  })

  it("把 UTC 时间转换为北京时间 (HH:mm:ss)", () => {
    // 文件名时间戳 26-06-17 16:43 北京时间 => UTC 08:43
    expect(formatBeijingTime("2026-06-17 08:43:53Z")).toBe("16:43:53")
  })

  it("withDate 时输出带日期的北京时间", () => {
    expect(formatBeijingTime("2026-06-17 16:43:53.000Z", { withDate: true })).toBe("2026-06-18 00:43:53")
  })

  it("跨日进位正确 (UTC 31 日 17:00 => 北京次日 01:00)", () => {
    expect(formatBeijingTime("2026-05-31 17:00:00Z", { withDate: true })).toBe("2026-06-01 01:00:00")
  })

  it("空值与非法输入返回 -", () => {
    expect(formatBeijingTime(null)).toBe("-")
    expect(formatBeijingTime("")).toBe("-")
    expect(formatBeijingTime("not-a-date")).toBe("-")
  })
})

describe("beijingDayRangeMs", () => {
  it("北京时间一整天对应 UTC [16:00 前一天, 16:00 当天)", () => {
    const [start, end] = beijingDayRangeMs("2026-06-17")!
    expect(new Date(start).toISOString()).toBe("2026-06-16T16:00:00.000Z")
    expect(new Date(end).toISOString()).toBe("2026-06-17T16:00:00.000Z")
  })

  it("拒绝非法格式", () => {
    expect(beijingDayRangeMs("2026/06/17")).toBeNull()
    expect(beijingDayRangeMs("2026-13-01")).toBeNull()
  })
})

describe("parsePbDate", () => {
  it("兼容空格分隔与 Z 后缀", () => {
    expect(parsePbDate("2026-06-17 08:43:53Z")?.getTime()).toBe(
      new Date("2026-06-17T08:43:53+00:00").getTime(),
    )
  })
})
