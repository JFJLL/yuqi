/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/_rh_admin_sso.pb.js — 平台「管理后台」免密登入 (drop-in, 新老 app 通用)
//
// VibeX control 服务端用此路由为 app 所有者换取一个 PocketBase superuser 短期 token,
// 实现「打开 app 管理后台」的免密登入。token 由 PB 进程内签发, 平台不存储任何密码。
//
// 安全模型 (fail-closed):
//   仅当请求头 X-Rh-Admin-Sso 等于容器内注入的 VIBEX_TASK_INDEX_TOKEN 时才签发。
//   该 secret 只在 control <-> 容器 的内网流转, 绝不下发浏览器; 任何不匹配/缺失一律 403。
//
// 该文件由 control 按需下发到 pocketbase-bin/pb_hooks/ (PB 热重载即生效), 新老 app 通用。
// 与具体 app 业务无关, 不读取任何业务 collection。

routerAdd("POST", "/__rh_admin_sso", function (e) {
  var expected = $os.getenv("VIBEX_TASK_INDEX_TOKEN")
  var got = ""
  try {
    // PB 把请求头名归一为小写+下划线 (X-Rh-Admin-Sso -> x_rh_admin_sso)。
    var hdrs = e.requestInfo().headers || {}
    got = hdrs["x_rh_admin_sso"] || hdrs["X-Rh-Admin-Sso"] || hdrs["x-rh-admin-sso"] || ""
  } catch (_) {}
  if (!expected || !got || String(got) !== expected) {
    return e.json(403, { code: "FORBIDDEN" })
  }

  // 平台专用 superuser: 每个 app 一份, 首次按需创建 (随机强密码, 平台不持有/不回传)。
  var email = "rh-platform-admin@vibex.local"
  var rec = null
  try {
    rec = $app.findAuthRecordByEmail("_superusers", email)
  } catch (_) {
    rec = null
  }
  if (!rec) {
    var col = $app.findCollectionByNameOrId("_superusers")
    rec = new Record(col)
    rec.setEmail(email)
    rec.setPassword($security.randomString(40))
    $app.save(rec)
  }

  // 15 分钟短期 token (time.Duration 纳秒)。静态 token 不可刷新, 过期即失效。
  var token = rec.newStaticAuthToken(15 * 60 * 1000000000)
  return e.json(200, { token: token, record: rec })
})
