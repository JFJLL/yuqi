export type BindingAsOf = Date | string | number
export type BindingRawStatusKind = "active" | "inactive" | "unknown"
export type BindingStatus = "active" | "inactive"

export interface BindingSelection<T extends object> {
  binding: T | null
  status: BindingStatus
  rawStatusKind: BindingRawStatusKind
  isActive: boolean
  isInactive: boolean
  usedLegacyFallback: boolean
  futureEffectiveDatePending: boolean
  hasLegalEffectiveDate: boolean
  warningCodes: string[]
}

export interface BindingSelectionWarnings {
  recordsWithoutDevice: number
  legacyFallbackDevices: number
  futureEffectiveDateDevices: number
  unknownStatusDevices: number
}

export interface BindingSelectionCollection<T extends object> {
  byDevice: Map<string, BindingSelection<T>>
  warnings: BindingSelectionWarnings
}

export function normalizeBindingStatus(status: unknown): string
export function bindingStatusKind(status: unknown): BindingRawStatusKind
export function bindingEffectiveTimestamp(record: object | null | undefined): number | null
export function bindingApprovedTimestamp(record: object | null | undefined): number | null
export function selectCurrentBindingForDevice<T extends object>(
  records: readonly T[],
  asOf?: BindingAsOf,
): BindingSelection<T>
export function selectCurrentBindings<T extends object>(
  records: readonly T[],
  asOf?: BindingAsOf,
): BindingSelectionCollection<T>
