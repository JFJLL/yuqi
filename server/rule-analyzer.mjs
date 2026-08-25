// server/rule-analyzer.mjs — 一期规则风险分析器 (纯 Node 模块, 无 PB 依赖, 可单测)
//
// 输入: session / transcript_segments / tenant risk_rules (enabled)
// 输出: { issues: [{ rule_code, rule_version, risk_level, title, summary, evidence_text,
//                    start_ms, end_ms, speaker, advice, recommended_expression,
//                    segments: [{sequence,start_ms,end_ms,speaker,text}] }] }
//
// 规则匹配类型:
//   KEYWORD_ANY   pattern_json.keywords: string[]     任一命中
//   KEYWORD_ALL   pattern_json.keywords: string[]     全部命中
//   REGEX         pattern_json.regex: string          正则命中 (长度/复杂度受限)
//   COMBINATION   pattern_json: { all:[], any:[], not:[] }
//
// 匹配单位为单个转写片段, COMBINATION 支持前后相邻片段窗口 (window=±1) 便于跨句命中。
// 证据文本一律取自原始转写片段, 保留 start_ms/end_ms/speaker。

const REGEX_MAX_LEN = 200

function safeRegex(pattern) {
  // 限制长度并验证可编译; 禁止复杂回溯型正则 (限制字符集/量词深度)
  if (typeof pattern !== "string" || pattern.length === 0 || pattern.length > REGEX_MAX_LEN) {
    return { ok: false, reason: "正则长度非法" }
  }
  // 禁止灾难性回溯特征: 嵌套量词 (a*)*, (a+)+, (a*)+ 等
  if (/(\([^)]*[+*][^)]*\)\s*[+*])/.test(pattern)) {
    return { ok: false, reason: "正则复杂度受限" }
  }
  try {
    // eslint-disable-next-line no-new-func
    new RegExp(pattern, "i")
    return { ok: true, regex: new RegExp(pattern, "i") }
  } catch (_) {
    return { ok: false, reason: "正则无效" }
  }
}

export function validateRulePattern(rule) {
  const matchType = String((rule && rule.match_type) || "").toUpperCase()
  const pattern = (rule && rule.pattern_json) || {}
  if (!["KEYWORD_ANY", "KEYWORD_ALL", "REGEX", "COMBINATION"].includes(matchType)) {
    return { ok: false, reason: "未知 match_type" }
  }
  if (matchType === "REGEX") {
    const r = safeRegex(pattern.regex)
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

function buildMatcher(rule) {
  const matchType = String(rule.match_type || "").toUpperCase()
  const p = rule.pattern_json || {}
  if (matchType === "KEYWORD_ANY") {
    const kws = (p.keywords || []).filter((x) => x)
    return (unitText) => kws.some((k) => unitText.includes(k))
  }
  if (matchType === "KEYWORD_ALL") {
    const kws = (p.keywords || []).filter((x) => x)
    return (unitText) => kws.every((k) => unitText.includes(k))
  }
  if (matchType === "REGEX") {
    const r = safeRegex(p.regex)
    if (!r.ok) return null
    return (unitText) => r.regex.test(unitText)
  }
  if (matchType === "COMBINATION") {
    const all = (p.all || []).filter((x) => x)
    const any = (p.any || []).filter((x) => x)
    const not = (p.not || []).filter((x) => x)
    return (unitText) => {
      if (not.some((k) => unitText.includes(k))) return false
      if (!all.every((k) => unitText.includes(k))) return false
      if (any.length > 0 && !any.some((k) => unitText.includes(k))) return false
      return true
    }
  }
  return null
}

// 分析入口
// params: { session, segments, rules, analysisVersion, transcriptVersion }
export function analyzeRisk(params) {
  const session = params.session || {}
  const segments = Array.isArray(params.segments) ? params.segments : []
  const rules = Array.isArray(params.rules) ? params.rules.filter((r) => r && r.enabled) : []
  const analysisVersion = Number(params.analysisVersion) || 0
  const transcriptVersion = Number(params.transcriptVersion) || 0

  const issues = []
  const seen = new Set()

  for (let ri = 0; ri < rules.length; ri++) {
    const rule = rules[ri]
    const ruleCode = String(rule.code || "")
    if (!ruleCode) continue
    const valid = validateRulePattern(rule)
    if (!valid.ok) continue
    const matcher = buildMatcher(rule)
    if (!matcher) continue

    const evidence = [] // 命中的原始片段 (带时间锚点)
    const matchedUnits = [] // 命中的匹配单元文本

    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si]
      const text = String(seg.text || "")
      if (!text) continue

      // COMBINATION 用相邻窗口 (前后 1 段), 其他类型按单段
      let unitText = text
      if (String(rule.match_type || "").toUpperCase() === "COMBINATION") {
        const prev = segments[si - 1]
        const next = segments[si + 1]
        unitText = [prev && prev.text, text, next && next.text].filter(Boolean).join(" ")
      }

      if (!matcher(unitText)) continue
      matchedUnits.push(text)
      evidence.push({
        sequence: Number(seg.sequence) || 0,
        start_ms: Number(seg.start_ms) || 0,
        end_ms: Number(seg.end_ms) || 0,
        speaker: String(seg.speaker || ""),
        text,
      })
    }

    if (evidence.length === 0) continue

    // 一个 (session, rule_code, analysis_version) 合并为一条疑似问题
    const dedupeKey = `${ruleCode}|${analysisVersion}|${transcriptVersion}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    evidence.sort((a, b) => a.sequence - b.sequence)
    const startMs = Math.min(...evidence.map((x) => x.start_ms))
    const endMs = Math.max(...evidence.map((x) => x.end_ms))
    const speaker = evidence[0].speaker || ""
    const evidenceText = evidence.map((x) => x.text).join("")

    issues.push({
      rule_code: ruleCode,
      rule_version: Number(rule.version) || 0,
      risk_level: String(rule.risk_level || "LOW"),
      title: String(rule.name || ruleCode),
      summary: `命中规则「${rule.name || ruleCode}」, 共 ${evidence.length} 处证据片段`,
      evidence_text: evidenceText.slice(0, 5000),
      start_ms: startMs,
      end_ms: endMs,
      speaker,
      advice: String(rule.advice || ""),
      recommended_expression: String(rule.recommended_expression || ""),
      segments: evidence.slice(0, 20),
    })
  }

  return {
    issues,
    analysis_version: analysisVersion,
    transcript_version: transcriptVersion,
    session_id: String(session.id || params.session_id || ""),
  }
}

import { createRequire } from "node:module"

const req = createRequire(import.meta.url)
export const BUILTIN_RULES = req("../shared/phase1-risk-rules.json")

export default { analyzeRisk, validateRulePattern, BUILTIN_RULES }
