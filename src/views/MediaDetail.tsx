import { useEffect, useState } from 'react'
import { MEDIA_TYPES } from '../../shared/types'
import type { FileEntry, MediaItem, ScanJob } from '../../shared/types'
import './MediaDetail.css'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** exponent).toFixed(1)} ${units[exponent]}`
}

interface MediaDetailProps {
  mediaId: number
  onBack: () => void
}

type Tab = 'overview' | 'browse' | 'history'

export default function MediaDetail({ mediaId, onBack }: MediaDetailProps): JSX.Element {
  const [item, setItem] = useState<MediaItem | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [folderPath, setFolderPath] = useState('')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [history, setHistory] = useState<ScanJob[]>([])

  useEffect(() => {
    void window.discdock.media.get(mediaId).then((result) => {
      if (result.ok) setItem(result.data)
    })
  }, [mediaId])

  useEffect(() => {
    if (tab !== 'browse') return
    void window.discdock.files.list(mediaId, folderPath).then((result) => {
      if (result.ok) setEntries(result.data)
    })
  }, [mediaId, folderPath, tab])

  useEffect(() => {
    if (tab !== 'history') return
    void window.discdock.scan.history(mediaId).then((result) => {
      if (result.ok) setHistory(result.data)
    })
  }, [mediaId, tab])

  if (!item) return <div className="media-detail">Loading…</div>

  const mediaTypeLabel = MEDIA_TYPES.find((t) => t.value === item.mediaType)?.label ?? item.mediaType
  const breadcrumbs = folderPath ? folderPath.split('/') : []

  return (
    <div className="media-detail">
      <button type="button" className="button button--small media-detail__back" onClick={onBack}>
        ← Back to Media Library
      </button>

      <div className="media-detail__header">
        <h1>{item.label}</h1>
        <span className={`status-badge status-badge--${item.status}`}>{item.status}</span>
      </div>
      <p className="media-detail__subtitle">
        {mediaTypeLabel} {item.physicalLocation ? `· ${item.physicalLocation}` : ''}
      </p>

      <div className="media-detail__tabs">
        <button type="button" className={tab === 'overview' ? 'tab tab--active' : 'tab'} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button type="button" className={tab === 'browse' ? 'tab tab--active' : 'tab'} onClick={() => setTab('browse')}>
          Browse
        </button>
        <button type="button" className={tab === 'history' ? 'tab tab--active' : 'tab'} onClick={() => setTab('history')}>
          Scan History
        </button>
      </div>

      {tab === 'overview' && (
        <div className="media-detail__overview">
          <p>Capacity: {item.capacityBytes ? formatBytes(item.capacityBytes) : 'Unknown'}</p>
          <p>Last scanned: {item.lastScannedAt ?? 'Never'}</p>
          <p>Last verified: {item.lastVerifiedAt ?? 'Never'}</p>
          <p>Notes: {item.notes ?? '—'}</p>
        </div>
      )}

      {tab === 'browse' && (
        <div className="media-detail__browse">
          <div className="breadcrumbs">
            <button type="button" onClick={() => setFolderPath('')}>
              Root
            </button>
            {breadcrumbs.map((segment, index) => {
              const pathAtIndex = breadcrumbs.slice(0, index + 1).join('/')
              return (
                <span key={pathAtIndex}>
                  {' / '}
                  <button type="button" onClick={() => setFolderPath(pathAtIndex)}>
                    {segment}
                  </button>
                </span>
              )
            })}
          </div>

          {entries.length === 0 ? (
            <p className="media-detail__status">This folder is empty (or hasn't been scanned yet).</p>
          ) : (
            <table className="media-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Kind</th>
                  <th>Size</th>
                  <th>Modified</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.path}>
                    <td>
                      {entry.isDirectory ? (
                        <button type="button" className="link-button" onClick={() => setFolderPath(entry.path)}>
                          📁 {entry.name}
                        </button>
                      ) : (
                        entry.name
                      )}
                    </td>
                    <td>{entry.isDirectory ? 'folder' : entry.kind}</td>
                    <td>{entry.isDirectory ? '—' : formatBytes(entry.sizeBytes)}</td>
                    <td>{entry.modifiedAtSrc ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="media-detail__history">
          {history.length === 0 ? (
            <p className="media-detail__status">No scans yet.</p>
          ) : (
            <table className="media-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Status</th>
                  <th>Hash Mode</th>
                  <th>Added</th>
                  <th>Modified</th>
                  <th>Removed</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {history.map((job) => (
                  <tr key={job.id}>
                    <td>{job.startedAt}</td>
                    <td>{job.status}</td>
                    <td>{job.hashMode}</td>
                    <td>{job.filesAdded}</td>
                    <td>{job.filesModified}</td>
                    <td>{job.filesRemoved}</td>
                    <td>{job.errorCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
