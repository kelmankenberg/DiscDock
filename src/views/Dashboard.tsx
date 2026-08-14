import HelpButton from '../components/HelpButton'
import { useEffect, useState } from 'react'
import { Disc3, Usb } from 'lucide-react'
import type { DashboardSummary, DetectedDevice, MediaItem } from '../../shared/types'

const EMPTY_SUMMARY: DashboardSummary = {
  totalMediaItems: 0,
  totalFiles: 0,
  totalSizeBytes: 0,
  mediaNeedingVerification: 0,
  recentScans: [],
  attention: []
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** exponent).toFixed(1)} ${units[exponent]}`
}

export default function Dashboard({
  onShowInLibrary
}: {
  onShowInLibrary: (mediaId: number) => void
}): JSX.Element {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY)
  const [devices, setDevices] = useState<DetectedDevice[]>([])
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [scanningDevices, setScanningDevices] = useState<Set<string>>(new Set())
  const [, setJobToDevice] = useState<Record<number, string>>({})
  const [promptedDevices, setPromptedDevices] = useState<Set<string>>(new Set())
  const [ejectingDevices, setEjectingDevices] = useState<Set<string>>(new Set())
  const [ejectMessage, setEjectMessage] = useState<string | null>(null)

  const findMediaForDevice = (device: DetectedDevice): MediaItem | undefined =>
    mediaItems.find((m) => m.deviceFingerprint === (device.uuid ?? device.devicePath))

  const refreshSummary = (): void => {
    void window.discdock.dashboard.getSummary().then((result) => {
      if (result.ok) setSummary(result.data)
    })
  }

  const refreshMediaItems = (): void => {
    void window.discdock.media.list().then((result) => {
      if (result.ok) setMediaItems(result.data)
    })
  }

  const startScanFor = (mediaId: number, device: DetectedDevice): void => {
    setScanningDevices((prev) => new Set(prev).add(device.devicePath))
    // Audio CDs have no mount point to walk; they are cataloged from the disc's raw TOC.
    const request = device.isAudioCd
      ? window.discdock.scan.startAudioCd(mediaId, device.devicePath)
      : window.discdock.scan.start(mediaId, device.mountPoint)

    void request.then((startResult) => {
      if (startResult.ok) {
        setJobToDevice((prev) => ({ ...prev, [startResult.data.jobId]: device.devicePath }))
      } else {
        setScanningDevices((prev) => {
          const next = new Set(prev)
          next.delete(device.devicePath)
          return next
        })
      }
    })
  }

  useEffect(() => {
    refreshSummary()
    refreshMediaItems()
    void window.discdock.devices.list().then((result) => {
      if (result.ok) setDevices(result.data)
    })

    const unsubConnect = window.discdock.devices.onConnected((device) => {
      setDevices((prev) => [...prev.filter((d) => d.devicePath !== device.devicePath), device])
    })
    const unsubDisconnect = window.discdock.devices.onDisconnected((devicePath) => {
      setDevices((prev) => prev.filter((d) => d.devicePath !== devicePath))
    })

    const finishScan = (jobId: number): void => {
      setJobToDevice((current) => {
        const devicePath = current[jobId]
        if (devicePath !== undefined) {
          setScanningDevices((prev) => {
            const next = new Set(prev)
            next.delete(devicePath)
            return next
          })
        }
        const next = { ...current }
        delete next[jobId]
        return next
      })
      refreshSummary()
      refreshMediaItems()
    }
    const unsubCompleted = window.discdock.scan.onCompleted(({ jobId }) => finishScan(jobId))
    const unsubFailed = window.discdock.scan.onFailed(({ jobId }) => finishScan(jobId))
    const unsubCancelled = window.discdock.scan.onCancelled(({ jobId }) => finishScan(jobId))

    return () => {
      unsubConnect()
      unsubDisconnect()
      unsubCompleted()
      unsubFailed()
      unsubCancelled()
    }
  }, [])

  // Prompt to scan when a known-but-never-scanned media item's device is (re)detected.
  useEffect(() => {
    for (const device of devices) {
      if (promptedDevices.has(device.devicePath)) continue
      const matched = findMediaForDevice(device)
      if (!matched || matched.lastScannedAt) continue

      setPromptedDevices((prev) => new Set(prev).add(device.devicePath))
      if (window.confirm(`"${matched.label}" has been added but never scanned. Scan it now?`)) {
        startScanFor(matched.id, device)
      }
      break // avoid stacking multiple blocking confirm() dialogs at once
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, mediaItems])

  const handleRegister = (device: DetectedDevice): void => {
    void window.discdock.media
      .create({
        label: device.isAudioCd
          ? (device.label ?? 'Audio CD')
          : (device.label ?? device.mountPoint.split('/').pop() ?? device.devicePath),
        mediaType: device.isAudioCd ? 'cd' : device.isOptical ? 'dvd' : 'external_hdd',
        capacityBytes: device.sizeBytes,
        physicalLocation: null,
        notes: null,
        deviceFingerprint: device.uuid ?? device.devicePath
      })
      .then((result) => {
        if (result.ok) {
          refreshSummary()
          refreshMediaItems()
          setPromptedDevices((prev) => new Set(prev).add(device.devicePath))

          if (window.confirm(`"${result.data.label}" was added. Scan it now?`)) {
            startScanFor(result.data.id, device)
          }
        }
      })
  }

  const handleEject = (device: DetectedDevice): void => {
    setEjectingDevices((prev) => new Set(prev).add(device.devicePath))
    setEjectMessage(null)
    void window.discdock.devices.eject(device.devicePath, device.isOptical).then((result) => {
      setEjectingDevices((prev) => {
        const next = new Set(prev)
        next.delete(device.devicePath)
        return next
      })
      setEjectMessage(
        result.ok
          ? `${device.label ?? device.devicePath}: ${result.data.message}`
          : `Eject failed: ${result.error.message}`
      )
    })
  }

  return (
    <div className="dashboard">
      <div className="page-header"><h1>Dashboard</h1><HelpButton topicId="dashboard" /></div>
      <div className="dashboard__cards">
        <div className="card">
          <span className="card__value">{summary.totalMediaItems}</span>
          <span className="card__label">Total Media Items</span>
        </div>
        <div className="card">
          <span className="card__value">{summary.totalFiles}</span>
          <span className="card__label">Total Files Catalogued</span>
        </div>
        <div className="card">
          <span className="card__value">{formatBytes(summary.totalSizeBytes)}</span>
          <span className="card__label">Total Catalogued Size</span>
        </div>
        <div className="card">
          <span className="card__value">{summary.mediaNeedingVerification}</span>
          <span className="card__label">Media Needing Verification</span>
        </div>
      </div>

      <div className="dashboard__panels">
        <section className="dashboard__panel">
          <h2>Recent Scan Activity</h2>
          {summary.recentScans.length === 0 ? <p className="dashboard__empty-devices">No scans yet.</p> : (
            <ul className="dashboard__activity-list">
              {summary.recentScans.map((scan) => (
                <li key={scan.jobId}>
                  <strong>{scan.mediaLabel}</strong>
                  <span>{scan.status} · {scan.filesAdded} added · {scan.filesModified} modified · {scan.filesRemoved} removed</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="dashboard__panel">
          <h2>Needs Attention</h2>
          {summary.attention.length === 0 ? <p className="dashboard__empty-devices">Nothing needs attention.</p> : (
            <ul className="dashboard__attention-list">
              {summary.attention.map((item) => <li key={`${item.kind}-${item.mediaItemId}`}><strong>{item.mediaLabel}</strong><span>{item.detail}</span></li>)}
            </ul>
          )}
        </section>
      </div>

      <h2>Detected Devices</h2>
      {ejectMessage && <p className="dashboard__eject-message">{ejectMessage}</p>}
      {devices.length === 0 ? (
        <p className="dashboard__empty-devices">
          No removable media currently connected. Insert a USB drive, disc, or external drive to
          register it here.
        </p>
      ) : (
        <table className="device-table">
          <thead>
            <tr>
              <th></th>
              <th>Label</th>
              <th>Mount Point</th>
              <th>Filesystem</th>
              <th>Size</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => {
              const matched = findMediaForDevice(device)
              return (
                <tr key={device.devicePath}>
                  <td>
                    {device.isOptical ? (
                      <Disc3 size={16} aria-hidden="true" />
                    ) : (
                      <Usb size={16} aria-hidden="true" />
                    )}
                  </td>
                  <td>{device.label ?? '(unlabeled)'}</td>
                  <td>{device.mountPoint || (device.isAudioCd ? 'Audio CD (no filesystem)' : '—')}</td>
                  <td>{device.fsType ?? '—'}</td>
                  <td>{device.sizeBytes ? formatBytes(device.sizeBytes) : '—'}</td>
                  <td>
                    {scanningDevices.has(device.devicePath) ? (
                      <span className="status-badge">Scanning…</span>
                    ) : !matched ? (
                      <button type="button" className="button button--small" onClick={() => handleRegister(device)}>
                        Register as Media
                      </button>
                    ) : !matched.lastScannedAt ? (
                      <button
                        type="button"
                        className="button button--small"
                        onClick={() => startScanFor(matched.id, device)}
                      >
                        Never Scanned — Scan Now
                      </button>
                    ) : (
                      <span className="status-badge">Registered</span>
                    )}
                  </td>
                  <td className="dashboard__device-actions">
                    {matched && (
                      <button
                        type="button"
                        className="button button--small"
                        onClick={() => onShowInLibrary(matched.id)}
                      >
                        Show in Media Library
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button--small"
                      disabled={ejectingDevices.has(device.devicePath)}
                      onClick={() => handleEject(device)}
                    >
                      {ejectingDevices.has(device.devicePath)
                        ? 'Ejecting…'
                        : device.isOptical
                          ? 'Eject'
                          : 'Safely Remove'}
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
