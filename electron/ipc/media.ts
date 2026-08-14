import { ipcMain } from 'electron'
import {
  createMediaItem,
  deleteMediaItem,
  getMediaItem,
  listMediaItems,
  markMediaVerified,
  retireMediaItem,
  updateMediaItem
} from '../db/mediaRepository'
import { MEDIA_TYPES } from '../../shared/types'
import type { IpcResult, MediaItem, MediaItemInput } from '../../shared/types'

const VALID_MEDIA_TYPES = new Set(MEDIA_TYPES.map((t) => t.value))

function validateMediaItemInput(input: unknown): MediaItemInput {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Invalid media item payload')
  }
  const candidate = input as Record<string, unknown>

  const label = typeof candidate.label === 'string' ? candidate.label.trim() : ''
  if (!label) throw new Error('Label is required')

  const mediaType = candidate.mediaType
  if (typeof mediaType !== 'string' || !VALID_MEDIA_TYPES.has(mediaType as MediaItemInput['mediaType'])) {
    throw new Error('A valid media type is required')
  }

  const capacityBytes =
    typeof candidate.capacityBytes === 'number' && Number.isFinite(candidate.capacityBytes)
      ? candidate.capacityBytes
      : null

  const physicalLocation =
    typeof candidate.physicalLocation === 'string' && candidate.physicalLocation.trim()
      ? candidate.physicalLocation.trim()
      : null

  const notes =
    typeof candidate.notes === 'string' && candidate.notes.trim() ? candidate.notes.trim() : null

  const deviceFingerprint =
    typeof candidate.deviceFingerprint === 'string' && candidate.deviceFingerprint.trim()
      ? candidate.deviceFingerprint.trim()
      : null

  return {
    label,
    mediaType: mediaType as MediaItemInput['mediaType'],
    capacityBytes,
    physicalLocation,
    notes,
    deviceFingerprint
  }
}

function toErrorResult(err: unknown): IpcResult<never> {
  const message = err instanceof Error ? err.message : 'Unknown error'
  return { ok: false, error: { code: 'media_error', message } }
}

export function registerMediaIpc(): void {
  ipcMain.handle('media:list', (): IpcResult<MediaItem[]> => {
    try {
      return { ok: true, data: listMediaItems() }
    } catch (err) {
      return toErrorResult(err)
    }
  })

  ipcMain.handle('media:get', (_event, payload: unknown): IpcResult<MediaItem> => {
    try {
      const id = (payload as { id?: unknown })?.id
      if (typeof id !== 'number') throw new Error('A numeric id is required')
      const item = getMediaItem(id)
      if (!item) throw new Error(`Media item ${id} not found`)
      return { ok: true, data: item }
    } catch (err) {
      return toErrorResult(err)
    }
  })

  ipcMain.handle('media:create', (_event, payload: unknown): IpcResult<MediaItem> => {
    try {
      const input = validateMediaItemInput(payload)
      return { ok: true, data: createMediaItem(input) }
    } catch (err) {
      return toErrorResult(err)
    }
  })

  ipcMain.handle('media:update', (_event, payload: unknown): IpcResult<MediaItem> => {
    try {
      const { id, patch } = (payload ?? {}) as { id?: unknown; patch?: unknown }
      if (typeof id !== 'number') throw new Error('A numeric id is required')
      const partial =
        patch && typeof patch === 'object' ? (patch as Partial<MediaItemInput>) : {}
      return { ok: true, data: updateMediaItem(id, partial) }
    } catch (err) {
      return toErrorResult(err)
    }
  })

  ipcMain.handle('media:retire', (_event, payload: unknown): IpcResult<MediaItem> => {
    try {
      const id = (payload as { id?: unknown })?.id
      if (typeof id !== 'number') throw new Error('A numeric id is required')
      return { ok: true, data: retireMediaItem(id) }
    } catch (err) {
      return toErrorResult(err)
    }
  })

  ipcMain.handle('media:delete', (_event, payload: unknown): IpcResult<{ deleted: true }> => {
    try {
      const id = (payload as { id?: unknown })?.id
      if (typeof id !== 'number') throw new Error('A numeric id is required')
      deleteMediaItem(id)
      return { ok: true, data: { deleted: true } }
    } catch (err) {
      return toErrorResult(err)
    }
  })

  ipcMain.handle('media:markVerified', (_event, payload: unknown): IpcResult<MediaItem> => {
    try {
      const id = (payload as { id?: unknown })?.id
      if (typeof id !== 'number') throw new Error('A numeric id is required')
      return { ok: true, data: markMediaVerified(id) }
    } catch (err) {
      return toErrorResult(err)
    }
  })
}
