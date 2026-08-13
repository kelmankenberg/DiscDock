import { useEffect, useState } from 'react'
import { Scan, CircleX, Archive, Trash2, Eject as EjectIcon, Disc3, Usb } from 'lucide-react'
import { MEDIA_TYPES } from '../../shared/types'
import type { DetectedDevice, MediaItem, MediaItemInput, MediaType, ScanProgress } from '../../shared/types'
import './MediaLibrary.css'

const EMPTY_FORM: MediaItemInput = {
  label: '',
  mediaType: 'other',
  capacityBytes: null,
  physicalLocation: null,
  notes: null
}

function mediaTypeLabel(mediaType: MediaType): string {
  return MEDIA_TYPES.find((t) => t.value === mediaType)?.label ?? mediaType
}

type SortKey = 'label' | 'mediaType' | 'physicalLocation' | 'status' | 'lastScannedAt'

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'label', label: 'Label' },
  { key: 'mediaType', label: 'Type' },
  { key: 'physicalLocation', label: 'Location' },
  { key: 'status', label: 'Status' },
  { key: 'lastScannedAt', label: 'Last Scanned' }
]

function sortValue(item: MediaItem, key: SortKey): string {
  switch (key) {
    case 'mediaType':
      return mediaTypeLabel(item.mediaType)
    case 'physicalLocation':
      return item.physicalLocation ?? ''
    case 'lastScannedAt':
      return item.lastScannedAt ?? ''
    default:
      return item[key] ?? ''
  }
}

interface ActiveScan {
  jobId: number
  filesProcessed: number
  currentPath: string
}

export default function MediaLibrary({ onOpenDetail }: { onOpenDetail: (mediaId: number) => void }): JSX.Element {
  const [items, setItems] = useState<MediaItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<MediaItemInput>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [scansByMedia, setScansByMedia] = useState<Record<number, ActiveScan>>({})
  const [jobToMedia, setJobToMedia] = useState<Record<number, number>>({})
  const [sortKey, setSortKey] = useState<SortKey>('label')
  const [sortAsc, setSortAsc] = useState(true)

  const handleSort = (key: SortKey): void => {
    if (key === sortKey) {
      setSortAsc((prev) => !prev)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const [devices, setDevices] = useState<DetectedDevice[]>([])
  const [deviceMountPoint, setDeviceMountPoint] = useState<string | null>(null)
  const [containerFilter, setContainerFilter] = useState<string>('')
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null)
  const [editingLocationValue, setEditingLocationValue] = useState('')

  const knownLocations = Array.from(
    new Set(items.map((item) => item.physicalLocation).filter((loc): loc is string => Boolean(loc)))
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

  const filteredItems = containerFilter ? items.filter((item) => item.physicalLocation === containerFilter) : items

  const sortedItems = [...filteredItems].sort((a, b) => {
    const result = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey), undefined, { sensitivity: 'base' })
    return sortAsc ? result : -result
  })

  const findDeviceForItem = (item: MediaItem): DetectedDevice | undefined =>
    devices.find((d) => item.deviceFingerprint && (d.uuid ?? d.devicePath) === item.deviceFingerprint)

  const unregisteredDevices = devices.filter(
    (d) => !items.some((item) => item.deviceFingerprint === (d.uuid ?? d.devicePath))
  )

  const [ejectingIds, setEjectingIds] = useState<Set<number>>(new Set())
  const [ejectMessage, setEjectMessage] = useState<string | null>(null)

  const handleEject = (item: MediaItem, device: DetectedDevice): void => {
    setEjectingIds((prev) => new Set(prev).add(item.id))
    setEjectMessage(null)
    void window.discdock.devices.eject(device.devicePath, device.isOptical).then((result) => {
      setEjectingIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      setEjectMessage(result.ok ? `${item.label}: ${result.data.message}` : `Eject failed: ${result.error.message}`)
    })
  }

  const handleAddDetectedDevice = (device: DetectedDevice): void => {
    setShowForm(true)
    handleUseDevice(device)
  }

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null)
  const [batchLocationValue, setBatchLocationValue] = useState('')

  const handleRowCheckboxClick = (
    event: React.MouseEvent<HTMLInputElement>,
    item: MediaItem,
    index: number
  ): void => {
    if (event.shiftKey && lastClickedIndex !== null) {
      const [start, end] = [lastClickedIndex, index].sort((a, b) => a - b)
      const rangeIds = sortedItems.slice(start, end + 1).map((i) => i.id)
      setSelectedIds((prev) => new Set([...prev, ...rangeIds]))
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(item.id)) next.delete(item.id)
        else next.add(item.id)
        return next
      })
    }
    setLastClickedIndex(index)
  }

  const handleSelectAll = (): void => {
    setSelectedIds((prev) =>
      prev.size === sortedItems.length ? new Set() : new Set(sortedItems.map((i) => i.id))
    )
  }

  const clearSelection = (): void => {
    setSelectedIds(new Set())
    setLastClickedIndex(null)
  }

  const handleBatchSetLocation = (): void => {
    const value = batchLocationValue.trim() || null
    void Promise.all(
      Array.from(selectedIds).map((id) => window.discdock.media.update(id, { physicalLocation: value }))
    ).then(() => {
      setBatchLocationValue('')
      clearSelection()
      loadItems()
    })
  }

  const handleBatchRetire = (): void => {
    if (!window.confirm(`Retire ${selectedIds.size} selected media item(s)?`)) return
    void Promise.all(Array.from(selectedIds).map((id) => window.discdock.media.retire(id))).then(() => {
      clearSelection()
      loadItems()
    })
  }

  const handleBatchDelete = (): void => {
    if (!window.confirm(`Delete ${selectedIds.size} selected media item(s) and their catalogs? This cannot be undone.`))
      return
    void Promise.all(Array.from(selectedIds).map((id) => window.discdock.media.delete(id))).then(() => {
      clearSelection()
      loadItems()
    })
  }

  const loadItems = (): void => {
    void window.discdock.media.list().then((result) => {
      if (result.ok) setItems(result.data)
    })
  }

  useEffect(loadItems, [])

  useEffect(() => {
    void window.discdock.devices.list().then((result) => {
      if (result.ok) setDevices(result.data)
    })
    const unsubConnect = window.discdock.devices.onConnected((device) => {
      setDevices((prev) => [...prev.filter((d) => d.devicePath !== device.devicePath), device])
    })
    const unsubDisconnect = window.discdock.devices.onDisconnected((devicePath) => {
      setDevices((prev) => prev.filter((d) => d.devicePath !== devicePath))
    })
    return () => {
      unsubConnect()
      unsubDisconnect()
    }
  }, [])

  useEffect(() => {
    const unsubProgress = window.discdock.scan.onProgress((progress: ScanProgress) => {
      setJobToMedia((current) => {
        const mediaId = current[progress.jobId]
        if (mediaId === undefined) return current
        setScansByMedia((prevScans) => ({
          ...prevScans,
          [mediaId]: {
            jobId: progress.jobId,
            filesProcessed: progress.filesProcessed,
            currentPath: progress.currentPath
          }
        }))
        return current
      })
    })

    const finishScan = (jobId: number): void => {
      setJobToMedia((current) => {
        const mediaId = current[jobId]
        if (mediaId !== undefined) {
          setScansByMedia((prevScans) => {
            const next = { ...prevScans }
            delete next[mediaId]
            return next
          })
        }
        const next = { ...current }
        delete next[jobId]
        return next
      })
      loadItems()
    }

    const unsubCompleted = window.discdock.scan.onCompleted(({ jobId }) => finishScan(jobId))
    const unsubFailed = window.discdock.scan.onFailed(({ jobId }) => finishScan(jobId))
    const unsubCancelled = window.discdock.scan.onCancelled(({ jobId }) => finishScan(jobId))

    return () => {
      unsubProgress()
      unsubCompleted()
      unsubFailed()
      unsubCancelled()
    }
  }, [])

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault()
    setError(null)
    void window.discdock.media.create(form).then((result) => {
      if (result.ok) {
        setForm(EMPTY_FORM)
        setShowForm(false)
        loadItems()

        const mediaId = result.data.id
        if (window.confirm(`"${result.data.label}" was added. Scan it now?`)) {
          if (deviceMountPoint) {
            beginScanWithPath(mediaId, deviceMountPoint)
          } else {
            handleScan(mediaId)
          }
        }
        setDeviceMountPoint(null)
      } else {
        setError(result.error.message)
      }
    })
  }

  const handleUseDevice = (device: DetectedDevice): void => {
    setForm({
      label: device.label ?? device.mountPoint.split('/').pop() ?? device.devicePath,
      mediaType: device.isOptical ? 'dvd' : 'external_hdd',
      capacityBytes: device.sizeBytes,
      physicalLocation: null,
      notes: null,
      deviceFingerprint: device.uuid ?? device.devicePath
    })
    setDeviceMountPoint(device.mountPoint)
  }

  const handleRetire = (id: number): void => {
    void window.discdock.media.retire(id).then((result) => {
      if (result.ok) loadItems()
    })
  }

  const handleDelete = (id: number): void => {
    if (!window.confirm('Delete this media item and its catalog? This cannot be undone.')) return
    void window.discdock.media.delete(id).then((result) => {
      if (result.ok) loadItems()
    })
  }

  const beginScanWithPath = (mediaId: number, rootPath: string): void => {
    void window.discdock.scan.start(mediaId, rootPath).then((startResult) => {
      if (startResult.ok) {
        const jobId = startResult.data.jobId
        setJobToMedia((prev) => ({ ...prev, [jobId]: mediaId }))
        setScansByMedia((prev) => ({ ...prev, [mediaId]: { jobId, filesProcessed: 0, currentPath: '' } }))
      }
    })
  }

  const handleScan = (mediaId: number): void => {
    void window.discdock.dialogs.pickFolder().then((pickResult) => {
      if (!pickResult.ok || !pickResult.data.path) return
      beginScanWithPath(mediaId, pickResult.data.path)
    })
  }

  const handleCancelScan = (mediaId: number): void => {
    const scan = scansByMedia[mediaId]
    if (scan) void window.discdock.scan.cancel(scan.jobId)
  }

  const startEditingLocation = (item: MediaItem): void => {
    setEditingLocationId(item.id)
    setEditingLocationValue(item.physicalLocation ?? '')
  }

  const saveEditingLocation = (id: number): void => {
    const value = editingLocationValue.trim() || null
    setEditingLocationId(null)
    void window.discdock.media.update(id, { physicalLocation: value }).then((result) => {
      if (result.ok) loadItems()
    })
  }

  return (
    <div className="media-library">
      <div className="media-library__header">
        <h1>Media Library</h1>
        <button type="button" className="button button--primary" onClick={() => setShowForm(true)}>
          Add Media
        </button>
      </div>

      {!showForm && unregisteredDevices.length > 0 && (
        <div className="new-media-banner">
          {unregisteredDevices.map((device) => (
            <div key={device.devicePath} className="new-media-banner__item">
              <span>
                {device.isOptical ? <Disc3 size={14} aria-hidden="true" /> : <Usb size={14} aria-hidden="true" />} New
                media detected: <strong>{device.label ?? device.mountPoint.split('/').pop()}</strong> — not yet
                registered.
              </span>
              <button
                type="button"
                className="button button--small button--primary"
                onClick={() => handleAddDetectedDevice(device)}
              >
                Add Media
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form className="media-form" onSubmit={handleSubmit}>
          {error && <div className="media-form__error">{error}</div>}

          {devices.length > 0 && (
            <div className="detected-devices-picker">
              <span className="detected-devices-picker__label">Detected media (click to fill in the form):</span>
              <div className="detected-devices-picker__list">
                {devices.map((device) => (
                  <button
                    type="button"
                    key={device.devicePath}
                    className="button button--small"
                    onClick={() => handleUseDevice(device)}
                  >
                    {device.isOptical ? <Disc3 size={14} aria-hidden="true" /> : <Usb size={14} aria-hidden="true" />}{' '}
                    {device.label ?? device.mountPoint.split('/').pop()}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label>
            Label
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              required
            />
          </label>
          <label>
            Media Type
            <select
              value={form.mediaType}
              onChange={(e) => setForm({ ...form, mediaType: e.target.value as MediaType })}
            >
              {MEDIA_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Container / Physical Location
            <input
              type="text"
              list="location-suggestions"
              value={form.physicalLocation ?? ''}
              onChange={(e) => setForm({ ...form, physicalLocation: e.target.value || null })}
              placeholder="e.g. CD Spindle #2, Garage / Box 3"
            />
            <datalist id="location-suggestions">
              {knownLocations.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </label>
          <label>
            Notes
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
            />
          </label>
          <div className="media-form__actions">
            <button type="submit" className="button button--primary">
              Save
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                setShowForm(false)
                setDeviceMountPoint(null)
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className="empty-state">
          <p>No media registered yet. Click "Add Media" to catalog your first item.</p>
        </div>
      ) : (
        <>
          {knownLocations.length > 0 && (
            <div className="container-filter">
              <label>
                Container
                <select value={containerFilter} onChange={(e) => setContainerFilter(e.target.value)}>
                  <option value="">All containers</option>
                  {knownLocations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {ejectMessage && <p className="media-library__eject-message">{ejectMessage}</p>}

          {selectedIds.size > 0 && (
            <div className="batch-actions">
              <span className="batch-actions__count">{selectedIds.size} selected</span>
              <input
                type="text"
                list="location-suggestions"
                placeholder="Set container…"
                value={batchLocationValue}
                onChange={(e) => setBatchLocationValue(e.target.value)}
              />
              <button type="button" className="button button--small" onClick={handleBatchSetLocation}>
                Apply Container
              </button>
              <button type="button" className="button button--small" onClick={handleBatchRetire}>
                Retire Selected
              </button>
              <button type="button" className="button button--small button--danger" onClick={handleBatchDelete}>
                Delete Selected
              </button>
              <button type="button" className="button button--small" onClick={clearSelection}>
                Clear Selection
              </button>
            </div>
          )}

          <table className="media-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={selectedIds.size > 0 && selectedIds.size === sortedItems.length}
                  onChange={handleSelectAll}
                  aria-label="Select all"
                />
              </th>
              {COLUMNS.map((col) => (
                <th key={col.key}>
                  <button type="button" className="media-table__sort-header" onClick={() => handleSort(col.key)}>
                    {col.label}
                    {sortKey === col.key ? (sortAsc ? ' ▲' : ' ▼') : ''}
                  </button>
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, index) => {
              const scan = scansByMedia[item.id]
              const presentDevice = findDeviceForItem(item)
              const rowClasses = [
                selectedIds.has(item.id) ? 'media-table__row--selected' : '',
                presentDevice ? 'media-table__row--present' : ''
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <tr key={item.id} className={rowClasses}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => {}}
                      onClick={(e) => handleRowCheckboxClick(e, item, index)}
                      aria-label={`Select ${item.label}`}
                    />
                  </td>
                  <td>
                    <button type="button" className="link-button" onClick={() => onOpenDetail(item.id)}>
                      {item.label}
                    </button>
                  </td>
                  <td>{mediaTypeLabel(item.mediaType)}</td>
                  <td>
                    {editingLocationId === item.id ? (
                      <input
                        type="text"
                        autoFocus
                        list="location-suggestions"
                        className="media-table__location-input"
                        value={editingLocationValue}
                        onChange={(e) => setEditingLocationValue(e.target.value)}
                        onBlur={() => saveEditingLocation(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditingLocation(item.id)
                          if (e.key === 'Escape') setEditingLocationId(null)
                        }}
                      />
                    ) : (
                      <button type="button" className="link-button" onClick={() => startEditingLocation(item)}>
                        {item.physicalLocation ?? 'Set container…'}
                      </button>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge status-badge--${item.status}`}>{item.status}</span>
                  </td>
                  <td>
                    {scan ? (
                      <span className="scan-progress">
                        Scanning… {scan.filesProcessed} files
                      </span>
                    ) : (
                      item.lastScannedAt ?? 'Never'
                    )}
                  </td>
                  <td className="media-table__actions">
                    {scan ? (
                      <button
                        type="button"
                        className="button button--small button--icon-only"
                        title="Cancel scan"
                        aria-label="Cancel scan"
                        onClick={() => handleCancelScan(item.id)}
                      >
                        <CircleX size={16} aria-hidden="true" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button button--small button--icon-only"
                        title="Scan"
                        aria-label="Scan"
                        onClick={() => handleScan(item.id)}
                      >
                        <Scan size={16} aria-hidden="true" />
                      </button>
                    )}
                    {item.status === 'active' && !scan && (
                      <button
                        type="button"
                        className="button button--small button--icon-only"
                        title="Retire"
                        aria-label="Retire"
                        onClick={() => handleRetire(item.id)}
                      >
                        <Archive size={16} aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button--small button--icon-only button--danger"
                      title="Delete"
                      aria-label="Delete"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                    {presentDevice && (
                      <button
                        type="button"
                        className="button button--small button--icon-only"
                        disabled={ejectingIds.has(item.id)}
                        title={
                          ejectingIds.has(item.id)
                            ? 'Ejecting…'
                            : presentDevice.isOptical
                              ? 'Eject'
                              : 'Safely Remove'
                        }
                        aria-label={presentDevice.isOptical ? 'Eject' : 'Safely Remove'}
                        onClick={() => handleEject(item, presentDevice)}
                      >
                        <EjectIcon size={16} aria-hidden="true" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          </table>
        </>
      )}
    </div>
  )
}
