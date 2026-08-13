import { ipcMain } from 'electron'
import { cancelScan, startScan } from '../scanning/scanManager'
import { listScanJobsForMedia } from '../db/scanRepository'
import { getSettings } from '../settings/settingsStore'
import type { HashMode, IpcResult, ScanJob } from '../../shared/types'

export function registerScanIpc(): void {
  ipcMain.handle('scan:start', (_event, payload: unknown): IpcResult<{ jobId: number }> => {
    const { mediaId, rootPath, hashMode } = (payload ?? {}) as {
      mediaId?: unknown
      rootPath?: unknown
      hashMode?: unknown
    }

    if (typeof mediaId !== 'number') {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric mediaId is required' } }
    }
    if (typeof rootPath !== 'string' || !rootPath.trim()) {
      return { ok: false, error: { code: 'invalid_input', message: 'A rootPath is required' } }
    }
    const validModes: HashMode[] = ['none', 'quick', 'full']
    const mode = validModes.includes(hashMode as HashMode) ? (hashMode as HashMode) : getSettings().defaultHashMode

    const jobId = startScan(mediaId, rootPath, mode)
    return { ok: true, data: { jobId } }
  })

  ipcMain.handle('scan:cancel', (_event, payload: unknown): IpcResult<{ cancelled: boolean }> => {
    const jobId = (payload as { jobId?: unknown })?.jobId
    if (typeof jobId !== 'number') {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric jobId is required' } }
    }
    return { ok: true, data: { cancelled: cancelScan(jobId) } }
  })

  ipcMain.handle('scan:history', (_event, payload: unknown): IpcResult<ScanJob[]> => {
    const mediaId = (payload as { mediaId?: unknown })?.mediaId
    if (typeof mediaId !== 'number') {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric mediaId is required' } }
    }
    return { ok: true, data: listScanJobsForMedia(mediaId) }
  })
}
