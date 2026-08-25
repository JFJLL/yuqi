/// <reference path="../pb_data/types.d.ts" />
// 1787500006_phase1_sms_index.js — sms_codes 唯一索引修正
// 旧: (mobile, status) 唯一 → 同手机号历史多条 USED/EXPIRED 会冲突
// 新: (mobile) WHERE status='ACTIVE' → 同手机号仅一条有效验证码, 允许历史记录

migrate((app) => {
  const coll = app.findCollectionByNameOrId("sms_codes")
  const kept = []
  let hasOld = false
  let hasNew = false
  for (const idx of (coll.indexes || [])) {
    if (String(idx).indexOf("idx_sms_codes_mobile_status") >= 0) {
      hasOld = true
      continue
    }
    if (String(idx).indexOf("idx_sms_codes_mobile_active") >= 0) hasNew = true
    kept.push(idx)
  }
  if (!hasNew) {
    kept.push("CREATE UNIQUE INDEX `idx_sms_codes_mobile_active` ON `sms_codes` (`mobile`) WHERE `status` = 'ACTIVE'")
  }
  if (hasOld || !hasNew) {
    coll.indexes = kept
    app.save(coll)
  }
  console.log("PHASE1_SMS_INDEX: sms_codes unique index fixed (ACTIVE only)")
}, (app) => {
  return true
})
