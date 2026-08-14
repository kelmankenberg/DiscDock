import { CircleQuestionMark } from 'lucide-react'
import type { ViewId } from '../help/types'
import { useHelp } from '../help/HelpContext'

export default function HelpButton({ topicId }: { topicId: ViewId }): JSX.Element {
  const { isOpen, topicId: activeTopic, toggle } = useHelp()
  return (
    <button
      type="button"
      className="button button--icon-only help-button"
      aria-label={`Help: ${topicId}`}
      title="Help (F1)"
      aria-pressed={isOpen && activeTopic === topicId}
      onClick={(event) => toggle(topicId, event.currentTarget)}
    >
      <CircleQuestionMark size={18} aria-hidden="true" />
    </button>
  )
}