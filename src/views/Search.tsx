import { useEffect, useState } from 'react'
import { FILE_KINDS, MEDIA_TYPES } from '../../shared/types'
import type { FileSearchResult, MediaType, FileKind, SearchFilters } from '../../shared/types'
import './Search.css'

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
  const [results, setResults] = useState<FileSearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)

  const runSearch = (pageToLoad: number): void => {
    const filters: SearchFilters = {}
    if (mediaType) filters.mediaType = mediaType
    if (kind) filters.kind = kind

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

  useEffect(() => {
    runSearch(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault()
    runSearch(0)
  }

  const pageSize = 100
  const hasMore = (page + 1) * pageSize < total

  return (
    <div className="search-view">
      <h1>Search</h1>
      <form className="search-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search by file name or path…"
          className="search-form__input"
        />
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
        <button type="submit" className="button button--primary">
          Search
        </button>
      </form>

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
