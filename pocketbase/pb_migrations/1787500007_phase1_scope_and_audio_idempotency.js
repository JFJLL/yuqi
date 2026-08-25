/// <reference path="../pb_data/types.d.ts" />
// 1787500007_phase1_scope_and_audio_idempotency.js — 数据范围增强与多租户音频幂等索引
// 1. audio_files: 删除全局 UNIQUE(object_key), 增加 UNIQUE(tenant, object_key) 索引
// 2. audio_files: 增加 store / employee / device 关联字段
// 3. devices: 增加 current_store / current_employee 镜像关联字段
// 4. 存量活跃绑定回填 devices.current_store / current_employee

function fieldExists(collection, name) {
  try {
    return !!collection.fields.getByName(name)
  } catch (_) {
    return false
  }
}

function ensureField(collection, def) {
  if (fieldExists(collection, def.name)) return false
  collection.fields.add(new Field(def))
  return true
}

function rel(name, collectionName, maxSelect, appRef) {
  let id = collectionName
  if (appRef) {
    try {
      id = appRef.findCollectionByNameOrId(collectionName).id
    } catch (_) {}
  }
  return { name, type: "relation", maxSelect: maxSelect || 1, collectionId: id }
}

migrate((app) => {
  try {
    // 1. 升级 audio_files 集合字段与多租户唯一索引
    const audioColl = app.findCollectionByNameOrId("audio_files")
    if (audioColl) {
      let ch = false
      ch = ensureField(audioColl, rel("store", "stores", 1, app)) || ch
      ch = ensureField(audioColl, rel("employee", "employees", 1, app)) || ch
      ch = ensureField(audioColl, rel("device", "devices", 1, app)) || ch

      // 替换索引: 删除旧全局唯一索引, 新建租户+object_key联合唯一索引
      const oldIndexes = audioColl.indexes || []
      const newIndexes = []
      for (let i = 0; i < oldIndexes.length; i++) {
        const idxStr = String(oldIndexes[i])
        if (idxStr.includes("idx_audio_files_object_key") || (idxStr.includes("UNIQUE") && idxStr.includes("object_key") && !idxStr.includes("tenant"))) {
          // 移除旧单列唯一索引
          ch = true
        } else {
          newIndexes.push(oldIndexes[i])
        }
      }
      const tenantIdxSql = "CREATE UNIQUE INDEX `idx_audio_files_tenant_object_key` ON `audio_files` (`tenant`, `object_key`)"
      if (!newIndexes.some((x) => String(x).includes("idx_audio_files_tenant_object_key"))) {
        newIndexes.push(tenantIdxSql)
        ch = true
      }
      audioColl.indexes = newIndexes
      if (ch) app.save(audioColl)

      // 在 SQLite 层面确保安全执行索引变更
      try {
        app.db().newQuery("DROP INDEX IF EXISTS `idx_audio_files_object_key`").execute()
      } catch (_) {}
      try {
        app.db().newQuery("CREATE UNIQUE INDEX IF NOT EXISTS `idx_audio_files_tenant_object_key` ON `audio_files` (`tenant`, `object_key`)").execute()
      } catch (_) {}
    }

    // 2. 升级 devices 集合字段 (current_store, current_employee)
    const devColl = app.findCollectionByNameOrId("devices")
    if (devColl) {
      let ch = false
      ch = ensureField(devColl, rel("current_store", "stores", 1, app)) || ch
      ch = ensureField(devColl, rel("current_employee", "employees", 1, app)) || ch
      if (ch) app.save(devColl)
    }

    // 3. 回填存量活跃绑定到 devices
    try {
      const activeBindings = app.findRecordsByFilter("device_bindings", "status = {:st}", "", 500, 0, { st: "ACTIVE" })
      for (let i = 0; i < activeBindings.length; i++) {
        const b = activeBindings[i]
        const devId = String(b.get("device") || "")
        if (devId) {
          try {
            const dev = app.findRecordById("devices", devId)
            dev.set("current_store", String(b.get("store") || ""))
            dev.set("current_employee", String(b.get("employee") || ""))
            dev.set("status", "IN_USE")
            app.save(dev)
          } catch (_) {}
        }
      }
    } catch (_) {}

    // 4. 回填存量 audio_files 归属
    try {
      const audios = app.findRecordsByFilter("audio_files", "store = '' || store = null", "", 500, 0, {})
      for (let i = 0; i < audios.length; i++) {
        const a = audios[i]
        const sn = String(a.get("device_sn") || "")
        if (sn) {
          try {
            const dev = app.findFirstRecordByFilter("devices", "device_no = {:sn}", { sn })
            if (dev) {
              a.set("device", dev.id)
              const cStore = String(dev.get("current_store") || "")
              const cEmp = String(dev.get("current_employee") || "")
              if (cStore) a.set("store", cStore)
              if (cEmp) a.set("employee", cEmp)
              app.save(a)
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  } catch (err) {
    console.log("PHASE1_SCOPE_MIGRATION_FAIL: " + JSON.stringify(String(err && err.message || err)))
    throw err
  }
}, (app) => {
  return true
})

