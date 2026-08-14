import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { MEDIA_TYPES } from '../../shared/types'
import type { MediaItem } from '../../shared/types'
import './LabelSheet.css'

interface LabelSheetProps {
  items: MediaItem[]
  onClose: () => void
}

/** Deep link consumed by the app's discdock:// protocol handler. */
function deepLink(mediaId: number): string {
  return `discdock://media/${mediaId}`
}

export default function LabelSheet({ items, onClose }: LabelSheetProps): JSX.Element {
  const [qrByItem, setQrByItem] = useState<Record<number, string>>({})

  useEffect(() => {
    let cancelled = false
    void Promise.all(
      items.map(async (item) => [item.id, await QRCode.toDataURL(deepLink(item.id), { margin: 0, width: 160 })] as const)
    ).then((entries) => {
      if (!cancelled) setQrByItem(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [items])

  return (
    <div className="label-sheet-overlay">
      <div className="label-sheet">
        <div className="label-sheet__toolbar">
          <h2>
            {items.length} label{items.length === 1 ? '' : 's'}
          </h2>
          <div className="label-sheet__toolbar-actions">
            <button type="button" className="button button--primary" onClick={() => window.print()}>
              Print
            </button>
            <button type="button" className="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="label-sheet__grid">
          {items.map((item) => (
            <div key={item.id} className="label-card">
              {qrByItem[item.id] && <img className="label-card__qr" src={qrByItem[item.id]} alt="" />}
              <div className="label-card__body">
                <strong className="label-card__label">{item.label}</strong>
                <span className="label-card__meta">
                  {MEDIA_TYPES.find((t) => t.value === item.mediaType)?.label ?? item.mediaType}
                </span>
                {item.physicalLocation && <span className="label-card__meta">{item.physicalLocation}</span>}
                <span className="label-card__id">#{item.id}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
