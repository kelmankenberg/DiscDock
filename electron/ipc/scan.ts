import { ipcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { cancelScan, startAudioCdScan, startScan } from '../scanning/scanManager'
import { getErrorsForMedia, listScanJobsForMedia } from '../db/scanRepository'
import { getSettings } from '../settings/settingsStore'
import type { HashMode, IpcResult, ScanErrorEntry, ScanJob } from '../../shared/types'
import { isHashMode, isNonEmptyString, isPositiveInteger, isRecord, isTrustedRendererEvent } from './validation'

export function registerScanIpc(): void {
  ipcMain.handle('scan:start', async (event, payload: unknown): Promise<IpcResult<{ jobId: number }>> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    const candidate = isRecord(payload) ? payload : {}
    const { mediaId, rootPath, hashMode } = candidate

    if (!isPositiveInteger(mediaId)) {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric mediaId is required' } }
    }
    if (!isNonEmptyString(rootPath)) {
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
    if (hashMode !== undefined && !isHashMode(hashMode)) {
      return { ok: false, error: { code: 'invalid_input', message: 'hashMode must be none, quick, or full' } }
    }
    const mode = (hashMode as HashMode | undefined) ?? getSettings().defaultHashMode

    const jobId = startScan(mediaId, resolvedRoot, mode)
    return { ok: true, data: { jobId } }
  })

  ipcMain.handle('scan:startAudioCd', (event, payload: unknown): IpcResult<{ jobId: number }> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    const candidate = isRecord(payload) ? payload : {}
    const { mediaId, devicePath } = candidate
    if (!isPositiveInteger(mediaId)) {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric mediaId is required' } }
    }
    if (!isNonEmptyString(devicePath)) {
      return { ok: false, error: { code: 'invalid_input', message: 'A devicePath is required' } }
    }
    return { ok: true, data: { jobId: startAudioCdScan(mediaId, devicePath) } }
  })

  ipcMain.handle('scan:cancel', (event, payload: unknown): IpcResult<{ cancelled: boolean }> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    const jobId = isRecord(payload) ? payload.jobId : undefined
    if (!isPositiveInteger(jobId)) {
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
