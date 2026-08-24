// pb_hooks/_lib/crud.js — 统一守卫 CRUD 路由工厂
//
// 用法 (在 .pb.js 中):
//   const crud = require(`${__hooks}/_lib/crud.js`)
//   crud.register({ name: "transcripts", roles: {...}, ... })
//
// 所有路由自动: 登录校验 / tenant 校验 / 角色校验 / 数据范围 / 写操作审计。

const g = require(`${__hooks}/_lib/guards.js`)

const SAFE_SORT_RE = /^[A-Za-z0-9_+\-, ]*$/
const SAFE_ID_RE = /^[A-Za-z0-9_-]+$/

function normalizeSort(value) {
  const raw = String(value || "-created")
  if (!SAFE_SORT_RE.test(raw)) return "-created"
  return raw
}

function sanitizeFilterValue(value, max) {
  const text = String(value === undefined || value === null ? "" : value)
  return text.slice(0, max || 200)
}

function jsonToPlain(obj) {
  // goja 的 JSONMap 需要 get() 访问; 转成普通 JS 对象
  if (obj === null || obj === undefined) return obj
  if (typeof obj.get === "function") {
    const out = {}
    try {
      const keys = obj.keys ? obj.keys() : []
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]
        out[k] = jsonToPlain(obj.get(k))
      }
    } catch (_) {}
    return out
  }
  if (Array.isArray(obj)) return obj.map((x) => jsonToPlain(x))
  if (typeof obj === "object") {
    const out = {}
    for (const k of Object.keys(obj)) out[k] = jsonToPlain(obj[k])
    return out
  }
  return obj
}

function setField(record, name, value, spec) {
  if (value === undefined || value === null) {
    if (spec && spec.required) record.set(name, "")
    return
  }
  const type = (spec && spec.type) || "text"
  switch (type) {
    case "text":
      record.set(name, sanitizeFilterValue(value, (spec && spec.max) || 2000))
      break
    case "number": {
      const n = Number(value)
      record.set(name, Number.isFinite(n) ? n : 0)
      break
    }
    case "bool":
      record.set(name, Boolean(value))
      break
    case "date":
      record.set(name, sanitizeFilterValue(value, 40))
      break
    case "relation":
      record.set(name, sanitizeFilterValue(value, 40))
      break
    case "json": {
      try {
        record.set(name, jsonToPlain(value))
      } catch (_) {
        record.set(name, {})
      }
      break
    }
    default:
      record.set(name, sanitizeFilterValue(value, 2000))
  }
}

function totalCount(name, filter, params) {
  try {
    const q = $app.db().newQuery("SELECT count(*) as c FROM `" + name + "` WHERE " + filter).bind(params || {})
    const row = q.one({ c: 0 })
    const n = Number(row && row.get ? row.get("c") : row && row.c)
    return Number.isFinite(n) ? n : 0
  } catch (_) {
    return -1
  }
}

function handleList(e, config) {
  try {
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, config.roles.list || [])

    const query = e.requestInfo().query || {}
    const page = parseInt(String(query.page || "1"), 10) || 1
    const perPageRaw = parseInt(String(query.perPage || "50"), 10) || 50
    const perPage = Math.min(Math.max(perPageRaw, 1), 500)
    const sort = normalizeSort(query.sort)

    const scope = g.buildScopeFilter(e, ctx, config.scope || {})
    const parts = []
    const params = {}
    for (const k of Object.keys(scope.params)) params[k] = scope.params[k]
    if (scope.filter) parts.push(scope.filter)

    // 查询过滤白名单
    const filters = config.filters || []
    for (let i = 0; i < filters.length; i++) {
      const f = filters[i]
      const v = query[f]
      if (v === undefined || v === null || v === "") continue
      const key = "qf" + i
      parts.push(f + " = {:" + key + "}")
      // bool 过滤值转布尔 (如 enabled=true)
      if (v === "true" || v === "false") {
        params[key] = v === "true"
      } else {
        params[key] = sanitizeFilterValue(v, 200)
      }
    }

    // 自定义过滤器 (如 asr_jobs 的 active=1)
    const filterMap = config.filterMap || {}
    for (const fk of Object.keys(filterMap)) {
      const v = query[fk]
      if (v === undefined || v === null || v === "") continue
      const built = filterMap[fk](v, e, ctx)
      if (built && built.filter) {
        parts.push(built.filter)
        for (const pk of Object.keys(built.params || {})) params[pk] = built.params[pk]
      }
    }

    const filter = parts.length > 0 ? parts.join(" && ") : "id != ''"
    const records = $app.findRecordsByFilter(config.name, filter, sort, perPage, (page - 1) * perPage, params)
    const items = []
    for (let i = 0; i < records.length; i++) items.push(records[i].publicExport())
    const total = totalCount(config.name, filter, params)
    return e.json(200, { items, page, perPage, totalItems: total >= 0 ? total : items.length })
  } catch (err) {
    return respondError(e, err)
  }
}

function handleGet(e, config) {
  try {
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, config.roles.view || [])
    const id = String(e.request.pathValue("id") || "")
    if (!SAFE_ID_RE.test(id)) throw new NotFoundError("记录不存在")
    let rec = null
    try {
      rec = $app.findRecordById(config.name, id)
    } catch (_) {
      rec = null
    }
    if (!rec) throw new NotFoundError("记录不存在")
    g.assertVisible(e, ctx, rec, config.scope || {})
    return e.json(200, rec.publicExport())
  } catch (err) {
    return respondError(e, err)
  }
}

function handleCreate(e, config) {
  try {
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, config.roles.create || [])

    const body = e.requestInfo().body || {}

    // 幂等键 (如 audio_files.object_key)
    if (config.idempotentKey) {
      const keyVal = sanitizeFilterValue(body[config.idempotentKey], 400)
      if (keyVal) {
        let existing = null
        try {
          existing = $app.findFirstRecordByFilter(
            config.name,
            config.idempotentKey + " = {:k}",
            { k: keyVal },
          )
        } catch (_) {
          existing = null
        }
        if (existing) {
          g.assertVisible(e, ctx, existing, config.scope || {})
          return e.json(200, { duplicate: true, item: existing.publicExport() })
        }
      }
    }

    if (config.onCreate) {
      const override = config.onCreate(body, ctx, e)
      if (override && override === "skip") return e.json(200, { skipped: true })
    }

    const collection = $app.findCollectionByNameOrId(config.name)
    const rec = new Record(collection)
    // tenant 一律来自认证上下文, 忽略请求体
    rec.set("tenant", ctx.tenantId)
    const fields = config.fields || {}
    for (const fname of Object.keys(fields)) {
      if (body[fname] !== undefined) setField(rec, fname, body[fname], fields[fname])
    }
    $app.save(rec)
    if (config.audit && config.audit.create) {
      g.writeAudit(e, ctx, config.audit.create, config.name, rec.id, { id: rec.id })
    }
    return e.json(200, rec.publicExport())
  } catch (err) {
    return respondError(e, err)
  }
}

function handleUpdate(e, config) {
  try {
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, config.roles.update || [])
    const id = String(e.request.pathValue("id") || "")
    if (!SAFE_ID_RE.test(id)) throw new NotFoundError("记录不存在")
    let rec = null
    try {
      rec = $app.findRecordById(config.name, id)
    } catch (_) {
      rec = null
    }
    if (!rec) throw new NotFoundError("记录不存在")
    g.assertVisible(e, ctx, rec, config.scope || {})

    const body = e.requestInfo().body || {}
    const fields = config.fields || {}
    for (const fname of Object.keys(fields)) {
      if (body[fname] !== undefined) setField(rec, fname, body[fname], fields[fname])
    }
    // tenant 不可由请求修改
    if (config.tenantLocked !== false) rec.set("tenant", ctx.tenantId)
    $app.save(rec)
    if (config.audit && config.audit.update) {
      g.writeAudit(e, ctx, config.audit.update, config.name, rec.id, { id: rec.id })
    }
    return e.json(200, rec.publicExport())
  } catch (err) {
    return respondError(e, err)
  }
}

function handleDelete(e, config) {
  try {
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, config.roles.delete || [])
    const id = String(e.request.pathValue("id") || "")
    if (!SAFE_ID_RE.test(id)) throw new NotFoundError("记录不存在")
    let rec = null
    try {
      rec = $app.findRecordById(config.name, id)
    } catch (_) {
      rec = null
    }
    if (!rec) throw new NotFoundError("记录不存在")
    g.assertVisible(e, ctx, rec, config.scope || {})
    if (config.beforeDelete) {
      config.beforeDelete(e, ctx, rec)
    }
    $app.delete(rec)
    if (config.audit && config.audit.delete) {
      g.writeAudit(e, ctx, config.audit.delete, config.name, id, { id })
    }
    return e.json(200, { ok: true })
  } catch (err) {
    return respondError(e, err)
  }
}

function respondError(e, err) {
  const status = Number(err && err.status) || 500
  const message = String((err && err.message) || err || "操作失败").slice(0, 300)
  const code = String((err && err.code) || "error").slice(0, 80)
  return e.json(status >= 400 && status <= 599 ? status : 500, { error: code || "error", message })
}

module.exports = {
  handlers: {
    list: handleList,
    get: handleGet,
    create: handleCreate,
    update: handleUpdate,
    delete: handleDelete,
  },
  helpers: {
    setField,
    jsonToPlain,
    sanitizeFilterValue,
    respondError,
    SAFE_ID_RE,
  },
}
