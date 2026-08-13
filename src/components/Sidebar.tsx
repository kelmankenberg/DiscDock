import './Sidebar.css'

export interface NavItem {
  key: string
  label: string
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'media-library', label: 'Media Library' },
  { key: 'search', label: 'Search' },
  { key: 'duplicates', label: 'Duplicates' },
  { key: 'collections', label: 'Collections' },
  { key: 'backup-export', label: 'Backup / Export' },
  { key: 'settings', label: 'Settings' }
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
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
