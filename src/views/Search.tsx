import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { FILE_KINDS, MEDIA_TYPES } from '../../shared/types'
import type { FileSearchResult, MediaItem, MediaType, FileKind, SearchFilters } from '../../shared/types'
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
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [mediaItemId, setMediaItemId] = useState('')
  const [minSize, setMinSize] = useState('')
  const [maxSize, setMaxSize] = useState('')
  const [modifiedAfter, setModifiedAfter] = useState('')
  const [modifiedBefore, setModifiedBefore] = useState('')
  const [scanStatus, setScanStatus] = useState('')
  const [verificationStatus, setVerificationStatus] = useState('')
  const [results, setResults] = useState<FileSearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void window.discdock.tags.list().then((result) => {
      if (result.ok) setTagNames(result.data)
    })
  }, [])

  useEffect(() => {
    void window.discdock.media.list().then((result) => {
      if (result.ok) setMediaItems(result.data)
    })
  }, [])

  const runSearch = (pageToLoad: number): void => {
    const filters: SearchFilters = {}
    if (mediaType) filters.mediaType = mediaType
    if (kind) filters.kind = kind
    if (tag) filters.tag = tag
    if (mediaItemId) filters.mediaItemId = Number(mediaItemId)
    if (minSize) filters.minSizeBytes = Number(minSize)
    if (maxSize) filters.maxSizeBytes = Number(maxSize)
    if (modifiedAfter) filters.modifiedAfter = modifiedAfter
    if (modifiedBefore) filters.modifiedBefore = modifiedBefore
    if (scanStatus) filters.scanStatus = scanStatus as SearchFilters['scanStatus']
    if (verificationStatus) filters.verificationStatus = verificationStatus as SearchFilters['verificationStatus']

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
  }, [text, mediaType, kind, tag, mediaItemId, minSize, maxSize, modifiedAfter, modifiedBefore, scanStatus, verificationStatus])

  const pageSize = 100
  const hasMore = (page + 1) * pageSize < total

  const exportResults = (): void => {
    const filters: SearchFilters = {}
    if (mediaType) filters.mediaType = mediaType
    if (kind) filters.kind = kind
    if (tag) filters.tag = tag
    if (mediaItemId) filters.mediaItemId = Number(mediaItemId)
    if (minSize) filters.minSizeBytes = Number(minSize)
    if (maxSize) filters.maxSizeBytes = Number(maxSize)
    if (modifiedAfter) filters.modifiedAfter = modifiedAfter
    if (modifiedBefore) filters.modifiedBefore = modifiedBefore
    if (scanStatus) filters.scanStatus = scanStatus as SearchFilters['scanStatus']
    if (verificationStatus) filters.verificationStatus = verificationStatus as SearchFilters['verificationStatus']
    void window.discdock.dialogs.pickSaveFile('discdock-search-results.csv').then((pick) => {
      if (!pick.ok || !pick.data.path) return
      void window.discdock.export.run({ type: 'search', text, filters }, 'csv', pick.data.path)
    })
  }

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
        <select value={mediaItemId} onChange={(e) => setMediaItemId(e.target.value)}>
          <option value="">All media items</option>
          {mediaItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
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
        <input type="number" min="0" placeholder="Min bytes" value={minSize} onChange={(e) => setMinSize(e.target.value)} />
        <input type="number" min="0" placeholder="Max bytes" value={maxSize} onChange={(e) => setMaxSize(e.target.value)} />
        <label className="search-form__date">Modified after <input type="date" value={modifiedAfter} onChange={(e) => setModifiedAfter(e.target.value)} /></label>
        <label className="search-form__date">Modified before <input type="date" value={modifiedBefore} onChange={(e) => setModifiedBefore(e.target.value)} /></label>
        <select value={scanStatus} onChange={(e) => setScanStatus(e.target.value)}>
          <option value="">Any scan status</option>
          <option value="completed">Completed scan</option>
          <option value="incomplete">Incomplete scan</option>
          <option value="failed">Failed scan</option>
        </select>
        <select value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value)}>
          <option value="">Any verification status</option>
          <option value="verified">Verified</option>
          <option value="needs-verification">Needs verification</option>
        </select>
      </div>

      {loading ? (
        <p className="search-view__status">Searching…</p>
      ) : results.length === 0 ? (
        <p className="search-view__status">No matching files found.</p>
      ) : (
        <>
          <p className="search-view__status">
            {total} result{total === 1 ? '' : 's'}
            <button type="button" className="button button--small search-view__export" onClick={exportResults} disabled={total === 0}>Export results</button>
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
