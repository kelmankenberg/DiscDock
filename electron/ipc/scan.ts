import { ipcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { cancelScan, startAudioCdScan, startScan } from '../scanning/scanManager'
import { getErrorsForMedia, listScanJobsForMedia } from '../db/scanRepository'
import { getSettings } from '../settings/settingsStore'
import type { HashMode, IpcResult, ScanErrorEntry, ScanJob } from '../../shared/types'

export function registerScanIpc(): void {
  ipcMain.handle('scan:start', async (_event, payload: unknown): Promise<IpcResult<{ jobId: number }>> => {
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
    const resolvedRoot = path.resolve(rootPath)
    try {
      const stat = await fs.stat(resolvedRoot)
      if (!stat.isDirectory()) {
        return { ok: false, error: { code: 'invalid_input', message: 'rootPath must be a directory' } }
      }
    } catch {
      return { ok: false, error: { code: 'invalid_input', message: 'rootPath does not exist or cannot be read' } }
    }
    const validModes: HashMode[] = ['none', 'quick', 'full']
    const mode = validModes.includes(hashMode as HashMode) ? (hashMode as HashMode) : getSettings().defaultHashMode

    const jobId = startScan(mediaId, resolvedRoot, mode)
    return { ok: true, data: { jobId } }
  })

  ipcMain.handle('scan:startAudioCd', (_event, payload: unknown): IpcResult<{ jobId: number }> => {
    const { mediaId, devicePath } = (payload ?? {}) as { mediaId?: unknown; devicePath?: unknown }
    if (typeof mediaId !== 'number') {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric mediaId is required' } }
    }
    if (typeof devicePath !== 'string' || !devicePath.trim()) {
      return { ok: false, error: { code: 'invalid_input', message: 'A devicePath is required' } }
    }
    return { ok: true, data: { jobId: startAudioCdScan(mediaId, devicePath) } }
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

  ipcMain.handle('scan:errors', (_event, payload: unknown): IpcResult<ScanErrorEntry[]> => {
    const mediaId = (payload as { mediaId?: unknown })?.mediaId
    if (typeof mediaId !== 'number') {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric mediaId is required' } }
    }
    return { ok: true, data: getErrorsForMedia(mediaId) }
  })
}
