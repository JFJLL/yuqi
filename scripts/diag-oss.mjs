#!/usr/bin/env node
// 复用 scanner 同款签名与请求逻辑，原样列出桶内对象
import { createHmac } from "node:crypto"
import https from "node:https"

function trimSlash(v) { return String(v || "").replace(/\/+$/, "") }
function normalizeEndpoint(v) { return trimSlash(String(v || "").trim().replace(/^https?:\/\//i, "")) }

const BUCKET = process.env.OSS_BUCKET || ""
const ENDPOINT = normalizeEndpoint(process.env.OSS_ENDPOINT || "")
const ID = process.env.OSS_ACCESS_KEY_ID || ""
const SECRET = process.env.OSS_ACCESS_KEY_SECRET || ""
const PREFIX = (process.env.OSS_PREFIX || "").replace(/^\/+/, "")

function auth(method, resource, date) {
  const s = [method, "", "", date, resource].join("\n")
  return `OSS ${ID}:${createHmac("sha1", SECRET).update(s, "utf8").digest("base64")}`
}
function host() { return `${BUCKET}.${ENDPOINT}` }

async function list(prefix, maxKeys = 1000) {
  const date = new Date().toUTCString()
  const resource = `/${BUCKET}/`
  const qs = new URLSearchParams({ prefix, "max-keys": String(maxKeys) }).toString()
  const url = `https://${host()}/?${qs}`
  const u = new URL(url)
  return new Promise((resolve, reject) => {
    const req = (u.protocol === "https:" ? https : https).request(u, { method: "GET", headers: { Date: date, Authorization: auth("GET", resource, date) } }, (res) => {
      const chunks = []
      res.on("data", c => chunks.push(c))
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8"), headers: res.headers }))
    })
    req.on("error", reject)
    req.setTimeout(15000, () => reject(new Error("timeout")))
    req.end()
  })
}

console.log(`BUCKET=${BUCKET} ENDPOINT=${ENDPOINT} PREFIX=${JSON.stringify(PREFIX)} ID=${ID.slice(0,6)}***`)
for (const p of [PREFIX, PREFIX + "WF2503Y001eecc4/", ""]) {
  console.log(`\n=== prefix=${JSON.stringify(p)} ===`)
  try {
    const r = await list(p)
    console.log(`HTTP ${r.status}`)
    if (r.status !== 200) {
      console.log(r.body.slice(0, 2000))
      continue
    }
    const keys = [...r.body.matchAll(/<Key>(.*?)<\/Key>/g)].map(m => m[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">"))
    const trunc = /<IsTruncated>(.*?)<\/IsTruncated>/.exec(r.body)?.[1]
    const next = /<NextMarker>(.*?)<\/NextMarker>/.exec(r.body)?.[1]
    console.log(`Keys=${keys.length} IsTruncated=${trunc} NextMarker=${next || "(none)"}`)
    keys.slice(0, 20).forEach(k => console.log(" ", k))
    // 同时打印未过滤前的 Contents 数量
    const contents = r.body.match(/<Contents>[\s\S]*?<\/Contents>/g) || []
    console.log(`Contents blocks=${contents.length}`)
  } catch (e) {
    console.error("ERR", e.message)
  }
}

// 同时查库
import http from "node:http"
function pbGet(path) {
  const url = `http://127.0.0.1:7040${path}`
  return new Promise((ok, err) => {
    http.get(url, res => {
      let b=""; res.on("data",c=>b+=c); res.on("end",()=>{ try{ ok(JSON.parse(b)) } catch{ ok({raw:b.slice(0,500)}) } })
    }).on("error", err)
  })
}
try {
  const d = await pbGet("/api/audio_files?perPage=100&sort=-created")
  console.log(`\n=== PB audio_files: ${d.items?.length ?? 0} 条 ===`)
  d.items?.slice(0,20).forEach(x=>console.log(` ${x.object_key}  ${x.status}  ${x.created}`))
} catch(e){ console.error("PB audio_files ERR", e.message) }
try {
  const d = await pbGet("/api/transcripts?perPage=20&sort=-created")
  console.log(`\n=== PB transcripts: ${d.items?.length ?? 0} 条 ===`)
  d.items?.slice(0,20).forEach(x=>console.log(` ${x.audio_name}  source=${x.source||"(空)"}  asr_status=${x.asr_status}`))
} catch(e){ console.error("PB transcripts ERR", e.message) }
