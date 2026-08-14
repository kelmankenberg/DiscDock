import { ipcMain } from 'electron'
import { exportCatalog } from '../export/exportService'
import type { ExportFormat, ExportScope, IpcResult } from '../../shared/types'
import { isNonEmptyString, isPositiveInteger, isRecord } from './validation'

export function registerExportIpc(): void {
  ipcMain.handle('export:run', (_event, payload: unknown): IpcResult<{ fileCount: number }> => {
    if (!isRecord(payload)) return { ok: false, error: { code: 'invalid_input', message: 'Invalid export payload' } }
    const { scope, format, destinationPath } = payload as {
      scope?: unknown
      format?: unknown
      destinationPath?: unknown
    }

    if (!isNonEmptyString(destinationPath)) {
      return { ok: false, error: { code: 'invalid_input', message: 'A destinationPath is required' } }
    }
    if (format !== 'json' && format !== 'csv') {
      return { ok: false, error: { code: 'invalid_input', message: 'format must be "json" or "csv"' } }
    }

    if (!isRecord(scope) || (scope.type !== 'all' && scope.type !== 'media')) {
      return { ok: false, error: { code: 'invalid_input', message: 'Invalid export scope' } }
    }
    if (scope.type === 'media' && !isPositiveInteger(scope.mediaId)) {
      return { ok: false, error: { code: 'invalid_input', message: 'A positive mediaId is required' } }
    }
    const validScope: ExportScope = scope.type === 'media' ? { type: 'media', mediaId: scope.mediaId as number } : { type: 'all' }

    try {
      const fileCount = exportCatalog(validScope, format as ExportFormat, destinationPath)
      return { ok: true, data: { fileCount } }
    } catch (err) {
      return { ok: false, error: { code: 'export_error', message: (err as Error).message } }
    }
  })
}
