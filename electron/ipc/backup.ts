import { ipcMain } from 'electron'
import { backupNow, restoreFromBackup } from '../backup/backupService'
import type { IpcResult } from '../../shared/types'

export function registerBackupIpc(): void {
  ipcMain.handle('backup:run', async (_event, payload: unknown): Promise<IpcResult<{ ok: true }>> => {
    const destinationPath = (payload as { destinationPath?: unknown })?.destinationPath
    if (typeof destinationPath !== 'string' || !destinationPath.trim()) {
      return { ok: false, error: { code: 'invalid_input', message: 'A destinationPath is required' } }
    }
    try {
      await backupNow(destinationPath)
      return { ok: true, data: { ok: true } }
    } catch (err) {
      return { ok: false, error: { code: 'backup_error', message: (err as Error).message } }
    }
  })

  ipcMain.handle(
    'backup:restore',
    async (_event, payload: unknown): Promise<IpcResult<{ safetyBackupPath: string }>> => {
      const sourcePath = (payload as { sourcePath?: unknown })?.sourcePath
      if (typeof sourcePath !== 'string' || !sourcePath.trim()) {
        return { ok: false, error: { code: 'invalid_input', message: 'A sourcePath is required' } }
      }
      try {
        const result = await restoreFromBackup(sourcePath)
        return { ok: true, data: result }
      } catch (err) {
        return { ok: false, error: { code: 'restore_error', message: (err as Error).message } }
      }
    }
  )
}
