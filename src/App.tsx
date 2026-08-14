import { useEffect, useRef, useState } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import Dashboard from './views/Dashboard'
import MediaLibrary from './views/MediaLibrary'
import MediaDetail from './views/MediaDetail'
import Search from './views/Search'
import Duplicates from './views/Duplicates'
import BackupExport from './views/BackupExport'
import SettingsView from './views/Settings'
import Collections from './views/Collections'
import PlaceholderView from './views/PlaceholderView'
import { NAV_ITEMS } from './components/Sidebar'
import HelpPanel from './components/HelpPanel'
import { HelpProvider, useHelp } from './help/HelpContext'
import type { ViewId } from './help/types'

const VIEW_TITLES: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.key, item.label])
)

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'discdock:sidebar-collapsed'

export default function App(): JSX.Element {
  const [activeView, setActiveView] = useState('dashboard')
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null)
  const [libraryFocusId, setLibraryFocusId] = useState<number | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
  )

  const toggleSidebarCollapsed = (): void => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next))
      return next
    })
  }

  useEffect(() => {
    void window.discdock.settings.get().then((result) => {
      if (result.ok) document.documentElement.dataset.theme = result.data.theme
    })
  }, [])

  useEffect(
    () =>
      window.discdock.app.onOpenMedia((mediaId) => {
        setActiveView('media-library')
        setSelectedMediaId(mediaId)
      }),
    []
  )

  // Global keyboard shortcuts: Ctrl+F -> Search, Ctrl+, -> Settings, F1 -> Help.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.ctrlKey) return
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        handleSelectNav('search')
      } else if (event.key === ',') {
        event.preventDefault()
        handleSelectNav('settings')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSelectNav = (key: string): void => {
    setSelectedMediaId(null)
    setLibraryFocusId(null)
    setActiveView(key)
  }

  const handleShowInLibrary = (mediaId: number): void => {
    setSelectedMediaId(null)
    setLibraryFocusId(mediaId)
    setActiveView('media-library')
  }

  const renderView = (): JSX.Element => {
    if (activeView === 'media-library' && selectedMediaId !== null) {
      return <MediaDetail mediaId={selectedMediaId} onBack={() => setSelectedMediaId(null)} />
    }
    switch (activeView) {
      case 'dashboard':
        return <Dashboard onShowInLibrary={handleShowInLibrary} />
      case 'media-library':
        return (
          <MediaLibrary
            onOpenDetail={setSelectedMediaId}
            focusMediaId={libraryFocusId}
            onFocusHandled={() => setLibraryFocusId(null)}
          />
        )
      case 'search':
        return <Search />
      case 'duplicates':
        return <Duplicates />
      case 'backup-export':
        return <BackupExport />
      case 'collections':
        return <Collections />
      case 'settings':
        return <SettingsView />
      default:
        return <PlaceholderView title={VIEW_TITLES[activeView] ?? activeView} />
    }
  }

  return (
    <HelpProvider>
      <AppShell
        sidebarCollapsed={sidebarCollapsed}
        toggleSidebarCollapsed={toggleSidebarCollapsed}
        activeView={activeView}
        selectedMediaId={selectedMediaId}
        handleSelectNav={handleSelectNav}
        renderView={renderView}
      />
    </HelpProvider>
  )
}

function AppShell({
  sidebarCollapsed,
  toggleSidebarCollapsed,
  activeView,
  selectedMediaId,
  handleSelectNav,
  renderView
}: {
  sidebarCollapsed: boolean
  toggleSidebarCollapsed: () => void
  activeView: string
  selectedMediaId: number | null
  handleSelectNav: (key: string) => void
  renderView: () => JSX.Element
}): JSX.Element {
  const help = useHelp()
  const previousHelpRoute = useRef(`${activeView}:${selectedMediaId ?? ''}`)

  useEffect(() => {
    const route = `${activeView}:${selectedMediaId ?? ''}`
    if (route === previousHelpRoute.current) return
    previousHelpRoute.current = route
    if (!help.isOpen) return
    help.show((activeView === 'media-library' && selectedMediaId !== null ? 'media-detail' : activeView) as ViewId)
  }, [activeView, help.isOpen, selectedMediaId])

  useEffect(() => {
    const handleHelpShortcut = (event: KeyboardEvent): void => {
      if (event.key !== 'F1') return
      event.preventDefault()
      help.toggle((activeView === 'media-library' && selectedMediaId !== null ? 'media-detail' : activeView) as ViewId)
    }
    window.addEventListener('keydown', handleHelpShortcut)
    return () => window.removeEventListener('keydown', handleHelpShortcut)
  }, [activeView, help, selectedMediaId])

  return (
    <div className="app-shell">
      <TitleBar sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebarCollapsed} />
      <div className="app-body">
        <Sidebar active={activeView} onSelect={handleSelectNav} collapsed={sidebarCollapsed} />
        <main className="app-content">{renderView()}</main>
        <HelpPanel />
      </div>
    </div>
  )
}
