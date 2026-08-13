import { LayoutDashboard, Library, Search, Copy, FolderOpen, DatabaseBackup, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import './Sidebar.css'

export interface NavItem {
  key: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'media-library', label: 'Media Library', icon: Library },
  { key: 'search', label: 'Search', icon: Search },
  { key: 'duplicates', label: 'Duplicates', icon: Copy },
  { key: 'collections', label: 'Collections', icon: FolderOpen },
  { key: 'backup-export', label: 'Backup / Export', icon: DatabaseBackup },
  { key: 'settings', label: 'Settings', icon: Settings }
]

interface SidebarProps {
  active: string
  onSelect: (key: string) => void
}

export default function Sidebar({ active, onSelect }: SidebarProps): JSX.Element {
  return (
    <nav className="sidebar">
      <ul className="sidebar__list">
        {NAV_ITEMS.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className={`sidebar__item${item.key === active ? ' sidebar__item--active' : ''}`}
              onClick={() => onSelect(item.key)}
            >
              <item.icon size={16} aria-hidden="true" />
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
