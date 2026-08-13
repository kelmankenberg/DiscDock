import { useEffect, useState } from 'react'
import { MEDIA_TYPES } from '../../shared/types'
import type { MediaItem, MediaItemInput, MediaType } from '../../shared/types'
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

export default function MediaLibrary(): JSX.Element {
  const [items, setItems] = useState<MediaItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<MediaItemInput>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  const loadItems = (): void => {
    void window.discdock.media.list().then((result) => {
      if (result.ok) setItems(result.data)
    })
  }

  useEffect(loadItems, [])

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault()
    setError(null)
    void window.discdock.media.create(form).then((result) => {
      if (result.ok) {
        setForm(EMPTY_FORM)
        setShowForm(false)
        loadItems()
      } else {
        setError(result.error.message)
      }
    })
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
            <button type="button" className="button" onClick={() => setShowForm(false)}>
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
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.label}</td>
                <td>{mediaTypeLabel(item.mediaType)}</td>
                <td>{item.physicalLocation ?? '—'}</td>
                <td>
                  <span className={`status-badge status-badge--${item.status}`}>{item.status}</span>
                </td>
                <td>{item.lastScannedAt ?? 'Never'}</td>
                <td className="media-table__actions">
                  {item.status === 'active' && (
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
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
