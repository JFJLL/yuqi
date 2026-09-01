import { selectCurrentBindings } from "../shared/device-binding-semantics.js"

function relationId(value) {
  if (Array.isArray(value)) return relationId(value[0])
  return typeof value === "string" ? value.trim() : ""
}

export function relationFieldsForAudioFile(mapping) {
  const fields = {}
  for (const field of ["device", "employee", "store"]) {
    const value = relationId(mapping?.[field])
    if (value) fields[field] = value
  }
  return fields
}

export function buildSubmittedAudioFilePatch(transcriptId, asrJobId, mapping) {
  return {
    status: "submitted",
    transcript: transcriptId,
    asr_job: asrJobId,
    error_message: "",
    next_retry_at: "",
    ...relationFieldsForAudioFile(mapping),
  }
}

export function selectFreshObjects(objects, knownObjectKeys) {
  const known = knownObjectKeys instanceof Set ? knownObjectKeys : new Set(knownObjectKeys || [])
  return (Array.isArray(objects) ? objects : []).filter((object) => !known.has(String(object?.key || "")))
}

export function buildAsrMetadata(deviceSn, mapping) {
  return {
    // ASR metadata is the physical Badge SN, never the PocketBase relation id.
    device: typeof deviceSn === "string" ? deviceSn : "",
    employee: relationId(mapping?.employee),
    store: relationId(mapping?.store),
    language: "zh-CN",
  }
}

export function buildBindingCache(devices, bindings, asOf = new Date()) {
  const safeDevices = Array.isArray(devices) ? devices : []
  const safeBindings = Array.isArray(bindings) ? bindings : []
  const selection = selectCurrentBindings(safeBindings, asOf)
  const deviceById = new Map()
  const deviceIdBySn = new Map()
  for (const device of safeDevices) {
    const id = relationId(device?.id)
    if (id) deviceById.set(id, device)
    const sn = relationId(device?.device_no)
    if (sn && id && !deviceIdBySn.has(sn)) deviceIdBySn.set(sn, id)
  }

  const cache = new Map()
  let currentBindingsByEffectiveDate = 0
  let currentBindingsRelationComplete = 0
  let currentBindingsRelationIncomplete = 0
  for (const [deviceId, selected] of selection.byDevice) {
    if (!selected.isActive || !selected.binding) continue
    currentBindingsByEffectiveDate += 1
    const binding = selected.binding
    const mapping = {
      device: relationId(binding.device),
      employee: relationId(binding.employee),
      store: relationId(binding.store),
    }
    const complete = Boolean(mapping.device && mapping.employee && mapping.store)
    if (complete) currentBindingsRelationComplete += 1
    else currentBindingsRelationIncomplete += 1

    const device = deviceById.get(deviceId)
    const sn = relationId(device?.device_no)
    if (sn) cache.set(sn, mapping)
  }

  return {
    cache,
    deviceIdBySn,
    stats: {
      deviceRecordsTotal: safeDevices.length,
      currentBindingsByEffectiveDate,
      currentBindingsRelationComplete,
      currentBindingsRelationIncomplete,
      legacyFallbackDevices: selection.warnings.legacyFallbackDevices,
      futureEffectiveDateDevices: selection.warnings.futureEffectiveDateDevices,
      unknownStatusDevices: selection.warnings.unknownStatusDevices,
      recordsWithoutDevice: selection.warnings.recordsWithoutDevice,
    },
  }
}

export function countAudioDeviceOverlap(objects, parseBadgeFilename, knownDeviceNos) {
  const known = knownDeviceNos instanceof Set ? knownDeviceNos : new Set(knownDeviceNos || [])
  const matched = new Set()
  for (const object of Array.isArray(objects) ? objects : []) {
    const fileName = object?.file_name || String(object?.key || "").split("/").pop()
    const parsed = typeof parseBadgeFilename === "function" ? parseBadgeFilename(fileName) : null
    const sn = relationId(parsed?.sn)
    if (sn && known.has(sn)) matched.add(sn)
  }
  return matched.size
}
