import { createContext, useContext, useState, type ReactNode } from 'react'
import type { ViewId } from './types'

interface HelpContextValue {
  topicId: ViewId
  setTopicId: (topicId: ViewId) => void
}

const HelpContext = createContext<HelpContextValue | null>(null)

export function HelpProvider({ children }: { children: ReactNode }): JSX.Element {
  const [topicId, setTopicId] = useState<ViewId>('dashboard')
  return <HelpContext.Provider value={{ topicId, setTopicId }}>{children}</HelpContext.Provider>
}

export function useHelp(): HelpContextValue {
  const context = useContext(HelpContext)
  if (!context) throw new Error('useHelp must be used within HelpProvider')
  return context
}