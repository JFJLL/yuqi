import { describe, it, expect } from "vitest"
import { createHmac } from "node:crypto"
import { safeSignatureEqual, verifyUploadToken } from "./asr-gateway.mjs"

describe("ASR Gateway 上传 Token 与安全校验", () => {
  const SECRET = "test-secret-key-123456"
  process.env.YUQI_UPLOAD_TOKEN_SECRET = SECRET

  function makeToken(payload, secret = SECRET) {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
    const sig = createHmac("sha256", secret)
      .update(`${header}.${body}`)
      .digest("base64url")
    return `${header}.${body}.${sig}`
  }

  it("safeSignatureEqual: 正确匹配与 timingSafeEqual", () => {
    expect(safeSignatureEqual("abcdef123456", "abcdef123456")).toBe(true)
    expect(safeSignatureEqual("abcdef123456", "abcdef123457")).toBe(false)
    expect(safeSignatureEqual("abcdef123456", "abcdef12345")).toBe(false) // 少1字节
    expect(safeSignatureEqual("abcdef123456", "abcdef1234567")).toBe(false) // 多1字节
    expect(safeSignatureEqual(null, "abcdef123456")).toBe(false)
  })

  it("verifyUploadToken: 正确签名验证成功", () => {
    const token = makeToken({
      action: "asr_upload",
      user: "u1",
      tenant: "demo",
      nonce: "nonce-001",
      exp: Math.floor(Date.now() / 1000) + 300,
    })
    const res = verifyUploadToken(token)
    expect(res.ok).toBe(true)
    expect(res.user).toBe("u1")
    expect(res.tenant).toBe("demo")
    expect(res.nonce).toBe("nonce-001")
  })

  it("verifyUploadToken: 载荷篡改被拒绝", () => {
    const valid = makeToken({
      action: "asr_upload",
      user: "u1",
      tenant: "demo",
      nonce: "nonce-002",
      exp: Math.floor(Date.now() / 1000) + 300,
    })
    const parts = valid.split(".")
    const tamperedPayload = Buffer.from(JSON.stringify({
      action: "asr_upload",
      user: "hacked_user",
      tenant: "demo",
      nonce: "nonce-002",
      exp: Math.floor(Date.now() / 1000) + 300,
    })).toString("base64url")
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`

    const res = verifyUploadToken(tamperedToken)
    expect(res.ok).toBe(false)
    expect(res.reason).toContain("令牌签名无效")
  })

  it("verifyUploadToken: 签名篡改被拒绝", () => {
    const valid = makeToken({
      action: "asr_upload",
      user: "u1",
      tenant: "demo",
      nonce: "nonce-003",
      exp: Math.floor(Date.now() / 1000) + 300,
    })
    const parts = valid.split(".")
    const tamperedSig = parts[2].slice(0, -2) + "xx"
    const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSig}`

    const res = verifyUploadToken(tamperedToken)
    expect(res.ok).toBe(false)
    expect(res.reason).toContain("令牌签名无效")
  })

  it("verifyUploadToken: 签名少 1 字节被拒绝", () => {
    const valid = makeToken({
      action: "asr_upload",
      user: "u1",
      tenant: "demo",
      nonce: "nonce-004",
      exp: Math.floor(Date.now() / 1000) + 300,
    })
    const parts = valid.split(".")
    const shortSig = parts[2].slice(0, -1)
    const tamperedToken = `${parts[0]}.${parts[1]}.${shortSig}`

    const res = verifyUploadToken(tamperedToken)
    expect(res.ok).toBe(false)
    expect(res.reason).toContain("令牌签名无效")
  })

  it("verifyUploadToken: 过期令牌被拒绝", () => {
    const expiredToken = makeToken({
      action: "asr_upload",
      user: "u1",
      tenant: "demo",
      nonce: "nonce-005",
      exp: Math.floor(Date.now() / 1000) - 60, // 60秒前过期
    })
    const res = verifyUploadToken(expiredToken)
    expect(res.ok).toBe(false)
    expect(res.reason).toContain("令牌已过期")
  })

  it("verifyUploadToken: 用途不符被拒绝", () => {
    const wrongActionToken = makeToken({
      action: "admin_login",
      user: "u1",
      tenant: "demo",
      nonce: "nonce-006",
      exp: Math.floor(Date.now() / 1000) + 300,
    })
    const res = verifyUploadToken(wrongActionToken)
    expect(res.ok).toBe(false)
    expect(res.reason).toContain("令牌用途不符")
  })
})

