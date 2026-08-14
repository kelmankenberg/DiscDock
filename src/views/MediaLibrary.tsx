import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Scan,
  CircleX,
  Archive,
  Trash2,
  Eject as EjectIcon,
  Disc3,
  Usb,
  Pencil,
  MoreVertical,
  AlertTriangle,
  ShieldCheck,
  QrCode
} from 'lucide-react'
import { MEDIA_TYPES } from '../../shared/types'
import type { DetectedDevice, MediaItem, MediaItemInput, MediaType, ScanProgress } from '../../shared/types'
import LabelSheet from '../components/LabelSheet'
import './MediaLibrary.css'
import HelpButton from '../components/HelpButton'

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

type SortKey = 'label' | 'mediaType' | 'physicalLocation' | 'status' | 'lastScannedAt' | 'tags' | 'notes'

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'label', label: 'Label' },
  { key: 'mediaType', label: 'Type' },
  { key: 'physicalLocation', label: 'Location' },
  { key: 'tags', label: 'Tags' },
  { key: 'notes', label: 'Notes' },
  { key: 'status', label: 'Status' },
  { key: 'lastScannedAt', label: 'Last Scanned' }
]

interface ActiveScan {
  jobId: number
  filesProcessed: number
  currentPath: string
  queued: boolean
  isAudioCd?: boolean
}

export default function MediaLibrary({
  onOpenDetail,
  focusMediaId = null,
  onFocusHandled
}: {
  onOpenDetail: (mediaId: number) => void
  focusMediaId?: number | null
  onFocusHandled?: () => void
}): JSX.Element {
  const [items, setItems] = useState<MediaItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [form, setForm] = useState<MediaItemInput>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [scansByMedia, setScansByMedia] = useState<Record<number, ActiveScan>>({})
  const [, setJobToMedia] = useState<Record<number, number>>({})
  const [sortKey, setSortKey] = useState<SortKey>('label')
  const [sortAsc, setSortAsc] = useState(true)

  const handleSort = (key: SortKey): void => {
    if (key === sortKey) {
      setSortAsc((prev) => !prev)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const [devices, setDevices] = useState<DetectedDevice[]>([])
  const [deviceMountPoint, setDeviceMountPoint] = useState<string | null>(null)
  const [containerFilter, setContainerFilter] = useState<string>('')
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null)
  const [editingLocationValue, setEditingLocationValue] = useState('')
  const [tagsByMedia, setTagsByMedia] = useState<Record<number, string[]>>({})
  const [allTagNames, setAllTagNames] = useState<string[]>([])
  const [tagFilter, setTagFilter] = useState<string>('')
  const [editingTagsId, setEditingTagsId] = useState<number | null>(null)
  const [editingTagsValue, setEditingTagsValue] = useState('')
  const [customMediaTypes, setCustomMediaTypes] = useState<string[]>([])
  const [verificationThresholdMonths, setVerificationThresholdMonths] = useState(12)

  const needsVerification = (item: MediaItem): boolean => {
    if (item.status !== 'active') return false
    // Newly added media starts its verification clock at creation, not at "never verified".
    const baseline = item.lastVerifiedAt ?? item.createdAt
    if (!baseline) return false
    const baselineDate = new Date(`${baseline.replace(' ', 'T')}Z`)
    if (Number.isNaN(baselineDate.getTime())) return false
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - verificationThresholdMonths)
    return baselineDate < cutoff
  }

  const handleMarkVerified = (id: number): void => {
    void window.discdock.media.markVerified(id).then((result) => {
      if (result.ok) loadItems()
    })
  }

  const [labelItems, setLabelItems] = useState<MediaItem[] | null>(null)
  const [, setPendingAudioCdPath] = useState<string | null>(null)
  const [coversByMedia, setCoversByMedia] = useState<Record<number, string>>({})
  const focusedRowRef = useRef<HTMLTableRowElement>(null)

  useEffect(() => {
    const withCovers = items.filter((item) => item.coverPath)
    if (withCovers.length === 0) return
    void Promise.all(
      withCovers.map(async (item) => [item.id, await window.discdock.media.cover(item.id)] as const)
    ).then((entries) => {
      setCoversByMedia(
        Object.fromEntries(
          entries
            .filter(([, result]) => result.ok && result.data)
            .map(([id, result]) => [id, (result as { ok: true; data: string }).data])
        )
      )
    })
  }, [items])

  // Selecting from another view (e.g. the Dashboard) highlights and scrolls to that row.
  useEffect(() => {
    if (focusMediaId === null) return
    setSelectedIds(new Set([focusMediaId]))
    setContainerFilter('')
    setTagFilter('')
  }, [focusMediaId])

  useEffect(() => {
    if (focusMediaId === null || !focusedRowRef.current) return
    focusedRowRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    onFocusHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMediaId, items])

  const knownLocations = Array.from(
    new Set(items.map((item) => item.physicalLocation).filter((loc): loc is string => Boolean(loc)))
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

  const containerFilteredItems = containerFilter
    ? items.filter((item) => item.physicalLocation === containerFilter)
    : items

  const filteredItems = tagFilter
    ? containerFilteredItems.filter((item) => (tagsByMedia[item.id] ?? []).includes(tagFilter))
    : containerFilteredItems

  const sortValue = (item: MediaItem, key: SortKey): string => {
    switch (key) {
      case 'mediaType':
        return mediaTypeLabel(item.mediaType)
      case 'physicalLocation':
        return item.physicalLocation ?? ''
      case 'lastScannedAt':
        return item.lastScannedAt ?? ''
      case 'notes':
        return item.notes ?? ''
      case 'tags':
        return (tagsByMedia[item.id] ?? []).join(', ')
      default:
        return item[key] ?? ''
    }
  }

  const sortedItems = [...filteredItems].sort((a, b) => {
    const result = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey), undefined, { sensitivity: 'base' })
    return sortAsc ? result : -result
  })

  const findDeviceForItem = (item: MediaItem): DetectedDevice | undefined =>
    devices.find((d) => item.deviceFingerprint && (d.uuid ?? d.devicePath) === item.deviceFingerprint)

  const unregisteredDevices = devices.filter(
    (d) => !items.some((item) => item.deviceFingerprint === (d.uuid ?? d.devicePath))
  )

  const [ejectingIds, setEjectingIds] = useState<Set<number>>(new Set())
  const [ejectMessage, setEjectMessage] = useState<string | null>(null)

  const handleEject = (item: MediaItem, device: DetectedDevice): void => {
    setEjectingIds((prev) => new Set(prev).add(item.id))
    setEjectMessage(null)
    void window.discdock.devices.eject(device.devicePath, device.isOptical).then((result) => {
      setEjectingIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      setEjectMessage(result.ok ? `${item.label}: ${result.data.message}` : `Eject failed: ${result.error.message}`)
    })
  }

  const handleAddDetectedDevice = (device: DetectedDevice): void => {
    setEditingItemId(null)
    setShowForm(true)
    handleUseDevice(device)
  }

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null)
  const [batchLocationValue, setBatchLocationValue] = useState('')

  const handleRowCheckboxClick = (
    event: React.MouseEvent<HTMLInputElement>,
    item: MediaItem,
    index: number
  ): void => {
    if (event.shiftKey && lastClickedIndex !== null) {
      const [start, end] = [lastClickedIndex, index].sort((a, b) => a - b)
      const rangeIds = sortedItems.slice(start, end + 1).map((i) => i.id)
      setSelectedIds((prev) => new Set([...prev, ...rangeIds]))
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(item.id)) next.delete(item.id)
        else next.add(item.id)
        return next
      })
    }
    setLastClickedIndex(index)
  }

  const handleRowClick = (event: React.MouseEvent<HTMLTableRowElement>, item: MediaItem, index: number): void => {
    const target = event.target as HTMLElement
    if (target.closest('button, input, select, textarea, a')) return

    if (event.shiftKey && lastClickedIndex !== null) {
      const [start, end] = [lastClickedIndex, index].sort((a, b) => a - b)
      const rangeIds = sortedItems.slice(start, end + 1).map((i) => i.id)
      setSelectedIds((prev) => (event.ctrlKey || event.metaKey ? new Set([...prev, ...rangeIds]) : new Set(rangeIds)))
    } else if (event.ctrlKey || event.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(item.id)) next.delete(item.id)
        else next.add(item.id)
        return next
      })
      setLastClickedIndex(index)
    } else {
      setSelectedIds((prev) => (prev.size === 1 && prev.has(item.id) ? new Set() : new Set([item.id])))
      setLastClickedIndex(index)
    }
  }

  const handleSelectAll = (): void => {
    setSelectedIds((prev) =>
      prev.size === sortedItems.length ? new Set() : new Set(sortedItems.map((i) => i.id))
    )
  }

  const clearSelection = (): void => {
    setSelectedIds(new Set())
    setLastClickedIndex(null)
  }

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; itemId: number } | null>(null)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  useLayoutEffect(() => {
    setMenuPos(contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null)
  }, [contextMenu])

  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el || !menuPos) return
    const rect = el.getBoundingClientRect()
    const margin = 8
    let { x, y } = menuPos
    if (rect.bottom > window.innerHeight - margin) {
      y = Math.max(margin, window.innerHeight - margin - rect.height)
    }
    if (rect.right > window.innerWidth - margin) {
      x = Math.max(margin, window.innerWidth - margin - rect.width)
    }
    if (x !== menuPos.x || y !== menuPos.y) setMenuPos({ x, y })
  }, [menuPos])

  const handleRowContextMenu = (
    event: React.MouseEvent<HTMLTableRowElement>,
    item: MediaItem,
    index: number
  ): void => {
    event.preventDefault()
    if (!selectedIds.has(item.id)) {
      setSelectedIds(new Set([item.id]))
      setLastClickedIndex(index)
    }
    setContextMenu({ x: event.clientX, y: event.clientY, itemId: item.id })
  }

  const openMenuFromButton = (
    event: React.MouseEvent<HTMLButtonElement>,
    item: MediaItem,
    index: number
  ): void => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!selectedIds.has(item.id)) {
      setSelectedIds(new Set([item.id]))
      setLastClickedIndex(index)
    }
    setContextMenu((prev) =>
      prev?.itemId === item.id ? null : { x: rect.right - 170, y: rect.bottom + 4, itemId: item.id }
    )
  }

  useEffect(() => {
    if (!contextMenu) return
    const close = (): void => setContextMenu(null)
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('click', close)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [contextMenu])

  const handleBatchSetLocation = (): void => {
    const value = batchLocationValue.trim() || null
    void Promise.all(
      Array.from(selectedIds).map((id) => window.discdock.media.update(id, { physicalLocation: value }))
    ).then(() => {
      setBatchLocationValue('')
      clearSelection()
      loadItems()
    })
  }

  const handleBatchRetire = (): void => {
    if (!window.confirm(`Retire ${selectedIds.size} selected media item(s)?`)) return
    void Promise.all(Array.from(selectedIds).map((id) => window.discdock.media.retire(id))).then(() => {
      clearSelection()
      loadItems()
    })
  }

  const handleBatchDelete = (): void => {
    if (!window.confirm(`Delete ${selectedIds.size} selected media item(s) and their catalogs? This cannot be undone.`))
      return
    void Promise.all(Array.from(selectedIds).map((id) => window.discdock.media.delete(id))).then(() => {
      clearSelection()
      loadItems()
    })
  }

  const loadItems = (): void => {
    void window.discdock.media.list().then((result) => {
      if (result.ok) setItems(result.data)
    })
    void window.discdock.tags.allForMedia().then((result) => {
      if (result.ok) setTagsByMedia(result.data)
    })
    void window.discdock.tags.list().then((result) => {
      if (result.ok) setAllTagNames(result.data)
    })
  }

  useEffect(loadItems, [])

  useEffect(() => {
    void window.discdock.settings.get().then((result) => {
      if (result.ok) {
        setCustomMediaTypes(result.data.customMediaTypes)
        setVerificationThresholdMonths(result.data.verificationThresholdMonths)
      }
    })
  }, [])

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
            currentPath: progress.currentPath,
            queued: false
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
      // Leave any warning the scan produced; only retire the in-progress notice.
      setEjectMessage((prev) => (prev?.startsWith('Reading disc') ? null : prev))
      loadItems()
    }

    const unsubCompleted = window.discdock.scan.onCompleted(({ jobId }) => finishScan(jobId))
    const unsubFailed = window.discdock.scan.onFailed(({ jobId, error }) => {
      setEjectMessage(error)
      finishScan(jobId)
    })
    const unsubCancelled = window.discdock.scan.onCancelled(({ jobId }) => finishScan(jobId))

    const unsubStarted = window.discdock.scan.onStarted(({ mediaItemId }) => {
      setScansByMedia((prevScans) => {
        const scan = prevScans[mediaItemId]
        if (!scan) return prevScans
        return { ...prevScans, [mediaItemId]: { ...scan, queued: false } }
      })
    })

    const unsubWarning = window.discdock.scan.onWarning(({ message }) => setEjectMessage(message))

    return () => {
      unsubProgress()
      unsubCompleted()
      unsubFailed()
      unsubCancelled()
      unsubStarted()
      unsubWarning()
    }
  }, [])

  const closeForm = (): void => {
    setShowForm(false)
    setEditingItemId(null)
    setForm(EMPTY_FORM)
    setDeviceMountPoint(null)
    setPendingAudioCdPath(null)
    setError(null)
  }

  const handleStartAdd = (): void => {
    setEditingItemId(null)
    setForm(EMPTY_FORM)
    setDeviceMountPoint(null)
    setPendingAudioCdPath(null)
    setError(null)
    setShowForm(true)
  }

  const handleStartEdit = (item: MediaItem): void => {
    setEditingItemId(item.id)
    setForm({
      label: item.label,
      mediaType: item.mediaType,
      capacityBytes: item.capacityBytes,
      physicalLocation: item.physicalLocation,
      notes: item.notes,
      deviceFingerprint: item.deviceFingerprint
    })
    setError(null)
    setDeviceMountPoint(null)
    setPendingAudioCdPath(null)
    setShowForm(true)
  }

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault()
    setError(null)

    if (editingItemId !== null) {
      void window.discdock.media
        .update(editingItemId, {
          label: form.label,
          mediaType: form.mediaType,
          capacityBytes: form.capacityBytes,
          physicalLocation: form.physicalLocation,
          notes: form.notes
        })
        .then((result) => {
          if (result.ok) {
            closeForm()
            loadItems()
          } else {
            setError(result.error.message)
          }
        })
      return
    }

    void window.discdock.media.create(form).then((result) => {
      if (result.ok) {
        const created = result.data
        setForm(EMPTY_FORM)
        setShowForm(false)
        loadItems()
        setSelectedIds(new Set([created.id]))

        // Resolve the source device from the saved fingerprint so the scan target can't go stale.
        const device = devices.find(
          (d) => created.deviceFingerprint && (d.uuid ?? d.devicePath) === created.deviceFingerprint
        )

        if (window.confirm(`"${created.label}" was added. Scan it now?`)) {
          if (device?.isAudioCd) {
            handleScanAudioCd(created.id, device.devicePath)
          } else if (device?.mountPoint) {
            beginScanWithPath(created.id, device.mountPoint)
          } else if (deviceMountPoint) {
            beginScanWithPath(created.id, deviceMountPoint)
          } else {
            handleScan(created.id)
          }
        }
        setDeviceMountPoint(null)
        setPendingAudioCdPath(null)
      } else {
        setError(result.error.message)
      }
    })
  }

  const deviceToInput = (device: DetectedDevice): MediaItemInput => ({
    label: device.isAudioCd
      ? (device.label ?? 'Audio CD')
      : (device.label ?? device.mountPoint.split('/').pop() ?? device.devicePath),
    mediaType: device.isAudioCd ? 'cd' : device.isOptical ? 'dvd' : 'external_hdd',
    capacityBytes: device.sizeBytes,
    physicalLocation: null,
    notes: null,
    deviceFingerprint: device.uuid ?? device.devicePath
  })

  const handleUseDevice = (device: DetectedDevice): void => {
    setForm(deviceToInput(device))
    setDeviceMountPoint(device.mountPoint || null)
    setPendingAudioCdPath(device.isAudioCd ? device.devicePath : null)
  }

  /** One-click equivalent of the Dashboard flow: register the device and start its scan. */
  const handleRegisterAndScan = (device: DetectedDevice): void => {
    setError(null)
    setEjectMessage(`Registering ${device.label ?? device.devicePath}…`)

    void window.discdock.media.create(deviceToInput(device)).then((result) => {
      if (!result.ok) {
        setEjectMessage(`Could not register this media: ${result.error.message}`)
        return
      }
      const created = result.data
      closeForm()
      loadItems()
      setSelectedIds(new Set([created.id]))

      if (device.isAudioCd) {
        handleScanAudioCd(created.id, device.devicePath)
      } else if (device.mountPoint) {
        setEjectMessage(null)
        beginScanWithPath(created.id, device.mountPoint)
      } else {
        setEjectMessage(null)
        handleScan(created.id)
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

  const beginScanWithPath = (mediaId: number, rootPath: string): void => {
    void window.discdock.scan.start(mediaId, rootPath).then((startResult) => {
      if (startResult.ok) {
        const jobId = startResult.data.jobId
        setJobToMedia((prev) => ({ ...prev, [jobId]: mediaId }))
        setScansByMedia((prev) => ({
          ...prev,
          [mediaId]: { jobId, filesProcessed: 0, currentPath: '', queued: true }
        }))
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

  const handleScanAudioCd = (mediaId: number, devicePath: string): void => {
    setEjectMessage('Reading disc and looking up track titles and cover art…')
    void window.discdock.scan.startAudioCd(mediaId, devicePath).then((result) => {
      if (!result.ok) {
        setEjectMessage(result.error.message)
        return
      }
      const jobId = result.data.jobId
      setJobToMedia((prev) => ({ ...prev, [jobId]: mediaId }))
      setScansByMedia((prev) => ({
        ...prev,
        [mediaId]: { jobId, filesProcessed: 0, currentPath: '', queued: false, isAudioCd: true }
      }))
    })
  }

  const startEditingLocation = (item: MediaItem): void => {
    setEditingLocationId(item.id)
    setEditingLocationValue(item.physicalLocation ?? '')
  }

  const saveEditingLocation = (id: number): void => {
    const value = editingLocationValue.trim() || null
    setEditingLocationId(null)
    void window.discdock.media.update(id, { physicalLocation: value }).then((result) => {
      if (result.ok) loadItems()
    })
  }

  const startEditingTags = (item: MediaItem): void => {
    setEditingTagsId(item.id)
    setEditingTagsValue((tagsByMedia[item.id] ?? []).join(', '))
  }

  const saveEditingTags = (id: number): void => {
    const tagNames = Array.from(
      new Set(
        editingTagsValue
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      )
    )
    setEditingTagsId(null)
    void window.discdock.tags.setForMedia(id, tagNames).then((result) => {
      if (result.ok) loadItems()
    })
  }

  return (
    <div className="media-library">
      <div className="media-library__header">
        <h1>Media Library</h1>
        <button type="button" className="button button--primary" onClick={handleStartAdd}>
          Add Media
        </button>
        <HelpButton topicId="media-library" />
      </div>

      {!showForm && unregisteredDevices.length > 0 && (
        <div className="new-media-banner">
          {unregisteredDevices.map((device) => (
            <div key={device.devicePath} className="new-media-banner__item">
              <span>
                {device.isOptical ? <Disc3 size={14} aria-hidden="true" /> : <Usb size={14} aria-hidden="true" />}{' '}
                {device.isAudioCd ? 'Audio CD detected' : 'New media detected'}:{' '}
                <strong>{device.label ?? device.mountPoint.split('/').pop()}</strong> — not yet registered.
              </span>
              <button
                type="button"
                className="button button--small button--primary"
                onClick={() => handleRegisterAndScan(device)}
              >
                Register &amp; Scan
              </button>
              <button
                type="button"
                className="button button--small"
                onClick={() => handleAddDetectedDevice(device)}
              >
                Add with Details…
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form className="media-form" onSubmit={handleSubmit}>
          <h2 className="media-form__title">{editingItemId !== null ? 'Edit Media' : 'Add Media'}</h2>
          {error && <div className="media-form__error">{error}</div>}

          {editingItemId === null && devices.length > 0 && (
            <div className="detected-devices-picker">
              <span className="detected-devices-picker__label">
                Detected media — click one to fill in the form below, then press Save:
              </span>
              <div className="detected-devices-picker__list">
                {devices.map((device) => (
                  <button
                    type="button"
                    key={device.devicePath}
                    className={
                      form.deviceFingerprint === (device.uuid ?? device.devicePath)
                        ? 'button button--small button--primary'
                        : 'button button--small'
                    }
                    onClick={() => handleUseDevice(device)}
                  >
                    {device.isOptical ? <Disc3 size={14} aria-hidden="true" /> : <Usb size={14} aria-hidden="true" />}{' '}
                    {device.label ?? device.mountPoint.split('/').pop()}
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
              {[...MEDIA_TYPES, ...customMediaTypes.map((value) => ({ value, label: value }))].map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Container / Physical Location
            <input
              type="text"
              list="location-suggestions"
              value={form.physicalLocation ?? ''}
              onChange={(e) => setForm({ ...form, physicalLocation: e.target.value || null })}
              placeholder="e.g. CD Spindle #2, Garage / Box 3"
            />
            <datalist id="location-suggestions">
              {knownLocations.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
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
            <button type="button" className="button" onClick={closeForm}>
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
        <>
          {knownLocations.length > 0 && (
            <div className="container-filter">
              <label>
                Container
                <select value={containerFilter} onChange={(e) => setContainerFilter(e.target.value)}>
                  <option value="">All containers</option>
                  {knownLocations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {allTagNames.length > 0 && (
            <div className="container-filter">
              <label>
                Tag
                <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                  <option value="">All tags</option>
                  {allTagNames.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <datalist id="tag-suggestions">
            {allTagNames.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>

          {ejectMessage && (
            <p className="media-library__eject-message">
              {ejectMessage}
              <button
                type="button"
                className="media-library__eject-message-dismiss"
                onClick={() => setEjectMessage(null)}
                aria-label="Dismiss message"
              >
                <CircleX size={14} aria-hidden="true" />
              </button>
            </p>
          )}

          {selectedIds.size > 0 && (
            <div className="batch-actions">
              <span className="batch-actions__count">{selectedIds.size} selected</span>
              <input
                type="text"
                list="location-suggestions"
                placeholder="Set container…"
                value={batchLocationValue}
                onChange={(e) => setBatchLocationValue(e.target.value)}
              />
              <button type="button" className="button button--small" onClick={handleBatchSetLocation}>
                Apply Container
              </button>
              <button type="button" className="button button--small" onClick={handleBatchRetire}>
                Retire Selected
              </button>
              <button
                type="button"
                className="button button--small"
                onClick={() => setLabelItems(sortedItems.filter((item) => selectedIds.has(item.id)))}
              >
                Print Labels
              </button>
              <button type="button" className="button button--small button--danger" onClick={handleBatchDelete}>
                Delete Selected
              </button>
              <button type="button" className="button button--small" onClick={clearSelection}>
                Clear Selection
              </button>
            </div>
          )}

          <table className="media-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={selectedIds.size > 0 && selectedIds.size === sortedItems.length}
                  onChange={handleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <th className="media-table__cover-header">Cover</th>
              {COLUMNS.map((col) => (
                <th key={col.key}>
                  <button type="button" className="media-table__sort-header" onClick={() => handleSort(col.key)}>
                    {col.label}
                    {sortKey === col.key ? (sortAsc ? ' ▲' : ' ▼') : ''}
                  </button>
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, index) => {
              const scan = scansByMedia[item.id]
              const presentDevice = findDeviceForItem(item)
              const rowClasses = [
                selectedIds.has(item.id) ? 'media-table__row--selected' : '',
                presentDevice ? 'media-table__row--present' : ''
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <tr
                  key={item.id}
                  ref={item.id === focusMediaId ? focusedRowRef : undefined}
                  className={rowClasses}
                  onClick={(e) => handleRowClick(e, item, index)}
                  onContextMenu={(e) => handleRowContextMenu(e, item, index)}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => {}}
                      onClick={(e) => handleRowCheckboxClick(e, item, index)}
                      aria-label={`Select ${item.label}`}
                    />
                  </td>
                  <td className="media-table__cover-cell">
                    {coversByMedia[item.id] ? (
                      <img
                        className="media-table__cover"
                        src={coversByMedia[item.id]}
                        alt={`${item.label} cover`}
                      />
                    ) : (
                      <span className="media-table__cover media-table__cover--placeholder" aria-hidden="true">
                        <Disc3 size={14} />
                      </span>
                    )}
                  </td>
                  <td>
                    <button type="button" className="link-button" onClick={() => onOpenDetail(item.id)}>
                      {item.label}
                    </button>
                  </td>
                  <td>{mediaTypeLabel(item.mediaType)}</td>
                  <td>
                    {editingLocationId === item.id ? (
                      <input
                        type="text"
                        autoFocus
                        list="location-suggestions"
                        className="media-table__location-input"
                        value={editingLocationValue}
                        onChange={(e) => setEditingLocationValue(e.target.value)}
                        onBlur={() => saveEditingLocation(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditingLocation(item.id)
                          if (e.key === 'Escape') setEditingLocationId(null)
                        }}
                      />
                    ) : (
                      <button type="button" className="link-button" onClick={() => startEditingLocation(item)}>
                        {item.physicalLocation ?? 'Set container…'}
                      </button>
                    )}
                  </td>
                  <td>
                    {editingTagsId === item.id ? (
                      <input
                        type="text"
                        autoFocus
                        list="tag-suggestions"
                        className="media-table__location-input"
                        value={editingTagsValue}
                        onChange={(e) => setEditingTagsValue(e.target.value)}
                        onBlur={() => saveEditingTags(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditingTags(item.id)
                          if (e.key === 'Escape') setEditingTagsId(null)
                        }}
                      />
                    ) : (
                      <button type="button" className="link-button" onClick={() => startEditingTags(item)}>
                        {(tagsByMedia[item.id] ?? []).length > 0
                          ? (tagsByMedia[item.id] ?? []).join(', ')
                          : 'Add tags…'}
                      </button>
                    )}
                  </td>
                  <td className="media-table__notes" title={item.notes ?? undefined}>
                    {item.notes ?? ''}
                  </td>
                  <td>
                    <span className={`status-badge status-badge--${item.status}`}>{item.status}</span>
                    {needsVerification(item) && (
                      <button
                        type="button"
                        className="verify-badge"
                        title={`Not verified in the last ${verificationThresholdMonths} months — click to mark verified now`}
                        onClick={() => handleMarkVerified(item.id)}
                      >
                        <AlertTriangle size={12} aria-hidden="true" /> Verify
                      </button>
                    )}
                  </td>
                  <td>
                    {scan ? (
                      <span className="scan-progress">
                        {scan.queued
                          ? 'Queued…'
                          : scan.isAudioCd
                            ? 'Reading disc…'
                            : `Scanning… ${scan.filesProcessed} files`}
                      </span>
                    ) : (
                      item.lastScannedAt ?? 'Never'
                    )}
                  </td>
                  <td className="media-table__actions">
                    <button
                      type="button"
                      className="button button--small button--icon-only"
                      title="More actions"
                      aria-label={`More actions for ${item.label}`}
                      aria-haspopup="menu"
                      onClick={(e) => {
                        e.stopPropagation()
                        openMenuFromButton(e, item, index)
                      }}
                    >
                      <MoreVertical size={16} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          </table>
        </>
      )}

      {contextMenu &&
        (() => {
          const item = items.find((i) => i.id === contextMenu.itemId)
          if (!item) return null
          const scan = scansByMedia[item.id]
          const presentDevice = findDeviceForItem(item)
          return (
            <ul
              className="media-context-menu"
              ref={menuRef}
              style={{ top: menuPos?.y ?? contextMenu.y, left: menuPos?.x ?? contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
              role="menu"
            >
              <li>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setContextMenu(null)
                    handleStartEdit(item)
                  }}
                >
                  <Pencil size={14} aria-hidden="true" /> Edit
                </button>
              </li>
              <li>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setContextMenu(null)
                    if (scan) handleCancelScan(item.id)
                    else handleScan(item.id)
                  }}
                >
                  {scan ? (
                    <>
                      <CircleX size={14} aria-hidden="true" /> Cancel Scan
                    </>
                  ) : (
                    <>
                      <Scan size={14} aria-hidden="true" /> Scan
                    </>
                  )}
                </button>
              </li>
              {presentDevice?.isOptical && !scan && (
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setContextMenu(null)
                      handleScanAudioCd(item.id, presentDevice.devicePath)
                    }}
                  >
                    <Disc3 size={14} aria-hidden="true" /> Scan Audio CD Tracks
                  </button>
                </li>
              )}
              {item.status === 'active' && !scan && (
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setContextMenu(null)
                      handleMarkVerified(item.id)
                    }}
                  >
                    <ShieldCheck size={14} aria-hidden="true" /> Mark Verified
                  </button>
                </li>
              )}
              {item.status === 'active' && !scan && (
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setContextMenu(null)
                      handleRetire(item.id)
                    }}
                  >
                    <Archive size={14} aria-hidden="true" /> Retire
                  </button>
                </li>
              )}
              <li>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setContextMenu(null)
                    setLabelItems([item])
                  }}
                >
                  <QrCode size={14} aria-hidden="true" /> Print Label
                </button>
              </li>
              <li>
                <button
                  type="button"
                  role="menuitem"
                  className="media-context-menu__danger"
                  onClick={() => {
                    setContextMenu(null)
                    handleDelete(item.id)
                  }}
                >
                  <Trash2 size={14} aria-hidden="true" /> Delete
                </button>
              </li>
              {presentDevice && (
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={ejectingIds.has(item.id)}
                    onClick={() => {
                      setContextMenu(null)
                      handleEject(item, presentDevice)
                    }}
                  >
                    <EjectIcon size={14} aria-hidden="true" />{' '}
                    {presentDevice.isOptical ? 'Eject' : 'Safely Remove'}
                  </button>
                </li>
              )}
            </ul>
          )
        })()}

      {labelItems && labelItems.length > 0 && (
        <LabelSheet items={labelItems} onClose={() => setLabelItems(null)} />
      )}
    </div>
  )
}
