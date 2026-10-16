import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { MAX_WIDTH, MIN_WIDTH, useSidePanel, type SidePanelId } from './SidePanelContext'

interface SlideOutPanelProps {
  panel: SidePanelId
  titleId: string
  title: string
  leading?: ReactNode
  search?: ReactNode
  children: ReactNode
}

export default function SlideOutPanel({ panel, titleId, title, leading, search, children }: SlideOutPanelProps): JSX.Element {
  const { activePanel, widthPercent, close, setWidthPercent } = useSidePanel()
  const isOpen = activePanel === panel
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (isOpen) headingRef.current?.focus()
  }, [isOpen, title])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && isOpen) close()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [close, isOpen])

  return (
    <aside
      className={`slide-panel${isOpen ? '' : ' slide-panel--closed'}`}
      style={{ width: isOpen ? `${widthPercent}%` : '0%' }}
      role="complementary"
      aria-labelledby={titleId}
      aria-hidden={!isOpen}
    >
      <div
        className="slide-panel__resize"
        role="separator"
        aria-orientation="vertical"
        tabIndex={isOpen ? 0 : -1}
        aria-label={`Resize ${panel} panel`}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={widthPercent}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            setWidthPercent(widthPercent + (event.key === 'ArrowRight' ? 1 : -1))
          } else if (event.key === 'Home') {
            setWidthPercent(MIN_WIDTH)
          } else if (event.key === 'End') {
            setWidthPercent(MAX_WIDTH)
          }
        }}
        onPointerDown={(event) => {
          const handle = event.currentTarget
          handle.setPointerCapture(event.pointerId)
          const startX = event.clientX
          const startWidth = widthPercent
          const move = (moveEvent: PointerEvent): void => {
            const availableWidth = document.documentElement.clientWidth
            setWidthPercent(startWidth - ((moveEvent.clientX - startX) / availableWidth) * 100)
          }
          const stop = (): void => {
            handle.removeEventListener('pointermove', move)
            handle.removeEventListener('pointerup', stop)
            handle.removeEventListener('pointercancel', stop)
          }
          handle.addEventListener('pointermove', move)
          handle.addEventListener('pointerup', stop)
          handle.addEventListener('pointercancel', stop)
        }}
      />
      <header className="slide-panel__header">
        <div className="slide-panel__heading">
          {leading}
          <h2 id={titleId} tabIndex={-1} ref={headingRef}>{title}</h2>
        </div>
        {search && <div className="slide-panel__search">{search}</div>}
        <button type="button" className="button button--icon-only slide-panel__close" aria-label={`Close ${panel}`} title={`Close ${panel}`} onClick={close}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className="slide-panel__content">{children}</div>
    </aside>
  )
}