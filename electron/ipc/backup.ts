import { ipcMain, Notification } from 'electron'
import { backupNow, restoreFromBackup } from '../backup/backupService'
import type { IpcResult } from '../../shared/types'
import { isNonEmptyString, isRecord, isTrustedRendererEvent } from './validation'

export function registerBackupIpc(): void {
  ipcMain.handle('backup:run', async (event, payload: unknown): Promise<IpcResult<{ ok: true }>> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    const destinationPath = isRecord(payload) ? payload.destinationPath : undefined
    if (!isNonEmptyString(destinationPath)) {
      return { ok: false, error: { code: 'invalid_input', message: 'A destinationPath is required' } }
    }
    try {
      await backupNow(destinationPath)
      new Notification({ title: 'DiscDock', body: 'Backup completed.' }).show()
      return { ok: true, data: { ok: true } }
    } catch (err) {
      return { ok: false, error: { code: 'backup_error', message: (err as Error).message } }
    }
  })

  ipcMain.handle(
    'backup:restore',
    async (event, payload: unknown): Promise<IpcResult<{ safetyBackupPath: string }>> => {
      if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
      const sourcePath = isRecord(payload) ? payload.sourcePath : undefined
      if (!isNonEmptyString(sourcePath)) {
        return { ok: false, error: { code: 'invalid_input', message: 'A sourcePath is required' } }
      }
      try {
        const result = await restoreFromBackup(sourcePath)
        new Notification({ title: 'DiscDock', body: 'Catalog restore completed.' }).show()
        return { ok: true, data: result }
      } catch (err) {
        return { ok: false, error: { code: 'restore_error', message: (err as Error).message } }
      }
    }
  )
}
