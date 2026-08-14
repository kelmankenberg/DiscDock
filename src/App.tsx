import { useEffect, useState } from 'react'
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

const VIEW_TITLES: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.key, item.label])
)

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'discdock:sidebar-collapsed'

export default function App(): JSX.Element {
  const [activeView, setActiveView] = useState('dashboard')
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null)
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

  // Global keyboard shortcuts: Ctrl+F -> Search, Ctrl+, -> Settings.
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
    setActiveView(key)
  }

  const renderView = (): JSX.Element => {
    if (activeView === 'media-library' && selectedMediaId !== null) {
      return <MediaDetail mediaId={selectedMediaId} onBack={() => setSelectedMediaId(null)} />
    }
    switch (activeView) {
      case 'dashboard':
        return <Dashboard />
      case 'media-library':
        return <MediaLibrary onOpenDetail={setSelectedMediaId} />
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
    <div className="app-shell">
      <TitleBar sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebarCollapsed} />
      <div className="app-body">
        <Sidebar active={activeView} onSelect={handleSelectNav} collapsed={sidebarCollapsed} />
        <main className="app-content">{renderView()}</main>
      </div>
    </div>
  )
}
