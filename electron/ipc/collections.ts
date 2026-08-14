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

export function registerCollectionsIpc(): void {
  ipcMain.handle('collections:list', (): IpcResult<Collection[]> => {
    return { ok: true, data: listCollections() }
  })

  ipcMain.handle('collections:create', (_event, payload: unknown): IpcResult<Collection> => {
    const { name, description } = (payload ?? {}) as { name?: unknown; description?: unknown }
    if (typeof name !== 'string' || !name.trim()) {
      return { ok: false, error: { code: 'invalid_input', message: 'A name is required' } }
    }
    const input: CollectionInput = {
      name: name.trim(),
      description: typeof description === 'string' && description.trim() ? description.trim() : null
    }
    return { ok: true, data: createCollection(input) }
  })

  ipcMain.handle('collections:delete', (_event, payload: unknown): IpcResult<{ deleted: true }> => {
    const id = (payload as { id?: unknown })?.id
    if (typeof id !== 'number') {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric id is required' } }
    }
    deleteCollection(id)
    return { ok: true, data: { deleted: true } }
  })

  ipcMain.handle('collections:members', (_event, payload: unknown): IpcResult<MediaItem[]> => {
    const collectionId = (payload as { collectionId?: unknown })?.collectionId
    if (typeof collectionId !== 'number') {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric collectionId is required' } }
    }
    return { ok: true, data: getCollectionMembers(collectionId) }
  })

  ipcMain.handle('collections:addMember', (_event, payload: unknown): IpcResult<{ ok: true }> => {
    const { collectionId, mediaId } = (payload ?? {}) as { collectionId?: unknown; mediaId?: unknown }
    if (typeof collectionId !== 'number' || typeof mediaId !== 'number') {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric collectionId and mediaId are required' } }
    }
    addMemberToCollection(collectionId, mediaId)
    return { ok: true, data: { ok: true } }
  })

  ipcMain.handle('collections:removeMember', (_event, payload: unknown): IpcResult<{ ok: true }> => {
    const { collectionId, mediaId } = (payload ?? {}) as { collectionId?: unknown; mediaId?: unknown }
    if (typeof collectionId !== 'number' || typeof mediaId !== 'number') {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric collectionId and mediaId are required' } }
    }
    removeMemberFromCollection(collectionId, mediaId)
    return { ok: true, data: { ok: true } }
  })
}
