import { ipcMain } from 'electron'
import { searchFiles } from '../db/searchRepository'
import type { IpcResult, SearchFilters, SearchResultPage } from '../../shared/types'

const DEFAULT_PAGE_SIZE = 100

export function registerSearchIpc(): void {
  ipcMain.handle('search:query', (_event, payload: unknown): IpcResult<SearchResultPage> => {
    const { text, filters, page } = (payload ?? {}) as {
      text?: unknown
      filters?: unknown
      page?: unknown
    }

    const queryText = typeof text === 'string' ? text : ''
    const queryFilters = (filters && typeof filters === 'object' ? filters : {}) as SearchFilters
    const pageNumber = typeof page === 'number' && page >= 0 ? page : 0

    try {
      return { ok: true, data: searchFiles(queryText, queryFilters, pageNumber, DEFAULT_PAGE_SIZE) }
    } catch (err) {
      return { ok: false, error: { code: 'search_error', message: (err as Error).message } }
    }
  })
}
