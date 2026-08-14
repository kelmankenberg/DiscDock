import { ipcMain } from 'electron'
import { searchFiles } from '../db/searchRepository'
import type { IpcResult, SearchFilters, SearchResultPage } from '../../shared/types'
import { isNonNegativeInteger, isRecord, isTrustedRendererEvent, validateSearchFilters } from './validation'

const DEFAULT_PAGE_SIZE = 100

export function registerSearchIpc(): void {
  ipcMain.handle('search:query', (event, payload: unknown): IpcResult<SearchResultPage> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    if (!isRecord(payload)) return { ok: false, error: { code: 'invalid_input', message: 'Invalid search payload' } }
    const { text, filters, page } = payload as {
      text?: unknown
      filters?: unknown
      page?: unknown
    }

    if (text !== undefined && typeof text !== 'string') return { ok: false, error: { code: 'invalid_input', message: 'text must be a string' } }
    if (page !== undefined && !isNonNegativeInteger(page)) return { ok: false, error: { code: 'invalid_input', message: 'page must be a non-negative integer' } }
    const queryFilters = validateSearchFilters(filters)
    if (!queryFilters) return { ok: false, error: { code: 'invalid_input', message: 'Invalid search filters' } }
    const queryText = text ?? ''
    const pageNumber = page ?? 0

    try {
      return { ok: true, data: searchFiles(queryText, queryFilters, pageNumber, DEFAULT_PAGE_SIZE) }
    } catch (err) {
      return { ok: false, error: { code: 'search_error', message: (err as Error).message } }
    }
  })
}
