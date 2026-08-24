// pb_hooks/_lib/auth-helpers.js — 认证辅助函数 (模块作用域, 在 handler 内 require 使用)
// JSVM 的 routerAdd handler 无法访问词法闭包, 因此所有辅助逻辑必须放在模块内,
// 再由 handler 在函数体内 require() 后调用。

function pbDate(now) {
  const d = now || new Date()
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z")
}

function isProduction() {
  const env = String($os.getenv("YUQI_ENV") || "").toLowerCase()
  return env === "production" || env === "prod"
}

function fixedDevCode() {
  if (isProduction()) return ""
  return String($os.getenv("YUQI_DEV_FIXED_CODE") || "")
}

function findUserByEmail(email) {
  try {
    return $app.findFirstRecordByData("app_users", "email", String(email || "").trim().toLowerCase())
  } catch (_) {
    return null
  }
}

function findUserByMobile(mobile) {
  try {
    return $app.findFirstRecordByFilter("app_users", "mobile = {:m}", { m: String(mobile || "").trim() })
  } catch (_) {
    return null
  }
}

module.exports = {
  pbDate,
  isProduction,
  fixedDevCode,
  findUserByEmail,
  findUserByMobile,
}
