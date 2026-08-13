import { useEffect, useRef, useState } from 'react'
import { Disc3, Minus, Square, Copy, X, PanelLeftClose, PanelLeftOpen, MoreVertical, RefreshCw, Bug } from 'lucide-react'
import './TitleBar.css'

interface WindowState {
  maximized: boolean
}

interface TitleBarProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

// Custom title bar replacing the OS-native one, since the BrowserWindow is created with frame: false.
export default function TitleBar({ sidebarCollapsed, onToggleSidebar }: TitleBarProps): JSX.Element {
  const [maximized, setMaximized] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.discdock.window.isMaximized().then((result) => {
      if (result.ok) setMaximized(result.data.maximized)
    })
    return window.discdock.window.onStateChanged((state: WindowState) => setMaximized(state.maximized))
  }, [])

  useEffect(() => {
    if (!moreMenuOpen) return
    const handleClickOutside = (event: MouseEvent): void => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMoreMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [moreMenuOpen])

  return (
    <header className="title-bar">
      <div className="title-bar__drag-region">
        <button
          type="button"
          className="title-bar__sidebar-toggle"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
        </button>
        <Disc3 size={16} className="title-bar__icon" aria-hidden="true" />
        <span className="title-bar__title">DiscDock</span>
      </div>
      <div className="title-bar__controls">
        <div className="title-bar__more" ref={moreMenuRef}>
          <button
            type="button"
            className="title-bar__button"
            aria-label="More"
            aria-haspopup="menu"
            aria-expanded={moreMenuOpen}
            onClick={() => setMoreMenuOpen((prev) => !prev)}
          >
            <MoreVertical size={14} />
          </button>
          {moreMenuOpen && (
            <div className="title-bar__menu" role="menu">
              <button
                type="button"
                className="title-bar__menu-item"
                role="menuitem"
                onClick={() => {
                  setMoreMenuOpen(false)
                  void window.discdock.app.restart()
                }}
              >
                <RefreshCw size={14} aria-hidden="true" />
                <span className="title-bar__menu-item-label">Restart DiscDock</span>
                <span className="title-bar__menu-item-shortcut">Ctrl+Shift+R</span>
              </button>
              <button
                type="button"
                className="title-bar__menu-item"
                role="menuitem"
                onClick={() => {
                  setMoreMenuOpen(false)
                  void window.discdock.app.toggleDevTools()
                }}
              >
                <Bug size={14} aria-hidden="true" />
                <span className="title-bar__menu-item-label">Show Dev Tools</span>
                <span className="title-bar__menu-item-shortcut">Ctrl+Shift+I</span>
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className="title-bar__button"
          aria-label="Minimize"
          onClick={() => void window.discdock.window.minimize()}
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          className="title-bar__button"
          aria-label={maximized ? 'Restore' : 'Maximize'}
          onClick={() => void window.discdock.window.maximize()}
        >
          {maximized ? <Copy size={13} /> : <Square size={12} />}
        </button>
        <button
          type="button"
          className="title-bar__button title-bar__button--close"
          aria-label="Close"
          onClick={() => void window.discdock.window.close()}
        >
          <X size={14} />
        </button>
      </div>
    </header>
  )
}
