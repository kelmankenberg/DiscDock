import { ipcMain } from 'electron'
import { app, nativeImage } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import {
  createMediaItem,
  deleteMediaItem,
  getMediaItem,
  listMediaItems,
  markMediaVerified,
  retireMediaItem,
  setMediaCoverPath,
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

function isLikelyAnimatedWebp(source: Buffer): boolean {
  // Animated WebP files typically include ANIM/ANMF chunks in the RIFF payload.
  const probe = source.subarray(0, Math.min(source.length, 64 * 1024)).toString('latin1')
  return probe.includes('ANIM') || probe.includes('ANMF')
}

async function decodeImageToPngBytes(source: Buffer): Promise<Buffer> {
  const image = nativeImage.createFromBuffer(source)
  if (!image.isEmpty()) return image.toPNG()
  if (isLikelyAnimatedWebp(source)) {
    // Some animated WebP files cannot be decoded by nativeImage, but can be flattened by sharp.
    try {
      return await sharp(source, { animated: true }).png().toBuffer()
    } catch {
      throw new Error('Animated WebP is not supported for cover images. Please use a static image.')
    }
  }
  try {
    return await sharp(source, { animated: true }).png().toBuffer()
  } catch {
    throw new Error('Image could not be decoded')
  }
}

async function writeCoverPngForMedia(mediaId: number, png: Buffer): Promise<string> {
  const coversDir = path.join(app.getPath('userData'), 'covers')
  await fs.mkdir(coversDir, { recursive: true })
  const coverPath = path.join(coversDir, `${mediaId}.png`)
  await fs.writeFile(coverPath, png)
  setMediaCoverPath(mediaId, coverPath)
  return coverPath
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

  ipcMain.handle('media:setCoverFromFile', async (event, payload: unknown): Promise<IpcResult<MediaItem>> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    try {
      const candidate = isRecord(payload) ? payload : {}
      const id = candidate.id
      const sourcePath = candidate.sourcePath
      if (!isPositiveInteger(id)) throw new Error('A positive numeric id is required')
      if (!isNonEmptyString(sourcePath)) throw new Error('A source image path is required')

      const existing = getMediaItem(id)
      if (!existing) throw new Error(`Media item ${id} not found`)

      const absolutePath = path.resolve(sourcePath)
      const source = await fs.readFile(absolutePath)
      let png: Buffer
      try {
        png = await decodeImageToPngBytes(source)
      } catch (err) {
        const fallback = nativeImage.createFromPath(absolutePath)
        if (!fallback.isEmpty()) {
          png = fallback.toPNG()
        } else {
          throw err
        }
      }

      await writeCoverPngForMedia(id, png)

      const updated = getMediaItem(id)
      if (!updated) throw new Error(`Media item ${id} not found`)
      return { ok: true, data: updated }
    } catch (err) {
      return toErrorResult(err)
    }
  })

  ipcMain.handle('media:clearCover', async (event, payload: unknown): Promise<IpcResult<MediaItem>> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    try {
      const id = isRecord(payload) ? payload.id : undefined
      if (!isPositiveInteger(id)) throw new Error('A positive numeric id is required')

      const existing = getMediaItem(id)
      if (!existing) throw new Error(`Media item ${id} not found`)

      if (existing.coverPath) {
        await fs.rm(existing.coverPath, { force: true })
      }
      setMediaCoverPath(id, null)

      const updated = getMediaItem(id)
      if (!updated) throw new Error(`Media item ${id} not found`)
      return { ok: true, data: updated }
    } catch (err) {
      return toErrorResult(err)
    }
  })

  ipcMain.handle('media:setCoverFromUrl', async (event, payload: unknown): Promise<IpcResult<MediaItem>> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    try {
      const candidate = isRecord(payload) ? payload : {}
      const id = candidate.id
      const imageUrl = candidate.imageUrl
      if (!isPositiveInteger(id)) throw new Error('A positive numeric id is required')
      if (!isNonEmptyString(imageUrl)) throw new Error('An image URL is required')

      const existing = getMediaItem(id)
      if (!existing) throw new Error(`Media item ${id} not found`)

      let parsed: URL
      try {
        parsed = new URL(imageUrl)
      } catch {
        throw new Error('Image URL is invalid')
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Only http(s) image URLs are allowed')
      }

      const response = await fetch(parsed.toString(), { redirect: 'follow' })
      if (!response.ok) {
        throw new Error(`Image download failed: ${response.status} ${response.statusText}`)
      }
      const contentType = response.headers.get('content-type')
      if (contentType && !contentType.toLowerCase().startsWith('image/')) {
        throw new Error(`Downloaded URL is not an image (content-type: ${contentType})`)
      }
      const downloaded = Buffer.from(await response.arrayBuffer())
      const png = await decodeImageToPngBytes(downloaded)

      await writeCoverPngForMedia(id, png)

      const updated = getMediaItem(id)
      if (!updated) throw new Error(`Media item ${id} not found`)
      return { ok: true, data: updated }
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
