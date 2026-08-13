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
