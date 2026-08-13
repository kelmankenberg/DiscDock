import { useState } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import Dashboard from './views/Dashboard'
import MediaLibrary from './views/MediaLibrary'
import PlaceholderView from './views/PlaceholderView'
import { NAV_ITEMS } from './components/Sidebar'

const VIEW_TITLES: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.key, item.label])
)

export default function App(): JSX.Element {
  const [activeView, setActiveView] = useState('dashboard')

  const renderView = (): JSX.Element => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard />
      case 'media-library':
        return <MediaLibrary />
      default:
        return <PlaceholderView title={VIEW_TITLES[activeView] ?? activeView} />
    }
  }

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-body">
        <Sidebar active={activeView} onSelect={setActiveView} />
        <main className="app-content">{renderView()}</main>
      </div>
    </div>
  )
}
