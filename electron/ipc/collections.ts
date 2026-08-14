import { ipcMain } from 'electron'
import {
  addMemberToCollection,
  createCollection,
  deleteCollection,
  getCollectionMembers,
  listCollections,
  removeMemberFromCollection
} from '../db/collectionRepository'
import type { Collection, CollectionInput, IpcResult, MediaItem } from '../../shared/types'
import { isNonEmptyString, isPositiveInteger, isRecord, isTrustedRendererEvent } from './validation'

export function registerCollectionsIpc(): void {
  ipcMain.handle('collections:list', (event): IpcResult<Collection[]> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    return { ok: true, data: listCollections() }
  })

  ipcMain.handle('collections:create', (event, payload: unknown): IpcResult<Collection> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    const candidate = isRecord(payload) ? payload : null
    const name = candidate?.name
    const description = candidate?.description
    if (!isNonEmptyString(name)) {
      return { ok: false, error: { code: 'invalid_input', message: 'A name is required' } }
    }
    const input: CollectionInput = {
      name: name.trim(),
      description: typeof description === 'string' && description.trim() ? description.trim() : null
    }
    return { ok: true, data: createCollection(input) }
  })

  ipcMain.handle('collections:delete', (event, payload: unknown): IpcResult<{ deleted: true }> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    const id = isRecord(payload) ? payload.id : undefined
    if (!isPositiveInteger(id)) {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric id is required' } }
    }
    deleteCollection(id)
    return { ok: true, data: { deleted: true } }
  })

  ipcMain.handle('collections:members', (event, payload: unknown): IpcResult<MediaItem[]> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    const collectionId = isRecord(payload) ? payload.collectionId : undefined
    if (!isPositiveInteger(collectionId)) {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric collectionId is required' } }
    }
    return { ok: true, data: getCollectionMembers(collectionId) }
  })

  ipcMain.handle('collections:addMember', (event, payload: unknown): IpcResult<{ ok: true }> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    const candidate = isRecord(payload) ? payload : {}
    const { collectionId, mediaId } = candidate
    if (!isPositiveInteger(collectionId) || !isPositiveInteger(mediaId)) {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric collectionId and mediaId are required' } }
    }
    addMemberToCollection(collectionId, mediaId)
    return { ok: true, data: { ok: true } }
  })

  ipcMain.handle('collections:removeMember', (event, payload: unknown): IpcResult<{ ok: true }> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    const candidate = isRecord(payload) ? payload : {}
    const { collectionId, mediaId } = candidate
    if (!isPositiveInteger(collectionId) || !isPositiveInteger(mediaId)) {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric collectionId and mediaId are required' } }
    }
    removeMemberFromCollection(collectionId, mediaId)
    return { ok: true, data: { ok: true } }
  })
}
