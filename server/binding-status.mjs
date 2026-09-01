const ACTIVE_BINDING_STATUS = "已绑定"

/**
 * 判断管理端认可的有效设备绑定状态。
 * 调用方可以传入带空格、不同大小写或 null 的外部数据。
 */
export function isActiveBindingStatus(status) {
  const normalized = String(status ?? "").trim()
  return normalized === ACTIVE_BINDING_STATUS || normalized.toLowerCase() === "active"
}

/**
 * device_bindings API 当前按 created 倒序返回记录。
 * 保持既有选择逻辑：对每台设备，取排序结果中第一个有效绑定。
 */
export function selectLatestActiveBindings(bindings) {
  const selected = new Map()
  for (const binding of Array.isArray(bindings) ? bindings : []) {
    if (!isActiveBindingStatus(binding?.status)) continue
    const device = String(binding?.device ?? "").trim()
    if (!device || selected.has(device)) continue
    selected.set(device, binding)
  }
  return selected
}
