import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  bindingStatusKind,
  normalizeBindingStatus,
  selectCurrentBindingForDevice,
  selectCurrentBindings,
} from "../shared/device-binding-semantics.js"
import {
  buildAsrMetadata,
  buildBindingCache,
  buildSubmittedAudioFilePatch,
  countAudioDeviceOverlap,
  relationFieldsForAudioFile,
  selectFreshObjects,
} from "./oss-scanner-helpers.mjs"

const AS_OF = "2026-09-01T00:00:00.000Z"

function binding(overrides = {}) {
  return {
    id: "binding-default",
    device: "device-1",
    employee: "employee-1",
    store: "store-1",
    status: "ACTIVE",
    effective_date: "2026-08-01T00:00:00.000Z",
    created: "2026-08-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("effective_date 设备绑定语义", () => {
  it("支持规定的有效状态、首尾空格，并拒绝空值和未知状态", () => {
    for (const status of ["已绑定", " ACTIVE ", "active"]) {
      expect(bindingStatusKind(status)).toBe("active")
      expect(normalizeBindingStatus(status)).not.toContain(" ")
    }
    for (const status of ["已解绑", " ENDED ", "ended", "INACTIVE", "inactive"]) {
      expect(bindingStatusKind(status)).toBe("inactive")
    }
    for (const status of ["", " ", null, undefined, "REQUESTED", "Active"]) {
      expect(bindingStatusKind(status)).toBe("unknown")
      expect(selectCurrentBindingForDevice([binding({ status })], AS_OF)).toMatchObject({
        status: "inactive",
        isActive: false,
        rawStatusKind: "unknown",
        warningCodes: ["UNKNOWN_BINDING_STATUS"],
      })
    }
  })

  it("按 effective_date 选择当前记录，而不是按 created 选择", () => {
    const active = binding({
      id: "active",
      status: "ACTIVE",
      effective_date: "2026-08-20T00:00:00.000Z",
      created: "2026-08-01T00:00:00.000Z",
    })
    const ended = binding({
      id: "ended",
      status: "ENDED",
      effective_date: "2026-07-01T00:00:00.000Z",
      created: "2026-08-02T00:00:00.000Z",
    })
    const result = selectCurrentBindingForDevice([ended, active], AS_OF)
    expect(result.binding?.id).toBe("active")
    expect(result.isActive).toBe(true)
  })

  it("最新业务记录结束时不回退旧 ACTIVE", () => {
    const result = selectCurrentBindingForDevice(
      [
        binding({ id: "old-active", status: "ACTIVE", effective_date: "2026-07-01T00:00:00Z" }),
        binding({ id: "new-ended", status: "ENDED", effective_date: "2026-08-01T00:00:00Z" }),
      ],
      AS_OF,
    )
    expect(result.binding?.id).toBe("new-ended")
    expect(result.status).toBe("inactive")
    expect(result.isActive).toBe(false)
  })

  it("不会让 future ACTIVE 或 future ENDED 提前覆盖当前记录", () => {
    const current = binding({ id: "current", status: "ACTIVE", effective_date: "2026-08-01T00:00:00Z" })
    const futureActive = binding({ id: "future-active", status: "ACTIVE", effective_date: "2026-09-02T00:00:00Z" })
    const activeResult = selectCurrentBindingForDevice([futureActive, current], AS_OF)
    expect(activeResult.binding?.id).toBe("current")
    expect(activeResult.isActive).toBe(true)

    const futureEnded = binding({ id: "future-ended", status: "ENDED", effective_date: "2026-09-02T00:00:00Z" })
    const endedResult = selectCurrentBindingForDevice([futureEnded, current], AS_OF)
    expect(endedResult.binding?.id).toBe("current")
    expect(endedResult.isActive).toBe(true)
  })

  it("effective_date 相同按 approved_at、created、id 依次决胜", () => {
    const sameEffective = [
      binding({ id: "id-low", approved_at: "2026-08-01T00:00:00Z", created: "2026-08-03T00:00:00Z" }),
      binding({ id: "id-approved", approved_at: "2026-08-02T00:00:00Z", created: "2026-08-01T00:00:00Z" }),
      binding({ id: "id-created", approved_at: "2026-08-02T00:00:00Z", created: "2026-08-04T00:00:00Z" }),
    ]
    expect(selectCurrentBindingForDevice(sameEffective, AS_OF).binding?.id).toBe("id-created")
    const sameCreated = sameEffective.map((row) => ({ ...row, created: "2026-08-04T00:00:00Z" }))
    expect(selectCurrentBindingForDevice(sameCreated, AS_OF).binding?.id).toBe("id-created")
  })

  it("记录顺序打乱不影响结果，设备之间互不影响", () => {
    const rows = [
      binding({ id: "d1-ended", device: "d1", status: "ENDED", effective_date: "2026-08-20T00:00:00Z" }),
      binding({ id: "d2-active", device: "d2", status: "active", effective_date: "2026-08-20T00:00:00Z" }),
      binding({ id: "d1-active", device: "d1", status: "ACTIVE", effective_date: "2026-08-01T00:00:00Z" }),
    ]
    const selected = selectCurrentBindings(rows, AS_OF)
    expect(selected.byDevice.get("d1")?.isActive).toBe(false)
    expect(selected.byDevice.get("d1")?.binding?.id).toBe("d1-ended")
    expect(selected.byDevice.get("d2")?.binding?.id).toBe("d2-active")
  })

  it("仅在全部记录缺少合法 effective_date 时启用 legacy fallback", () => {
    const legacy = selectCurrentBindingForDevice(
      [
        binding({ id: "legacy-old", effective_date: "", created: "2026-08-01T00:00:00Z" }),
        binding({ id: "legacy-new", effective_date: "not-a-date", created: "2026-08-02T00:00:00Z" }),
      ],
      AS_OF,
    )
    expect(legacy.binding?.id).toBe("legacy-new")
    expect(legacy.usedLegacyFallback).toBe(true)
    expect(legacy.warningCodes).toContain("LEGACY_EFFECTIVE_DATE_FALLBACK")

    const legalWins = selectCurrentBindingForDevice(
      [
        binding({ id: "no-date", effective_date: "", status: "ACTIVE", created: "2026-09-02T00:00:00Z" }),
        binding({ id: "legal", effective_date: "2026-08-01T00:00:00Z", status: "ENDED" }),
      ],
      AS_OF,
    )
    expect(legalWins.binding?.id).toBe("legal")
    expect(legalWins.usedLegacyFallback).toBe(false)
  })
})

describe("Scanner 绑定缓存和音频归属", () => {
  it("缓存保存 PocketBase relation id，并按统一语义排除最新结束记录", () => {
    const devices = [
      { id: "device-1", device_no: "WF-001" },
      { id: "device-2", device_no: "WF-002" },
    ]
    const bindings = [
      binding({ id: "d1-old", device: "device-1", employee: "employee-old", store: "store-old", status: "ACTIVE", effective_date: "2026-07-01T00:00:00Z" }),
      binding({ id: "d1-ended", device: "device-1", employee: "employee-new", store: "store-new", status: "ENDED", effective_date: "2026-08-01T00:00:00Z" }),
      binding({ id: "d2-active", device: "device-2", employee: "employee-2", store: "store-2", status: "ACTIVE", effective_date: "2026-08-01T00:00:00Z" }),
    ]
    const snapshot = buildBindingCache(devices, bindings, AS_OF)
    expect(snapshot.cache.has("WF-001")).toBe(false)
    expect(snapshot.cache.get("WF-002")).toEqual({ device: "device-2", employee: "employee-2", store: "store-2" })
    expect(snapshot.stats).toMatchObject({
      deviceRecordsTotal: 2,
      currentBindingsByEffectiveDate: 1,
      currentBindingsRelationComplete: 1,
      currentBindingsRelationIncomplete: 0,
    })
  })

  it("音频 relation 字段只写入真实存在的映射，ASR metadata 保留 SN", () => {
    expect(relationFieldsForAudioFile({ device: "d1", employee: "e1", store: "s1" })).toEqual({
      device: "d1",
      employee: "e1",
      store: "s1",
    })
    expect(relationFieldsForAudioFile({ device: "d1", employee: "", store: null })).toEqual({ device: "d1" })
    expect(relationFieldsForAudioFile({})).toEqual({})
    expect(buildSubmittedAudioFilePatch("transcript-1", "job-1", {
      device: "d1",
      employee: "e1",
      store: "s1",
    })).toEqual({
      status: "submitted",
      transcript: "transcript-1",
      asr_job: "job-1",
      device: "d1",
      employee: "e1",
      store: "s1",
      error_message: "",
      next_retry_at: "",
    })
    expect(buildAsrMetadata("WF-001", { device: "device-1", employee: "employee-1", store: "store-1" })).toEqual({
      device: "WF-001",
      employee: "employee-1",
      store: "store-1",
      language: "zh-CN",
    })
  })

  it("只聚合统计 OSS 对象与设备主数据的重叠", () => {
    const parser = (fileName) => ({ sn: fileName.startsWith("known") ? "WF-001" : "WF-unknown" })
    expect(countAudioDeviceOverlap(
      [{ key: "known-a.mp3" }, { key: "known-b.mp3" }, { key: "other.mp3" }],
      parser,
      new Set(["WF-001"]),
    )).toBe(1)
  })

  it("已知 object_key 不会重复提交，且日志源码不直接打印 object_key", async () => {
    expect(selectFreshObjects([{ key: "known" }, { key: "fresh" }], new Set(["known"]))).toEqual([{ key: "fresh" }])
    const source = readFileSync(new URL("./oss-scanner.mjs", import.meta.url), "utf8")
    expect(source).not.toMatch(/(?:log|logError)\([^\n]*object_key/)
    expect(source).not.toContain("样本:")
  })
})

describe("demo seed 插入顺序", () => {
  it("先创建历史 ENDED，再创建当前 ACTIVE", () => {
    const source = readFileSync(new URL("../scripts/seed-phase1-demo.mjs", import.meta.url), "utf8")
    const endedPosition = source.indexOf("const oldBinding")
    const activePosition = source.indexOf("status='ACTIVE'")
    expect(endedPosition).toBeGreaterThan(-1)
    expect(activePosition).toBeGreaterThan(endedPosition)
  })
})
