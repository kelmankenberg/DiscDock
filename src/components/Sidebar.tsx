import { useState } from 'react'
import {
  LayoutDashboard,
  Library,
  Search,
  Copy,
  FolderOpen,
  DatabaseBackup,
  Settings,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'
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

const COLLAPSED_STORAGE_KEY = 'discdock:sidebar-collapsed'

interface SidebarProps {
  active: string
  onSelect: (key: string) => void
}

export default function Sidebar({ active, onSelect }: SidebarProps): JSX.Element {
  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true')

  const toggleCollapsed = (): void => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <nav className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
      <button
        type="button"
        className="sidebar__toggle"
        onClick={toggleCollapsed}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
      </button>
      <ul className="sidebar__list">
        {NAV_ITEMS.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className={`sidebar__item${item.key === active ? ' sidebar__item--active' : ''}`}
              onClick={() => onSelect(item.key)}
              title={collapsed ? item.label : undefined}
              aria-label={item.label}
            >
              <item.icon size={16} aria-hidden="true" />
              {!collapsed && item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
