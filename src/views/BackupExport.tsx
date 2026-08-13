import { useState } from 'react'
import './BackupExport.css'

export default function BackupExport(): JSX.Element {
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
    </div>
  )
}
