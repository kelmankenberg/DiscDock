import { useEffect, useState } from 'react'
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
  const [devices, setDevices] = useState<DetectedDevice[]>([])
  const [deviceMountPoint, setDeviceMountPoint] = useState<string | null>(null)

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

  return (
    <div className="media-library">
      <div className="media-library__header">
        <h1>Media Library</h1>
        <button type="button" className="button button--primary" onClick={() => setShowForm(true)}>
          Add Media
        </button>
      </div>

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
                    {device.isOptical ? '💿' : '💾'} {device.label ?? device.mountPoint.split('/').pop()}
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
            Physical Location
            <input
              type="text"
              value={form.physicalLocation ?? ''}
              onChange={(e) => setForm({ ...form, physicalLocation: e.target.value || null })}
              placeholder="e.g. Garage > Box 3 > Shelf B"
            />
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
        <table className="media-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Type</th>
              <th>Location</th>
              <th>Status</th>
              <th>Last Scanned</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const scan = scansByMedia[item.id]
              return (
                <tr key={item.id}>
                  <td>
                    <button type="button" className="link-button" onClick={() => onOpenDetail(item.id)}>
                      {item.label}
                    </button>
                  </td>
                  <td>{mediaTypeLabel(item.mediaType)}</td>
                  <td>{item.physicalLocation ?? '—'}</td>
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
                      <button type="button" className="button button--small" onClick={() => handleCancelScan(item.id)}>
                        Cancel
                      </button>
                    ) : (
                      <button type="button" className="button button--small" onClick={() => handleScan(item.id)}>
                        Scan
                      </button>
                    )}
                    {item.status === 'active' && !scan && (
                      <button type="button" className="button button--small" onClick={() => handleRetire(item.id)}>
                        Retire
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button--small button--danger"
                      onClick={() => handleDelete(item.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
