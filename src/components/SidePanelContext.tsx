import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export type SidePanelId = 'help' | 'changelog'

interface SidePanelContextValue {
  activePanel: SidePanelId | null
  widthPercent: number
  toggle: (panel: SidePanelId, opener?: HTMLButtonElement) => void
  close: () => void
  setWidthPercent: (width: number) => void
}

const MIN_WIDTH = 25
const MAX_WIDTH = 50
const SidePanelContext = createContext<SidePanelContextValue | null>(null)

const clampWidth = (width: number): number => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))

export function SidePanelProvider({ children }: { children: ReactNode }): JSX.Element {
  const [activePanel, setActivePanel] = useState<SidePanelId | null>(null)
  const [widthPercent, setWidthPercentState] = useState(30)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const openerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    void window.discdock.settings.get().then((result) => {
      if (result.ok) {
        setActivePanel(result.data.helpPanelOpen ? 'help' : null)
        setWidthPercentState(clampWidth(result.data.sidePanelWidthPercent))
      }
      setSettingsLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (!settingsLoaded) return
    const timer = window.setTimeout(() => {
      void window.discdock.settings.update({
        helpPanelOpen: activePanel === 'help',
        sidePanelWidthPercent: widthPercent
      })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [activePanel, settingsLoaded, widthPercent])

  const close = (): void => {
    setActivePanel(null)
    window.setTimeout(() => {
      if (openerRef.current?.isConnected) openerRef.current.focus()
    }, 180)
  }

  const toggle = (panel: SidePanelId, opener?: HTMLButtonElement): void => {
    if (opener) openerRef.current = opener
    if (activePanel === panel) {
      close()
    } else {
      setActivePanel(panel)
    }
  }

  return (
    <SidePanelContext.Provider value={{
      activePanel,
      widthPercent,
      toggle,
      close,
      setWidthPercent: (width) => setWidthPercentState(clampWidth(width))
    }}>
      {children}
    </SidePanelContext.Provider>
  )
}

export function useSidePanel(): SidePanelContextValue {
  const context = useContext(SidePanelContext)
  if (!context) throw new Error('useSidePanel must be used within SidePanelProvider')
  return context
}

export { MIN_WIDTH, MAX_WIDTH }