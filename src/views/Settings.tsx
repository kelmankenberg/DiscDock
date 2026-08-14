import { useEffect, useState } from 'react'
import type { AppSettings, DesktopShortcutStatus, HashMode, Theme, UpdateStatus } from '../../shared/types'
import './Settings.css'
import HelpButton from '../components/HelpButton'

const HASH_MODES: { value: HashMode; label: string }[] = [
  { value: 'none', label: 'None (metadata only, fastest)' },
  { value: 'quick', label: 'Quick (partial hash)' },
  { value: 'full', label: 'Full (SHA-256, most accurate)' }
]

function updateStatusMessage(status: UpdateStatus): string {
  switch (status.state) {
    case 'checking':
      return 'Checking for updates…'
    case 'up-to-date':
      return 'DiscDock is up to date.'
    case 'available':
      return `Version ${status.version} is available.`
    case 'downloading':
      return `Downloading update… ${status.percent}%`
    case 'downloaded':
      return `Version ${status.version} is ready to install.`
    case 'error':
      return status.message
    default:
      return 'No update check has run yet.'
  }
}

export default function Settings(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [newMediaType, setNewMediaType] = useState('')
  const [newFieldName, setNewFieldName] = useState('')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: 'idle' })
  const [shortcut, setShortcut] = useState<DesktopShortcutStatus | null>(null)
  const [shortcutBusy, setShortcutBusy] = useState(false)
  const [shortcutError, setShortcutError] = useState<string | null>(null)

  useEffect(() => {
    void window.discdock.desktopShortcut.status().then((result) => {
      if (result.ok) setShortcut(result.data)
    })
  }, [])

  const toggleShortcut = (create: boolean): void => {
    setShortcutBusy(true)
    setShortcutError(null)
    const action = create
      ? window.discdock.desktopShortcut.create()
      : window.discdock.desktopShortcut.remove()
    void action.then((result) => {
      setShortcutBusy(false)
      if (result.ok) setShortcut(result.data)
      else setShortcutError(result.error.message)
    })
  }

  useEffect(() => {
    void window.discdock.updates.status().then((result) => {
      if (result.ok) setUpdateStatus(result.data)
    })
    return window.discdock.updates.onStatus(setUpdateStatus)
  }, [])

  useEffect(() => {
    void window.discdock.settings.get().then((result) => {
      if (result.ok) setSettings(result.data)
    })
  }, [])

  const save = (patch: Partial<AppSettings>): void => {
    void window.discdock.settings.update(patch).then((result) => {
      if (result.ok) {
        setSettings(result.data)
        if (patch.theme) document.documentElement.dataset.theme = result.data.theme
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      }
    })
  }

  const addMediaType = (): void => {
    if (!settings) return
    const value = newMediaType.trim()
    if (!value || settings.customMediaTypes.includes(value)) return
    save({ customMediaTypes: [...settings.customMediaTypes, value] })
    setNewMediaType('')
  }

  const addFieldName = (): void => {
    if (!settings) return
    const value = newFieldName.trim()
    if (!value || settings.customFieldNames.includes(value)) return
    save({ customFieldNames: [...settings.customFieldNames, value] })
    setNewFieldName('')
  }

  if (!settings) return <div className="settings-view">Loading…</div>

  return (
    <div className="settings-view">
      <div className="page-header"><h1>Settings</h1><HelpButton topicId="settings" /></div>
      {saved && <p className="settings-view__saved">Saved</p>}

      <section className="settings-section">
        <h2>Scanning Defaults</h2>
        <label>
          Default hash mode
          <select
            value={settings.defaultHashMode}
            onChange={(e) => save({ defaultHashMode: e.target.value as HashMode })}
          >
            {HASH_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Exclude patterns (one per line)
          <textarea
            value={settings.excludePatterns.join('\n')}
            onChange={(e) => save({ excludePatterns: e.target.value.split('\n').filter(Boolean) })}
            rows={4}
          />
        </label>
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={settings.followSymlinks}
            onChange={(e) => save({ followSymlinks: e.target.checked })}
          />
          Follow symbolic links during scans
        </label>
        <label className="settings-months-field">
          Maximum simultaneous scans
          <input
            type="number"
            min={1}
            max={8}
            value={settings.maxConcurrentScans}
            onChange={(e) => {
              const value = Number(e.target.value)
              if (Number.isFinite(value) && value >= 1) save({ maxConcurrentScans: Math.trunc(value) })
            }}
          />
        </label>
      </section>

      <section className="settings-section">
        <h2>Appearance</h2>
        <label>
          Theme
          <select value={settings.theme} onChange={(e) => save({ theme: e.target.value as Theme })}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </section>

      <section className="settings-section">
        <h2>Custom Media Types</h2>
        <p>Add media types that are not included in the built-in list.</p>
        <div className="settings-list-editor">
          <input
            type="text"
            value={newMediaType}
            placeholder="e.g. Blu-ray"
            onChange={(e) => setNewMediaType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addMediaType()
            }}
          />
          <button type="button" className="button button--small" onClick={addMediaType}>
            Add
          </button>
        </div>
        <ul className="settings-list-editor__items">
          {settings.customMediaTypes.map((mediaType) => (
            <li key={mediaType}>
              <span>{mediaType}</span>
              <button
                type="button"
                className="button button--small button--danger"
                onClick={() => save({ customMediaTypes: settings.customMediaTypes.filter((value) => value !== mediaType) })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-section">
        <h2>Custom Fields</h2>
        <p>Define metadata fields that can be filled in on each media item.</p>
        <div className="settings-list-editor">
          <input
            type="text"
            value={newFieldName}
            placeholder="e.g. Purchase Date"
            onChange={(e) => setNewFieldName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addFieldName()
            }}
          />
          <button type="button" className="button button--small" onClick={addFieldName}>
            Add
          </button>
        </div>
        <ul className="settings-list-editor__items">
          {settings.customFieldNames.map((fieldName) => (
            <li key={fieldName}>
              <span>{fieldName}</span>
              <button
                type="button"
                className="button button--small button--danger"
                onClick={() => save({ customFieldNames: settings.customFieldNames.filter((value) => value !== fieldName) })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-section">
        <h2>Notifications</h2>
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={settings.notifications.scanCompleted}
            onChange={(e) =>
              save({ notifications: { ...settings.notifications, scanCompleted: e.target.checked } })
            }
          />
          Notify when a scan completes
        </label>
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={settings.notifications.scanFailed}
            onChange={(e) =>
              save({ notifications: { ...settings.notifications, scanFailed: e.target.checked } })
            }
          />
          Notify when a scan fails
        </label>
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={settings.notifications.verificationReminders}
            onChange={(e) =>
              save({ notifications: { ...settings.notifications, verificationReminders: e.target.checked } })
            }
          />
          Remind me about media needing re-verification
        </label>
        <label className="settings-months-field">
          Flag media as needing verification after (months)
          <input
            type="number"
            min={1}
            max={120}
            value={settings.verificationThresholdMonths}
            onChange={(e) => {
              const months = Number(e.target.value)
              if (Number.isFinite(months) && months >= 1) save({ verificationThresholdMonths: Math.trunc(months) })
            }}
          />
        </label>
      </section>

      <section className="settings-section">
        <h2>Updates</h2>
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={settings.autoUpdateEnabled}
            onChange={(e) => save({ autoUpdateEnabled: e.target.checked })}
          />
          Check for updates automatically on startup
        </label>
        <p>{updateStatusMessage(updateStatus)}</p>
        <div className="settings-list-editor">
          <button
            type="button"
            className="button button--small"
            onClick={() => void window.discdock.updates.check()}
          >
            Check Now
          </button>
          {updateStatus.state === 'available' && (
            <button
              type="button"
              className="button button--small button--primary"
              onClick={() => void window.discdock.updates.download()}
            >
              Download Update
            </button>
          )}
          {updateStatus.state === 'downloaded' && (
            <button
              type="button"
              className="button button--small button--primary"
              onClick={() => void window.discdock.updates.install()}
            >
              Restart & Install
            </button>
          )}
        </div>
      </section>

      {shortcut?.supported && (
        <section className="settings-section">
          <h2>Desktop Shortcut</h2>
          <p>
            {shortcut.exists
              ? `A DiscDock launcher is on your desktop (${shortcut.path}).`
              : 'DiscDock is available from your applications menu. You can also add a launcher to your desktop.'}
          </p>
          <div className="settings-list-editor">
            <button
              type="button"
              className={shortcut.exists ? 'button button--small' : 'button button--small button--primary'}
              disabled={shortcutBusy}
              onClick={() => toggleShortcut(!shortcut.exists)}
            >
              {shortcut.exists ? 'Remove Desktop Shortcut' : 'Create Desktop Shortcut'}
            </button>
          </div>
          {shortcutError && <p className="settings-view__error">{shortcutError}</p>}
        </section>
      )}

      <section className="settings-section">
        <h2>Network Enrichment</h2>
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={settings.audioCdMetadataEnabled}
            onChange={(e) => save({ audioCdMetadataEnabled: e.target.checked })}
          />
          Look up audio CD titles and cover art online during scans
        </label>
        <p>DiscDock does not make network requests during scans unless this option is enabled.</p>
      </section>

      <section className="settings-section">
        <h2>Keyboard Shortcuts</h2>
        <table className="shortcuts-table">
          <tbody>
            <tr>
              <td>
                <kbd>Ctrl</kbd> + <kbd>F</kbd>
              </td>
              <td>Open Search</td>
            </tr>
            <tr>
              <td>
                <kbd>Ctrl</kbd> + <kbd>,</kbd>
              </td>
              <td>Open Settings</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  )
}
