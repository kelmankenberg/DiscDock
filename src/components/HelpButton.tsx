import { CircleQuestionMark } from 'lucide-react'
import type { ViewId } from '../help/types'
import { useHelp } from '../help/HelpContext'
import { useSidePanel } from './SidePanelContext'

export default function HelpButton({ topicId }: { topicId: ViewId }): JSX.Element {
  const help = useHelp()
  const panel = useSidePanel()
  const isActive = panel.activePanel === 'help' && help.topicId === topicId
  return (
    <button
      type="button"
      className="button button--icon-only help-button"
      aria-label={`Help: ${topicId}`}
      title="Help (F1)"
      aria-pressed={isActive}
      onClick={(event) => {
        help.setTopicId(topicId)
        panel.toggle('help', event.currentTarget)
      }}
    >
      <CircleQuestionMark size={18} aria-hidden="true" />
    </button>
  )
}