import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { analyzeRisk, validateRulePattern, BUILTIN_RULES } from "./rule-analyzer.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

function seg(sequence, text, startMs, endMs, speaker = "店员") {
  return { sequence, text, start_ms: startMs ?? sequence * 1000, end_ms: endMs ?? (sequence + 1) * 1000, speaker }
}

function run(segments, rules, sessionExtra = {}) {
  return analyzeRisk({
    session: { id: "s1", tenant: "demo", ...sessionExtra },
    segments,
    rules,
    analysisVersion: 1,
    transcriptVersion: 1,
  })
}

describe("BUILTIN_RULES 规则唯一定义与一致性", () => {
  it("BUILTIN_RULES 包含 8 类正式规则", () => {
    expect(BUILTIN_RULES.length).toBe(8)
    const expectedCodes = [
      "PRESCRIPTION_DRUG_SALES",
      "MEDICAL_INSURANCE_VIOLATION",
      "EXAGGERATED_EFFICACY",
      "IRRATIONAL_MEDICATION_ADVICE",
      "CONTRAINDICATION_NOT_ASKED",
      "INDUCED_OVER_PURCHASE",
      "SERVICE_ATTITUDE",
      "INSUFFICIENT_CONSULTATION_INFO",
    ]
    expect(BUILTIN_RULES.map((r) => r.code)).toEqual(expectedCodes)
  })

  it("shared/phase1-risk-rules.json 与 generated/risk-rules.js 完全一致", () => {
    const rawJson = JSON.parse(readFileSync(path.join(root, "shared", "phase1-risk-rules.json"), "utf8"))
    expect(BUILTIN_RULES).toEqual(rawJson)

    for (const r of BUILTIN_RULES) {
      const v = validateRulePattern(r)
      expect(v.ok, `${r.code}: ${v.reason}`).toBe(true)
      expect(r.version).toBe(1)
      expect(r.status).toBe("ACTIVE")
      expect(r.enabled).toBe(true)
      expect(typeof r.advice).toBe("string")
      expect(r.advice.length).toBeGreaterThan(5)
      expect(typeof r.recommended_expression).toBe("string")
      expect(r.recommended_expression.length).toBeGreaterThan(5)
    }
  })
})

describe("BUILTIN_RULES 真实 8 类规则验收 (Table-Driven 56+ Cases)", () => {
  const ruleCases = [
    {
      code: "PRESCRIPTION_DRUG_SALES",
      name: "处方药违规销售",
      expectedLevel: "HIGH",
      positives: [
        "这款阿莫西林是处方药，您直接拿去吃就行",
        "头孢胶囊今天买二送一，没处方也能买",
        "左氧氟沙星您先带一盒回去吃",
      ],
      negatives: [
        "请问您有带医生开的处方吗？",
        "普通感冒可以先喝点温开水多休息",
        "这款润喉糖是非处方保健食品",
      ],
      exclusion: "板蓝根颗粒和维生素C不需要处方",
    },
    {
      code: "MEDICAL_INSURANCE_VIOLATION",
      name: "医保话术违规",
      expectedLevel: "HIGH",
      positives: [
        "今天活动帮你刷医保，走医保没问题",
        "日用品也可以医保随便刷",
        "可以拿家里人的刷医保卡套现",
      ],
      negatives: [
        "医保报销请以当地医保局政策为准",
        "本店支持合规使用医保电子凭证",
        "自费药品不支持医保个人账户支付",
      ],
      exclusion: "医保结算需符合规定，具体能否报销以医保政策为准",
    },
    {
      code: "EXAGGERATED_EFFICACY",
      name: "夸大疗效",
      expectedLevel: "MEDIUM",
      positives: [
        "这个药包治百病，吃完立刻见效",
        "保证好，百分百有效，肯定断根",
        "我们这个特效药药到病除，无效退款",
      ],
      negatives: [
        "按疗程服用可以帮助缓解症状",
        "平时注意多休息清淡饮食",
        "说明书上有详细的适应症和用法",
      ],
      exclusion: "这个药效果因人而异，不能保证根治，建议遵医嘱使用",
    },
    {
      code: "IRRATIONAL_MEDICATION_ADVICE",
      name: "不合理用药建议",
      expectedLevel: "MEDIUM",
      positives: [
        "感冒严重就加倍吃，一次吃四片",
        "这两种药一起吃没事，多吃点效果快",
        "觉得疼就自己加量吃",
      ],
      negatives: [
        "一次一片，一天三次，温开水送服",
        "饭前半小时服用吸收效果更好",
        "老人和儿童用药请遵照说明书剂量",
      ],
      exclusion: "千万不要加倍吃，不能自行加量，请遵医嘱",
    },
    {
      code: "CONTRAINDICATION_NOT_ASKED",
      name: "禁忌症未询问",
      expectedLevel: "MEDIUM",
      positives: [
        "这个药不用问，谁都能吃",
        "这个保健品没有禁忌，随便吃",
        "没关系，不用管禁忌直接买",
      ],
      negatives: [
        "请问您平时有高血压或糖尿病吗？",
        "孕妇及哺乳期妇女慎用本品",
        "对青霉素类药物过敏者禁用",
      ],
      exclusion: "先问一下禁忌和过敏史，遵医嘱最安全",
    },
    {
      code: "INDUCED_OVER_PURCHASE",
      name: "诱导超量购买",
      expectedLevel: "MEDIUM",
      positives: [
        "现在做活动买五送五多囤点，多买几盒",
        "趁活动多买，一次多拿几盒备着",
        "家里多囤一点准没错",
      ],
      negatives: [
        "建议您先买一盒试一下",
        "药品开封后请在有效期内使用",
        "按疗程购买，不要过量储备",
      ],
      exclusion: "我们建议按需购买，不需要囤太多",
    },
    {
      code: "SERVICE_ATTITUDE",
      name: "服务态度问题",
      expectedLevel: "LOW",
      positives: [
        "爱买不买，嫌贵别买",
        "烦死了，别烦我，自己看",
        "催什么催，不懂别乱说",
      ],
      negatives: [
        "您好，请问有什么可以帮您？",
        "请您稍等片刻，我马上为您查询",
        "感谢您的光临，祝您早日康复",
      ],
      exclusion: "我们会耐心为您解答，请稍等",
    },
    {
      code: "INSUFFICIENT_CONSULTATION_INFO",
      name: "问诊信息不足",
      expectedLevel: "LOW",
      positives: [
        "不用问症状，直接拿药拿了就走",
        "不用多说，直接买就行",
        "不问了，交钱直接拿药",
      ],
      negatives: [
        "请问您咳嗽有痰吗？发烧几天了？",
        "问一下您目前还有在吃其他药吗？",
        "建议您先测量一下体温再对症选药",
      ],
      exclusion: "请问您主要是什么症状？请遵医嘱用药",
    },
  ]

  for (const tc of ruleCases) {
    describe(`规则: ${tc.code} (${tc.name})`, () => {
      const targetRule = BUILTIN_RULES.find((r) => r.code === tc.code)

      it("命中所有正向真实案例 (Positives >= 3)", () => {
        expect(targetRule).toBeDefined()
        expect(tc.positives.length).toBeGreaterThanOrEqual(3)
        for (let i = 0; i < tc.positives.length; i++) {
          const text = tc.positives[i]
          const res = run([seg(1, text, 1000 * i, 1000 * (i + 1), "店员")], [targetRule])
          expect(res.issues.length, `Pos[${i}]: ${text}`).toBe(1)
          const issue = res.issues[0]
          expect(issue.rule_code).toBe(tc.code)
          expect(issue.risk_level).toBe(tc.expectedLevel)
          expect(issue.evidence_text).toContain(text)
          expect(issue.advice).toBe(targetRule.advice)
          expect(issue.recommended_expression).toBe(targetRule.recommended_expression)
          expect(issue.start_ms).toBe(1000 * i)
          expect(issue.end_ms).toBe(1000 * (i + 1))
        }
      })

      it("不命中所有负向真实案例 (Negatives >= 3)", () => {
        expect(tc.negatives.length).toBeGreaterThanOrEqual(3)
        for (let i = 0; i < tc.negatives.length; i++) {
          const text = tc.negatives[i]
          const res = run([seg(1, text, 1000, 2000, "店员")], [targetRule])
          expect(res.issues.length, `Neg[${i}]: ${text}`).toBe(0)
        }
      })

      it("包含排除/否定词时不误命中 (Exclusion >= 1)", () => {
        const text = tc.exclusion
        const res = run([seg(1, text, 1000, 2000, "店员")], [targetRule])
        expect(res.issues.length, `Exclusion: ${text}`).toBe(0)
      })
    })
  }
})

describe("规则分析器 · 引擎通用能力与边界", () => {
  it("KEYWORD_ALL 需全部条件同时出现", () => {
    const r = { code: "ALL_TEST", match_type: "KEYWORD_ALL", pattern_json: { keywords: ["甲", "乙"] }, enabled: true, version: 1 }
    expect(run([seg(0, "甲和乙都说了")], [r]).issues.length).toBe(1)
    expect(run([seg(0, "只说了甲")], [r]).issues.length).toBe(0)
  })

  it("REGEX 命中 (不区分大小写)", () => {
    const r = { code: "REGEX_TEST", match_type: "REGEX", pattern_json: { regex: "吃.{0,2}片" }, enabled: true, version: 1 }
    expect(run([seg(0, "每天吃四片")], [r]).issues.length).toBe(1)
    expect(run([seg(0, "每天喝两杯水")], [r]).issues.length).toBe(0)
  })

  it("REGEX 复杂回溯模式被安全拒绝", () => {
    expect(validateRulePattern({ match_type: "REGEX", pattern_json: { regex: "(a+)+b" } }).ok).toBe(false)
    expect(validateRulePattern({ match_type: "REGEX", pattern_json: { regex: "(" } }).ok).toBe(false)
    expect(validateRulePattern({ match_type: "REGEX", pattern_json: { regex: "a".repeat(300) } }).ok).toBe(false)
  })

  it("COMBINATION: all + any + not 组合与相邻窗口跨句支持", () => {
    const r = {
      code: "COMB_TEST",
      match_type: "COMBINATION",
      pattern_json: { all: ["处方"], any: ["不用管", "随便卖"], not: ["请出示"] },
      enabled: true,
      version: 1,
    }
    // 跨句在相邻窗口 (window=±1) 命中
    const hit = run([seg(0, "这个是处方药"), seg(1, "随便卖没关系")], [r])
    expect(hit.issues.length).toBe(1)

    // 含有 not 排除词时不命中
    const excluded = run([seg(0, "这个是处方药"), seg(1, "请出示处方")], [r])
    expect(excluded.issues.length).toBe(0)

    // 缺少 any 关键词时不命中
    const miss = run([seg(0, "这个是处方药"), seg(1, "天气真好")], [r])
    expect(miss.issues.length).toBe(0)
  })

  it("一个会话多个规则命中 => 产生多个独立 issue", () => {
    const r1 = BUILTIN_RULES.find((r) => r.code === "MEDICAL_INSURANCE_VIOLATION")
    const r2 = BUILTIN_RULES.find((r) => r.code === "INDUCED_OVER_PURCHASE")
    const res = run([
      seg(0, "帮你刷医保，走医保没问题", 0, 5000),
      seg(1, "多买几盒囤一点", 6000, 10000),
    ], [r1, r2])
    expect(res.issues.length).toBe(2)
    const codes = res.issues.map((x) => x.rule_code)
    expect(codes).toContain("MEDICAL_INSURANCE_VIOLATION")
    expect(codes).toContain("INDUCED_OVER_PURCHASE")
  })

  it("证据文本来自原始片段并保留精确时间锚点与说话人", () => {
    const r = BUILTIN_RULES.find((x) => x.code === "EXAGGERATED_EFFICACY")
    const res = run([seg(0, "这个药包治百病，吃完立刻见效", 12000, 20000, "营业员张三")], [r])
    expect(res.issues.length).toBe(1)
    const issue = res.issues[0]
    expect(issue.evidence_text).toContain("包治百病")
    expect(issue.start_ms).toBe(12000)
    expect(issue.end_ms).toBe(20000)
    expect(issue.speaker).toBe("营业员张三")
    expect(issue.segments.length).toBeGreaterThanOrEqual(1)
  })

  it("禁用规则 (enabled=false) 绝不参与分析", () => {
    const disabledRule = { ...BUILTIN_RULES[0], enabled: false }
    const res = run([seg(0, "阿莫西林处方药直接吃")], [disabledRule])
    expect(res.issues.length).toBe(0)
  })

  it("同输入重复分析结果完全确定与幂等", () => {
    const segs = [seg(0, "帮你刷医保，走医保没问题"), seg(1, "谢谢")]
    const a = run(segs, BUILTIN_RULES)
    const b = run(segs, BUILTIN_RULES)
    expect(a.issues).toEqual(b.issues)
  })

  it("无规则命中时不产生任何 issue 或占位记录", () => {
    const res = run([seg(0, "请问您哪里不舒服？"), seg(1, "按说明书服用即可")], BUILTIN_RULES)
    expect(res.issues.length).toBe(0)
  })
})
