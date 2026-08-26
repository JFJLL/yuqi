import test from "node:test"
import assert from "node:assert/strict"
import { startPbTestServer } from "../helpers/pb-test-server.mjs"

test("Ticket 10: 培训中心课程编排、任务派发与作答考核集成测试", async (t) => {
  const server = await startPbTestServer({ envMode: "test" })
  const { req, superuserEmail, superuserPassword } = server

  t.after(async () => {
    await server.stop()
  })

  // 1. Superuser 登录
  const superAuth = await req("POST", "/api/collections/_superusers/auth-with-password", {
    identity: superuserEmail,
    password: superuserPassword,
  })
  assert.equal(superAuth.status, 200)
  const superHeaders = { Authorization: "Bearer " + superAuth.data.token }

  const tenantRes = await req("GET", "/api/collections/tenants/records", null, superHeaders)
  const tenantId = tenantRes.data.items[0]?.id || ""

  // 2. 创建测试门店与员工
  const storeRes = await req("POST", "/api/collections/stores/records", {
    name: "成都有禄店",
    code: "STORE-CD-001",
    status: "营业中",
    tenant: tenantId,
  }, superHeaders)
  const storeId = storeRes.data.id

  const empRes = await req("POST", "/api/collections/employees/records", {
    name: "郑药师",
    phone: "13200000001",
    role: "营业员",
    store: storeId,
    status: "在职",
    tenant: tenantId,
  }, superHeaders)
  const empId = empRes.data.id

  // 3. 发布课程与章节
  const courseRes = await req("POST", "/api/collections/learning_courses/records", {
    title: "高血压合并用药禁忌培训",
    category: "药学知识",
    summary: "详细解析常见降压药物相互作用与禁忌规范",
    status: "PUBLISHED",
    tenant: tenantId,
  }, superHeaders)
  assert.equal(courseRes.status, 200, "创建课程成功")
  const courseId = courseRes.data.id

  const unitRes = await req("POST", "/api/collections/learning_course_units/records", {
    course: courseId,
    title: "第一章：利尿剂与ACEI类联合禁忌",
    content_type: "text",
    content: "严禁擅自联合使用同类型高风险降压制剂，需注意监测电解质与肾功能。",
    duration_seconds: 300,
    sort_order: 1,
    tenant: tenantId,
  }, superHeaders)
  assert.equal(unitRes.status, 200, "创建章节成功")

  // 4. 从巡检问题派发培训任务
  const taskRes = await req("POST", "/api/collections/learning_tasks/records", {
    course: courseId,
    employee: empId,
    store: storeId,
    source_issue: "ISSUE-CD-01",
    due_at: "2026-09-01",
    status: "PENDING",
    tenant: tenantId,
  }, superHeaders)
  assert.equal(taskRes.status, 200, "派发培训任务成功")
  const taskId = taskRes.data.id

  // 5. 创建结业考试与试题
  const examRes = await req("POST", "/api/collections/learning_exams/records", {
    course: courseId,
    title: "高血压合并用药禁忌结业考核",
    pass_score: 80,
    max_attempts: 3,
    time_limit_minutes: 30,
    tenant: tenantId,
  }, superHeaders)
  assert.equal(examRes.status, 200, "创建考试成功")
  const examId = examRes.data.id

  const qRes = await req("POST", "/api/collections/learning_questions/records", {
    exam: examId,
    stem: "以下哪种降压药联用属于高风险禁忌？",
    type: "SINGLE",
    options_json: JSON.stringify([
      { label: "A", text: "ACEI + ARB 联合使用" },
      { label: "B", text: "CCB + ACEI 联合使用" },
      { label: "C", text: "利尿剂 + 钙拮抗剂" },
    ]),
    answer: "A",
    score: 100,
    explanation: "ACEI与ARB联用会显著增加高钾血症与肾损害风险。",
    sort_order: 1,
    tenant: tenantId,
  }, superHeaders)
  assert.equal(qRes.status, 200, "创建试题成功")
  const qId = qRes.data.id

  // 6. 员工通过微信/手机号登录获取 Employee Token
  const empLogin = await req("POST", "/api/yuqi/auth/wechat/login", {
    loginCode: "mock-code-zheng",
    phoneCode: "13200000001",
    testMock: true,
  })
  assert.equal(empLogin.status, 200, "员工登录成功")
  const empHeaders = { Authorization: "Bearer " + empLogin.data.token }

  // 7. 员工读取自己的培训任务列表
  const empTasks = await req("GET", "/api/yuqi/employee/learning-tasks", null, empHeaders)
  assert.equal(empTasks.status, 200, "获取员工任务列表成功")
  assert.equal(empTasks.data.items.length, 1)
  assert.equal(empTasks.data.items[0].id, taskId)

  // 8. 员工拉取试卷，验证绝不泄露 standard_answer 或 analysis
  const examPaper = await req("GET", "/api/yuqi/employee/learning-tasks/" + taskId + "/exam", null, empHeaders)
  assert.equal(examPaper.status, 200, "获取员工试卷成功")
  assert.equal(examPaper.data.questions.length, 1)
  assert.equal(examPaper.data.questions[0].standard_answer, undefined, "题目不包含 standard_answer")
  assert.equal(examPaper.data.questions[0].analysis, undefined, "题目不包含 analysis")

  // 8.1 负向测试：提交非法/不存在的 unitId 必须被服务端 400 拒绝
  const fakeProgressRes = await req("POST", "/api/yuqi/employee/learning-tasks/" + taskId + "/progress", {
    completedUnitId: "not-a-real-unit-123",
  }, empHeaders)
  assert.equal(fakeProgressRes.status, 400, "非法章节ID提交必须返回 400 拒绝")

  // 8.2 正常提交真实 unitId 进度
  const validProgressRes = await req("POST", "/api/yuqi/employee/learning-tasks/" + taskId + "/progress", {
    completedUnitId: unitRes.data.id,
  }, empHeaders)
  assert.equal(validProgressRes.status, 200, "真实章节ID提交成功")
  assert.equal(validProgressRes.data.progressPercent, 100, "章节全部完成进度为 100%")

  // 9. 员工提交作答，服务端自动判分
  const submitRes = await req("POST", "/api/yuqi/employee/learning-tasks/" + taskId + "/exam/submit", {
    answers: { [qId]: "A" },
    attemptId: examPaper.data.attemptId,
  }, empHeaders)
  assert.equal(submitRes.status, 200, "提交作答成功")
  assert.equal(submitRes.data.score, 100, "服务端判定为满分 100")
  assert.equal(submitRes.data.passed, true, "服务端判定为通过")

  // 9.1 负向测试：同一 attemptId 重复提交必须被 400 拒绝
  const replaySubmitRes = await req("POST", "/api/yuqi/employee/learning-tasks/" + taskId + "/exam/submit", {
    answers: { [qId]: "A" },
    attemptId: examPaper.data.attemptId,
  }, empHeaders)
  assert.equal(replaySubmitRes.status, 400, "重复提交同一会话必须被 400 拒绝")

  // 10. 检查任务状态已更新为 COMPLETED
  const taskAfter = await req("GET", "/api/collections/learning_tasks/records/" + taskId, null, superHeaders)
  assert.equal(taskAfter.data.status, "COMPLETED", "任务自动标记为已完成")
})
