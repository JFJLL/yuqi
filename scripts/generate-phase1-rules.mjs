// scripts/generate-phase1-rules.mjs — 生成 JSVM 规则模块
// 读取 shared/phase1-risk-rules.json, 生成 pocketbase/pb_hooks/_generated/risk-rules.js
// 确保 Node 规则分析器、PocketBase Hook、Demo 种子与测试全链路规则唯一定义。

import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

const jsonPath = path.join(root, "shared", "phase1-risk-rules.json")
const outDir = path.join(root, "pocketbase", "pb_hooks", "_generated")
const outPath = path.join(outDir, "risk-rules.js")

const rules = JSON.parse(readFileSync(jsonPath, "utf8"))

mkdirSync(outDir, { recursive: true })

const jsCode = `// Auto-generated from shared/phase1-risk-rules.json. Do not edit directly.
// Run "node scripts/generate-phase1-rules.mjs" to regenerate.

const BUILTIN_RULES = ${JSON.stringify(rules, null, 2)}

module.exports = {
  BUILTIN_RULES,
}
`

writeFileSync(outPath, jsCode, "utf8")
console.log(`[generate-rules] generated ${outPath} (${rules.length} rules)`)

