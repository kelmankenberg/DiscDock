import { useEffect, useState } from 'react'
import type { AppSettings, HashMode, Theme } from '../../shared/types'
import './Settings.css'

const HASH_MODES: { value: HashMode; label: string }[] = [
  { value: 'none', label: 'None (metadata only, fastest)' },
  { value: 'quick', label: 'Quick (partial hash)' },
  { value: 'full', label: 'Full (SHA-256, most accurate)' }
]

export default function Settings(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [newMediaType, setNewMediaType] = useState('')
  const [newFieldName, setNewFieldName] = useState('')

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
    const value = newMediaType.trim()
    if (!value || settings.customMediaTypes.includes(value)) return
    save({ customMediaTypes: [...settings.customMediaTypes, value] })
    setNewMediaType('')
  }

  const addFieldName = (): void => {
    const value = newFieldName.trim()
    if (!value || settings.customFieldNames.includes(value)) return
    save({ customFieldNames: [...settings.customFieldNames, value] })
    setNewFieldName('')
  }

  if (!settings) return <div className="settings-view">Loading…</div>

  return (
    <div className="settings-view">
      <h1>Settings</h1>
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
