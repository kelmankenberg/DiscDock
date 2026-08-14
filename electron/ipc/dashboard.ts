import { ipcMain } from 'electron'
import { getDb } from '../db'
import { countMediaNeedingVerification } from '../db/mediaRepository'
import { getSettings } from '../settings/settingsStore'
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

    const mediaNeedingVerification = countMediaNeedingVerification(
      getSettings().verificationThresholdMonths
    )

    return {
      ok: true,
      data: { totalMediaItems, totalFiles, totalSizeBytes, mediaNeedingVerification }
    }
  })
}
