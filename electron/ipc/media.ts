import { ipcMain } from 'electron'
import fs from 'node:fs/promises'
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
import { isNonEmptyString, isPositiveInteger, isRecord, isTrustedRendererEvent } from './validation'

const VALID_MEDIA_TYPES = new Set(MEDIA_TYPES.map((t) => t.value))

function validateMediaItemInput(input: unknown): MediaItemInput {
  if (!isRecord(input)) {
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

function validateMediaItemPatch(patch: unknown): Partial<MediaItemInput> {
  if (!isRecord(patch)) throw new Error('Invalid media update payload')
  const allowed = new Set(['label', 'mediaType', 'capacityBytes', 'physicalLocation', 'notes', 'deviceFingerprint'])
  if (Object.keys(patch).some((key) => !allowed.has(key))) throw new Error('Unknown media update field')
  if (patch.label !== undefined && !isNonEmptyString(patch.label)) throw new Error('Label must be a non-empty string')
  if (patch.mediaType !== undefined && !isNonEmptyString(patch.mediaType)) throw new Error('Media type must be a non-empty string')
  if (patch.capacityBytes !== undefined && patch.capacityBytes !== null && (typeof patch.capacityBytes !== 'number' || !Number.isFinite(patch.capacityBytes) || patch.capacityBytes < 0)) throw new Error('Capacity must be a non-negative number')
  for (const key of ['physicalLocation', 'notes', 'deviceFingerprint'] as const) {
    if (patch[key] !== undefined && patch[key] !== null && typeof patch[key] !== 'string') throw new Error(`${key} must be a string or null`)
  }
  return patch as Partial<MediaItemInput>
}

function toErrorResult(err: unknown): IpcResult<never> {
  const message = err instanceof Error ? err.message : 'Unknown error'
  return { ok: false, error: { code: 'media_error', message } }
}

export function registerMediaIpc(): void {
  ipcMain.handle('media:list', (event): IpcResult<MediaItem[]> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    try {
      return { ok: true, data: listMediaItems() }
    } catch (err) {
      return toErrorResult(err)
    }
  })

  ipcMain.handle('media:get', (event, payload: unknown): IpcResult<MediaItem> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    try {
      const id = isRecord(payload) ? payload.id : undefined
      if (!isPositiveInteger(id)) throw new Error('A positive numeric id is required')
      const item = getMediaItem(id)
      if (!item) throw new Error(`Media item ${id} not found`)
      return { ok: true, data: item }
    } catch (err) {
      return toErrorResult(err)
    }
  })

  ipcMain.handle('media:create', (event, payload: unknown): IpcResult<MediaItem> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    try {
      const input = validateMediaItemInput(payload)
      return { ok: true, data: createMediaItem(input) }
    } catch (err) {
      return toErrorResult(err)
    }
  })

  ipcMain.handle('media:update', (event, payload: unknown): IpcResult<MediaItem> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    try {
      const candidate = isRecord(payload) ? payload : {}
      const { id, patch } = candidate
      if (!isPositiveInteger(id)) throw new Error('A positive numeric id is required')
      const partial = validateMediaItemPatch(patch)
      return { ok: true, data: updateMediaItem(id, partial) }
    } catch (err) {
      return toErrorResult(err)
    }
  })

  ipcMain.handle('media:retire', (event, payload: unknown): IpcResult<MediaItem> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    try {
      const id = isRecord(payload) ? payload.id : undefined
      if (!isPositiveInteger(id)) throw new Error('A positive numeric id is required')
      return { ok: true, data: retireMediaItem(id) }
    } catch (err) {
      return toErrorResult(err)
    }
  })

  ipcMain.handle('media:delete', (event, payload: unknown): IpcResult<{ deleted: true }> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    try {
      const id = isRecord(payload) ? payload.id : undefined
      if (!isPositiveInteger(id)) throw new Error('A positive numeric id is required')
      deleteMediaItem(id)
      return { ok: true, data: { deleted: true } }
    } catch (err) {
      return toErrorResult(err)
    }
  })

  ipcMain.handle('media:markVerified', (event, payload: unknown): IpcResult<MediaItem> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    try {
      const id = isRecord(payload) ? payload.id : undefined
      if (!isPositiveInteger(id)) throw new Error('A positive numeric id is required')
      return { ok: true, data: markMediaVerified(id) }
    } catch (err) {
      return toErrorResult(err)
    }
  })

  // Covers live outside the app bundle, so they are returned as a data URL rather than a file path.
  ipcMain.handle('media:cover', async (event, payload: unknown): Promise<IpcResult<string | null>> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    try {
      const id = isRecord(payload) ? payload.id : undefined
      if (!isPositiveInteger(id)) throw new Error('A positive numeric id is required')
      const item = getMediaItem(id)
      if (!item?.coverPath) return { ok: true, data: null }
      const png = await fs.readFile(item.coverPath)
      return { ok: true, data: `data:image/png;base64,${png.toString('base64')}` }
    } catch {
      return { ok: true, data: null }
    }
  })
}
