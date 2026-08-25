/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/jobs.pb.js — 内部任务路由 (仅 X-Yuqi-Service-Token 可访问)
//
// POST /api/yuqi/internal/jobs/enqueue   {job_type, business_key, idempotency_key, priority, payload_json}
// POST /api/yuqi/internal/jobs/claim     {worker_id}            原子领取
// POST /api/yuqi/internal/jobs/{id}/success  {result_json}
// POST /api/yuqi/internal/jobs/{id}/retry    {error_message}
// POST /api/yuqi/internal/jobs/{id}/fail     {error_code, error_message}
// POST /api/yuqi/internal/analysis/apply    {session_id, transcript_version, analysis_version, results[]}
//
// JSVM: handler 无法访问文件级闭包, 辅助函数在 _lib/jobs-helpers.js, 由 handler 内 require。

// ---- 入队 (幂等: 同 idempotency_key 不重复创建) ----
routerAdd("POST", "/api/yuqi/internal/jobs/enqueue", (e) => {
  try {
    const JH = require(`${__hooks}/_lib/jobs-helpers.js`)
    const svc = JH.requireService(e)
    const body = e.requestInfo().body || {}
    const jobType = String(body.job_type || "").trim()
    const idemKey = String(body.idempotency_key || "").trim()
    if (!jobType || !idemKey) throw new BadRequestError("job_type 与 idempotency_key 必填")
    if (jobType.length > 40 || idemKey.length > 160) throw new BadRequestError("参数过长")

    let existing = null
    try {
      existing = $app.findFirstRecordByFilter("processing_jobs", "idempotency_key = {:k}", { k: idemKey })
    } catch (_) {
      existing = null
    }
    if (existing) {
      const st = String(existing.get("status") || "")
      if (st === "SUCCEEDED" || st === "FAILED" || st === "CANCELLED") {
        return e.json(200, { duplicate: true, terminal: true, job: existing.publicExport() })
      }
      return e.json(200, { duplicate: true, job: existing.publicExport() })
    }

    const coll = $app.findCollectionByNameOrId("processing_jobs")
    const rec = new Record(coll)
    rec.set("tenant", svc.tenantId)
    rec.set("job_type", jobType)
    rec.set("business_key", String(body.business_key || "").slice(0, 120))
    rec.set("idempotency_key", idemKey)
    rec.set("status", "QUEUED")
    rec.set("priority", Number(body.priority) || 0)
    rec.set("attempts", 0)
    rec.set("max_attempts", Number(body.max_attempts) || 3)
    rec.set("payload_json", body.payload_json || {})
    rec.set("request_id", String(body.request_id || "").slice(0, 80))
    $app.save(rec)
    return e.json(200, { duplicate: false, job: rec.publicExport() })
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "enqueue_failed", message: String((err && err.message) || "入队失败") })
  }
})

// ---- 原子领取 ----
routerAdd("POST", "/api/yuqi/internal/jobs/claim", (e) => {
  try {
    const JH = require(`${__hooks}/_lib/jobs-helpers.js`)
    const svc = JH.requireService(e)
    const body = e.requestInfo().body || {}
    const workerId = String(body.worker_id || "worker").slice(0, 80)
    const lockMs = Number(body.lock_ms) || 300000
    const now = new Date()
    const nowStr = JH.pbDate(now)
    const cutoffStr = JH.pbDate(new Date(now.getTime() - lockMs))

    // 原子领取: 单条条件 UPDATE (SQLite 单语句原子), 避免双 worker 重复领取
    const sql = "UPDATE `processing_jobs` SET `status`='RUNNING', `locked_by`={:w}, `locked_at`={:now}, `attempts`=`attempts`+1, `started_at`={:now} WHERE `id` = (SELECT `id` FROM `processing_jobs` WHERE `tenant`={:t} AND (`status` IN ('QUEUED','RETRYING') OR (`status`='RUNNING' AND `locked_at` <= {:cutoff})) AND (`next_retry_at`='' OR `next_retry_at` <= {:now}) AND (`locked_at`='' OR `locked_at` <= {:cutoff}) ORDER BY `priority` DESC, `created` ASC LIMIT 1) AND (`status` IN ('QUEUED','RETRYING') OR (`status`='RUNNING' AND `locked_at` <= {:cutoff})) AND (`locked_at`='' OR `locked_at` <= {:cutoff})"
    const upd = $app.db().newQuery(sql).bind({ w: workerId, now: nowStr, cutoff: cutoffStr, t: svc.tenantId })
    upd.execute()

    let claimed = null
    try {
      const rows = $app.findRecordsByFilter(
        "processing_jobs",
        "tenant = {:t} && locked_by = {:w} && locked_at = {:now} && status = 'RUNNING'",
        "", 1, 0,
        { t: svc.tenantId, w: workerId, now: nowStr },
      )
      claimed = rows.length > 0 ? rows[0] : null
    } catch (_) {
      claimed = null
    }

    if (!claimed) return e.json(200, { claimed: false })
    return e.json(200, { claimed: true, job: claimed.publicExport() })
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "claim_failed", message: String((err && err.message) || "领取失败") })
  }
})

// ---- 成功 ----
routerAdd("POST", "/api/yuqi/internal/jobs/{id}/success", (e) => {
  try {
    const JH = require(`${__hooks}/_lib/jobs-helpers.js`)
    const svc = JH.requireService(e)
    const job = JH.findJob(e.request.pathValue("id"))
    if (!job) throw new NotFoundError("任务不存在")
    if (String(job.get("tenant") || "") !== svc.tenantId) throw new NotFoundError("任务不存在")
    const body = e.requestInfo().body || {}
    job.set("status", "SUCCEEDED")
    job.set("result_json", body.result_json || {})
    job.set("finished_at", JH.nowIso())
    $app.save(job)
    return e.json(200, job.publicExport())
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "job_failed", message: String((err && err.message) || "操作失败") })
  }
})

// ---- 重试 (指数退避) ----
routerAdd("POST", "/api/yuqi/internal/jobs/{id}/retry", (e) => {
  try {
    const JH = require(`${__hooks}/_lib/jobs-helpers.js`)
    const svc = JH.requireService(e)
    const job = JH.findJob(e.request.pathValue("id"))
    if (!job) throw new NotFoundError("任务不存在")
    if (String(job.get("tenant") || "") !== svc.tenantId) throw new NotFoundError("任务不存在")
    const body = e.requestInfo().body || {}
    const attempts = Number(job.get("attempts") || 0)
    const maxAttempts = Number(job.get("max_attempts") || 3)
    if (attempts >= maxAttempts) {
      job.set("status", "FAILED")
      job.set("error_code", "MAX_ATTEMPTS")
      job.set("error_message", String(body.error_message || "超过最大重试次数").slice(0, 1000))
      job.set("finished_at", JH.nowIso())
      $app.save(job)
      return e.json(200, { terminal: true, status: "FAILED", job: job.publicExport() })
    }
    // 指数退避: 2^attempts 分钟 (上限 1 小时)
    const backoffMs = Math.min(60 * 60 * 1000, Math.pow(2, Math.max(attempts - 1, 0)) * 60 * 1000)
    job.set("status", "RETRYING")
    job.set("error_code", String(body.error_code || "RETRY").slice(0, 80))
    job.set("error_message", String(body.error_message || "").slice(0, 1000))
    job.set("next_retry_at", JH.pbDate(new Date(Date.now() + backoffMs)))
    $app.save(job)
    return e.json(200, { retrying: true, next_retry_at: job.get("next_retry_at"), job: job.publicExport() })
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "job_failed", message: String((err && err.message) || "操作失败") })
  }
})

// ---- 失败 ----
routerAdd("POST", "/api/yuqi/internal/jobs/{id}/fail", (e) => {
  try {
    const JH = require(`${__hooks}/_lib/jobs-helpers.js`)
    const svc = JH.requireService(e)
    const job = JH.findJob(e.request.pathValue("id"))
    if (!job) throw new NotFoundError("任务不存在")
    if (String(job.get("tenant") || "") !== svc.tenantId) throw new NotFoundError("任务不存在")
    const body = e.requestInfo().body || {}
    job.set("status", "FAILED")
    job.set("error_code", String(body.error_code || "ERROR").slice(0, 80))
    job.set("error_message", String(body.error_message || "").slice(0, 1000))
    job.set("finished_at", JH.nowIso())
    $app.save(job)
    return e.json(200, job.publicExport())
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "job_failed", message: String((err && err.message) || "操作失败") })
  }
})

// ---- 分析结果落库 (幂等) ----
// results: [{ rule_code, rule_version, risk_level, title, summary, evidence_text,
//            start_ms, end_ms, speaker, advice, recommended_expression, segments: [...] }]
routerAdd("POST", "/api/yuqi/internal/analysis/apply", (e) => {
  try {
    const JH = require(`${__hooks}/_lib/jobs-helpers.js`)
    const svc = JH.requireService(e)
    const body = e.requestInfo().body || {}
    const sessionId = String(body.session_id || "")
    if (!sessionId) throw new BadRequestError("session_id 必填")
    let session = null
    try {
      session = $app.findRecordById("sessions", sessionId)
    } catch (_) {
      session = null
    }
    if (!session) throw new NotFoundError("会话不存在")
    if (String(session.get("tenant") || "") !== svc.tenantId) throw new NotFoundError("会话不存在")

    const transcriptVersion = Number(body.transcript_version)
    const analysisVersion = Number(body.analysis_version)
    const employeeId = String(session.get("employee") || "")
    const storeId = String(session.get("store") || "")
    const results = Array.isArray(body.results) ? body.results : []
    const created = { segments: 0, issues: 0, duplicates: 0 }

    for (let i = 0; i < results.length; i++) {
      const r = results[i] || {}
      const ruleCode = String(r.rule_code || "").slice(0, 60)
      const ruleVersion = Number(r.rule_version) || 0
      if (!ruleCode) continue

      // 幂等: 已存在同 (session, transcript_version, rule_code, analysis_version) 的问题则跳过
      let existingIssue = null
      try {
        existingIssue = $app.findFirstRecordByFilter("issues",
          "tenant = {:t} && session = {:s} && transcript_version = {:tv} && rule_code = {:rc} && analysis_version = {:av}",
          { t: svc.tenantId, s: sessionId, tv: transcriptVersion, rc: ruleCode, av: analysisVersion })
      } catch (_) {
        existingIssue = null
      }
      if (existingIssue) {
        created.duplicates++
        continue
      }

      // risk_segments (同一命中可有多段证据)
      const segRows = Array.isArray(r.segments) ? r.segments : []
      let firstSeg = null
      for (let j = 0; j < segRows.length; j++) {
        const sg = segRows[j] || {}
        let dupSeg = null
        try {
          dupSeg = $app.findFirstRecordByFilter("risk_segments",
            "tenant = {:t} && session = {:s} && transcript_version = {:tv} && rule_code = {:rc} && analysis_version = {:av} && sequence = {:seq}",
            { t: svc.tenantId, s: sessionId, tv: transcriptVersion, rc: ruleCode, av: analysisVersion, seq: Number(sg.sequence) || 0 })
        } catch (_) {
          dupSeg = null
        }
        if (dupSeg) continue
        const coll = $app.findCollectionByNameOrId("risk_segments")
        const segRec = new Record(coll)
        segRec.set("tenant", svc.tenantId)
        segRec.set("session", sessionId)
        segRec.set("transcript_version", transcriptVersion)
        segRec.set("rule_code", ruleCode)
        segRec.set("rule_version", ruleVersion)
        segRec.set("analysis_version", analysisVersion)
        segRec.set("sequence", Number(sg.sequence) || 0)
        segRec.set("start_ms", Number(sg.start_ms) || 0)
        segRec.set("end_ms", Number(sg.end_ms) || 0)
        segRec.set("speaker", String(sg.speaker || "").slice(0, 60))
        segRec.set("text", String(sg.text || "").slice(0, 5000))
        segRec.set("risk_level", String(r.risk_level || "LOW").slice(0, 20))
        segRec.set("advice", String(r.advice || "").slice(0, 2000))
        segRec.set("recommended_expression", String(r.recommended_expression || "").slice(0, 2000))
        segRec.set("evidence_json", sg.evidence || {})
        segRec.set("status", "ACTIVE")
        $app.save(segRec)
        created.segments++
        if (!firstSeg) firstSeg = segRec
      }

      // issue
      const icoll = $app.findCollectionByNameOrId("issues")
      const issueRec = new Record(icoll)
      issueRec.set("tenant", svc.tenantId)
      issueRec.set("session", sessionId)
      issueRec.set("employee", employeeId)
      issueRec.set("store", storeId)
      issueRec.set("rule_code", ruleCode)
      issueRec.set("rule_version", ruleVersion)
      issueRec.set("transcript_version", transcriptVersion)
      issueRec.set("analysis_version", analysisVersion)
      issueRec.set("risk_level", String(r.risk_level || "LOW").slice(0, 20))
      issueRec.set("title", String(r.title || ruleCode).slice(0, 200))
      issueRec.set("summary", String(r.summary || "").slice(0, 2000))
      issueRec.set("evidence_text", String(r.evidence_text || "").slice(0, 5000))
      issueRec.set("start_ms", Number(r.start_ms) || 0)
      issueRec.set("end_ms", Number(r.end_ms) || 0)
      issueRec.set("advice", String(r.advice || "").slice(0, 2000))
      issueRec.set("recommended_expression", String(r.recommended_expression || "").slice(0, 2000))
      issueRec.set("analysis_status", "SUCCEEDED")
      issueRec.set("review_status", "PENDING")
      issueRec.set("employee_visibility", "HIDDEN")
      issueRec.set("employee_view_status", "NONE")
      issueRec.set("appeal_status", "NONE")
      issueRec.set("rectification_status", "NONE")
      issueRec.set("close_status", "OPEN")
      $app.save(issueRec)
      created.issues++
    }

    return e.json(200, created)
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "analysis_apply_failed", message: String((err && err.message) || "落库失败") })
  }
})
