import { useState } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import Dashboard from './views/Dashboard'
import MediaLibrary from './views/MediaLibrary'
import MediaDetail from './views/MediaDetail'
import Search from './views/Search'
import Duplicates from './views/Duplicates'
import PlaceholderView from './views/PlaceholderView'
import { NAV_ITEMS } from './components/Sidebar'

const VIEW_TITLES: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.key, item.label])
)

export default function App(): JSX.Element {
  const [activeView, setActiveView] = useState('dashboard')
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null)

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
      default:
        return <PlaceholderView title={VIEW_TITLES[activeView] ?? activeView} />
    }
  }

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-body">
        <Sidebar active={activeView} onSelect={handleSelectNav} />
        <main className="app-content">{renderView()}</main>
      </div>
    </div>
  )
}
