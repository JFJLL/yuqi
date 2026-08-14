/// <reference path="../pb_data/types.d.ts" />
// @vibex-protocol: markup/1
// pb_hooks/aigc.pb.js — RunningHub AIGC 标准模型中转 (self-contained, 单路由 + allowlist)
//
// 上面那行协议标记 + 下面各处的 localForwardRhHeaders 是「创作者自主定价」的发布
// 审计判据: 标记声明意图, 而真正被检查的是 "X-RH-Vibex-Ticket" 这个字面量确实出现在
// 请求头构造里。只认注释会被旧模板复制粘贴骗过, 只认函数定义会被一个从没被调用的
// 空壳骗过 —— 那正是"配了系数一分不加"的静默失效来源。判定结果决定后台能否配 >0。
//
// 路由约定:
//   GET  /api/aigc/models
//   POST /api/aigc/upload                         multipart file -> RH download_url
//   POST /api/aigc/submit                         body.model=<rh-model-short>
//   POST /api/aigc/jobs/{jobId}/poll
//   POST /api/aigc/history                         body.model 可选
//   POST /api/aigc/history/{jobId}/update
//   POST /api/aigc/history/{jobId}/delete
//
// ⚠️ 这个文件由 mcp__rh-pb-hooks__install_aigc_template / install_aigc_routes 装到目标路径。
//    加模型只更新 ALLOWED_MODELS, 不新增 per-model routerAdd。
//
// 业务字段 (book_id / order_id 等) 必须新建独立 collection 用 task_id 外键关联,
// **禁止**往 aigc_tasks 加业务字段 (会逼模型绕开 MCP 自己 Write).
//
// 字段名注意:
//   - PB 不允许字段名叫 model (跟 PB Record 内置属性冲突) → 表字段用 model_name。
//   - 前端传 body.model, 后端用 ALLOWED_MODELS[model] 校验并读取 endpoint/payload 契约。

// Published and dev containers inject the current app id. Keep the rendered
// literal only as a local-export fallback so Remix copies follow their runtime.
var VIBEX_APP_ID = $os.getenv("VIBEX_APP_ID") || "{{VIBEX_APP_ID}}"
var ALLOWED_MODELS = {{AIGC_ALLOWED_MODELS}}

onBootstrap(function (e) {
  e.next()
  try {
    var existing = null
    try { existing = $app.findCollectionByNameOrId("aigc_tasks") } catch (_) { existing = null }
    if (existing) {
      try {
        var changed = false
        function hasField(name) {
          try { return !!existing.fields.getByName(name) } catch (_) {}
          try {
            for (var i = 0; i < existing.fields.length; i++) {
              if (String(existing.fields[i].name) === String(name)) return true
            }
          } catch (_) {}
          return false
        }
        function addField(def) {
          if (hasField(def.name)) return
          try { existing.fields.add(new Field(def)); changed = true } catch (_) {}
        }
        addField({ name: "rating", type: "number", min: 0, max: 5 })
        addField({ name: "favorite", type: "bool" })
        addField({ name: "category", type: "text", max: 32 })
        addField({ name: "note", type: "text", max: 1000 })
        addField({ name: "created", type: "autodate", onCreate: true })
        addField({ name: "updated", type: "autodate", onCreate: true, onUpdate: true })
        addField({ name: "consume_money", type: "text", max: 64 })
        addField({ name: "consume_coins", type: "text", max: 64 })
        addField({ name: "task_cost_time", type: "text", max: 64 })
        addField({ name: "third_party_consume_money", type: "text", max: 64 })
        if (changed) $app.save(existing)
      } catch (schemaErr) {
        try { $app.logger().error("aigc_tasks schema upgrade: " + String(schemaErr && schemaErr.message || schemaErr)) } catch (_) {}
      }
    } else {
      var col = new Collection({
        type: "base", name: "aigc_tasks",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
          { name: "task_id", type: "text", required: true, max: 160 },
          { name: "rh_user_id", type: "text", max: 160 },
          { name: "rh_task_id", type: "text", max: 160 },
          { name: "model_name", type: "text", required: true, max: 64 },
          { name: "page", type: "text", max: 64 },
          { name: "prompt", type: "text", max: 5000 },
          { name: "status", type: "text", required: true, max: 32 },
          { name: "result_url", type: "text", max: 2048 },
          { name: "error_message", type: "text", max: 4000 },
          { name: "rating", type: "number", min: 0, max: 5 },
          { name: "favorite", type: "bool" },
          { name: "category", type: "text", max: 32 },
          { name: "note", type: "text", max: 1000 },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
          { name: "consume_money", type: "text", max: 64 },
          { name: "consume_coins", type: "text", max: 64 },
          { name: "task_cost_time", type: "text", max: 64 },
          { name: "third_party_consume_money", type: "text", max: 64 },
        ],
        indexes: ["CREATE UNIQUE INDEX idx_aigc_tasks_task_id ON aigc_tasks (task_id)"],
      })
      $app.save(col)
      try { $app.logger().info("aigc_tasks created") } catch (_) {}
    }
  } catch (err) {
    try { $app.logger().error("aigc_tasks bootstrap: " + String(err && err.message || err)) } catch (_) {}
  }
})

function listAllowedModels() {
  var items = []
  for (var key in ALLOWED_MODELS) {
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_MODELS, key)) continue
    var cfg = ALLOWED_MODELS[key] || {}
    items.push({
      model: key,
      endpoint: cfg.endpoint || "",
      output_type: cfg.output_type || "image",
      primary_input: cfg.primary_input || null,
      scalar_params: cfg.scalar_params || [],
      media_params: cfg.media_params || [],
    })
  }
  return items
}

function readKey(ev) {
  try { var h = ev.requestInfo().headers || {}; var k = h["x_rh_api_key"] || h["X-Rh-Api-Key"] || h["x-rh-api-key"] || ""; if (k) return String(k) } catch (_) {}
  return $os.getenv("RH_API_KEY") || ""
}

function responseText(res) { return (res && typeof res.raw === "string") ? res.raw : "" }
function responseJson(res) { var raw = responseText(res); try { return JSON.parse(raw) } catch (_) { return null } }

function newTaskId() { return "task-" + new Date().getTime() + "-" + Math.random().toString(16).slice(2, 10) }

function keyFingerprint(k) {
  var s = String(k || "")
  if (!s) return ""
  var h1 = 0x811c9dc5 >>> 0, h2 = 0x1000193 >>> 0
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i)
    h1 = ((h1 ^ c) >>> 0); h1 = (h1 * 16777619) >>> 0
    h2 = ((h2 + c) >>> 0); h2 = (h2 * 2246822519) >>> 0
  }
  function hex8(n) { var x = (n >>> 0).toString(16); while (x.length < 8) x = "0" + x; return x }
  return hex8(h1) + hex8(h2)
}

function isRhAuthErr(raw) {
  var s = String(raw || "")
  return s.indexOf("APIKEY_USER_NOT_FOUND") >= 0 || s.indexOf("APIKEY_INVALID") >= 0 || s.indexOf("TOKEN_INVALID") >= 0
    || s.indexOf("user not exist") >= 0 || s.indexOf('"code":301') >= 0
    || s.indexOf('"errorCode":"806"') >= 0 || s.indexOf('"errorCode":"412"') >= 0
}

function mapRhBizErr(parsed, raw) {
  var p = parsed || {}
  var code = String(p.errorCode || p.code || p.errCode || "")
  var msg = String(p.errorMsg || p.errorMessage || p.message || p.msg || p.error || raw || "")
  var hay = (code + " " + msg + " " + String(raw || "")).toLowerCase()
  if (code === "605" || hay.indexOf("insufficient") >= 0 || hay.indexOf("balance") >= 0 || hay.indexOf("余额") >= 0 || hay.indexOf("点数") >= 0 || hay.indexOf("积分") >= 0) {
    return { error: "rh_insufficient_balance", errorCode: code || "605", message: msg || "RunningHub 账户余额不足" }
  }
  if (hay.indexOf("content security audit") >= 0 || hay.indexOf("content moderation") >= 0 || hay.indexOf("内容安全审查") >= 0 || hay.indexOf("内容审查") >= 0 || hay.indexOf("审核未通过") >= 0) {
    return { error: "rh_content_audit", errorCode: code, message: msg || "内容审核未通过" }
  }
  if (code || msg) return { error: "rh_submit_failed", errorCode: code, message: msg || "RunningHub 提交失败" }
  return null
}

function ensureColl() {
  try { return $app.findCollectionByNameOrId("aigc_tasks") } catch (_) {}
  var col = new Collection({
    type: "base", name: "aigc_tasks",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "task_id", type: "text", required: true, max: 160 },
      { name: "rh_user_id", type: "text", max: 160 },
      { name: "rh_task_id", type: "text", max: 160 },
      { name: "model_name", type: "text", required: true, max: 64 },
      { name: "page", type: "text", max: 64 },
      { name: "prompt", type: "text", max: 5000 },
      { name: "status", type: "text", required: true, max: 32 },
      { name: "result_url", type: "text", max: 2048 },
      { name: "error_message", type: "text", max: 4000 },
      { name: "rating", type: "number", min: 0, max: 5 },
      { name: "favorite", type: "bool" },
      { name: "category", type: "text", max: 32 },
      { name: "note", type: "text", max: 1000 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      { name: "consume_money", type: "text", max: 64 },
      { name: "consume_coins", type: "text", max: 64 },
      { name: "task_cost_time", type: "text", max: 64 },
      { name: "third_party_consume_money", type: "text", max: 64 },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_aigc_tasks_task_id ON aigc_tasks (task_id)"],
  })
  $app.save(col)
  return $app.findCollectionByNameOrId("aigc_tasks")
}

function buildPayload(cfg, body) {
  var payload = { appCode: "vibex", vibexAppId: VIBEX_APP_ID }
  var inputText = String(body.prompt || body.text || body.description || body.lyrics || "").trim()
  var primary = cfg.primary_input || null
  if (primary && primary.name) {
    var pname = String(primary.name)
    inputText = String(body[pname] || "").trim()
    if (primary.required && !inputText) {
      return { error: { status: 400, body: { error: "input_required", message: "请输入内容" } } }
    }
    if (inputText.length > 8000) inputText = inputText.substring(0, 8000)
    payload[pname] = inputText
  } else {
    if (inputText.length > 8000) inputText = inputText.substring(0, 8000)
  }

  var params = cfg.scalar_params || cfg.params || []
  for (var i = 0; i < params.length; i++) {
    var p = params[i] || {}
    var name = String(p.name || "")
    if (!name) continue
    var ptype = String(p.type || "string")
    var val
    if (ptype === "bool") {
      val = (body[name] === undefined || body[name] === null) ? !!p.default : !!body[name]
    } else if (ptype === "number") {
      val = (body[name] === undefined || body[name] === null) ? Number(p.default || 0) : Number(body[name])
    } else {
      val = String((body[name] === undefined || body[name] === null || body[name] === "") ? (p.default || "") : body[name])
      if (p.enum && p.enum.length && p.enum.indexOf(val) < 0) val = String(p.default || p.enum[0] || "")
    }
    if (ptype === "string" && !p.required && val === "empty") continue
    if (p.wire === "list") {
      payload[name] = Array.isArray(body[name]) ? body[name] : (val ? [val] : [])
    } else {
      payload[name] = val
    }
  }

  var media = cfg.media_params || []
  function cleanMediaUrl(v) {
    var s = String(v || "").trim()
    if (!s) return ""
    if (s.indexOf("data:") === 0) return null
    if (!/^https?:\/\//i.test(s)) return null
    return s
  }
  for (var j = 0; j < media.length; j++) {
    var m = media[j] || {}
    var mname = String(m.name || "")
    if (!mname) continue
    if (m.multiple) {
      if (m.required && (!Array.isArray(body[mname]) || !body[mname].length)) {
        return { error: { status: 400, body: { error: "media_required", message: "缺少必填媒体 " + mname } } }
      }
      if (Array.isArray(body[mname]) && body[mname].length) {
        var cleaned = []
        for (var mi = 0; mi < body[mname].length; mi++) {
          var cu = cleanMediaUrl(body[mname][mi])
          if (cu === null) return { error: { status: 400, body: { error: "media_url_required", message: "请先上传媒体并传入可访问的 URL: " + mname } } }
          if (cu) cleaned.push(cu)
        }
        if (cleaned.length) payload[mname] = cleaned
      }
    } else {
      if (m.required && !body[mname]) {
        return { error: { status: 400, body: { error: "media_required", message: "缺少必填媒体 " + mname } } }
      }
      if (body[mname]) {
        var su = cleanMediaUrl(body[mname])
        if (su === null) return { error: { status: 400, body: { error: "media_url_required", message: "请先上传媒体并传入可访问的 URL: " + mname } } }
        if (su) payload[mname] = su
      }
    }
  }

  if (cfg.payload_fields) {
    for (var extra in cfg.payload_fields) {
      if (Object.prototype.hasOwnProperty.call(cfg.payload_fields, extra)) payload[extra] = cfg.payload_fields[extra]
    }
  }
  return { payload: payload, input_text: inputText }
}

function normalizeOutputUrl(rawUrl) {
  if (!rawUrl) return rawUrl
  var u = String(rawUrl)
  var idx = u.indexOf("myqcloud.com/")
  if (idx >= 0) u = "https://rh-images.xiaoyaoyou.com/" + u.substring(idx + "myqcloud.com/".length)
  var qIdx = u.indexOf("?"); var path = qIdx >= 0 ? u.substring(0, qIdx) : u; var query = qIdx >= 0 ? u.substring(qIdx) : ""
  try { path = encodeURI(decodeURI(path)) } catch (_) {}
  return path + query
}

function reportTaskIndex(f) {
  try {
    var base = ($os.getenv("VIBEX_CONTROL_URL") || "").replace(/\/+$/, "")
    var appId = (f && f.app_id) || $os.getenv("VIBEX_APP_ID")
    if (!base || !appId || !f || !f.task_id) return
    var headers = { "Content-Type": "application/json" }
    var tok = $os.getenv("VIBEX_TASK_INDEX_TOKEN")
    if (tok) headers.Authorization = "Bearer " + tok
    $http.send({
      url: base + "/api/app-task-index/upsert", method: "POST", headers: headers,
      body: JSON.stringify({
        app_id: appId, snapshot_id: f.snapshot_id || $os.getenv("VIBEX_PUBLISH_SNAPSHOT_ID") || null,
        task_id: String(f.task_id), rh_user_id: f.rh_user_id || null, rh_task_id: f.rh_task_id || null,
        status: f.status || "running", error_message: f.error_message || null,
      }),
      timeout: 5,
    })
  } catch (_) {}
}

function safeString(r, name) { try { return r.getString(name) } catch (_) { return "" } }
function safeBool(r, name) { try { return !!r.getBool(name) } catch (_) { return false } }
function safeNumber(r, name) { try { return Number(r.get(name) || 0) || 0 } catch (_) { return 0 } }

function itemFromRecord(rec) {
  return {
    jobId: rec.getString("task_id"),
    taskId: rec.getString("rh_task_id"),
    status: rec.getString("status"),
    page: rec.getString("page"),
    prompt: rec.getString("prompt"),
    resultUrl: rec.getString("result_url"),
    errorMessage: rec.getString("error_message"),
    rating: safeNumber(rec, "rating"),
    favorite: safeBool(rec, "favorite"),
    category: safeString(rec, "category"),
    note: safeString(rec, "note"),
    created: rec.getString("created"),
    updated: rec.getString("updated"),
    model: rec.getString("model_name"),
    consumeMoney: safeString(rec, "consume_money"),
    consumeCoins: safeString(rec, "consume_coins"),
    taskCostTime: safeString(rec, "task_cost_time"),
    thirdPartyConsumeMoney: safeString(rec, "third_party_consume_money"),
  }
}

routerAdd("GET", "/api/aigc/models", function (e) {
  try {
    var allowedModels = {{AIGC_ALLOWED_MODELS}}
    var items = []
    for (var key in allowedModels) {
      if (!Object.prototype.hasOwnProperty.call(allowedModels, key)) continue
      var cfg = allowedModels[key] || {}
      items.push({
        model: key,
        endpoint: cfg.endpoint || "",
        output_type: cfg.output_type || "image",
        primary_input: cfg.primary_input || null,
        scalar_params: cfg.scalar_params || [],
        media_params: cfg.media_params || [],
      })
    }
    return e.json(200, { ok: true, models: items })
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "aigc_models_error", message: msg, fingerprint: msg.substring(0, 80) })
  }
})

routerAdd("POST", "/api/aigc/upload", function (e) {
  // 每个 routerAdd 处理器是独立作用域, 看不到顶层函数 (本文件里 localReadKey /
  // allowedModels 全都重复定义就是这个原因), 所以透传 helper 也得各带一份。
  function localForwardRhHeaders(ev, base) {
    var out = {}
    for (var k in base) { if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k] }
    try {
      var h = ev.requestInfo().headers || {}
      function pick(a, b, c) { return h[a] || h[b] || h[c] || "" }
      var app = pick("x_rh_vibex_app", "X-RH-Vibex-App", "x-rh-vibex-app")
      var tkt = pick("x_rh_vibex_ticket", "X-RH-Vibex-Ticket", "x-rh-vibex-ticket")
      var sig = pick("x_rh_vibex_sign", "X-RH-Vibex-Sign", "x-rh-vibex-sign")
      if (app) out["X-RH-Vibex-App"] = String(app)
      if (tkt) out["X-RH-Vibex-Ticket"] = String(tkt)
      if (sig) out["X-RH-Vibex-Sign"] = String(sig)
    } catch (_) {}
    return out
  }
  function localReadKey(ev) {
    try { var h = ev.requestInfo().headers || {}; var k = h["x_rh_api_key"] || h["X-Rh-Api-Key"] || h["x-rh-api-key"] || ""; if (k) return String(k) } catch (_) {}
    return $os.getenv("RH_API_KEY") || ""
  }
  function localIsRhAuthErr(raw) {
    var s = String(raw || "")
    return s.indexOf("APIKEY_USER_NOT_FOUND") >= 0 || s.indexOf("APIKEY_INVALID") >= 0 || s.indexOf("TOKEN_INVALID") >= 0
      || s.indexOf("user not exist") >= 0 || s.indexOf('"code":301') >= 0
      || s.indexOf('"errorCode":"806"') >= 0 || s.indexOf('"errorCode":"412"') >= 0
  }
  function localResponseText(res) { return (res && typeof res.raw === "string") ? res.raw : "" }
  function localResponseJson(res) { var raw = localResponseText(res); try { return JSON.parse(raw) } catch (_) { return null } }
  try {
    var key = localReadKey(e)
    if (!key) return e.json(412, { error: "rh_login_required", message: "请用右上角按钮登录 RunningHub" })

    var rhFile = null
    var fileType = "image"
    try {
      try { e.request.parseMultipartForm(64 << 20) } catch (_) {}
      var mf = e.request.multipartForm
      if (mf && mf.value && mf.value["fileType"] && mf.value["fileType"].length) fileType = String(mf.value["fileType"][0] || "image")
      if (mf && mf.file && mf.file["file"] && mf.file["file"].length) {
        rhFile = $filesystem.fileFromMultipart(mf.file["file"][0])
      }
    } catch (_) { rhFile = null }
    if (!rhFile) return e.json(400, { error: "invalid_upload", message: "请使用 multipart/form-data 上传 file 字段" })

    fileType = String(fileType || "image").toLowerCase()
    if (["image", "audio", "video", "zip"].indexOf(fileType) < 0) fileType = "image"

    var form = new FormData()
    form.append("file", rhFile)
    form.append("apiKey", key)
    var res = $http.send({
      url: "https://www.runninghub.cn/openapi/v2/media/upload/binary",
      method: "POST",
      headers: localForwardRhHeaders(e, { "Authorization": "Bearer " + key }),
      body: form,
      timeout: 60,
    })
    var raw = localResponseText(res)
    if (localIsRhAuthErr(raw)) return e.json(412, { error: "rh_login_required", message: "RunningHub 登录态已过期" })
    if (!res || res.statusCode < 200 || res.statusCode >= 300) {
      var em = raw || ("RH HTTP " + (res ? res.statusCode : 0))
      return e.json(502, { error: "rh_upload_failed", message: em, fingerprint: String(em).substring(0, 80) })
    }
    var parsed = localResponseJson(res)
    var data = parsed && parsed.data ? parsed.data : parsed
    var downloadUrl = data && (data.download_url || data.downloadUrl)
    var fileName = data && (data.fileName || data.filename)
    if (!downloadUrl) return e.json(502, { error: "rh_upload_bad_response", message: raw, fingerprint: raw.substring(0, 80) })
    return e.json(200, {
      ok: true,
      type: data && data.type ? String(data.type) : fileType,
      download_url: String(downloadUrl),
      downloadUrl: String(downloadUrl),
      fileName: fileName ? String(fileName) : "",
      size: data && data.size ? String(data.size) : "",
    })
  } catch (err) {
    var msg = String(err && err.message || err)
    if (localIsRhAuthErr(msg)) return e.json(412, { error: "rh_login_required", message: "RunningHub 登录态已过期" })
    return e.json(500, { error: "aigc_upload_error", message: msg, fingerprint: msg.substring(0, 80) })
  }
})

routerAdd("POST", "/api/aigc/submit", function (e) {
  // 计价真正发生的入口, 票据在这里最关键: 丢了它 RH 认不出 app, 系数恒为 0。
  function localForwardRhHeaders(ev, base) {
    var out = {}
    for (var k in base) { if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k] }
    try {
      var h = ev.requestInfo().headers || {}
      function pick(a, b, c) { return h[a] || h[b] || h[c] || "" }
      var app = pick("x_rh_vibex_app", "X-RH-Vibex-App", "x-rh-vibex-app")
      var tkt = pick("x_rh_vibex_ticket", "X-RH-Vibex-Ticket", "x-rh-vibex-ticket")
      var sig = pick("x_rh_vibex_sign", "X-RH-Vibex-Sign", "x-rh-vibex-sign")
      if (app) out["X-RH-Vibex-App"] = String(app)
      if (tkt) out["X-RH-Vibex-Ticket"] = String(tkt)
      if (sig) out["X-RH-Vibex-Sign"] = String(sig)
    } catch (_) {}
    return out
  }
  function localReadKey(ev) {
    try { var h = ev.requestInfo().headers || {}; var k = h["x_rh_api_key"] || h["X-Rh-Api-Key"] || h["x-rh-api-key"] || ""; if (k) return String(k) } catch (_) {}
    return $os.getenv("RH_API_KEY") || ""
  }
  function localNewTaskId() { return "task-" + new Date().getTime() + "-" + Math.random().toString(16).slice(2, 10) }
  function localKeyFingerprint(k) {
    var s = String(k || "")
    if (!s) return ""
    var h1 = 0x811c9dc5 >>> 0, h2 = 0x1000193 >>> 0
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i)
      h1 = ((h1 ^ c) >>> 0); h1 = (h1 * 16777619) >>> 0
      h2 = ((h2 + c) >>> 0); h2 = (h2 * 2246822519) >>> 0
    }
    function hex8(n) { var x = (n >>> 0).toString(16); while (x.length < 8) x = "0" + x; return x }
    return hex8(h1) + hex8(h2)
  }
  function localIsRhAuthErr(raw) {
    var s = String(raw || "")
    return s.indexOf("APIKEY_USER_NOT_FOUND") >= 0 || s.indexOf("APIKEY_INVALID") >= 0 || s.indexOf("TOKEN_INVALID") >= 0
      || s.indexOf("user not exist") >= 0 || s.indexOf('"code":301') >= 0
      || s.indexOf('"errorCode":"806"') >= 0 || s.indexOf('"errorCode":"412"') >= 0
  }
  function localMapRhBizErr(parsed, raw) {
    var p = parsed || {}
    var code = String(p.errorCode || p.code || p.errCode || "")
    var msg = String(p.errorMsg || p.errorMessage || p.message || p.msg || p.error || raw || "")
    var hay = (code + " " + msg + " " + String(raw || "")).toLowerCase()
    if (code === "605" || hay.indexOf("insufficient") >= 0 || hay.indexOf("balance") >= 0 || hay.indexOf("余额") >= 0 || hay.indexOf("点数") >= 0 || hay.indexOf("积分") >= 0) {
      return { error: "rh_insufficient_balance", errorCode: code || "605", message: msg || "RunningHub 账户余额不足" }
    }
    if (hay.indexOf("content security audit") >= 0 || hay.indexOf("content moderation") >= 0 || hay.indexOf("内容安全审查") >= 0 || hay.indexOf("内容审查") >= 0 || hay.indexOf("审核未通过") >= 0) {
      return { error: "rh_content_audit", errorCode: code, message: msg || "内容审核未通过" }
    }
    if (code || msg) return { error: "rh_submit_failed", errorCode: code, message: msg || "RunningHub 提交失败" }
    return null
  }
  function localEnsureColl() {
    try { return $app.findCollectionByNameOrId("aigc_tasks") } catch (_) {}
    var col = new Collection({
      type: "base", name: "aigc_tasks",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
        { name: "task_id", type: "text", required: true, max: 160 },
        { name: "rh_user_id", type: "text", max: 160 },
        { name: "rh_task_id", type: "text", max: 160 },
        { name: "model_name", type: "text", required: true, max: 64 },
        { name: "page", type: "text", max: 64 },
        { name: "prompt", type: "text", max: 5000 },
        { name: "status", type: "text", required: true, max: 32 },
        { name: "result_url", type: "text", max: 2048 },
        { name: "error_message", type: "text", max: 4000 },
        { name: "rating", type: "number", min: 0, max: 5 },
        { name: "favorite", type: "bool" },
        { name: "category", type: "text", max: 32 },
        { name: "note", type: "text", max: 1000 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        { name: "consume_money", type: "text", max: 64 },
        { name: "consume_coins", type: "text", max: 64 },
        { name: "task_cost_time", type: "text", max: 64 },
        { name: "third_party_consume_money", type: "text", max: 64 },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_aigc_tasks_task_id ON aigc_tasks (task_id)"],
    })
    $app.save(col)
    return $app.findCollectionByNameOrId("aigc_tasks")
  }
  function localBuildPayload(cfg, body) {
    var payload = { appCode: "vibex", vibexAppId: $os.getenv("VIBEX_APP_ID") || "{{VIBEX_APP_ID}}" }
    var inputText = String(body.prompt || body.text || body.description || body.lyrics || "").trim()
    var primary = cfg.primary_input || null
    if (primary && primary.name) {
      var pname = String(primary.name)
      inputText = String(body[pname] || "").trim()
      if (primary.required && !inputText) {
        return { error: { status: 400, body: { error: "input_required", message: "请输入内容" } } }
      }
      if (inputText.length > 8000) inputText = inputText.substring(0, 8000)
      payload[pname] = inputText
    } else {
      if (inputText.length > 8000) inputText = inputText.substring(0, 8000)
    }
    var params = cfg.scalar_params || cfg.params || []
    for (var i = 0; i < params.length; i++) {
      var p = params[i] || {}
      var name = String(p.name || "")
      if (!name) continue
      var ptype = String(p.type || "string")
      var val
      if (ptype === "bool") {
        val = (body[name] === undefined || body[name] === null) ? !!p.default : !!body[name]
      } else if (ptype === "number") {
        val = (body[name] === undefined || body[name] === null) ? Number(p.default || 0) : Number(body[name])
      } else {
        val = String((body[name] === undefined || body[name] === null || body[name] === "") ? (p.default || "") : body[name])
        if (p.enum && p.enum.length && p.enum.indexOf(val) < 0) val = String(p.default || p.enum[0] || "")
      }
      if (ptype === "string" && !p.required && val === "empty") continue
      if (p.wire === "list") {
        payload[name] = Array.isArray(body[name]) ? body[name] : (val ? [val] : [])
      } else {
        payload[name] = val
      }
    }
    var media = cfg.media_params || []
    function cleanMediaUrl(v) {
      var s = String(v || "").trim()
      if (!s) return ""
      if (s.indexOf("data:") === 0) return null
      if (!/^https?:\/\//i.test(s)) return null
      return s
    }
    for (var j = 0; j < media.length; j++) {
      var m = media[j] || {}
      var mname = String(m.name || "")
      if (!mname) continue
      if (m.multiple) {
        if (m.required && (!Array.isArray(body[mname]) || !body[mname].length)) {
          return { error: { status: 400, body: { error: "media_required", message: "缺少必填媒体 " + mname } } }
        }
        if (Array.isArray(body[mname]) && body[mname].length) {
          var cleaned = []
          for (var mi = 0; mi < body[mname].length; mi++) {
            var cu = cleanMediaUrl(body[mname][mi])
            if (cu === null) return { error: { status: 400, body: { error: "media_url_required", message: "请先上传媒体并传入可访问的 URL: " + mname } } }
            if (cu) cleaned.push(cu)
          }
          if (cleaned.length) payload[mname] = cleaned
        }
      } else {
        if (m.required && !body[mname]) {
          return { error: { status: 400, body: { error: "media_required", message: "缺少必填媒体 " + mname } } }
        }
        if (body[mname]) {
          var su = cleanMediaUrl(body[mname])
          if (su === null) return { error: { status: 400, body: { error: "media_url_required", message: "请先上传媒体并传入可访问的 URL: " + mname } } }
          if (su) payload[mname] = su
        }
      }
    }
    if (cfg.payload_fields) {
      for (var extra in cfg.payload_fields) {
        if (Object.prototype.hasOwnProperty.call(cfg.payload_fields, extra)) payload[extra] = cfg.payload_fields[extra]
      }
    }
    return { payload: payload, input_text: inputText }
  }
  function localReportTaskIndex(f) {
    try {
      var base = ($os.getenv("VIBEX_CONTROL_URL") || "").replace(/\/+$/, "")
      var appId = (f && f.app_id) || $os.getenv("VIBEX_APP_ID")
      if (!base || !appId || !f || !f.task_id) return
      var headers = { "Content-Type": "application/json" }
      var tok = $os.getenv("VIBEX_TASK_INDEX_TOKEN")
      if (tok) headers.Authorization = "Bearer " + tok
      $http.send({
        url: base + "/api/app-task-index/upsert", method: "POST", headers: headers,
        body: JSON.stringify({
          app_id: appId, snapshot_id: f.snapshot_id || $os.getenv("VIBEX_PUBLISH_SNAPSHOT_ID") || null,
          task_id: String(f.task_id), rh_user_id: f.rh_user_id || null, rh_task_id: f.rh_task_id || null,
          status: f.status || "running", error_message: f.error_message || null,
        }),
        timeout: 5,
      })
    } catch (_) {}
  }
  try {
    var allowedModels = {{AIGC_ALLOWED_MODELS}}
    var key = localReadKey(e)
    if (!key) return e.json(412, { error: "rh_login_required", message: "请用右上角按钮登录 RunningHub" })
    var body = e.requestInfo().body || {}
    var modelName = String(body.model || "").trim()
    var cfg = modelName ? allowedModels[modelName] : null
    if (!cfg) return e.json(400, { error: "model_not_allowed", message: "AIGC 模型未在服务端 allowlist 中启用", model: modelName })

    var built = localBuildPayload(cfg, body)
    if (built.error) return e.json(built.error.status, built.error.body)
    var payload = built.payload
    var inputText = built.input_text || ""
    var endpoint = String(cfg.endpoint || "")
    if (!endpoint) return e.json(500, { error: "model_endpoint_missing", message: "模型 endpoint 未配置", fingerprint: modelName })
    if (endpoint.charAt(0) !== "/") endpoint = "/openapi/v2/" + endpoint.replace(/^\/?openapi\/v2\//, "")

    var res = $http.send({
      url: "https://www.runninghub.cn" + endpoint, method: "POST",
      headers: localForwardRhHeaders(e, { "Authorization": "Bearer " + key, "Content-Type": "application/json" }),
      body: JSON.stringify(payload), timeout: 30,
    })
    var rawBody = (res && typeof res.raw === "string") ? res.raw : ""
    if (localIsRhAuthErr(rawBody)) return e.json(412, { error: "rh_login_required", message: "RunningHub 登录态已过期" })
    if (!res || res.statusCode < 200 || res.statusCode >= 300) {
      var em = "RH HTTP " + (res ? res.statusCode : 0) + " " + rawBody.substring(0, 200)
      return e.json(502, { error: "rh_submit_failed", message: em, fingerprint: em.substring(0, 80) })
    }
    var parsed = null; try { parsed = JSON.parse(rawBody) } catch (_) {}
    if (!parsed || !parsed.taskId) {
      var bizErr = localMapRhBizErr(parsed, rawBody)
      if (bizErr) return e.json(200, bizErr)
      var bm = "RH bad JSON: " + rawBody.substring(0, 200)
      return e.json(502, { error: "rh_submit_bad_json", message: bm, fingerprint: bm.substring(0, 80) })
    }
    var rhTaskId = String(parsed.taskId); var localTaskId = localNewTaskId()
    try {
      var coll = localEnsureColl()
      var rec = new Record(coll)
      rec.set("task_id", localTaskId); rec.set("rh_task_id", rhTaskId); rec.set("model_name", modelName)
      rec.set("rh_user_id", localKeyFingerprint(key))
      rec.set("page", String(body.page || "")); rec.set("prompt", inputText); rec.set("status", "running")
      $app.save(rec)
    } catch (_) {}
    localReportTaskIndex({ task_id: localTaskId, rh_task_id: rhTaskId, rh_user_id: localKeyFingerprint(key), status: "running" })
    return e.json(200, { ok: true, taskId: localTaskId, rhTaskId: rhTaskId, status: "running", model: modelName })
  } catch (err) {
    var msg = String(err && err.message || err)
    if (localIsRhAuthErr(msg)) return e.json(412, { error: "rh_login_required", message: "RunningHub 登录态已过期" })
    return e.json(500, { error: "aigc_submit_error", message: msg, fingerprint: msg.substring(0, 80) })
  }
})

// 价格预估: 用和 /submit 完全相同的 payload 构造逻辑, 换成 RH 的 price-preview 端点
// (POST /openapi/v2/price-preview/<原端点>)。任何失败都返回 { ok: false }, 不抛错、不 412
// 阻塞生成流程 —— 前端只应隐藏价格徽标, 不应因为预估失败拦住用户点击生成按钮。
routerAdd("POST", "/api/aigc/price-preview", function (e) {
  // 预估价必须和实扣同口径: 这里丢票据会变成"预览显示原价、实际扣上浮价",
  // 是直接可见的资损争议, 比少赚严重。
  function localForwardRhHeaders(ev, base) {
    var out = {}
    for (var k in base) { if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k] }
    try {
      var h = ev.requestInfo().headers || {}
      function pick(a, b, c) { return h[a] || h[b] || h[c] || "" }
      var app = pick("x_rh_vibex_app", "X-RH-Vibex-App", "x-rh-vibex-app")
      var tkt = pick("x_rh_vibex_ticket", "X-RH-Vibex-Ticket", "x-rh-vibex-ticket")
      var sig = pick("x_rh_vibex_sign", "X-RH-Vibex-Sign", "x-rh-vibex-sign")
      if (app) out["X-RH-Vibex-App"] = String(app)
      if (tkt) out["X-RH-Vibex-Ticket"] = String(tkt)
      if (sig) out["X-RH-Vibex-Sign"] = String(sig)
    } catch (_) {}
    return out
  }
  function localReadKey(ev) {
    try { var h = ev.requestInfo().headers || {}; var k = h["x_rh_api_key"] || h["X-Rh-Api-Key"] || h["x-rh-api-key"] || ""; if (k) return String(k) } catch (_) {}
    return $os.getenv("RH_API_KEY") || ""
  }
  function localIsRhAuthErr(raw) {
    var s = String(raw || "")
    return s.indexOf("APIKEY_USER_NOT_FOUND") >= 0 || s.indexOf("APIKEY_INVALID") >= 0 || s.indexOf("TOKEN_INVALID") >= 0
      || s.indexOf("user not exist") >= 0 || s.indexOf('"code":301') >= 0
      || s.indexOf('"errorCode":"806"') >= 0 || s.indexOf('"errorCode":"412"') >= 0
  }
  function localBuildPayload(cfg, body) {
    var payload = { appCode: "vibex", vibexAppId: $os.getenv("VIBEX_APP_ID") || "{{VIBEX_APP_ID}}" }
    var inputText = String(body.prompt || body.text || body.description || body.lyrics || "").trim()
    var primary = cfg.primary_input || null
    if (primary && primary.name) {
      var pname = String(primary.name)
      inputText = String(body[pname] || "").trim()
      if (inputText.length > 8000) inputText = inputText.substring(0, 8000)
      payload[pname] = inputText
    } else {
      if (inputText.length > 8000) inputText = inputText.substring(0, 8000)
    }
    var params = cfg.scalar_params || cfg.params || []
    for (var i = 0; i < params.length; i++) {
      var p = params[i] || {}
      var name = String(p.name || "")
      if (!name) continue
      var ptype = String(p.type || "string")
      var val
      if (ptype === "bool") {
        val = (body[name] === undefined || body[name] === null) ? !!p.default : !!body[name]
      } else if (ptype === "number") {
        val = (body[name] === undefined || body[name] === null) ? Number(p.default || 0) : Number(body[name])
      } else {
        val = String((body[name] === undefined || body[name] === null || body[name] === "") ? (p.default || "") : body[name])
        if (p.enum && p.enum.length && p.enum.indexOf(val) < 0) val = String(p.default || p.enum[0] || "")
      }
      if (ptype === "string" && !p.required && val === "empty") continue
      if (p.wire === "list") {
        payload[name] = Array.isArray(body[name]) ? body[name] : (val ? [val] : [])
      } else {
        payload[name] = val
      }
    }
    var media = cfg.media_params || []
    function cleanMediaUrl(v) {
      var s = String(v || "").trim()
      if (!s) return ""
      if (s.indexOf("data:") === 0) return null
      if (!/^https?:\/\//i.test(s)) return null
      return s
    }
    for (var j = 0; j < media.length; j++) {
      var m = media[j] || {}
      var mname = String(m.name || "")
      if (!mname) continue
      if (m.multiple) {
        if (Array.isArray(body[mname]) && body[mname].length) {
          var cleaned = []
          for (var mi = 0; mi < body[mname].length; mi++) {
            var cu = cleanMediaUrl(body[mname][mi])
            if (cu) cleaned.push(cu)
          }
          if (cleaned.length) payload[mname] = cleaned
        }
      } else if (body[mname]) {
        var su = cleanMediaUrl(body[mname])
        if (su) payload[mname] = su
      }
    }
    if (cfg.payload_fields) {
      for (var extra in cfg.payload_fields) {
        if (Object.prototype.hasOwnProperty.call(cfg.payload_fields, extra)) payload[extra] = cfg.payload_fields[extra]
      }
    }
    return payload
  }
  try {
    var allowedModels = {{AIGC_ALLOWED_MODELS}}
    var key = localReadKey(e)
    if (!key) return e.json(200, { ok: false, message: "rh_login_required" })
    var body = e.requestInfo().body || {}
    var modelName = String(body.model || "").trim()
    var cfg = modelName ? allowedModels[modelName] : null
    if (!cfg) return e.json(200, { ok: false, message: "model_not_allowed" })
    var endpoint = String(cfg.endpoint || "")
    if (!endpoint) return e.json(200, { ok: false, message: "model_endpoint_missing" })
    if (endpoint.charAt(0) !== "/") endpoint = "/openapi/v2/" + endpoint.replace(/^\/?openapi\/v2\//, "")
    var previewEndpoint = endpoint.replace("/openapi/v2/", "/openapi/v2/price-preview/")
    var payload = localBuildPayload(cfg, body)

    var res = $http.send({
      url: "https://www.runninghub.cn" + previewEndpoint, method: "POST",
      headers: localForwardRhHeaders(e, { "Authorization": "Bearer " + key, "Content-Type": "application/json" }),
      body: JSON.stringify(payload), timeout: 15,
    })
    var rawBody = (res && typeof res.raw === "string") ? res.raw : ""
    if (localIsRhAuthErr(rawBody)) return e.json(200, { ok: false, message: "rh_login_required" })
    if (!res || res.statusCode < 200 || res.statusCode >= 300) {
      return e.json(200, { ok: false, message: "price_preview_unavailable" })
    }
    var parsed = null; try { parsed = JSON.parse(rawBody) } catch (_) {}
    if (!parsed || parsed.errorCode) {
      return e.json(200, { ok: false, message: (parsed && parsed.errorMessage) || "price_preview_unavailable" })
    }
    return e.json(200, {
      ok: true,
      estimatedPrice: parsed.estimatedPrice,
      currency: parsed.currency || "CNY",
      priceText: parsed.priceText || "",
      freeLimit: !!parsed.freeLimit,
      isFreeThisCall: !!parsed.isFreeThisCall,
    })
  } catch (err) {
    return e.json(200, { ok: false, message: "price_preview_error" })
  }
})

routerAdd("POST", "/api/aigc/jobs/{jobId}/poll", function (e) {
  function localReadKey(ev) {
    try { var h = ev.requestInfo().headers || {}; var k = h["x_rh_api_key"] || h["X-Rh-Api-Key"] || h["x-rh-api-key"] || ""; if (k) return String(k) } catch (_) {}
    return $os.getenv("RH_API_KEY") || ""
  }
  function localIsRhAuthErr(raw) {
    var s = String(raw || "")
    return s.indexOf("APIKEY_USER_NOT_FOUND") >= 0 || s.indexOf("APIKEY_INVALID") >= 0 || s.indexOf("TOKEN_INVALID") >= 0
      || s.indexOf("user not exist") >= 0 || s.indexOf('"code":301') >= 0
      || s.indexOf('"errorCode":"806"') >= 0 || s.indexOf('"errorCode":"412"') >= 0
  }
  function localNormalizeOutputUrl(rawUrl) {
    if (!rawUrl) return rawUrl
    var u = String(rawUrl)
    var idx = u.indexOf("myqcloud.com/")
    if (idx >= 0) u = "https://rh-images.xiaoyaoyou.com/" + u.substring(idx + "myqcloud.com/".length)
    var qIdx = u.indexOf("?"); var path = qIdx >= 0 ? u.substring(0, qIdx) : u; var query = qIdx >= 0 ? u.substring(qIdx) : ""
    try { path = encodeURI(decodeURI(path)) } catch (_) {}
    return path + query
  }
  function localReportTaskIndex(f) {
    try {
      var base = ($os.getenv("VIBEX_CONTROL_URL") || "").replace(/\/+$/, "")
      var appId = (f && f.app_id) || $os.getenv("VIBEX_APP_ID")
      if (!base || !appId || !f || !f.task_id) return
      var headers = { "Content-Type": "application/json" }
      var tok = $os.getenv("VIBEX_TASK_INDEX_TOKEN")
      if (tok) headers.Authorization = "Bearer " + tok
      $http.send({
        url: base + "/api/app-task-index/upsert", method: "POST", headers: headers,
        body: JSON.stringify({
          app_id: appId, snapshot_id: f.snapshot_id || $os.getenv("VIBEX_PUBLISH_SNAPSHOT_ID") || null,
          task_id: String(f.task_id), rh_user_id: f.rh_user_id || null, rh_task_id: f.rh_task_id || null,
          status: f.status || "running", error_message: f.error_message || null,
        }),
        timeout: 5,
      })
    } catch (_) {}
  }
  // RH /openapi/v2/query 终态响应里的 usage 是真实扣费明细 (thirdPartyConsumeMoney 通常是实付
  // 金额, consumeMoney/consumeCoins 常为 null)。全部按字符串落库/返回, 避免精度问题。
  function localExtractUsage(data) {
    var u = (data && data.usage) || {}
    function s(v) { return (v === undefined || v === null) ? null : String(v) }
    return {
      consumeMoney: s(u.consumeMoney),
      consumeCoins: s(u.consumeCoins),
      taskCostTime: s(u.taskCostTime),
      thirdPartyConsumeMoney: s(u.thirdPartyConsumeMoney),
    }
  }
  try {
    var allowedModels = {{AIGC_ALLOWED_MODELS}}
    var key = localReadKey(e)
    if (!key) return e.json(412, { error: "rh_login_required", message: "请用右上角按钮登录 RunningHub" })
    var jobId = e.request.pathValue("jobId")
    if (!jobId) return e.json(400, { error: "job_id_required" })
    var rec = null
    try { rec = $app.findFirstRecordByFilter("aigc_tasks", "task_id = {:tid}", { tid: jobId }) } catch (_) {}
    if (!rec) return e.json(404, { error: "job_not_found", message: "任务不存在或已过期" })
    var rhTaskId = rec.getString("rh_task_id")
    if (!rhTaskId) return e.json(200, { ok: true, taskId: jobId, status: "RUNNING", outputs: [] })

    var res = $http.send({
      // 刻意不带上浮票据: /query 只读任务状态、不计价, 带了纯属白烧一张一次性票。
      // 计价只发生在 /submit (实扣) 与 /price-preview (展示价) 两处。
      url: "https://www.runninghub.cn/openapi/v2/query", method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: rhTaskId }), timeout: 30,
    })
    var rawBody = (res && typeof res.raw === "string") ? res.raw : ""
    if (localIsRhAuthErr(rawBody)) return e.json(412, { error: "rh_login_required", message: "RunningHub 登录态已过期" })
    if (!res || res.statusCode < 200 || res.statusCode >= 300) {
      return e.json(200, { ok: true, taskId: jobId, status: "RUNNING", outputs: [], model: rec.getString("model_name") })
    }
    var data = null; try { data = JSON.parse(rawBody) } catch (_) {}
    if (!data) return e.json(200, { ok: true, taskId: jobId, status: "RUNNING", outputs: [], model: rec.getString("model_name") })

    var modelName = rec.getString("model_name")
    var cfg = allowedModels[modelName] || {}
    var outputType = String(cfg.output_type || "image")
    var taskStatus = String(data.status || "RUNNING").toUpperCase()
    var usage = localExtractUsage(data)
    var outputs = []
    if (taskStatus === "SUCCESS") {
      var results = data.results || []
      for (var i = 0; i < results.length; i++) {
        var r = results[i]
        var u = (r && (r.url || r.fileUrl || r.imageUrl)) || ""
        if (!u && typeof r === "string") u = r
        if (u) outputs.push({ url: localNormalizeOutputUrl(u), type: outputType })
      }
      if (outputs.length) {
        try {
          rec.set("status", "success"); rec.set("result_url", outputs[0].url.substring(0, 2048))
          rec.set("consume_money", usage.consumeMoney || ""); rec.set("consume_coins", usage.consumeCoins || "")
          rec.set("task_cost_time", usage.taskCostTime || ""); rec.set("third_party_consume_money", usage.thirdPartyConsumeMoney || "")
          $app.save(rec)
        } catch (_) {}
        localReportTaskIndex({ task_id: jobId, rh_task_id: rhTaskId, rh_user_id: rec.getString("rh_user_id"), status: "success" })
      }
    } else if (taskStatus === "FAILED" || taskStatus === "CANCEL") {
      var errMsg = String(data.errorMessage || data.errorCode || "task_failed")
      try {
        rec.set("status", "failed"); rec.set("error_message", errMsg.substring(0, 4000))
        rec.set("consume_money", usage.consumeMoney || ""); rec.set("consume_coins", usage.consumeCoins || "")
        rec.set("task_cost_time", usage.taskCostTime || ""); rec.set("third_party_consume_money", usage.thirdPartyConsumeMoney || "")
        $app.save(rec)
      } catch (_) {}
      localReportTaskIndex({ task_id: jobId, rh_task_id: rhTaskId, rh_user_id: rec.getString("rh_user_id"), status: "failed", error_message: errMsg })
      return e.json(200, { ok: true, taskId: jobId, status: taskStatus, outputs: [], error: errMsg, model: modelName, usage: usage })
    }
    return e.json(200, { ok: true, taskId: jobId, status: taskStatus, outputs: outputs, model: modelName, usage: usage })
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("aigc_poll_transient: " + msg) } catch (_) {}
    return e.json(200, { ok: true, status: "RUNNING", outputs: [] })
  }
})

routerAdd("POST", "/api/aigc/history", function (e) {
  function localReadKey(ev) {
    try { var h = ev.requestInfo().headers || {}; var k = h["x_rh_api_key"] || h["X-Rh-Api-Key"] || h["x-rh-api-key"] || ""; if (k) return String(k) } catch (_) {}
    return $os.getenv("RH_API_KEY") || ""
  }
  function localKeyFingerprint(k) {
    var s = String(k || "")
    if (!s) return ""
    var h1 = 0x811c9dc5 >>> 0, h2 = 0x1000193 >>> 0
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i)
      h1 = ((h1 ^ c) >>> 0); h1 = (h1 * 16777619) >>> 0
      h2 = ((h2 + c) >>> 0); h2 = (h2 * 2246822519) >>> 0
    }
    function hex8(n) { var x = (n >>> 0).toString(16); while (x.length < 8) x = "0" + x; return x }
    return hex8(h1) + hex8(h2)
  }
  function localSafeString(r, name) { try { return r.getString(name) } catch (_) { return "" } }
  function localSafeBool(r, name) { try { return !!r.getBool(name) } catch (_) { return false } }
  function localSafeNumber(r, name) { try { return Number(r.get(name) || 0) || 0 } catch (_) { return 0 } }
  function localItemFromRecord(rec) {
    return {
      jobId: rec.getString("task_id"),
      taskId: rec.getString("rh_task_id"),
      status: rec.getString("status"),
      page: rec.getString("page"),
      prompt: rec.getString("prompt"),
      resultUrl: rec.getString("result_url"),
      errorMessage: rec.getString("error_message"),
      rating: localSafeNumber(rec, "rating"),
      favorite: localSafeBool(rec, "favorite"),
      category: localSafeString(rec, "category"),
      note: localSafeString(rec, "note"),
      created: rec.getString("created"),
      updated: rec.getString("updated"),
      model: rec.getString("model_name"),
      consumeMoney: localSafeString(rec, "consume_money"),
      consumeCoins: localSafeString(rec, "consume_coins"),
      taskCostTime: localSafeString(rec, "task_cost_time"),
      thirdPartyConsumeMoney: localSafeString(rec, "third_party_consume_money"),
    }
  }
  function localIsRhAuthErr(raw) {
    var s = String(raw || "")
    return s.indexOf("APIKEY_USER_NOT_FOUND") >= 0 || s.indexOf("APIKEY_INVALID") >= 0 || s.indexOf("TOKEN_INVALID") >= 0
      || s.indexOf("user not exist") >= 0 || s.indexOf('"code":301') >= 0
      || s.indexOf('"errorCode":"806"') >= 0 || s.indexOf('"errorCode":"412"') >= 0
  }
  function localNormalizeOutputUrl(rawUrl) {
    if (!rawUrl) return rawUrl
    var u = String(rawUrl)
    var idx = u.indexOf("myqcloud.com/")
    if (idx >= 0) u = "https://rh-images.xiaoyaoyou.com/" + u.substring(idx + "myqcloud.com/".length)
    var qIdx = u.indexOf("?"); var path = qIdx >= 0 ? u.substring(0, qIdx) : u; var query = qIdx >= 0 ? u.substring(qIdx) : ""
    try { path = encodeURI(decodeURI(path)) } catch (_) {}
    return path + query
  }
  function localExtractUsage(data) {
    var u = (data && data.usage) || {}
    function s(v) { return (v === undefined || v === null) ? null : String(v) }
    return {
      consumeMoney: s(u.consumeMoney),
      consumeCoins: s(u.consumeCoins),
      taskCostTime: s(u.taskCostTime),
      thirdPartyConsumeMoney: s(u.thirdPartyConsumeMoney),
    }
  }
  // 懒对账: 关页/刷新期间没有浏览器在 poll 时, /jobs/{jobId}/poll (唯一写终态的地方) 就没人调用,
  // aigc_tasks 记录会永远停在 running —— 哪怕 RH 那边任务早就跑完了。这里在用户自己打开历史列表时,
  // 用他自己请求带的 key 顺带把 stale running 记录的真实终态补上, 逻辑跟 /jobs/{jobId}/poll 完全一致
  // (成功查usage/结果URL, 失败查errorMessage), 避免记录变成永远转圈的幽灵。
  // 只处理本页 status=="running" 且 updated 超过 30s 的记录, 最多 3 条 (串行请求 RH), 防止一页里
  // 混进很多 stale 记录时拖慢 /history 响应 —— 没处理到的等下次打开历史 (或 resumeAigcJob) 再对账。
  // RH /query 对已被清理/过期的任务不会返回 status=FAILED, 而是返回错误文案 (无 status 字段)。
  // 这类记录必须写成 failed, 否则永远卡 running —— 恰恰是"隔天才回来看历史"这种最需要对账的场景。
  // 只认明确的 not-found/expired 标记, 瞬时错误 (限流/5xx 文案) 不能误判成终态。
  function localIsRhTaskGone(raw) {
    var s = String(raw || "").toLowerCase()
    return s.indexOf("task not found") >= 0 || s.indexOf("task not exist") >= 0
      || s.indexOf("task_not_found" ) >= 0 || s.indexOf("task_not_exist") >= 0
      || s.indexOf("任务不存在") >= 0 || s.indexOf("已过期") >= 0 || s.indexOf("task expired") >= 0
  }
  function localReconcileStaleRunning(records, key) {
    if (!key) return
    var allowedModels = {{AIGC_ALLOWED_MODELS}}
    var handled = 0
    for (var i = 0; i < records.length && handled < 3; i++) {
      var rec = records[i]
      try {
        if (rec.getString("status") !== "running") continue
        var rhTaskId = rec.getString("rh_task_id")
        if (!rhTaskId) continue
        // PB autodate 字符串是 "2006-01-02 15:04:05.000Z" (空格分隔, 非 ISO); Goja 的 Date 不保证
        // 能解析这种格式, 必须先归一化成 ISO。解析失败按 stale 处理 (fail-open, 最坏多查一次 RH),
        // 绝不能按"跳过"处理 —— 否则解析一旦失败, 懒对账整体静默失效。
        var updatedMs = NaN
        try { updatedMs = new Date(String(rec.getString("updated") || "").replace(" ", "T")).getTime() } catch (_) {}
        if (!isNaN(updatedMs) && Date.now() - updatedMs < 30000) continue
        handled++

        var res = $http.send({
          url: "https://www.runninghub.cn/openapi/v2/query", method: "POST",
          headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: rhTaskId }), timeout: 15,
        })
        var rawBody = (res && typeof res.raw === "string") ? res.raw : ""
        if (localIsRhAuthErr(rawBody)) continue // 登录态过期留给用户主动操作时再报 412, 这里不动记录
        if (!res || res.statusCode < 200 || res.statusCode >= 300) continue
        var data = null; try { data = JSON.parse(rawBody) } catch (_) {}
        if (!data) continue

        var taskStatus = String(data.status || "RUNNING").toUpperCase()
        if (taskStatus !== "SUCCESS" && taskStatus !== "FAILED" && taskStatus !== "CANCEL") {
          // RH 端任务已不存在/过期 → 写 failed 终态, 不再让它永远转圈
          if (!data.status && localIsRhTaskGone(rawBody)) {
            rec.set("status", "failed")
            rec.set("error_message", String(data.errorMessage || data.msg || data.message || "任务不存在或已过期").substring(0, 4000))
            $app.save(rec)
          }
          continue
        }
        var usage = localExtractUsage(data)
        if (taskStatus === "SUCCESS") {
          var results = data.results || []
          var outUrl = ""
          for (var j = 0; j < results.length; j++) {
            var r = results[j]
            var u = (r && (r.url || r.fileUrl || r.imageUrl)) || ""
            if (!u && typeof r === "string") u = r
            if (u) { outUrl = localNormalizeOutputUrl(u); break }
          }
          if (!outUrl) continue
          rec.set("status", "success"); rec.set("result_url", outUrl.substring(0, 2048))
          rec.set("consume_money", usage.consumeMoney || ""); rec.set("consume_coins", usage.consumeCoins || "")
          rec.set("task_cost_time", usage.taskCostTime || ""); rec.set("third_party_consume_money", usage.thirdPartyConsumeMoney || "")
          $app.save(rec)
        } else {
          var errMsg = String(data.errorMessage || data.errorCode || "task_failed")
          rec.set("status", "failed"); rec.set("error_message", errMsg.substring(0, 4000))
          rec.set("consume_money", usage.consumeMoney || ""); rec.set("consume_coins", usage.consumeCoins || "")
          rec.set("task_cost_time", usage.taskCostTime || ""); rec.set("third_party_consume_money", usage.thirdPartyConsumeMoney || "")
          $app.save(rec)
        }
      } catch (_) { /* 单条对账失败不影响其它记录 / 主流程, 保持 running 下次再试 */ }
    }
  }
  try {
    var userId = localKeyFingerprint(localReadKey(e))
    if (!userId) return e.json(200, { ok: true, items: [], page: 1, perPage: 0 })
    var body = {}
    try { body = e.requestInfo().body || {} } catch (_) {}
    var query = {}
    try { query = e.requestInfo().query || {} } catch (_) {}
    var page = parseInt(String(body.page || query.page || "1"), 10); if (!page || page < 1) page = 1
    var perPage = parseInt(String(body.perPage || query.perPage || "20"), 10); if (!perPage || perPage < 1) perPage = 20
    if (perPage > 100) perPage = 100

    var filters = ["rh_user_id = {:uid}"]
    var params = { uid: userId }
    var modelName = String(body.model || query.model || "").trim()
    if (modelName) { filters.push("model_name = {:m}"); params.m = modelName }
    if (body.favorite === true || body.favorite === "true") filters.push("favorite = true")
    if (body.status) { filters.push("status = {:status}"); params.status = String(body.status) }
    if (body.category) { filters.push("category = {:category}"); params.category = String(body.category).substring(0, 32) }
    var minRating = parseInt(String(body.minRating || "0"), 10)
    if (minRating > 0) { filters.push("rating >= {:minRating}"); params.minRating = minRating }
    var sort = "-created"
    if (body.sort === "oldest") sort = "created"
    if (body.sort === "rating") sort = "-rating,-created"
    if (body.sort === "favorite") sort = "-favorite,-created"

    var records = []
    try {
      records = $app.findRecordsByFilter("aigc_tasks", filters.join(" && "), sort, perPage, (page - 1) * perPage, params) || []
    } catch (_) { records = [] }

    localReconcileStaleRunning(records, localReadKey(e))

    var items = []
    for (var i = 0; i < records.length; i++) items.push(localItemFromRecord(records[i]))
    return e.json(200, { ok: true, items: items, page: page, perPage: perPage })
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "aigc_history_error", message: msg, fingerprint: msg.substring(0, 80) })
  }
})

routerAdd("POST", "/api/aigc/history/{jobId}/update", function (e) {
  function localReadKey(ev) {
    try { var h = ev.requestInfo().headers || {}; var k = h["x_rh_api_key"] || h["X-Rh-Api-Key"] || h["x-rh-api-key"] || ""; if (k) return String(k) } catch (_) {}
    return $os.getenv("RH_API_KEY") || ""
  }
  function localKeyFingerprint(k) {
    var s = String(k || "")
    if (!s) return ""
    var h1 = 0x811c9dc5 >>> 0, h2 = 0x1000193 >>> 0
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i)
      h1 = ((h1 ^ c) >>> 0); h1 = (h1 * 16777619) >>> 0
      h2 = ((h2 + c) >>> 0); h2 = (h2 * 2246822519) >>> 0
    }
    function hex8(n) { var x = (n >>> 0).toString(16); while (x.length < 8) x = "0" + x; return x }
    return hex8(h1) + hex8(h2)
  }
  function localSafeString(r, name) { try { return r.getString(name) } catch (_) { return "" } }
  function localSafeBool(r, name) { try { return !!r.getBool(name) } catch (_) { return false } }
  function localSafeNumber(r, name) { try { return Number(r.get(name) || 0) || 0 } catch (_) { return 0 } }
  function localItemFromRecord(rec) {
    return {
      jobId: rec.getString("task_id"),
      taskId: rec.getString("rh_task_id"),
      status: rec.getString("status"),
      page: rec.getString("page"),
      prompt: rec.getString("prompt"),
      resultUrl: rec.getString("result_url"),
      errorMessage: rec.getString("error_message"),
      rating: localSafeNumber(rec, "rating"),
      favorite: localSafeBool(rec, "favorite"),
      category: localSafeString(rec, "category"),
      note: localSafeString(rec, "note"),
      created: rec.getString("created"),
      updated: rec.getString("updated"),
      model: rec.getString("model_name"),
      consumeMoney: localSafeString(rec, "consume_money"),
      consumeCoins: localSafeString(rec, "consume_coins"),
      taskCostTime: localSafeString(rec, "task_cost_time"),
      thirdPartyConsumeMoney: localSafeString(rec, "third_party_consume_money"),
    }
  }
  try {
    var userId = localKeyFingerprint(localReadKey(e))
    if (!userId) return e.json(412, { error: "rh_login_required", message: "请用右上角按钮登录 RunningHub" })
    var jobId = e.request.pathValue("jobId")
    var rec = null
    try { rec = $app.findFirstRecordByFilter("aigc_tasks", "task_id = {:tid} && rh_user_id = {:uid}", { tid: jobId, uid: userId }) } catch (_) {}
    if (!rec) return e.json(404, { error: "history_not_found", message: "记录不存在或已删除" })
    var body = {}
    try { body = e.requestInfo().body || {} } catch (_) {}
    if (body.rating !== undefined) {
      var rating = Number(body.rating || 0)
      if (rating < 0 || rating > 5 || Math.floor(rating) !== rating) return e.json(400, { error: "invalid_rating", message: "评分必须是 1-5, 或 0 表示清空" })
      rec.set("rating", rating)
    }
    if (body.favorite !== undefined) rec.set("favorite", !!body.favorite)
    if (body.category !== undefined) rec.set("category", String(body.category || "").substring(0, 32))
    if (body.note !== undefined) rec.set("note", String(body.note || "").substring(0, 1000))
    $app.save(rec)
    return e.json(200, { ok: true, item: localItemFromRecord(rec) })
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "aigc_history_update_error", message: msg, fingerprint: msg.substring(0, 80) })
  }
})

routerAdd("POST", "/api/aigc/history/{jobId}/delete", function (e) {
  function localReadKey(ev) {
    try { var h = ev.requestInfo().headers || {}; var k = h["x_rh_api_key"] || h["X-Rh-Api-Key"] || h["x-rh-api-key"] || ""; if (k) return String(k) } catch (_) {}
    return $os.getenv("RH_API_KEY") || ""
  }
  function localKeyFingerprint(k) {
    var s = String(k || "")
    if (!s) return ""
    var h1 = 0x811c9dc5 >>> 0, h2 = 0x1000193 >>> 0
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i)
      h1 = ((h1 ^ c) >>> 0); h1 = (h1 * 16777619) >>> 0
      h2 = ((h2 + c) >>> 0); h2 = (h2 * 2246822519) >>> 0
    }
    function hex8(n) { var x = (n >>> 0).toString(16); while (x.length < 8) x = "0" + x; return x }
    return hex8(h1) + hex8(h2)
  }
  try {
    var userId = localKeyFingerprint(localReadKey(e))
    if (!userId) return e.json(412, { error: "rh_login_required", message: "请用右上角按钮登录 RunningHub" })
    var jobId = e.request.pathValue("jobId")
    var rec = null
    try { rec = $app.findFirstRecordByFilter("aigc_tasks", "task_id = {:tid} && rh_user_id = {:uid}", { tid: jobId, uid: userId }) } catch (_) {}
    if (!rec) return e.json(404, { error: "history_not_found", message: "记录不存在或已删除" })
    $app.delete(rec)
    return e.json(200, { ok: true, deleted: true, jobId: jobId })
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "aigc_history_delete_error", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
