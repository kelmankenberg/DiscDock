import { ipcMain } from 'electron'
import { getDuplicateReport } from '../db/duplicateRepository'
import type { DuplicateReport, DuplicateReportFilters, IpcResult } from '../../shared/types'
import { isNonEmptyString, isPositiveInteger, isRecord } from './validation'

export function registerDuplicatesIpc(): void {
  ipcMain.handle('duplicates:report', (_event, payload: unknown): IpcResult<DuplicateReport> => {
    if (payload !== undefined && !isRecord(payload)) return { ok: false, error: { code: 'invalid_input', message: 'Invalid duplicate filters' } }
    const candidate = (payload ?? {}) as Record<string, unknown>
    if (candidate.minGroupSize !== undefined && !isPositiveInteger(candidate.minGroupSize)) return { ok: false, error: { code: 'invalid_input', message: 'minGroupSize must be positive' } }
    if (candidate.mediaType !== undefined && !isNonEmptyString(candidate.mediaType)) return { ok: false, error: { code: 'invalid_input', message: 'mediaType must be a non-empty string' } }
    if (candidate.kind !== undefined && !isNonEmptyString(candidate.kind)) return { ok: false, error: { code: 'invalid_input', message: 'kind must be a non-empty string' } }
    const filters = candidate as DuplicateReportFilters
    try {
      return { ok: true, data: getDuplicateReport(filters) }
    } catch (err) {
      return { ok: false, error: { code: 'duplicates_error', message: (err as Error).message } }
    }
  })
}
