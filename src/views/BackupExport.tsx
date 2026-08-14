import { useEffect, useState } from 'react'
import type { ExportFormat, MediaItem } from '../../shared/types'
import './BackupExport.css'

export default function BackupExport(): JSX.Element {
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [scope, setScope] = useState<'all' | 'media'>('all')
  const [selectedMediaId, setSelectedMediaId] = useState('')
  const [format, setFormat] = useState<ExportFormat>('csv')

  useEffect(() => {
    void window.discdock.media.list().then((result) => {
      if (result.ok) setMediaItems(result.data)
    })
  }, [])

  const handleBackup = (): void => {
    void window.discdock.dialogs.pickSaveFile(`discdock-backup-${Date.now()}.sqlite3`).then((pick) => {
      if (!pick.ok || !pick.data.path) return
      setBusy(true)
      setStatus(null)
      void window.discdock.backup.run(pick.data.path).then((result) => {
        setBusy(false)
        setStatus(result.ok ? `Backup saved to ${pick.data.path}` : `Backup failed: ${result.error.message}`)
      })
    })
  }

  const handleRestore = (): void => {
    void window.discdock.dialogs.pickOpenFile().then((pick) => {
      if (!pick.ok || !pick.data.path) return
      const confirmed = window.confirm(
        'Restoring will replace your current catalog with the selected backup file. ' +
          'A safety backup of your current data will be taken first. Continue?'
      )
      if (!confirmed) return

      setBusy(true)
      setStatus(null)
      void window.discdock.backup.restore(pick.data.path!).then((result) => {
        setBusy(false)
        setStatus(
          result.ok
            ? `Restored successfully. Your previous data was saved to ${result.data.safetyBackupPath}`
            : `Restore failed: ${result.error.message}`
        )
      })
    })
  }

  const handleExport = (): void => {
    if (scope === 'media' && !selectedMediaId) return
    void window.discdock.dialogs.pickSaveFile(`discdock-catalog.${format}`).then((pick) => {
      if (!pick.ok || !pick.data.path) return
      setBusy(true)
      setStatus(null)
      const exportScope = scope === 'all' ? { type: 'all' as const } : { type: 'media' as const, mediaId: Number(selectedMediaId) }
      void window.discdock.export.run(exportScope, format, pick.data.path).then((result) => {
        setBusy(false)
        setStatus(result.ok ? `Exported ${result.data.fileCount} files to ${pick.data.path}` : `Export failed: ${result.error.message}`)
      })
    })
  }

  return (
    <div className="backup-export-view">
      <h1>Backup / Export</h1>

      <section className="settings-section">
        <h2>Database Backup</h2>
        <p className="backup-export-view__hint">
          Back up your entire catalog (all media, files, tags, and scan history) to a single
          portable file, or restore from a previous backup.
        </p>
        <div className="backup-export-view__actions">
          <button type="button" className="button button--primary" disabled={busy} onClick={handleBackup}>
            Backup Now
          </button>
          <button type="button" className="button" disabled={busy} onClick={handleRestore}>
            Restore from Backup
          </button>
        </div>
        {busy && <p className="backup-export-view__status">Working…</p>}
        {status && <p className="backup-export-view__status">{status}</p>}
      </section>

      <section className="settings-section">
        <h2>Catalog Export</h2>
        <p className="backup-export-view__hint">Export cataloged files and their media metadata for use in spreadsheets or other tools.</p>
        <div className="backup-export-view__export-controls">
          <label>
            Scope
            <select value={scope} onChange={(e) => setScope(e.target.value as 'all' | 'media')}>
              <option value="all">All media</option>
              <option value="media">Single media item</option>
            </select>
          </label>
          {scope === 'media' && (
            <label>
              Media item
              <select value={selectedMediaId} onChange={(e) => setSelectedMediaId(e.target.value)}>
                <option value="">Choose media…</option>
                {mediaItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Format
            <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </label>
          <button type="button" className="button button--primary" disabled={busy || (scope === 'media' && !selectedMediaId)} onClick={handleExport}>
            Export Catalog
          </button>
        </div>
      </section>
    </div>
  )
}
