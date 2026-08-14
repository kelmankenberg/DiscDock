import { useEffect, useState } from 'react'
import { MEDIA_TYPES } from '../../shared/types'
import type {
  AppSettings,
  CustomFieldValue,
  FileAnnotation,
  FileEntry,
  MediaItem,
  ScanErrorEntry,
  ScanJob
} from '../../shared/types'
import './MediaDetail.css'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** exponent).toFixed(1)} ${units[exponent]}`
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

interface MediaDetailProps {
  mediaId: number
  onBack: () => void
}

type Tab = 'overview' | 'browse' | 'history' | 'errors'

export default function MediaDetail({ mediaId, onBack }: MediaDetailProps): JSX.Element {
  const [item, setItem] = useState<MediaItem | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [folderPath, setFolderPath] = useState('')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [history, setHistory] = useState<ScanJob[]>([])
  const [errors, setErrors] = useState<ScanErrorEntry[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldValue[]>([])
  const [customFieldNames, setCustomFieldNames] = useState<string[]>([])
  const [annotations, setAnnotations] = useState<Record<string, FileAnnotation>>({})
  const [allTagNames, setAllTagNames] = useState<string[]>([])
  const [editingCell, setEditingCell] = useState<{ path: string; field: 'tags' | 'note' } | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [fileActionMessage, setFileActionMessage] = useState<string | null>(null)
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null)

  useEffect(() => {
    void window.discdock.media.cover(mediaId).then((result) => {
      setCoverDataUrl(result.ok ? result.data : null)
    })
  }, [mediaId, item?.coverPath])

  const openFile = (filePath: string): void => {
    setFileActionMessage(null)
    void window.discdock.files.open(mediaId, filePath).then((result) => {
      if (!result.ok) setFileActionMessage(result.error.message)
    })
  }

  const revealFile = (filePath: string): void => {
    setFileActionMessage(null)
    void window.discdock.files.reveal(mediaId, filePath).then((result) => {
      if (!result.ok) setFileActionMessage(result.error.message)
    })
  }

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
    if (tab !== 'browse') return
    void window.discdock.files.annotations(mediaId).then((result) => {
      if (result.ok) setAnnotations(result.data)
    })
    void window.discdock.tags.list().then((result) => {
      if (result.ok) setAllTagNames(result.data)
    })
  }, [mediaId, tab])

  const startEditing = (path: string, field: 'tags' | 'note'): void => {
    const annotation = annotations[path]
    setEditingCell({ path, field })
    setEditingValue(field === 'tags' ? (annotation?.tags ?? []).join(', ') : (annotation?.note ?? ''))
  }

  const saveEditing = (): void => {
    if (!editingCell) return
    const { path, field } = editingCell
    setEditingCell(null)

    const request =
      field === 'tags'
        ? window.discdock.files.setTags(
            mediaId,
            path,
            Array.from(new Set(editingValue.split(',').map((tag) => tag.trim()).filter(Boolean)))
          )
        : window.discdock.files.setNote(mediaId, path, editingValue.trim() || null)

    void request.then((result) => {
      if (!result.ok) return
      setAnnotations((current) => ({ ...current, [path]: result.data }))
      if (field === 'tags') {
        void window.discdock.tags.list().then((tagsResult) => {
          if (tagsResult.ok) setAllTagNames(tagsResult.data)
        })
      }
    })
  }

  useEffect(() => {
    if (tab !== 'history') return
    void window.discdock.scan.history(mediaId).then((result) => {
      if (result.ok) setHistory(result.data)
    })
  }, [mediaId, tab])

  useEffect(() => {
    if (tab !== 'errors') return
    void window.discdock.scan.errors(mediaId).then((result) => {
      if (result.ok) setErrors(result.data)
    })
  }, [mediaId, tab])

  useEffect(() => {
    void Promise.all([window.discdock.settings.get(), window.discdock.customFields.getForMedia(mediaId)]).then(
      ([settingsResult, fieldsResult]) => {
        if (settingsResult.ok) setCustomFieldNames((settingsResult.data as AppSettings).customFieldNames)
        if (fieldsResult.ok) setCustomFields(fieldsResult.data)
      }
    )
  }, [mediaId])

  const customFieldValue = (fieldName: string): string =>
    customFields.find((field) => field.fieldName === fieldName)?.fieldValue ?? ''

  const saveCustomField = (fieldName: string, value: string): void => {
    void window.discdock.customFields.setForMedia(mediaId, fieldName, value || null).then((result) => {
      if (result.ok) {
        setCustomFields((current) => {
          const next = current.filter((field) => field.fieldName !== fieldName)
          if (value) next.push({ fieldName, fieldValue: value })
          return next
        })
      }
    })
  }

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
        <button type="button" className={tab === 'errors' ? 'tab tab--active' : 'tab'} onClick={() => setTab('errors')}>
          Errors
        </button>
      </div>

      {tab === 'overview' && (
        <div className="media-detail__overview">
          {coverDataUrl && (
            <img className="media-detail__cover" src={coverDataUrl} alt={`${item.label} cover art`} />
          )}
          <p>Capacity: {item.capacityBytes ? formatBytes(item.capacityBytes) : 'Unknown'}</p>
          <p>Last scanned: {item.lastScannedAt ?? 'Never'}</p>
          <p>Last verified: {item.lastVerifiedAt ?? 'Never'}</p>
          <button
            type="button"
            className="button button--small"
            onClick={() => {
              void window.discdock.media.markVerified(mediaId).then((result) => {
                if (result.ok) setItem(result.data)
              })
            }}
          >
            Mark Verified Now
          </button>
          <p>Notes: {item.notes ?? '—'}</p>
          {customFieldNames.length > 0 && (
            <div className="media-detail__custom-fields">
              <h2>Custom Fields</h2>
              {customFieldNames.map((fieldName) => (
                <label key={fieldName}>
                  {fieldName}
                  <input
                    type="text"
                    defaultValue={customFieldValue(fieldName)}
                    onBlur={(event) => saveCustomField(fieldName, event.target.value.trim())}
                  />
                </label>
              ))}
            </div>
          )}
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

          {fileActionMessage && <p className="media-detail__status">{fileActionMessage}</p>}

          {entries.length === 0 ? (
            <p className="media-detail__status">This folder is empty (or hasn't been scanned yet).</p>
          ) : (
            <table className="media-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Kind</th>
                  <th>Size</th>
                  <th>Duration</th>
                  <th>Modified</th>
                  <th>Tags</th>
                  <th>Note</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const annotation = annotations[entry.path]
                  const isEditingTags = editingCell?.path === entry.path && editingCell.field === 'tags'
                  const isEditingNote = editingCell?.path === entry.path && editingCell.field === 'note'
                  return (
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
                      <td>{entry.durationSeconds !== null ? formatDuration(entry.durationSeconds) : '—'}</td>
                      <td>{entry.modifiedAtSrc ?? '—'}</td>
                      <td>
                        {isEditingTags ? (
                          <input
                            type="text"
                            autoFocus
                            list="file-tag-suggestions"
                            className="media-detail__annotation-input"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={saveEditing}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditing()
                              if (e.key === 'Escape') setEditingCell(null)
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => startEditing(entry.path, 'tags')}
                          >
                            {(annotation?.tags ?? []).length > 0 ? annotation.tags.join(', ') : 'Add tags…'}
                          </button>
                        )}
                      </td>
                      <td className="media-detail__note-cell" title={annotation?.note ?? undefined}>
                        {isEditingNote ? (
                          <input
                            type="text"
                            autoFocus
                            className="media-detail__annotation-input"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={saveEditing}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditing()
                              if (e.key === 'Escape') setEditingCell(null)
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => startEditing(entry.path, 'note')}
                          >
                            {annotation?.note ?? 'Add note…'}
                          </button>
                        )}
                      </td>
                      <td className="media-detail__file-actions">
                        {!entry.isDirectory && (
                          <button
                            type="button"
                            className="button button--small"
                            onClick={() => openFile(entry.path)}
                          >
                            Open
                          </button>
                        )}
                        <button
                          type="button"
                          className="button button--small"
                          onClick={() => revealFile(entry.path)}
                        >
                          Show in Files
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <datalist id="file-tag-suggestions">
            {allTagNames.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
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

      {tab === 'errors' && (
        <div className="media-detail__errors">
          {errors.length === 0 ? (
            <p className="media-detail__status">No scan errors recorded.</p>
          ) : (
            <table className="media-table">
              <thead>
                <tr>
                  <th>Path</th>
                  <th>Type</th>
                  <th>Message</th>
                  <th>Scan Started</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((entry, index) => (
                  <tr key={`${entry.path}-${entry.scanStartedAt}-${index}`}>
                    <td>{entry.path}</td>
                    <td>{entry.errorType}</td>
                    <td>{entry.message}</td>
                    <td>{entry.scanStartedAt}</td>
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
