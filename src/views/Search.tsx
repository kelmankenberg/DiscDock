import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { FILE_KINDS, MEDIA_TYPES } from '../../shared/types'
import type { FileSearchResult, MediaType, FileKind, SearchFilters } from '../../shared/types'
import './Search.css'
import HelpButton from '../components/HelpButton'

const DEBOUNCE_MS = 300

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** exponent).toFixed(1)} ${units[exponent]}`
}

export default function Search(): JSX.Element {
  const [text, setText] = useState('')
  const [mediaType, setMediaType] = useState<MediaType | ''>('')
  const [kind, setKind] = useState<FileKind | ''>('')
  const [tag, setTag] = useState('')
  const [tagNames, setTagNames] = useState<string[]>([])
  const [results, setResults] = useState<FileSearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void window.discdock.tags.list().then((result) => {
      if (result.ok) setTagNames(result.data)
    })
  }, [])

  const runSearch = (pageToLoad: number): void => {
    const filters: SearchFilters = {}
    if (mediaType) filters.mediaType = mediaType
    if (kind) filters.kind = kind
    if (tag) filters.tag = tag

    setLoading(true)
    void window.discdock.search.query(text, filters, pageToLoad).then((result) => {
      setLoading(false)
      if (result.ok) {
        setResults(result.data.results)
        setTotal(result.data.total)
        setPage(pageToLoad)
      }
    })
  }

  // Acts as a live filter: re-runs (debounced) whenever the search text or filters change,
  // rather than requiring an explicit submit — the catalog is typically small/fast enough
  // (FTS5-backed) for this to feel instant.
  useEffect(() => {
    const timer = setTimeout(() => runSearch(0), DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, mediaType, kind, tag])

  const pageSize = 100
  const hasMore = (page + 1) * pageSize < total

  return (
    <div className="search-view">
      <div className="page-header"><h1>Search</h1><HelpButton topicId="search" /></div>
      <div className="search-form">
        <div className="search-form__input-wrapper">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Filter by file name or path…"
            className="search-form__input"
          />
          {text && (
            <button
              type="button"
              className="search-form__clear"
              onClick={() => setText('')}
              aria-label="Clear search"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <select value={mediaType} onChange={(e) => setMediaType(e.target.value as MediaType | '')}>
          <option value="">All media types</option>
          {MEDIA_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value as FileKind | '')}>
          <option value="">All file kinds</option>
          {FILE_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        {tagNames.length > 0 && (
          <select value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">All file tags</option>
            {tagNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <p className="search-view__status">Searching…</p>
      ) : results.length === 0 ? (
        <p className="search-view__status">No matching files found.</p>
      ) : (
        <>
          <p className="search-view__status">
            {total} result{total === 1 ? '' : 's'}
          </p>
          <table className="search-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Path</th>
                <th>Media</th>
                <th>Kind</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={result.id}>
                  <td>{result.name}</td>
                  <td>{result.path}</td>
                  <td>{result.mediaLabel}</td>
                  <td>{result.kind}</td>
                  <td>{formatBytes(result.sizeBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && (
            <button type="button" className="button" onClick={() => runSearch(page + 1)}>
              Load more
            </button>
          )}
        </>
      )}
    </div>
  )
}
