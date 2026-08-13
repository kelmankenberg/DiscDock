import { ipcMain } from 'electron'
import { getDb } from '../db'
import type { DashboardSummary, IpcResult } from '../../shared/types'

export function registerDashboardIpc(): void {
  ipcMain.handle('dashboard:summary', (): IpcResult<DashboardSummary> => {
    const db = getDb()

    const { count: totalMediaItems } = db
      .prepare('SELECT COUNT(*) as count FROM media_item')
      .get() as { count: number }

    const { count: totalFiles, total: totalSizeBytes } = db
      .prepare(
        'SELECT COUNT(*) as count, COALESCE(SUM(size_bytes), 0) as total FROM file_record WHERE is_directory = 0'
      )
      .get() as { count: number; total: number }

    const { count: mediaNeedingVerification } = db
      .prepare(
        `SELECT COUNT(*) as count FROM media_item
         WHERE status = 'active'
           AND (last_verified_at IS NULL OR last_verified_at < datetime('now', '-12 months'))`
      )
      .get() as { count: number }

    return {
      ok: true,
      data: { totalMediaItems, totalFiles, totalSizeBytes, mediaNeedingVerification }
    }
  })
}
