import { ArrowLeft, ChevronDown } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { HELP_TOPICS } from '../help/registry'
import { useHelp } from '../help/HelpContext'
import { HighlightMatches, matchesPanelSearch, PanelSearch } from './PanelSearch'
import SlideOutPanel from './SlideOutPanel'
import { useSidePanel } from './SidePanelContext'
import type { ViewId } from '../help/types'

function HelpSection({ title, query, defaultOpen = false, children }: { title: string; query: string; defaultOpen?: boolean; children: ReactNode }): JSX.Element {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <details className="help-panel__section" open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary>
        <span><HighlightMatches text={title} query={query} /></span>
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div className="help-panel__section-content">{children}</div>
    </details>
  )
}

export default function HelpPanel(): JSX.Element {
  const { topicId, setTopicId } = useHelp()
  const { activePanel } = useSidePanel()
  const [history, setHistory] = useState<ViewId[]>([])
  const [query, setQuery] = useState('')
  const topic = HELP_TOPICS[topicId]
  const normalizedQuery = query.trim()

  useEffect(() => setQuery(''), [topicId])

  const featuresHeadingMatches = normalizedQuery !== '' && matchesPanelSearch('Features', normalizedQuery)
  const tipsHeadingMatches = normalizedQuery !== '' && matchesPanelSearch('Tips', normalizedQuery)
  const visibleFeatures = topic.features.filter((feature) =>
    featuresHeadingMatches || matchesPanelSearch(`${feature.name} ${feature.description}`, normalizedQuery)
  )
  const visibleTips = topic.tips.filter((tip) =>
    tipsHeadingMatches || matchesPanelSearch(tip, normalizedQuery)
  )
  const visibleRelated = (topic.seeAlso ?? []).filter((relatedId) =>
    matchesPanelSearch(HELP_TOPICS[relatedId].title, normalizedQuery)
  )
  const showOverview = matchesPanelSearch(`Overview ${topic.overview}`, normalizedQuery)
  const showFeatures = visibleFeatures.length > 0
  const showTips = visibleTips.length > 0
  const showRelated = visibleRelated.length > 0 && topic.seeAlso !== undefined
  const hasResults = showOverview || showFeatures || showTips || showRelated

  const navigate = (nextTopic: ViewId): void => {
    setHistory((previous) => [...previous, topicId])
    setTopicId(nextTopic)
  }

  return (
    <SlideOutPanel
      panel="help"
      titleId="help-panel-title"
      title={`Help: ${topic.title}`}
      search={<PanelSearch label="Search Help content" placeholder="Search this page's help" value={query} onChange={setQuery} />}
      leading={history.length > 0 && (
        <button type="button" className="button button--small slide-panel__back" onClick={() => {
          const previousTopic = history[history.length - 1]
          setHistory((previous) => previous.slice(0, -1))
          setTopicId(previousTopic)
        }}>
          <ArrowLeft size={14} aria-hidden="true" /> Back
        </button>
      )}
    >
      <div className="help-panel__content" hidden={activePanel !== 'help'}>
        {!hasResults ? (
          <p className="help-panel__empty">No Help content matches “{query}”.</p>
        ) : (
          <>
            {showOverview && (
              <HelpSection key={`${topicId}-overview`} title="Overview" query={normalizedQuery} defaultOpen>
                <p><HighlightMatches text={topic.overview} query={normalizedQuery} /></p>
              </HelpSection>
            )}
            {showFeatures && (
              <HelpSection key={`${topicId}-features`} title="Features" query={normalizedQuery} defaultOpen>
                <dl className="help-panel__features">
                  {visibleFeatures.map((feature) => (
                    <div key={feature.name}>
                      <dt><HighlightMatches text={feature.name} query={normalizedQuery} /></dt>
                      <dd><HighlightMatches text={feature.description} query={normalizedQuery} /></dd>
                    </div>
                  ))}
                </dl>
              </HelpSection>
            )}
            {showTips && (
              <HelpSection key={`${topicId}-tips`} title="Tips" query={normalizedQuery}>
                <ul className="help-panel__tips">
                  {visibleTips.map((tip) => <li key={tip}><HighlightMatches text={tip} query={normalizedQuery} /></li>)}
                </ul>
              </HelpSection>
            )}
            {showRelated && (
              <HelpSection key={`${topicId}-related`} title="See also" query={normalizedQuery}>
                <ul className="help-panel__links">
                  {visibleRelated.map((relatedId) => (
                    <li key={relatedId}>
                      <button type="button" onClick={() => navigate(relatedId)}>
                        <HighlightMatches text={HELP_TOPICS[relatedId].title} query={normalizedQuery} />
                      </button>
                    </li>
                  ))}
                </ul>
              </HelpSection>
            )}
          </>
        )}
      </div>
    </SlideOutPanel>
  )
}