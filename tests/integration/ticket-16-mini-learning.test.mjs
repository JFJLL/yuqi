import test from "node:test"
import assert from "node:assert/strict"
import { startPbTestServer } from "../helpers/pb-test-server.mjs"

test("Ticket 16: 小程序荐药与培训学习集成测试", async (t) => {
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

  // 2. 创建租户、门店、员工
  const tenantRes = await req("POST", "/api/collections/tenants/records", {
    code: "demo",
    name: "演示租户",
    status: "ACTIVE",
  }, superHeaders)
  const tenantId = tenantRes.data.id

  const storeRes = await req("POST", "/api/collections/stores/records", {
    name: "无锡胜利门分店",
    code: "STORE-WX-001",
    tenant: tenantId,
    status: "营业中",
  }, superHeaders)
  const storeId = storeRes.data.id

  const empRes = await req("POST", "/api/collections/employees/records", {
    name: "冯药师",
    phone: "13900000077",
    role: "营业员",
    store: storeId,
    tenant: tenantId,
    status: "在职",
  }, superHeaders)
  const empId = empRes.data.id

  // 3. 员工登录
  const wxLoginRes = await req("POST", "/api/yuqi/auth/wechat/login", {
    loginCode: "mock-code-feng",
    phoneCode: "13900000077",
    testMock: true,
  })
  assert.equal(wxLoginRes.status, 200)
  const empToken = wxLoginRes.data.token
  const empHeaders = { Authorization: "Bearer " + empToken }

  // 4. 创建课程与分配给该员工的任务
  const courseRes = await req("POST", "/api/collections/learning_courses/records", {
    title: "儿童用药安全与剂量换算",
    category: "药学知识",
    summary: "儿童常用退烧与止咳药物安全剂量规范",
    status: "PUBLISHED",
    tenant: tenantId,
  }, superHeaders)
  const courseId = courseRes.data.id

  const unitRes = await req("POST", "/api/collections/learning_course_units/records", {
    course: courseId,
    title: "第一节：小儿退热剂剂量计算",
    content: "按体重 10mg/kg 计算单次给药量...",
    duration_seconds: 300,
    sort_order: 1,
    tenant: tenantId,
  }, superHeaders)
  const unitId = unitRes.data.id

  const examRes = await req("POST", "/api/collections/learning_exams/records", {
    course: courseId,
    title: "儿童用药安全考核",
    pass_score: 80,
    max_attempts: 3,
    time_limit_minutes: 20,
    tenant: tenantId,
  }, superHeaders)
  const examId = examRes.data.id

  const qRes = await req("POST", "/api/collections/learning_questions/records", {
    exam: examId,
    stem: "3岁幼儿发热38.5度首选哪种退热成分？",
    type: "SINGLE",
    options_json: JSON.stringify([
      { label: "A", text: "布洛芬 / 对乙酰氨基酚" },
      { label: "B", text: "阿司匹林" },
    ]),
    answer: "A",
    score: 100,
    explanation: "儿童禁用阿司匹林以防瑞氏综合征。",
    sort_order: 1,
    tenant: tenantId,
  }, superHeaders)
  const qId = qRes.data.id

  const taskRes = await req("POST", "/api/collections/learning_tasks/records", {
    course: courseId,
    employee: empId,
    store: storeId,
    due_at: "2026-09-10",
    status: "IN_PROGRESS",
    tenant: tenantId,
  }, superHeaders)
  const taskId = taskRes.data.id

  // 5. 员工通过员工端 API 获取任务并更新章节进度
  const myTasks = await req("GET", "/api/yuqi/employee/learning-tasks", null, empHeaders)
  assert.equal(myTasks.status, 200, "员工读取任务成功")
  assert.equal(myTasks.data.items.length, 1)

  const progRes = await req("POST", `/api/yuqi/employee/learning-tasks/${taskId}/progress`, {
    completedUnitId: unitId,
  }, empHeaders)
  assert.equal(progRes.status, 200, "员工提交章节学习进度成功")
  assert.equal(progRes.data.progressPercent, 100)

  // 6. 员工参加考试并提交作答
  const paperRes = await req("GET", `/api/yuqi/employee/learning-tasks/${taskId}/exam`, null, empHeaders)
  assert.equal(paperRes.status, 200, "获取试卷成功")
  assert.equal(paperRes.data.questions[0].answer, undefined, "绝不泄露正确答案")

  const examSubmitRes = await req("POST", `/api/yuqi/employee/learning-tasks/${taskId}/exam/submit`, {
    answers: { [qId]: "A" },
    attemptId: paperRes.data.attemptId,
  }, empHeaders)
  assert.equal(examSubmitRes.status, 200, "员工提交考试成功")
  assert.equal(examSubmitRes.data.passed, true, "服务端判定考试通过")

  // 7. 员工查询推荐药品知识
  const recRes = await req("GET", "/api/yuqi/recommendations?keyword=布洛芬", null, empHeaders)
  assert.equal(recRes.status, 200, "员工查询推荐药品成功")
})
