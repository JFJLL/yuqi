// Auto-generated from shared/phase1-risk-rules.json. Do not edit directly.
// Run "node scripts/generate-phase1-rules.mjs" to regenerate.

const BUILTIN_RULES = [
  {
    "code": "PRESCRIPTION_DRUG_SALES",
    "name": "处方药违规销售",
    "category": "处方药",
    "risk_level": "HIGH",
    "match_type": "KEYWORD_ANY",
    "pattern_json": {
      "keywords": [
        "处方药",
        "阿莫西林",
        "头孢",
        "西地那非",
        "布洛芬缓释胶囊",
        "左氧氟沙星",
        "处方药推销",
        "没处方也能买"
      ]
    },
    "advice": "处方药需凭医师处方销售, 不得在无处方情况下推销或售卖。",
    "recommended_expression": "这款药物属于处方药，需要您先凭医生处方，我才能为您安排。",
    "enabled": true,
    "version": 1,
    "status": "ACTIVE"
  },
  {
    "code": "MEDICAL_INSURANCE_VIOLATION",
    "name": "医保话术违规",
    "category": "医保合规",
    "risk_level": "HIGH",
    "match_type": "KEYWORD_ANY",
    "pattern_json": {
      "keywords": [
        "帮你刷医保",
        "医保随便刷",
        "走医保没问题",
        "套现",
        "刷医保卡",
        "套取医保",
        "借医保卡"
      ]
    },
    "advice": "不得使用医保套现、代刷或诱导违规使用医保等表述。",
    "recommended_expression": "医保使用需符合规定，具体能否报销以医保政策为准。",
    "enabled": true,
    "version": 1,
    "status": "ACTIVE"
  },
  {
    "code": "EXAGGERATED_EFFICACY",
    "name": "夸大疗效",
    "category": "疗效宣传",
    "risk_level": "MEDIUM",
    "match_type": "COMBINATION",
    "pattern_json": {
      "all": [],
      "any": [
        "包治",
        "根治",
        "药到病除",
        "立刻见效",
        "百分百有效",
        "断根",
        "保证好",
        "治愈",
        "无效退款",
        "绝对有效"
      ],
      "not": [
        "需遵医嘱",
        "遵医嘱",
        "建议就医",
        "因人而异",
        "不能保证",
        "不一定"
      ]
    },
    "advice": "不得对药品或保健品疗效作绝对化、夸大性承诺。",
    "recommended_expression": "这个药的效果因人而异，建议按说明书使用并遵医嘱。",
    "enabled": true,
    "version": 1,
    "status": "ACTIVE"
  },
  {
    "code": "IRRATIONAL_MEDICATION_ADVICE",
    "name": "不合理用药建议",
    "category": "用药安全",
    "risk_level": "MEDIUM",
    "match_type": "COMBINATION",
    "pattern_json": {
      "all": [],
      "any": [
        "加倍吃",
        "加量吃",
        "一次吃四片",
        "一起吃没事",
        "多吃点效果快",
        "加倍",
        "加量",
        "超量吃",
        "自己加量"
      ],
      "not": [
        "不要加倍",
        "不能自行加量",
        "请遵医嘱",
        "遵医嘱",
        "医生建议"
      ]
    },
    "advice": "不得自行建议超剂量或合并用药, 需提示遵医嘱。",
    "recommended_expression": "用药剂量请严格按说明书或医嘱执行，不要自行加倍。",
    "enabled": true,
    "version": 1,
    "status": "ACTIVE"
  },
  {
    "code": "CONTRAINDICATION_NOT_ASKED",
    "name": "禁忌症未询问",
    "category": "用药安全",
    "risk_level": "MEDIUM",
    "match_type": "COMBINATION",
    "pattern_json": {
      "all": [],
      "any": [
        "不用问",
        "没关系",
        "谁都能吃",
        "没有禁忌",
        "随便吃",
        "不问了",
        "不用管禁忌"
      ],
      "not": [
        "过敏史",
        "有何禁忌",
        "有无禁忌",
        "问一下禁忌",
        "遵医嘱"
      ]
    },
    "advice": "销售处方药或高风险药品前应询问过敏史与禁忌症（疑似未提示禁忌风险）。",
    "recommended_expression": "请问您对什么药物过敏吗？有没有医生特别交代的禁忌？",
    "enabled": true,
    "version": 1,
    "status": "ACTIVE"
  },
  {
    "code": "INDUCED_OVER_PURCHASE",
    "name": "诱导超量购买",
    "category": "销售行为",
    "risk_level": "MEDIUM",
    "match_type": "KEYWORD_ANY",
    "pattern_json": {
      "keywords": [
        "多买几盒",
        "囤一点",
        "多囤",
        "多买点",
        "趁活动多买",
        "一次多拿",
        "多囤点",
        "买五送五多囤"
      ]
    },
    "advice": "不得诱导顾客超量购买或囤药。",
    "recommended_expression": "建议按需购买，先按疗程使用，后续再按情况补充。",
    "enabled": true,
    "version": 1,
    "status": "ACTIVE"
  },
  {
    "code": "SERVICE_ATTITUDE",
    "name": "服务态度问题",
    "category": "服务态度",
    "risk_level": "LOW",
    "match_type": "KEYWORD_ANY",
    "pattern_json": {
      "keywords": [
        "爱买不买",
        "烦死了",
        "别烦我",
        "嫌贵别买",
        "不懂别乱说",
        "自己看",
        "关我什么事",
        "催什么催"
      ]
    },
    "advice": "保持耐心与礼貌, 不得使用不耐烦或冒犯性语言。",
    "recommended_expression": "好的，我帮您再确认一下，稍等。",
    "enabled": true,
    "version": 1,
    "status": "ACTIVE"
  },
  {
    "code": "INSUFFICIENT_CONSULTATION_INFO",
    "name": "问诊信息不足",
    "category": "问诊规范",
    "risk_level": "LOW",
    "match_type": "COMBINATION",
    "pattern_json": {
      "all": [],
      "any": [
        "不用问症状",
        "直接拿药",
        "不问了",
        "不用多说",
        "拿了就走",
        "直接买就行"
      ],
      "not": [
        "请问",
        "问一下",
        "什么症状",
        "遵医嘱"
      ]
    },
    "advice": "销售前应主动询问症状、病史等关键信息, 避免盲目推荐（疑似问诊信息不足）。",
    "recommended_expression": "请问您主要是什么症状？大概持续多久了？",
    "enabled": true,
    "version": 1,
    "status": "ACTIVE"
  }
]

module.exports = {
  BUILTIN_RULES,
}
