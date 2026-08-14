export type ViewId =
  | 'dashboard'
  | 'media-library'
  | 'media-detail'
  | 'search'
  | 'duplicates'
  | 'collections'
  | 'backup-export'
  | 'settings'

export interface HelpTopic {
  id: ViewId
  title: string
  overview: string
  features: { name: string; description: string }[]
  tips: string[]
  seeAlso?: ViewId[]
}