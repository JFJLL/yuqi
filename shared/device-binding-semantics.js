// Shared current-binding semantics for the management UI and the OSS scanner.
//
// effective_date is the business timestamp. created/updated are persistence
// metadata and must never decide which binding is current.

const ACTIVE_STATUSES = new Set(["已绑定", "ACTIVE", "active"])
const INACTIVE_STATUSES = new Set(["已解绑", "ENDED", "ended", "INACTIVE", "inactive"])

function asText(value) {
  return value == null ? "" : String(value)
}

function timestamp(value) {
  if (value instanceof Date) {
    const result = value.getTime()
    return Number.isFinite(result) ? result : null
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const text = asText(value).trim()
  if (!text) return null
  const result = Date.parse(text)
  return Number.isFinite(result) ? result : null
}

function compareTimestampAscending(left, right, field) {
  const leftTime = timestamp(left?.[field])
  const rightTime = timestamp(right?.[field])
  if (leftTime == null && rightTime == null) return 0
  if (leftTime == null) return -1
  if (rightTime == null) return 1
  return leftTime - rightTime
}

function compareStringAscending(left, right, field) {
  const leftText = asText(left?.[field])
  const rightText = asText(right?.[field])
  if (leftText === rightText) return 0
  return leftText < rightText ? -1 : 1
}

function compareTieBreakers(left, right) {
  return (
    compareTimestampAscending(left, right, "approved_at") ||
    compareTimestampAscending(left, right, "created") ||
    compareStringAscending(left, right, "id")
  )
}

function pickHighest(rows, compare) {
  let selected = null
  for (const row of rows) {
    if (!selected || compare(row, selected) > 0) selected = row
  }
  return selected
}

/**
 * Normalize only the documented status whitespace. Case variants are kept
 * explicit so an unknown status cannot accidentally become active.
 */
export function normalizeBindingStatus(status) {
  return asText(status).trim()
}

export function bindingStatusKind(status) {
  const normalized = normalizeBindingStatus(status)
  if (ACTIVE_STATUSES.has(normalized)) return "active"
  if (INACTIVE_STATUSES.has(normalized)) return "inactive"
  return "unknown"
}

export function bindingEffectiveTimestamp(record) {
  return timestamp(record?.effective_date)
}

export function bindingApprovedTimestamp(record) {
  return timestamp(record?.approved_at)
}

/**
 * Select the business record for one device and then interpret its status.
 *
 * A future effective record is not eligible yet. If a legal effective date
 * exists but all such records are future-dated, no legacy record is allowed
 * to override it. Legacy ordering is used only when every record lacks a
 * legal effective_date.
 */
export function selectCurrentBindingForDevice(records, asOf = new Date()) {
  const rows = Array.isArray(records)
    ? records.filter((record) => record && typeof record === "object")
    : []
  const asOfTimestamp = timestamp(asOf) ?? Date.now()
  const legalEffectiveRows = rows.filter((record) => bindingEffectiveTimestamp(record) != null)
  const eligibleRows = legalEffectiveRows.filter(
    (record) => bindingEffectiveTimestamp(record) <= asOfTimestamp,
  )
  const warningCodes = []
  let binding = null
  let usedLegacyFallback = false
  let futureEffectiveDatePending = false

  if (eligibleRows.length > 0) {
    binding = pickHighest(
      eligibleRows,
      (left, right) =>
        bindingEffectiveTimestamp(left) - bindingEffectiveTimestamp(right) ||
        compareTieBreakers(left, right),
    )
  } else if (legalEffectiveRows.length === 0) {
    binding = pickHighest(rows, compareTieBreakers)
    if (binding) {
      usedLegacyFallback = true
      warningCodes.push("LEGACY_EFFECTIVE_DATE_FALLBACK")
    }
  } else {
    futureEffectiveDatePending = true
    warningCodes.push("FUTURE_EFFECTIVE_DATE_PENDING")
  }

  const rawStatusKind = binding ? bindingStatusKind(binding.status) : "inactive"
  if (rawStatusKind === "unknown") warningCodes.push("UNKNOWN_BINDING_STATUS")
  const status = rawStatusKind === "active" ? "active" : "inactive"

  return {
    binding,
    status,
    rawStatusKind,
    isActive: status === "active",
    isInactive: status === "inactive",
    usedLegacyFallback,
    futureEffectiveDatePending,
    hasLegalEffectiveDate: legalEffectiveRows.length > 0,
    warningCodes,
  }
}

/**
 * Group records by device relation and apply the same selector to every group.
 * Warning counts are intentionally aggregate-only and contain no identifiers.
 */
export function selectCurrentBindings(records, asOf = new Date()) {
  const rows = Array.isArray(records)
    ? records.filter((record) => record && typeof record === "object")
    : []
  const grouped = new Map()
  let recordsWithoutDevice = 0
  for (const record of rows) {
    const deviceId = asText(record.device).trim()
    if (!deviceId) {
      recordsWithoutDevice += 1
      continue
    }
    const group = grouped.get(deviceId) || []
    group.push(record)
    grouped.set(deviceId, group)
  }

  const byDevice = new Map()
  const warnings = {
    recordsWithoutDevice,
    legacyFallbackDevices: 0,
    futureEffectiveDateDevices: 0,
    unknownStatusDevices: 0,
  }
  for (const [deviceId, group] of grouped) {
    const selection = selectCurrentBindingForDevice(group, asOf)
    byDevice.set(deviceId, selection)
    if (selection.usedLegacyFallback) warnings.legacyFallbackDevices += 1
    if (selection.futureEffectiveDatePending) warnings.futureEffectiveDateDevices += 1
    if (selection.rawStatusKind === "unknown") warnings.unknownStatusDevices += 1
  }

  return { byDevice, warnings }
}
