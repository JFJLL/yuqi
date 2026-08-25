// pb_hooks/_lib/rule-validate.js — 规则模式校验 + 内置规则 (CJS, JSVM 用)
// 与 server/rule-analyzer.mjs 保持逻辑一致 (JSVM 无法 import ESM)。

const REGEX_MAX_LEN = 200

function safeRegexOk(pattern) {
  if (typeof pattern !== "string" || pattern.length === 0 || pattern.length > REGEX_MAX_LEN) {
    return { ok: false, reason: "正则长度非法" }
  }
  if (/(\([^)]*[+*][^)]*\)\s*[+*])/.test(pattern)) {
    return { ok: false, reason: "正则复杂度受限" }
  }
  try {
    // eslint-disable-next-line no-new-func
    new RegExp(pattern, "i")
    return { ok: true }
  } catch (_) {
    return { ok: false, reason: "正则无效" }
  }
}

function validateRulePattern(rule) {
  const matchType = String((rule && rule.match_type) || "").toUpperCase()
  const pattern = (rule && rule.pattern_json) || {}
  if (!["KEYWORD_ANY", "KEYWORD_ALL", "REGEX", "COMBINATION"].includes(matchType)) {
    return { ok: false, reason: "未知 match_type" }
  }
  if (matchType === "REGEX") {
    const r = safeRegexOk(pattern.regex)
    if (!r.ok) return { ok: false, reason: r.reason }
  }
  if (matchType === "KEYWORD_ANY" || matchType === "KEYWORD_ALL") {
    const kws = Array.isArray(pattern.keywords) ? pattern.keywords.filter((x) => x) : []
    if (kws.length === 0) return { ok: false, reason: "缺少关键词" }
    if (kws.some((k) => typeof k !== "string" || k.length === 0 || k.length > 50)) {
      return { ok: false, reason: "关键词非法" }
    }
  }
  if (matchType === "COMBINATION") {
    const all = Array.isArray(pattern.all) ? pattern.all.filter((x) => x) : []
    const any = Array.isArray(pattern.any) ? pattern.any.filter((x) => x) : []
    const not = Array.isArray(pattern.not) ? pattern.not.filter((x) => x) : []
    if (all.length === 0 && any.length === 0) return { ok: false, reason: "组合规则缺少条件" }
    const allWords = all.concat(any, not)
    if (allWords.some((k) => typeof k !== "string" || k.length === 0 || k.length > 50)) {
      return { ok: false, reason: "组合关键词非法" }
    }
  }
  return { ok: true }
}

let BUILTIN_RULES = []
try {
  BUILTIN_RULES = require(`${__hooks}/_generated/risk-rules.js`).BUILTIN_RULES || []
} catch (_) {
  try {
    BUILTIN_RULES = require(`${__hooks}/../../shared/phase1-risk-rules.json`)
  } catch (_) {
    BUILTIN_RULES = []
  }
}

function writeSnapshot(app, rule, action) {
  try {
    const coll = app.findCollectionByNameOrId("risk_rule_versions")
    const rec = new Record(coll)
    rec.set("tenant", String(rule.get("tenant") || ""))
    rec.set("rule", rule.id)
    rec.set("version", Number(rule.get("version") || 0))
    rec.set("action", action)
    rec.set("snapshot_json", {
      code: rule.get("code"),
      name: rule.get("name"),
      category: rule.get("category"),
      risk_level: rule.get("risk_level"),
      match_type: rule.get("match_type"),
      pattern_json: rule.get("pattern_json"),
      advice: rule.get("advice"),
      recommended_expression: rule.get("recommended_expression"),
      enabled: rule.get("enabled"),
    })
    app.save(rec)
  } catch (_) {}
}

module.exports = {
  validateRulePattern,
  writeSnapshot,
  BUILTIN_RULES,
}
