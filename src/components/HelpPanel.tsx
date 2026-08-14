import { ArrowLeft, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { HELP_TOPICS } from '../help/registry'
import { MAX_WIDTH, MIN_WIDTH, useHelp } from '../help/HelpContext'
import type { ViewId } from '../help/types'

export default function HelpPanel(): JSX.Element | null {
  const { isOpen, topicId, widthPercent, close, setWidthPercent, toggle } = useHelp()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [history, setHistory] = useState<ViewId[]>([])
  const topic = HELP_TOPICS[topicId]

  useEffect(() => {
    if (isOpen) headingRef.current?.focus()
  }, [isOpen, topicId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && isOpen) close()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [close, isOpen])

  const navigate = (nextTopic: ViewId): void => {
    setHistory((previous) => [...previous, topicId])
    toggle(nextTopic)
  }

  return (
    <aside
      className={`help-panel${isOpen ? '' : ' help-panel--closed'}`}
      style={{ width: isOpen ? `${widthPercent}%` : '0%' }}
      role="complementary"
      aria-labelledby="help-panel-title"
      aria-hidden={!isOpen}
    >
      <div
        className="help-panel__resize"
        role="separator"
        tabIndex={0}
        aria-label="Resize help panel"
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
          const widthContainer = handle.parentElement?.parentElement
          handle.setPointerCapture(event.pointerId)
          const startX = event.clientX
          const startWidth = widthPercent
          const move = (moveEvent: PointerEvent): void => {
            const availableWidth = widthContainer?.clientWidth ?? window.innerWidth
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
      <div className="help-panel__header">
        <div>
          {history.length > 0 && (
            <button type="button" className="button button--small help-panel__back" onClick={() => {
              const previousTopic = history[history.length - 1]
              setHistory((previous) => previous.slice(0, -1))
              toggle(previousTopic)
            }}>
              <ArrowLeft size={14} aria-hidden="true" /> Back
            </button>
          )}
          <h2 id="help-panel-title" tabIndex={-1} ref={headingRef}>Help: {topic.title}</h2>
        </div>
        <button type="button" className="button button--icon-only" aria-label="Close help" title="Close help" onClick={close}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="help-panel__content">
        <section>
          <h3>Overview</h3>
          <p>{topic.overview}</p>
        </section>
        <section>
          <h3>Features</h3>
          <dl>{topic.features.map((feature) => <div key={feature.name}><dt>{feature.name}</dt><dd>{feature.description}</dd></div>)}</dl>
        </section>
        <section>
          <h3>Tips</h3>
          <ul>{topic.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
        </section>
        {topic.seeAlso && <section><h3>See also</h3><ul className="help-panel__links">{topic.seeAlso.map((relatedId) => <li key={relatedId}><button type="button" onClick={() => navigate(relatedId)}>{HELP_TOPICS[relatedId].title}</button></li>)}</ul></section>}
      </div>
    </aside>
  )
}