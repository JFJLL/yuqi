/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/learning.pb.js — 培训中心员工端安全业务闭环
//
// GET  /api/yuqi/employee/learning-tasks              获取员工培训任务列表
// GET  /api/yuqi/employee/learning-tasks/{id}         获取课程与章节内容
// POST /api/yuqi/employee/learning-tasks/{id}/progress 提交章节学习进度
// GET  /api/yuqi/employee/learning-tasks/{id}/exam     获取安全试卷 (无正确答案)
// POST /api/yuqi/employee/learning-tasks/{id}/exam/submit 服务端阅卷与提交
// GET  /api/yuqi/employee/learning-tasks/{id}/exam/attempts 历史作答记录

routerAdd("GET", "/api/yuqi/employee/learning-tasks", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const ctx = g.requireAuth(e)
    const empId = String(ctx.user.get("employee") || "")
    if (!empId) throw new ForbiddenError("当前账号未关联员工档案")

    const filter = ctx.tenantId
      ? "employee = {:emp} && (tenant = {:tenant} || tenant = '')"
      : "employee = {:emp}"
    const params = ctx.tenantId ? { emp: empId, tenant: ctx.tenantId } : { emp: empId }
    const tasks = $app.findRecordsByFilter("learning_tasks", filter, "-created", 100, 0, params)

    const result = tasks.map((task) => {
      let course = null
      try { course = $app.findRecordById("learning_courses", String(task.get("course") || "")) } catch (_) {}

      let progress = null
      try {
        progress = $app.findFirstRecordByFilter(
          "learning_progress",
          "task = {:t} && employee = {:e}",
          { t: task.id, e: empId }
        )
      } catch (_) {}

      let latestAttempt = null
      try {
        const attempts = $app.findRecordsByFilter(
          "learning_attempts",
          "task = {:t} && employee = {:e}",
          "-submitted_at",
          1,
          0,
          { t: task.id, e: empId }
        )
        if (attempts.length > 0) latestAttempt = attempts[0]
      } catch (_) {}

      return {
        id: task.id,
        courseId: task.get("course"),
        courseTitle: course ? course.get("title") : "合规培训课程",
        category: course ? course.get("category") : "合规规范",
        summary: course ? course.get("summary") : "",
        coverUrl: course ? course.get("cover_url") : "",
        dueDate: task.get("due_date"),
        status: task.get("status") || "PENDING",
        passRequired: Boolean(task.get("pass_required")),
        progressPercent: progress ? Number(progress.get("progress_percent") || 0) : (task.get("status") === "COMPLETED" ? 100 : 0),
        lastExamScore: latestAttempt ? Number(latestAttempt.get("score") || 0) : null,
        lastExamPassed: latestAttempt ? Boolean(latestAttempt.get("passed")) : null,
        created: task.get("created"),
      }
    })

    return e.json(200, { items: result })
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "load_tasks_failed", message: String((err && err.message) || err) })
  }
})

routerAdd("GET", "/api/yuqi/employee/learning-tasks/{id}", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const ctx = g.requireAuth(e)
    const taskId = e.request.pathValue("id")
    const task = $app.findRecordById("learning_tasks", taskId)
    if (!task) throw new NotFoundError("任务不存在")
    if (String(task.get("tenant") || "") !== ctx.tenantId) throw new NotFoundError("任务不存在")

    const empId = String(ctx.user.get("employee") || "")
    if (ctx.roleCode === "EMPLOYEE" && String(task.get("employee") || "") !== empId) {
      throw new ForbiddenError("无权查看他人培训任务")
    }

    const courseId = String(task.get("course") || "")
    const course = $app.findRecordById("learning_courses", courseId)

    const units = $app.findRecordsByFilter(
      "learning_course_units",
      "course = {:c}",
      "sort_order",
      100,
      0,
      { c: courseId }
    )

    let progress = null
    try {
      progress = $app.findFirstRecordByFilter(
        "learning_progress",
        "task = {:t} && employee = {:e}",
        { t: task.id, e: empId }
      )
    } catch (_) {}

    return e.json(200, {
      task: {
        id: task.id,
        status: task.get("status"),
        dueDate: task.get("due_date"),
        passRequired: Boolean(task.get("pass_required")),
      },
      course: {
        id: course.id,
        title: course.get("title"),
        category: course.get("category"),
        summary: course.get("summary"),
        coverUrl: course.get("cover_url"),
      },
      units: units.map((u) => ({
        id: u.id,
        title: u.get("title"),
        contentType: u.get("content_type") || "text",
        content: u.get("content"),
        durationSeconds: Number(u.get("duration_seconds") || 300),
        sortOrder: Number(u.get("sort_order") || 1),
      })),
      progress: progress ? {
        progressPercent: Number(progress.get("progress_percent") || 0),
        completedUnits: progress.get("completed_units") || [],
        status: progress.get("status"),
      } : null,
    })
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "load_task_detail_failed", message: String((err && err.message) || err) })
  }
})

routerAdd("POST", "/api/yuqi/employee/learning-tasks/{id}/progress", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const AH = require(`${__hooks}/_lib/auth-helpers.js`)
    const ctx = g.requireAuth(e)
    const taskId = e.request.pathValue("id")
    const task = $app.findRecordById("learning_tasks", taskId)
    if (!task) throw new NotFoundError("任务不存在")
    if (String(task.get("tenant") || "") !== ctx.tenantId) throw new NotFoundError("任务不存在")

    const empId = String(ctx.user.get("employee") || "")
    if (ctx.roleCode === "EMPLOYEE" && String(task.get("employee") || "") !== empId) {
      throw new ForbiddenError("无权操作他人培训任务")
    }

    const body = e.requestInfo().body || {}
    const completedUnitId = String(body.completedUnitId || body.unitId || "").trim()
    const courseId = String(task.get("course") || "")

    if (!completedUnitId) throw new BadRequestError("缺少 completedUnitId")

    // 严格校验章节真实性与课程归属
    let validUnit = null
    try {
      validUnit = $app.findRecordById("learning_course_units", completedUnitId)
    } catch (_) {}
    if (!validUnit || String(validUnit.get("course") || "") !== courseId) {
      throw new BadRequestError("章节不存在或不属于该课程")
    }

    const totalUnits = $app.findRecordsByFilter("learning_course_units", "course = {:c}", "", 200, 0, { c: courseId }).length

    let progress = null
    try {
      progress = $app.findFirstRecordByFilter("learning_progress", "task = {:t} && employee = {:e}", { t: task.id, e: empId })
    } catch (_) {}

    const progColl = $app.findCollectionByNameOrId("learning_progress")
    if (!progress) {
      progress = new Record(progColl)
      progress.set("tenant", ctx.tenantId)
      progress.set("task", task.id)
      progress.set("course", courseId)
      progress.set("employee", empId)
      progress.set("completed_units", JSON.stringify([]))
    }

    let completedUnits = []
    try {
      const raw = progress.get("completed_units")
      completedUnits = typeof raw === "string" ? JSON.parse(raw || "[]") : (Array.isArray(raw) ? raw : [])
    } catch (_) {
      completedUnits = []
    }

    if (completedUnitId && !completedUnits.includes(completedUnitId)) {
      completedUnits.push(completedUnitId)
    }

    const total = Math.max(1, totalUnits)
    const percent = Math.min(100, Math.round((completedUnits.length / total) * 100))
    progress.set("completed_units", JSON.stringify(completedUnits))
    progress.set("progress_percent", percent)
    if (completedUnitId) progress.set("last_unit", completedUnitId)

    if (percent >= 100) {
      progress.set("status", "COMPLETED")
      progress.set("completed_at", AH.pbDate())
    } else {
      progress.set("status", "IN_PROGRESS")
    }
    $app.save(progress)

    return e.json(200, {
      ok: true,
      progressPercent: percent,
      completedCount: completedUnits.length,
      totalUnits: total,
      status: progress.get("status"),
    })
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "update_progress_failed", message: String((err && err.message) || err) })
  }
})

routerAdd("GET", "/api/yuqi/employee/learning-tasks/{id}/exam", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const AH = require(`${__hooks}/_lib/auth-helpers.js`)
    const ctx = g.requireAuth(e)
    const taskId = e.request.pathValue("id")
    const task = $app.findRecordById("learning_tasks", taskId)
    if (!task) throw new NotFoundError("任务不存在")
    if (String(task.get("tenant") || "") !== ctx.tenantId) throw new NotFoundError("任务不存在")

    const empId = String(ctx.user.get("employee") || "")
    if (ctx.roleCode === "EMPLOYEE" && String(task.get("employee") || "") !== empId) {
      throw new ForbiddenError("无权查看他人考试")
    }

    const courseId = String(task.get("course") || "")
    let exam = null
    try {
      exam = $app.findFirstRecordByFilter("learning_exams", "course = {:c}", { c: courseId })
    } catch (_) {}
    if (!exam) throw new NotFoundError("该课程未配置结业考试")

    const maxAttempts = Number(exam.get("max_attempts") || 3)
    const previousAttempts = $app.findRecordsByFilter(
      "learning_attempts",
      "task = {:t} && employee = {:e} && (status = 'SUBMITTED' || passed = true)",
      "-submitted_at",
      50,
      0,
      { t: task.id, e: empId }
    )
    if (previousAttempts.length >= maxAttempts) {
      throw new BadRequestError("已达到考试最大尝试次数限制 (" + maxAttempts + " 次)")
    }

    const questions = $app.findRecordsByFilter(
      "learning_questions",
      "exam = {:exam}",
      "sort_order",
      100,
      0,
      { exam: exam.id }
    )

    // 创建/获取不可变试卷版本快照
    const versionNum = Number(exam.get("current_version") || 1)
    let examVersion = null
    try {
      examVersion = $app.findFirstRecordByFilter("learning_exam_versions", "exam = {:exam} && version_number = {:v}", { exam: exam.id, v: versionNum })
    } catch (_) {}
    if (!examVersion) {
      const verColl = $app.findCollectionByNameOrId("learning_exam_versions")
      examVersion = new Record(verColl)
      examVersion.set("tenant", ctx.tenantId)
      examVersion.set("exam", exam.id)
      examVersion.set("version_number", versionNum)
      const snapshot = questions.map((q) => ({
        id: q.id,
        stem: q.get("stem"),
        type: q.get("type") || q.get("question_type") || "SINGLE",
        options: q.get("options_json"),
        answer: q.get("answer") || q.get("standard_answer"),
        score: Number(q.get("score") || 10),
        explanation: q.get("explanation") || q.get("analysis") || "",
      }))
      examVersion.set("snapshot_json", JSON.stringify(snapshot))
      $app.save(examVersion)
    }

    const timeLimitMinutes = Number(exam.get("time_limit_minutes") || 30)
    const startedAt = AH.pbDate()
    const expiresAt = new Date(Date.now() + timeLimitMinutes * 60 * 1000).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z")

    // 创建/获取当前进行中的作答会话
    let activeAttempt = null
    try {
      activeAttempt = $app.findFirstRecordByFilter(
        "learning_attempts",
        "task = {:t} && employee = {:e} && status = 'IN_PROGRESS'",
        { t: task.id, e: empId }
      )
    } catch (_) {}

    if (!activeAttempt) {
      const attColl = $app.findCollectionByNameOrId("learning_attempts")
      activeAttempt = new Record(attColl)
      activeAttempt.set("tenant", ctx.tenantId)
      activeAttempt.set("task", task.id)
      activeAttempt.set("exam", exam.id)
      activeAttempt.set("exam_version", examVersion.id)
      activeAttempt.set("employee", empId)
      activeAttempt.set("status", "IN_PROGRESS")
      activeAttempt.set("started_at", startedAt)
      activeAttempt.set("expires_at", expiresAt)
      activeAttempt.set("answers_json", "{}")
      $app.save(activeAttempt)
    }

    // 安全脱敏：绝不向下发正确答案或解析
    const safeQuestions = questions.map((q) => {
      let opts = []
      try {
        const raw = q.get("options_json")
        opts = typeof raw === "string" ? JSON.parse(raw || "[]") : (Array.isArray(raw) ? raw : [])
      } catch (_) {
        opts = []
      }
      return {
        id: q.id,
        stem: q.get("stem"),
        questionType: q.get("type") || q.get("question_type") || "SINGLE",
        options: opts,
        score: Number(q.get("score") || 10),
        sortOrder: Number(q.get("sort_order") || 1),
      }
    })

    return e.json(200, {
      attemptId: activeAttempt.id,
      examId: exam.id,
      title: exam.get("title"),
      passScore: Number(exam.get("pass_score") || 80),
      timeLimitMinutes,
      startedAt: activeAttempt.get("started_at") || startedAt,
      expiresAt: activeAttempt.get("expires_at") || expiresAt,
      maxAttempts,
      usedAttempts: previousAttempts.length,
      remainingAttempts: Math.max(0, maxAttempts - previousAttempts.length),
      questions: safeQuestions,
    })
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "load_exam_failed", message: String((err && err.message) || err) })
  }
})

routerAdd("POST", "/api/yuqi/employee/learning-tasks/{id}/exam/submit", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const AH = require(`${__hooks}/_lib/auth-helpers.js`)
    const ctx = g.requireAuth(e)
    const taskId = e.request.pathValue("id")
    const task = $app.findRecordById("learning_tasks", taskId)
    if (!task) throw new NotFoundError("任务不存在")
    if (String(task.get("tenant") || "") !== ctx.tenantId) throw new NotFoundError("任务不存在")

    const empId = String(ctx.user.get("employee") || "")
    if (ctx.roleCode === "EMPLOYEE" && String(task.get("employee") || "") !== empId) {
      throw new ForbiddenError("无权代他人提交考试")
    }

    const courseId = String(task.get("course") || "")
    let exam = null
    try {
      exam = $app.findFirstRecordByFilter("learning_exams", "course = {:c}", { c: courseId })
    } catch (_) {}
    if (!exam) throw new NotFoundError("结业考试不存在")

    const maxAttempts = Number(exam.get("max_attempts") || 3)
    const prevAttempts = $app.findRecordsByFilter(
      "learning_attempts",
      "task = {:t} && employee = {:e} && status = 'SUBMITTED'",
      "",
      50,
      0,
      { t: task.id, e: empId }
    )
    if (prevAttempts.length >= maxAttempts) {
      throw new BadRequestError("已达到考试最大尝试次数限制 (" + maxAttempts + " 次)")
    }

    const body = e.requestInfo().body || {}
    const submittedAnswers = body.answers || {}
    const attemptId = String(body.attemptId || "").trim()

    let attempt = null
    if (attemptId) {
      try { attempt = $app.findRecordById("learning_attempts", attemptId) } catch (_) {}
    }
    if (!attempt) {
      try {
        attempt = $app.findFirstRecordByFilter(
          "learning_attempts",
          "task = {:t} && employee = {:e} && status = 'IN_PROGRESS'",
          { t: task.id, e: empId }
        )
      } catch (_) {}
    }

    if (!attempt) {
      throw new NotFoundError("未找到进行中的有效考试会话，请先获取试卷开始考试")
    }

    // 1. 归属与所有权严格校验
    if (String(attempt.get("task") || "") !== task.id || String(attempt.get("employee") || "") !== empId) {
      throw new ForbiddenError("该作答会话不属于当前员工或任务，禁止挪用")
    }
    const attTenant = String(attempt.get("tenant") || "")
    if (attTenant && attTenant !== ctx.tenantId) {
      throw new NotFoundError("作答会话不存在")
    }

    // 2. 防重复提交校验
    if (String(attempt.get("status") || "") === "SUBMITTED") {
      throw new BadRequestError("该作答会话已完成提交，禁止重复提交")
    }

    // 超时校验
    if (attempt && attempt.get("expires_at")) {
      const expTime = new Date(String(attempt.get("expires_at")).replace(" ", "T")).getTime()
      if (Number.isFinite(expTime) && Date.now() > expTime + 60000) {
        throw new BadRequestError("考试已超时，提交已被拒绝")
      }
    }

    const questions = $app.findRecordsByFilter("learning_questions", "exam = {:exam}", "sort_order", 100, 0, { exam: exam.id })
    let totalScore = 0
    const details = []

    for (const q of questions) {
      const qId = q.id
      const stdAns = String(q.get("answer") || q.get("standard_answer") || "").trim().toUpperCase()
      const empAns = String(submittedAnswers[qId] || "").trim().toUpperCase()
      const qScore = Number(q.get("score") || 10)
      const isCorrect = stdAns === empAns && empAns.length > 0
      if (isCorrect) totalScore += qScore

      details.push({
        questionId: qId,
        stem: q.get("stem"),
        userAnswer: empAns,
        correct: isCorrect,
        score: isCorrect ? qScore : 0,
        standardAnswer: stdAns,
        analysis: q.get("explanation") || q.get("analysis") || "",
      })
    }

    const passScore = Number(exam.get("pass_score") || 80)
    const passed = totalScore >= passScore

    // 写入作答记录
    if (!attempt) {
      const attColl = $app.findCollectionByNameOrId("learning_attempts")
      attempt = new Record(attColl)
      attempt.set("tenant", ctx.tenantId)
      attempt.set("task", task.id)
      attempt.set("exam", exam.id)
      attempt.set("employee", empId)
    }
    attempt.set("status", "SUBMITTED")
    attempt.set("tenant", ctx.tenantId)
    attempt.set("task", task.id)
    attempt.set("exam", exam.id)
    attempt.set("employee", empId)
    attempt.set("answers_json", JSON.stringify(submittedAnswers))
    attempt.set("score", totalScore)
    attempt.set("passed", passed)
    attempt.set("detail_json", JSON.stringify(details))
    attempt.set("submitted_at", AH.pbDate())
    $app.save(attempt)

    if (passed) {
      task.set("status", "COMPLETED")
      $app.save(task)

      try {
        const prog = $app.findFirstRecordByFilter("learning_progress", "task = {:t} && employee = {:e}", { t: task.id, e: empId })
        if (prog) {
          prog.set("status", "COMPLETED")
          prog.set("completed_at", AH.pbDate())
          $app.save(prog)
        }
      } catch (_) {}
    }

    g.writeAudit(e, ctx, "exam_submit", "learning_attempts", attempt.id, {
      taskId: task.id,
      score: totalScore,
      passed,
      attemptNumber: prevAttempts.length + 1,
    })

    return e.json(200, {
      ok: true,
      score: totalScore,
      passScore,
      passed,
      attemptNumber: prevAttempts.length + 1,
      remainingAttempts: Math.max(0, maxAttempts - prevAttempts.length - 1),
      details,
    })
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "submit_exam_failed", message: String((err && err.message) || err) })
  }
})

routerAdd("GET", "/api/yuqi/employee/learning-tasks/{id}/exam/attempts", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const ctx = g.requireAuth(e)
    const taskId = e.request.pathValue("id")
    const task = $app.findRecordById("learning_tasks", taskId)
    if (!task) throw new NotFoundError("任务不存在")
    if (String(task.get("tenant") || "") !== ctx.tenantId) throw new NotFoundError("任务不存在")

    const empId = String(ctx.user.get("employee") || "")
    if (ctx.roleCode === "EMPLOYEE" && String(task.get("employee") || "") !== empId) {
      throw new ForbiddenError("无权查看他人作答记录")
    }

    const attempts = $app.findRecordsByFilter(
      "learning_attempts",
      "task = {:t} && employee = {:e}",
      "-submitted_at",
      20,
      0,
      { t: task.id, e: empId }
    )

    return e.json(200, {
      items: attempts.map((a) => ({
        id: a.id,
        score: Number(a.get("score") || 0),
        passed: Boolean(a.get("passed")),
        submittedAt: a.get("submitted_at") || a.get("created"),
      })),
    })
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "load_attempts_failed", message: String((err && err.message) || err) })
  }
})
