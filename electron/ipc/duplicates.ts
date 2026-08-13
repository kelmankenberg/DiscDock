import { ipcMain } from 'electron'
import { getDuplicateReport } from '../db/duplicateRepository'
import type { DuplicateReport, DuplicateReportFilters, IpcResult } from '../../shared/types'

export function registerDuplicatesIpc(): void {
  ipcMain.handle('duplicates:report', (_event, payload: unknown): IpcResult<DuplicateReport> => {
    const filters = (payload && typeof payload === 'object' ? payload : {}) as DuplicateReportFilters
    try {
      return { ok: true, data: getDuplicateReport(filters) }
    } catch (err) {
      return { ok: false, error: { code: 'duplicates_error', message: (err as Error).message } }
    }
  })
}
