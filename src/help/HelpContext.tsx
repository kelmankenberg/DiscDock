import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ViewId } from './types'

interface HelpContextValue {
  isOpen: boolean
  topicId: ViewId
  widthPercent: number
  toggle: (topicId: ViewId, opener?: HTMLButtonElement) => void
  show: (topicId: ViewId) => void
  close: () => void
  setWidthPercent: (width: number) => void
}

const MIN_WIDTH = 25
const MAX_WIDTH = 40
const HelpContext = createContext<HelpContextValue | null>(null)

const clampWidth = (width: number): number => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))

export function HelpProvider({ children }: { children: ReactNode }): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [topicId, setTopicId] = useState<ViewId>('dashboard')
  const [widthPercent, setWidthPercentState] = useState(30)
  const openerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    void window.discdock.settings.get().then((result) => {
      if (!result.ok) return
      setIsOpen(result.data.helpPanelOpen)
      setWidthPercentState(clampWidth(result.data.helpPanelWidthPercent))
    })
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void window.discdock.settings.update({ helpPanelOpen: isOpen, helpPanelWidthPercent: widthPercent })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [isOpen, widthPercent])

  const toggle = (nextTopic: ViewId, opener?: HTMLButtonElement): void => {
    if (opener) openerRef.current = opener
    if (isOpen && topicId === nextTopic) {
      setIsOpen(false)
      window.setTimeout(() => openerRef.current?.focus(), 180)
      return
    }
    setTopicId(nextTopic)
    setIsOpen(true)
  }

  const close = (): void => {
    setIsOpen(false)
    window.setTimeout(() => openerRef.current?.focus(), 180)
  }

  const show = (nextTopic: ViewId): void => {
    setTopicId(nextTopic)
    setIsOpen(true)
  }

  return <HelpContext.Provider value={{ isOpen, topicId, widthPercent, toggle, show, close, setWidthPercent: (width) => setWidthPercentState(clampWidth(width)) }}>{children}</HelpContext.Provider>
}

export function useHelp(): HelpContextValue {
  const context = useContext(HelpContext)
  if (!context) throw new Error('useHelp must be used within HelpProvider')
  return context
}

export { MIN_WIDTH, MAX_WIDTH }