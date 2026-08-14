import { useEffect, useState } from 'react'
import { Trash2, Plus, X } from 'lucide-react'
import type { Collection, MediaItem } from '../../shared/types'
import './Collections.css'
import HelpButton from '../components/HelpButton'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

export default function Collections(): JSX.Element {
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [members, setMembers] = useState<MediaItem[]>([])
  const [allMedia, setAllMedia] = useState<MediaItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [addMediaId, setAddMediaId] = useState<string>('')

  const loadCollections = (): void => {
    void window.discdock.collections.list().then((result) => {
      if (result.ok) setCollections(result.data)
    })
  }

  useEffect(() => {
    loadCollections()
    void window.discdock.media.list().then((result) => {
      if (result.ok) setAllMedia(result.data)
    })
  }, [])

  const loadMembers = (collectionId: number): void => {
    void window.discdock.collections.members(collectionId).then((result) => {
      if (result.ok) setMembers(result.data)
    })
  }

  useEffect(() => {
    if (selectedId !== null) loadMembers(selectedId)
  }, [selectedId])

  const selectedCollection = collections.find((c) => c.id === selectedId) ?? null

  const handleCreate = (event: React.FormEvent): void => {
    event.preventDefault()
    setError(null)
    void window.discdock.collections.create({ name, description: description || null }).then((result) => {
      if (result.ok) {
        setName('')
        setDescription('')
        setShowForm(false)
        loadCollections()
      } else {
        setError(result.error.message)
      }
    })
  }

  const handleDelete = (id: number): void => {
    if (!window.confirm('Delete this collection? Media items themselves will not be affected.')) return
    void window.discdock.collections.delete(id).then((result) => {
      if (result.ok) {
        if (selectedId === id) setSelectedId(null)
        loadCollections()
      }
    })
  }

  const handleAddMember = (): void => {
    if (selectedId === null || !addMediaId) return
    const mediaId = Number(addMediaId)
    void window.discdock.collections.addMember(selectedId, mediaId).then((result) => {
      if (result.ok) {
        setAddMediaId('')
        loadMembers(selectedId)
        loadCollections()
      }
    })
  }

  const handleRemoveMember = (mediaId: number): void => {
    if (selectedId === null) return
    void window.discdock.collections.removeMember(selectedId, mediaId).then((result) => {
      if (result.ok) {
        loadMembers(selectedId)
        loadCollections()
      }
    })
  }

  const availableMedia = allMedia.filter((m) => !members.some((mem) => mem.id === m.id))

  return (
    <div className="collections-view">
      <div className="collections-view__header">
        <h1>Collections</h1>
        <button type="button" className="button button--primary" onClick={() => setShowForm(true)}>
          <Plus size={16} aria-hidden="true" /> New Collection
        </button>
        <HelpButton topicId="collections" />
      </div>

      {showForm && (
        <form className="media-form" onSubmit={handleCreate}>
          {error && <div className="media-form__error">{error}</div>}
          <label>
            Name
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
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

      {collections.length === 0 ? (
        <div className="empty-state">
          <p>No collections yet. Click "New Collection" to group related media items together.</p>
        </div>
      ) : (
        <div className="collections-view__layout">
          <ul className="collections-list">
            {collections.map((collection) => (
              <li key={collection.id}>
                <button
                  type="button"
                  className={`collections-list__item${selectedId === collection.id ? ' collections-list__item--active' : ''}`}
                  onClick={() => setSelectedId(collection.id)}
                >
                  <span className="collections-list__name">{collection.name}</span>
                  <span className="collections-list__meta">
                    {collection.memberCount} items · {formatBytes(collection.totalSizeBytes)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="collections-detail">
            {selectedCollection ? (
              <>
                <div className="collections-detail__header">
                  <div>
                    <h2>{selectedCollection.name}</h2>
                    {selectedCollection.description && <p>{selectedCollection.description}</p>}
                    <p className="collections-detail__stats">
                      {selectedCollection.memberCount} items · {selectedCollection.totalFiles} files ·{' '}
                      {formatBytes(selectedCollection.totalSizeBytes)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="button button--small button--danger"
                    onClick={() => handleDelete(selectedCollection.id)}
                  >
                    <Trash2 size={16} aria-hidden="true" /> Delete Collection
                  </button>
                </div>

                {availableMedia.length > 0 && (
                  <div className="collections-detail__add-member">
                    <select value={addMediaId} onChange={(e) => setAddMediaId(e.target.value)}>
                      <option value="">Add media item…</option>
                      {availableMedia.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="button button--small" onClick={handleAddMember} disabled={!addMediaId}>
                      Add
                    </button>
                  </div>
                )}

                {members.length === 0 ? (
                  <p className="empty-state">No media items in this collection yet.</p>
                ) : (
                  <table className="media-table">
                    <thead>
                      <tr>
                        <th>Label</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member) => (
                        <tr key={member.id}>
                          <td>{member.label}</td>
                          <td>
                            <span className={`status-badge status-badge--${member.status}`}>{member.status}</span>
                          </td>
                          <td className="media-table__actions">
                            <button
                              type="button"
                              className="button button--small button--icon-only"
                              title="Remove from collection"
                              aria-label="Remove from collection"
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              <X size={16} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            ) : (
              <p className="empty-state">Select a collection to view its members.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
