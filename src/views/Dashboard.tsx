import { useEffect, useState } from 'react'
import type { DashboardSummary, DetectedDevice } from '../../shared/types'

const EMPTY_SUMMARY: DashboardSummary = {
  totalMediaItems: 0,
  totalFiles: 0,
  totalSizeBytes: 0,
  mediaNeedingVerification: 0
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** exponent).toFixed(1)} ${units[exponent]}`
}

export default function Dashboard(): JSX.Element {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY)
  const [devices, setDevices] = useState<DetectedDevice[]>([])
  const [registered, setRegistered] = useState<Set<string>>(new Set())
  const [scanningDevices, setScanningDevices] = useState<Set<string>>(new Set())
  const [jobToDevice, setJobToDevice] = useState<Record<number, string>>({})

  const refreshSummary = (): void => {
    void window.discdock.dashboard.getSummary().then((result) => {
      if (result.ok) setSummary(result.data)
    })
  }

  useEffect(() => {
    refreshSummary()
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

  const handleRegister = (device: DetectedDevice): void => {
    void window.discdock.media
      .create({
        label: device.label ?? device.mountPoint.split('/').pop() ?? device.devicePath,
        mediaType: device.isOptical ? 'dvd' : 'external_hdd',
        capacityBytes: device.sizeBytes,
        physicalLocation: null,
        notes: null,
        deviceFingerprint: device.uuid ?? device.devicePath
      })
      .then((result) => {
        if (result.ok) {
          setRegistered((prev) => new Set(prev).add(device.devicePath))
          refreshSummary()

          if (window.confirm(`"${result.data.label}" was added. Scan it now?`)) {
            setScanningDevices((prev) => new Set(prev).add(device.devicePath))
            void window.discdock.scan.start(result.data.id, device.mountPoint).then((startResult) => {
              if (startResult.ok) {
                setJobToDevice((prev) => ({ ...prev, [startResult.data.jobId]: device.devicePath }))
              }
            })
          }
        }
      })
  }

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
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

      <h2>Detected Devices</h2>
      {devices.length === 0 ? (
        <p className="dashboard__empty-devices">
          No removable media currently connected. Insert a USB drive, disc, or external drive to
          register it here.
        </p>
      ) : (
        <table className="device-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Mount Point</th>
              <th>Filesystem</th>
              <th>Size</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.devicePath}>
                <td>{device.label ?? '(unlabeled)'}</td>
                <td>{device.mountPoint}</td>
                <td>{device.fsType ?? '—'}</td>
                <td>{device.sizeBytes ? formatBytes(device.sizeBytes) : '—'}</td>
                <td>
                  {scanningDevices.has(device.devicePath) ? (
                    <span className="status-badge">Scanning…</span>
                  ) : registered.has(device.devicePath) ? (
                    <span className="status-badge">Registered</span>
                  ) : (
                    <button type="button" className="button button--small" onClick={() => handleRegister(device)}>
                      Register as Media
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
