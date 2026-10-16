import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import changelogSource from '../../changelog.md?raw'
import { HighlightMatches, matchesPanelSearch, PanelSearch } from './PanelSearch'
import SlideOutPanel from './SlideOutPanel'
import { useSidePanel } from './SidePanelContext'

interface ChangelogCategory {
  title: string
  entries: string[]
}

interface ChangelogRelease {
  title: string
  categories: ChangelogCategory[]
}

function parseChangelog(source: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = []
  let activeCategory: ChangelogCategory | undefined

  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      releases.push({ title: line.slice(3).trim(), categories: [] })
      activeCategory = undefined
    } else if (line.startsWith('### ') && releases.length > 0) {
      activeCategory = { title: line.slice(4).trim(), entries: [] }
      releases[releases.length - 1].categories.push(activeCategory)
    } else if (line.startsWith('- ') && activeCategory) {
      activeCategory.entries.push(line.slice(2).trim())
    }
  }

  return releases
}

const releases = parseChangelog(changelogSource)

export default function ChangelogPanel(): JSX.Element {
  const { activePanel } = useSidePanel()
  const [expandedReleases, setExpandedReleases] = useState<Set<number>>(() => new Set(releases.length > 0 ? [0] : []))
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim()

  const visibleReleases = releases.flatMap((release, index) => {
    const releaseMatches = normalizedQuery !== '' && matchesPanelSearch(release.title, normalizedQuery)
    const categories = release.categories.flatMap((category) => {
      const categoryMatches = normalizedQuery !== '' && matchesPanelSearch(category.title, normalizedQuery)
      const entries = releaseMatches || categoryMatches || normalizedQuery === ''
        ? category.entries
        : category.entries.filter((entry) => matchesPanelSearch(entry, normalizedQuery))
      return categoryMatches || entries.length > 0 ? [{ ...category, entries }] : []
    })

    return releaseMatches || categories.length > 0 ? [{ ...release, categories, index }] : []
  })

  useEffect(() => {
    if (!normalizedQuery) return
    const matchingIndices = visibleReleases.map((release) => release.index)
    setExpandedReleases((current) => {
      const next = new Set(current)
      matchingIndices.forEach((index) => next.add(index))
      return next.size === current.size ? current : next
    })
  }, [normalizedQuery])

  return (
    <SlideOutPanel
      panel="changelog"
      titleId="changelog-panel-title"
      title="Changelog"
      search={<PanelSearch label="Search Changelog" placeholder="Search releases" value={query} onChange={setQuery} />}
    >
      <div className="changelog-panel__content" hidden={activePanel !== 'changelog'}>
        {visibleReleases.length === 0 ? (
          <p className="changelog-panel__empty">No changelog entries match “{query}”.</p>
        ) : (
          <div className="changelog-panel__releases">
          {visibleReleases.map((release) => (
            <details
              className="changelog-panel__release"
              key={release.title}
              open={expandedReleases.has(release.index)}
              onToggle={(event) => {
                const isExpanded = event.currentTarget.open
                setExpandedReleases((current) => {
                  const next = new Set(current)
                  if (isExpanded) next.add(release.index)
                  else next.delete(release.index)
                  return next
                })
              }}
            >
              <summary>
                <span><HighlightMatches text={release.title} query={normalizedQuery} /></span>
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <div className="changelog-panel__release-content">
                {release.categories.map((category) => (
                  <section key={category.title}>
                    <h3><HighlightMatches text={category.title} query={normalizedQuery} /></h3>
                    <ul>{category.entries.map((entry) => <li key={entry}><HighlightMatches text={entry} query={normalizedQuery} /></li>)}</ul>
                  </section>
                ))}
              </div>
            </details>
          ))}
          </div>
        )}
      </div>
    </SlideOutPanel>
  )
}