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
  ipcMain.handle('files:list', (_event, payload: unknown): IpcResult<FileEntry[]> => {
    const { mediaId, folderPath } = (payload ?? {}) as { mediaId?: unknown; folderPath?: unknown }
    if (typeof mediaId !== 'number') {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric mediaId is required' } }
    }
    const path = typeof folderPath === 'string' ? folderPath : ''
    try {
      return { ok: true, data: listFolderContents(mediaId, path) }
    } catch (err) {
      return { ok: false, error: { code: 'files_error', message: (err as Error).message } }
    }
  })

  ipcMain.handle(
    'files:annotations',
    (_event, payload: unknown): IpcResult<Record<string, FileAnnotation>> => {
      const { mediaId } = (payload ?? {}) as { mediaId?: unknown }
      if (typeof mediaId !== 'number') return invalidInput('A numeric mediaId is required')
      try {
        return { ok: true, data: getFileAnnotations(mediaId) }
      } catch (err) {
        return { ok: false, error: { code: 'files_error', message: (err as Error).message } }
      }
    }
  )

  ipcMain.handle('files:setTags', (_event, payload: unknown): IpcResult<FileAnnotation> => {
    const { mediaId, filePath, tagNames } = (payload ?? {}) as {
      mediaId?: unknown
      filePath?: unknown
      tagNames?: unknown
    }
    if (typeof mediaId !== 'number') return invalidInput('A numeric mediaId is required')
    if (typeof filePath !== 'string' || !filePath) return invalidInput('A file path is required')
    const names = Array.isArray(tagNames)
      ? tagNames.filter((name): name is string => typeof name === 'string')
      : []
    try {
      return { ok: true, data: setTagsForFile(mediaId, filePath, names) }
    } catch (err) {
      return { ok: false, error: { code: 'files_error', message: (err as Error).message } }
    }
  })

  ipcMain.handle('files:setNote', (_event, payload: unknown): IpcResult<FileAnnotation> => {
    const { mediaId, filePath, note } = (payload ?? {}) as {
      mediaId?: unknown
      filePath?: unknown
      note?: unknown
    }
    if (typeof mediaId !== 'number') return invalidInput('A numeric mediaId is required')
    if (typeof filePath !== 'string' || !filePath) return invalidInput('A file path is required')
    const value = typeof note === 'string' ? note : null
    try {
      return { ok: true, data: setNoteForFile(mediaId, filePath, value) }
    } catch (err) {
      return { ok: false, error: { code: 'files_error', message: (err as Error).message } }
    }
  })

  ipcMain.handle('files:open', async (_event, payload: unknown): Promise<IpcResult<{ opened: true }>> => {
    const { mediaId, filePath } = (payload ?? {}) as { mediaId?: unknown; filePath?: unknown }
    if (typeof mediaId !== 'number') return invalidInput('A numeric mediaId is required')
    if (typeof filePath !== 'string' || !filePath) return invalidInput('A file path is required')
    try {
      const resolved = await resolveLivePath(mediaId, filePath)
      const error = await shell.openPath(resolved)
      if (error) throw new Error(error)
      return { ok: true, data: { opened: true } }
    } catch (err) {
      return { ok: false, error: { code: 'files_error', message: (err as Error).message } }
    }
  })

  ipcMain.handle('files:reveal', async (_event, payload: unknown): Promise<IpcResult<{ revealed: true }>> => {
    const { mediaId, filePath } = (payload ?? {}) as { mediaId?: unknown; filePath?: unknown }
    if (typeof mediaId !== 'number') return invalidInput('A numeric mediaId is required')
    if (typeof filePath !== 'string' || !filePath) return invalidInput('A file path is required')
    try {
      shell.showItemInFolder(await resolveLivePath(mediaId, filePath))
      return { ok: true, data: { revealed: true } }
    } catch (err) {
      return { ok: false, error: { code: 'files_error', message: (err as Error).message } }
    }
  })
}
