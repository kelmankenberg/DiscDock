import { ipcMain, shell } from 'electron'
import fs from 'node:fs'
import nodePath from 'node:path'
import { listFolderContents } from '../db/fileRepository'
import { getMediaItem } from '../db/mediaRepository'
import { listConnectedDevices } from '../devices/deviceDetection'
import {
  getFileAnnotations,
  setNoteForFile,
  setTagsForFile
} from '../db/fileAnnotationRepository'
import type { FileAnnotation, FileEntry, IpcResult } from '../../shared/types'
import { isNonEmptyString, isPositiveInteger, isRecord, isStringArray, isTrustedRendererEvent } from './validation'

const invalidInput = (message: string): IpcResult<never> => ({
  ok: false,
  error: { code: 'invalid_input', message }
})

/**
 * Maps a catalog-relative path back onto the live filesystem via the media item's currently
 * mounted device. Rejects paths that escape the mount point.
 */
async function resolveLivePath(mediaId: number, filePath: string): Promise<string> {
  const item = getMediaItem(mediaId)
  if (!item) throw new Error(`Media item ${mediaId} not found`)
  if (!item.deviceFingerprint) throw new Error(`"${item.label}" is not linked to a device`)

  const devices = await listConnectedDevices()
  const device = devices.find((d) => (d.uuid ?? d.devicePath) === item.deviceFingerprint)
  if (!device) throw new Error(`"${item.label}" is not currently connected`)

  const mountPoint = nodePath.resolve(device.mountPoint)
  const resolved = nodePath.resolve(mountPoint, filePath)
  if (resolved !== mountPoint && !resolved.startsWith(`${mountPoint}${nodePath.sep}`)) {
    throw new Error('Resolved path is outside the mounted media')
  }
  if (!fs.existsSync(resolved)) throw new Error('That file no longer exists on the media')

  return resolved
}

export function registerFilesIpc(): void {
  ipcMain.handle('files:list', (event, payload: unknown): IpcResult<FileEntry[]> => {
    if (!isTrustedRendererEvent(event)) return invalidInput('Untrusted renderer')
    const candidate = isRecord(payload) ? payload : {}
    const { mediaId, folderPath } = candidate
    if (!isPositiveInteger(mediaId)) {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric mediaId is required' } }
    }
    if (folderPath !== undefined && typeof folderPath !== 'string') return invalidInput('folderPath must be a string')
    const path = folderPath ?? ''
    try {
      return { ok: true, data: listFolderContents(mediaId, path) }
    } catch (err) {
      return { ok: false, error: { code: 'files_error', message: (err as Error).message } }
    }
  })

  ipcMain.handle(
    'files:annotations',
    (event, payload: unknown): IpcResult<Record<string, FileAnnotation>> => {
      if (!isTrustedRendererEvent(event)) return invalidInput('Untrusted renderer')
      const mediaId = isRecord(payload) ? payload.mediaId : undefined
      if (!isPositiveInteger(mediaId)) return invalidInput('A positive numeric mediaId is required')
      try {
        return { ok: true, data: getFileAnnotations(mediaId) }
      } catch (err) {
        return { ok: false, error: { code: 'files_error', message: (err as Error).message } }
      }
    }
  )

  ipcMain.handle('files:setTags', (event, payload: unknown): IpcResult<FileAnnotation> => {
    if (!isTrustedRendererEvent(event)) return invalidInput('Untrusted renderer')
    const candidate = isRecord(payload) ? payload : {}
    const { mediaId, filePath, tagNames } = candidate
    if (!isPositiveInteger(mediaId)) return invalidInput('A positive numeric mediaId is required')
    if (!isNonEmptyString(filePath)) return invalidInput('A file path is required')
    if (!isStringArray(tagNames)) return invalidInput('tagNames must be an array of strings')
    try {
      return { ok: true, data: setTagsForFile(mediaId, filePath, tagNames) }
    } catch (err) {
      return { ok: false, error: { code: 'files_error', message: (err as Error).message } }
    }
  })

  ipcMain.handle('files:setNote', (event, payload: unknown): IpcResult<FileAnnotation> => {
    if (!isTrustedRendererEvent(event)) return invalidInput('Untrusted renderer')
    const candidate = isRecord(payload) ? payload : {}
    const { mediaId, filePath, note } = candidate
    if (!isPositiveInteger(mediaId)) return invalidInput('A positive numeric mediaId is required')
    if (!isNonEmptyString(filePath)) return invalidInput('A file path is required')
    if (note !== undefined && note !== null && typeof note !== 'string') return invalidInput('note must be a string or null')
    const value = typeof note === 'string' ? note : null
    try {
      return { ok: true, data: setNoteForFile(mediaId, filePath, value) }
    } catch (err) {
      return { ok: false, error: { code: 'files_error', message: (err as Error).message } }
    }
  })

  ipcMain.handle('files:open', async (event, payload: unknown): Promise<IpcResult<{ opened: true }>> => {
    if (!isTrustedRendererEvent(event)) return invalidInput('Untrusted renderer')
    const candidate = isRecord(payload) ? payload : {}
    const { mediaId, filePath } = candidate
    if (!isPositiveInteger(mediaId)) return invalidInput('A positive numeric mediaId is required')
    if (!isNonEmptyString(filePath)) return invalidInput('A file path is required')
    try {
      const resolved = await resolveLivePath(mediaId, filePath)
      const error = await shell.openPath(resolved)
      if (error) throw new Error(error)
      return { ok: true, data: { opened: true } }
    } catch (err) {
      return { ok: false, error: { code: 'files_error', message: (err as Error).message } }
    }
  })

  ipcMain.handle('files:reveal', async (event, payload: unknown): Promise<IpcResult<{ revealed: true }>> => {
    if (!isTrustedRendererEvent(event)) return invalidInput('Untrusted renderer')
    const candidate = isRecord(payload) ? payload : {}
    const { mediaId, filePath } = candidate
    if (!isPositiveInteger(mediaId)) return invalidInput('A positive numeric mediaId is required')
    if (!isNonEmptyString(filePath)) return invalidInput('A file path is required')
    try {
      shell.showItemInFolder(await resolveLivePath(mediaId, filePath))
      return { ok: true, data: { revealed: true } }
    } catch (err) {
      return { ok: false, error: { code: 'files_error', message: (err as Error).message } }
    }
  })
}
