import { ipcMain } from 'electron'
import { exportCatalog } from '../export/exportService'
import type { ExportFormat, ExportScope, IpcResult } from '../../shared/types'

export function registerExportIpc(): void {
  ipcMain.handle('export:run', (_event, payload: unknown): IpcResult<{ fileCount: number }> => {
    const { scope, format, destinationPath } = (payload ?? {}) as {
      scope?: unknown
      format?: unknown
      destinationPath?: unknown
    }

    if (typeof destinationPath !== 'string' || !destinationPath.trim()) {
      return { ok: false, error: { code: 'invalid_input', message: 'A destinationPath is required' } }
    }
    if (format !== 'json' && format !== 'csv') {
      return { ok: false, error: { code: 'invalid_input', message: 'format must be "json" or "csv"' } }
    }

    const scopeObj = scope as ExportScope
    const validScope: ExportScope =
      scopeObj && scopeObj.type === 'media' && typeof scopeObj.mediaId === 'number'
        ? { type: 'media', mediaId: scopeObj.mediaId }
        : { type: 'all' }

    try {
      const fileCount = exportCatalog(validScope, format as ExportFormat, destinationPath)
      return { ok: true, data: { fileCount } }
    } catch (err) {
      return { ok: false, error: { code: 'export_error', message: (err as Error).message } }
    }
  })
}
