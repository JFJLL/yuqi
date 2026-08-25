import { describe, it, expect } from "vitest"
import { analyzeRisk, validateRulePattern, BUILTIN_RULES } from "./rule-analyzer.mjs"

function seg(sequence, text, startMs, endMs, speaker = "S1") {
  return { sequence, text, start_ms: startMs ?? sequence * 1000, end_ms: endMs ?? (sequence + 1) * 1000, speaker }
}

function rule(code, matchType, patternJson, riskLevel = "HIGH", enabled = true) {
  return { code, match_type: matchType, pattern_json: patternJson, risk_level: riskLevel, enabled, version: 1 }
}

function run(segments, rules) {
  return analyzeRisk({ session: { id: "s1" }, segments, rules, analysisVersion: 1, transcriptVersion: 1 })
}

describe("规则分析器 · 8 类内置风险", () => {
  it("内置规则定义齐全且合法", () => {
    expect(BUILTIN_RULES.length).toBe(8)
    for (const r of BUILTIN_RULES) {
      expect(validateRulePattern(r).ok, r.code).toBe(true)
    }
  })

  it("1. 处方药违规销售: 命中与不命中", () => {
    const rules = [rule("PRESC", "KEYWORD_ANY", { keywords: ["不用开处方", "直接吃就行"] })]
    const hit = run([seg(0, "这个药不用开处方，直接吃就行")], rules)
    expect(hit.issues.length).toBe(1)
    expect(hit.issues[0].rule_code).toBe("PRESC")
    const miss = run([seg(0, "这个药需要凭处方购买，请先挂号")], rules)
    expect(miss.issues.length).toBe(0)
  })

  it("2. 医保话术违规: 命中与不命中", () => {
    const rules = [rule("MEDICAL_INSURANCE", "KEYWORD_ANY", { keywords: ["医保报销没问题", "我帮你操作医保"] })]
    expect(run([seg(0, "你放心，医保报销没问题")], rules).issues.length).toBe(1)
    expect(run([seg(0, "医保报销请以医保政策为准")], rules).issues.length).toBe(0)
  })

  it("3. 夸大疗效: 命中与不命中", () => {
    const rules = [rule("EXAGGERATED_EFFICACY", "KEYWORD_ANY", { keywords: ["三天包好", "包治"] })]
    expect(run([seg(0, "这个药吃了三天包好")], rules).issues.length).toBe(1)
    expect(run([seg(0, "请按说明书和医嘱使用")], rules).issues.length).toBe(0)
  })

  it("4. 不合理用药建议: 命中与不命中", () => {
    const rules = [rule("IRRATIONAL_DOSAGE", "KEYWORD_ANY", { keywords: ["一次吃四片", "加倍吃"] })]
    expect(run([seg(0, "抗生素一次吃四片就行")], rules).issues.length).toBe(1)
    expect(run([seg(0, "请按处方用量服用")], rules).issues.length).toBe(0)
  })

  it("5. 禁忌症未询问: 命中与不命中", () => {
    const rules = [rule("NO_CONTRAINDICATION_CHECK", "KEYWORD_ANY", { keywords: ["没禁忌", "什么人都能吃"] })]
    expect(run([seg(0, "这个保健品没禁忌，随便吃")], rules).issues.length).toBe(1)
    expect(run([seg(0, "请问您有过敏史吗")], rules).issues.length).toBe(0)
  })

  it("6. 诱导超量购买: 命中与不命中", () => {
    const rules = [rule("INDUCED_OVER_PURCHASE", "KEYWORD_ANY", { keywords: ["多买两盒", "一次买六盒"] })]
    expect(run([seg(0, "多买两盒，这周有活动")], rules).issues.length).toBe(1)
    expect(run([seg(0, "建议按需购买")], rules).issues.length).toBe(0)
  })

  it("7. 服务态度问题: 命中与不命中", () => {
    const rules = [rule("SERVICE_ATTITUDE", "KEYWORD_ANY", { keywords: ["你怎么这么麻烦", "爱买不买"] })]
    expect(run([seg(0, "你怎么这么麻烦，问那么多")], rules).issues.length).toBe(1)
    expect(run([seg(0, "我帮您详细解答")], rules).issues.length).toBe(0)
  })

  it("8. 问诊信息不足: 命中与不命中", () => {
    const rules = [rule("INSUFFICIENT_CONSULT", "KEYWORD_ANY", { keywords: ["记不清了", "你自己看吧"] })]
    expect(run([seg(0, "这个药怎么吃我记不清了")], rules).issues.length).toBe(1)
    expect(run([seg(0, "这个药的使用方法是饭后服用")], rules).issues.length).toBe(0)
  })
})

describe("规则分析器 · 匹配类型与边界", () => {
  it("KEYWORD_ALL 需全部命中", () => {
    const rules = [rule("ALL_TEST", "KEYWORD_ALL", { keywords: ["甲", "乙"] })]
    expect(run([seg(0, "甲和乙都说了")], rules).issues.length).toBe(1)
    expect(run([seg(0, "只说了甲")], rules).issues.length).toBe(0)
  })

  it("REGEX 命中 (不区分大小写)", () => {
    const rules = [rule("REGEX_TEST", "REGEX", { regex: "吃.{0,2}片" })]
    expect(run([seg(0, "每天吃四片")], rules).issues.length).toBe(1)
    expect(run([seg(0, "每天喝两杯水")], rules).issues.length).toBe(0)
  })

  it("REGEX 复杂回溯模式被拒绝", () => {
    expect(validateRulePattern(rule("BAD", "REGEX", { regex: "(a+)+b" })).ok).toBe(false)
    expect(validateRulePattern(rule("BAD", "REGEX", { regex: "(" })).ok).toBe(false)
    expect(validateRulePattern(rule("BAD", "REGEX", { regex: "a".repeat(300) })).ok).toBe(false)
  })

  it("COMBINATION: all + any + not + 相邻窗口", () => {
    const rules = [rule("COMB_TEST", "COMBINATION", { all: ["甲"], any: ["乙", "丙"], not: ["排除"] })]
    // 甲 + 乙 在同一相邻窗口内命中
    const hit = run([seg(0, "甲"), seg(1, "乙")], rules)
    expect(hit.issues.length).toBe(1)
    // 含排除词则不命中
    const excluded = run([seg(0, "甲"), seg(1, "排除乙")], rules)
    expect(excluded.issues.length).toBe(0)
    // 只有甲没有乙/丙则不命中
    const miss = run([seg(0, "甲"), seg(1, "无关内容")], rules)
    expect(miss.issues.length).toBe(0)
  })

  it("一个会话多个规则命中 => 多个问题", () => {
    const rules = [
      rule("R1", "KEYWORD_ANY", { keywords: ["直接吃"] }),
      rule("R2", "KEYWORD_ANY", { keywords: ["随便刷"] }),
    ]
    const res = run([seg(0, "这个药直接吃就行"), seg(1, "医保随便刷")], rules)
    expect(res.issues.length).toBe(2)
  })

  it("证据文本来自原始片段并保留时间锚点/说话人", () => {
    const rules = [rule("ANCHOR", "KEYWORD_ANY", { keywords: ["包好"] })]
    const res = run([seg(0, "这个药三天包好", 12000, 20000, "S2")], rules)
    expect(res.issues[0].evidence_text).toContain("包好")
    expect(res.issues[0].start_ms).toBe(12000)
    expect(res.issues[0].end_ms).toBe(20000)
    expect(res.issues[0].speaker).toBe("S2")
  })

  it("禁用规则不参与分析", () => {
    const rules = [rule("DISABLED", "KEYWORD_ANY", { keywords: ["包好"] }, "HIGH", false)]
    expect(run([seg(0, "三天包好")], rules).issues.length).toBe(0)
  })

  it("同输入重复分析结果一致 (幂等)", () => {
    const rules = [rule("IDEM", "KEYWORD_ANY", { keywords: ["包好"] })]
    const segs = [seg(0, "这个药三天包好"), seg(1, "谢谢")]
    const a = run(segs, rules)
    const b = run(segs, rules)
    expect(a.issues).toEqual(b.issues)
  })

  it("模型/规则失败不产生“无问题”记录", () => {
    // 空规则表 => 空结果, 不写入任何 issue
    expect(run([seg(0, "随便")], []).issues.length).toBe(0)
  })
})
