import { FILE_KINDS } from '../../shared/types'
import { app } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import type { AppSettings, HashMode, SearchFilters } from '../../shared/types'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isTrustedRendererEvent(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? ''
  if (app.isPackaged) return url.startsWith('file://')
  return url === 'http://localhost:5173/' || url.startsWith('http://localhost:5173/')
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

export function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

export function isHashMode(value: unknown): value is HashMode {
  return value === 'none' || value === 'quick' || value === 'full'
}

export function validateSearchFilters(value: unknown): SearchFilters | null {
  if (value === undefined) return {}
  if (!isRecord(value)) return null

  const filters: SearchFilters = {}
  if (value.mediaItemId !== undefined) {
    if (!isPositiveInteger(value.mediaItemId)) return null
    filters.mediaItemId = value.mediaItemId
  }
  if (value.mediaType !== undefined) {
    if (!isNonEmptyString(value.mediaType)) return null
    filters.mediaType = value.mediaType
  }
  if (value.kind !== undefined) {
    if (!FILE_KINDS.includes(value.kind as (typeof FILE_KINDS)[number])) return null
    filters.kind = value.kind as SearchFilters['kind']
  }
  if (value.minSizeBytes !== undefined) {
    if (!isNonNegativeInteger(value.minSizeBytes)) return null
    filters.minSizeBytes = value.minSizeBytes
  }
  if (value.maxSizeBytes !== undefined) {
    if (!isNonNegativeInteger(value.maxSizeBytes)) return null
    filters.maxSizeBytes = value.maxSizeBytes
  }
  for (const key of ['modifiedAfter', 'modifiedBefore'] as const) {
    if (value[key] !== undefined && (typeof value[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value[key]))) return null
    if (value[key] !== undefined) filters[key] = value[key]
  }
  if (filters.minSizeBytes !== undefined && filters.maxSizeBytes !== undefined && filters.minSizeBytes > filters.maxSizeBytes) {
    return null
  }
  if (value.tag !== undefined) {
    if (!isNonEmptyString(value.tag)) return null
    filters.tag = value.tag
  }
  return filters
}

export function validateSettingsPatch(value: unknown): Partial<AppSettings> | null {
  if (!isRecord(value)) return null
  const patch: Partial<AppSettings> = {}
  if (value.defaultHashMode !== undefined) {
    if (!isHashMode(value.defaultHashMode)) return null
    patch.defaultHashMode = value.defaultHashMode
  }
  if (value.excludePatterns !== undefined) {
    if (!Array.isArray(value.excludePatterns) || !value.excludePatterns.every(isNonEmptyString)) return null
    patch.excludePatterns = value.excludePatterns
  }
  if (value.followSymlinks !== undefined) {
    if (typeof value.followSymlinks !== 'boolean') return null
    patch.followSymlinks = value.followSymlinks
  }
  if (value.theme !== undefined) {
    if (value.theme !== 'light' && value.theme !== 'dark' && value.theme !== 'system') return null
    patch.theme = value.theme
  }
  if (value.notifications !== undefined) {
    if (!isRecord(value.notifications)) return null
    const notifications = value.notifications
    if (typeof notifications.scanCompleted !== 'boolean' || typeof notifications.scanFailed !== 'boolean' || typeof notifications.verificationReminders !== 'boolean') return null
    patch.notifications = notifications as unknown as AppSettings['notifications']
  }
  if (value.customMediaTypes !== undefined) {
    if (!Array.isArray(value.customMediaTypes) || !value.customMediaTypes.every(isNonEmptyString)) return null
    patch.customMediaTypes = value.customMediaTypes
  }
  if (value.customFieldNames !== undefined) {
    if (!Array.isArray(value.customFieldNames) || !value.customFieldNames.every(isNonEmptyString)) return null
    patch.customFieldNames = value.customFieldNames
  }
  for (const key of ['verificationThresholdMonths', 'maxConcurrentScans'] as const) {
    if (value[key] !== undefined) {
      if (!isPositiveInteger(value[key])) return null
      patch[key] = value[key]
    }
  }
  for (const key of ['autoUpdateEnabled', 'audioCdMetadataEnabled', 'helpPanelOpen'] as const) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'boolean') return null
      patch[key] = value[key]
    }
  }
  if (value.helpPanelWidthPercent !== undefined) {
    if (typeof value.helpPanelWidthPercent !== 'number' || !Number.isFinite(value.helpPanelWidthPercent) || value.helpPanelWidthPercent < 25 || value.helpPanelWidthPercent > 40) return null
    patch.helpPanelWidthPercent = value.helpPanelWidthPercent
  }
  return patch
}