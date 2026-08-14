import { ipcMain } from 'electron'
import { getDb } from '../db'
import { countMediaNeedingVerification } from '../db/mediaRepository'
import { getSettings } from '../settings/settingsStore'
import type { DashboardAttention, DashboardScanActivity, DashboardSummary, IpcResult } from '../../shared/types'
import { isTrustedRendererEvent } from './validation'

export function registerDashboardIpc(): void {
  ipcMain.handle('dashboard:summary', (event): IpcResult<DashboardSummary> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    const db = getDb()

    const { count: totalMediaItems } = db
      .prepare('SELECT COUNT(*) as count FROM media_item')
      .get() as { count: number }

    const { count: totalFiles, total: totalSizeBytes } = db
      .prepare(
        'SELECT COUNT(*) as count, COALESCE(SUM(size_bytes), 0) as total FROM file_record WHERE is_directory = 0'
      )
      .get() as { count: number; total: number }

    const settings = getSettings()
    const mediaNeedingVerification = countMediaNeedingVerification(settings.verificationThresholdMonths)
    const recentScans = db.prepare(`
      SELECT sj.id as jobId, sj.media_item_id as mediaItemId, mi.label as mediaLabel,
             sj.status, sj.started_at as startedAt, sj.files_added as filesAdded,
             sj.files_modified as filesModified, sj.files_removed as filesRemoved,
             sj.error_count as errorCount
      FROM scan_job sj JOIN media_item mi ON mi.id = sj.media_item_id
      ORDER BY sj.started_at DESC LIMIT 8
    `).all() as DashboardScanActivity[]
    const attention = db.prepare(`
      SELECT mi.id as mediaItemId, mi.label as mediaLabel, 'verification' as kind,
             'Verification is due' as detail
      FROM media_item mi
      WHERE mi.status = 'active'
        AND COALESCE(mi.last_verified_at, mi.created_at) < datetime('now', ?)
      UNION ALL
      SELECT DISTINCT mi.id as mediaItemId, mi.label as mediaLabel, 'scan' as kind,
             CASE WHEN sj.status = 'incomplete' THEN 'Last scan was incomplete'
                  ELSE 'Last scan failed' END as detail
      FROM scan_job sj JOIN media_item mi ON mi.id = sj.media_item_id
      WHERE sj.status IN ('incomplete', 'failed')
      ORDER BY mediaLabel LIMIT 12
    `).all(`-${settings.verificationThresholdMonths} months`) as DashboardAttention[]

    return {
      ok: true,
      data: { totalMediaItems, totalFiles, totalSizeBytes, mediaNeedingVerification, recentScans, attention }
    }
  })
}
