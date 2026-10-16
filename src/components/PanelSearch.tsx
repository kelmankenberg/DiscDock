import { Search } from 'lucide-react'

interface PanelSearchProps {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}

export function PanelSearch({ label, placeholder, value, onChange }: PanelSearchProps): JSX.Element {
  return (
    <div className="panel-search">
      <Search size={15} aria-hidden="true" />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export function matchesPanelSearch(text: string, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  return normalizedQuery === '' || text.toLowerCase().includes(normalizedQuery)
}

export function HighlightMatches({ text, query }: { text: string; query: string }): JSX.Element {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return <>{text}</>

  const normalizedText = text.toLowerCase()
  const segments: JSX.Element[] = []
  let cursor = 0
  let matchIndex = normalizedText.indexOf(normalizedQuery, cursor)

  while (matchIndex !== -1) {
    if (matchIndex > cursor) segments.push(<span key={`text-${cursor}`}>{text.slice(cursor, matchIndex)}</span>)
    const matchEnd = matchIndex + normalizedQuery.length
    segments.push(<mark className="panel-search__highlight" key={`match-${matchIndex}`}>{text.slice(matchIndex, matchEnd)}</mark>)
    cursor = matchEnd
    matchIndex = normalizedText.indexOf(normalizedQuery, cursor)
  }

  if (cursor < text.length) segments.push(<span key={`text-${cursor}`}>{text.slice(cursor)}</span>)
  return <>{segments}</>
}