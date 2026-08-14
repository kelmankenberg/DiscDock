// Shared type contracts between main, preload, and renderer processes.

export interface IpcOk<T> {
  ok: true
  data: T
}

export interface IpcErr {
  ok: false
  error: { code: string; message: string }
}

export type IpcResult<T> = IpcOk<T> | IpcErr

export interface WindowState {
  maximized: boolean
}

// Not a strict union: custom media types (user-defined in Settings) are arbitrary strings too.
export type MediaType = string

export const BUILTIN_MEDIA_TYPES: { value: MediaType; label: string }[] = [
  { value: 'cd', label: 'CD' },
  { value: 'dvd', label: 'DVD' },
  { value: 'bluray', label: 'Blu-ray' },
  { value: 'usb_drive', label: 'USB Flash Drive' },
  { value: 'external_hdd', label: 'External HDD' },
  { value: 'external_ssd', label: 'External SSD' },
  { value: 'sd_card', label: 'SD Card' },
  { value: 'network_share', label: 'Network Share' },
  { value: 'other', label: 'Other' }
]

// Kept for backwards compatibility with existing imports; prefer BUILTIN_MEDIA_TYPES + settings.customMediaTypes.
export const MEDIA_TYPES = BUILTIN_MEDIA_TYPES

export interface MediaItem {
  id: number
  label: string
  mediaType: MediaType
  deviceFingerprint: string | null
  capacityBytes: number | null
  physicalLocation: string | null
  notes: string | null
  status: 'active' | 'retired' | 'lost'
  createdAt: string
  lastScannedAt: string | null
  lastVerifiedAt: string | null
  coverPath: string | null
}

export interface MediaItemInput {
  label: string
  mediaType: MediaType
  capacityBytes: number | null
  physicalLocation: string | null
  notes: string | null
  deviceFingerprint?: string | null
}

export interface DetectedDevice {
  devicePath: string
  label: string | null
  fsType: string | null
  mountPoint: string
  sizeBytes: number | null
  uuid: string | null
  isOptical: boolean
  isAudioCd: boolean
}

export interface DashboardSummary {
  totalMediaItems: number
  totalFiles: number
  totalSizeBytes: number
  mediaNeedingVerification: number
  recentScans: DashboardScanActivity[]
  attention: DashboardAttention[]
}

export interface DashboardScanActivity {
  jobId: number
  mediaItemId: number
  mediaLabel: string
  status: ScanStatus
  startedAt: string
  filesAdded: number
  filesModified: number
  filesRemoved: number
  errorCount: number
}

export interface DashboardAttention {
  mediaItemId: number
  mediaLabel: string
  kind: 'verification' | 'scan'
  detail: string
}

export type HashMode = 'none' | 'quick' | 'full'

export type ScanStatus = 'queued' | 'running' | 'completed' | 'cancelled' | 'failed' | 'incomplete'

export interface ScanJob {
  id: number
  mediaItemId: number
  status: ScanStatus
  hashMode: HashMode
  startedAt: string
  completedAt: string | null
  filesAdded: number
  filesRemoved: number
  filesModified: number
  filesUnchanged: number
  errorCount: number
}

export interface ScanProgress {
  jobId: number
  filesProcessed: number
  bytesProcessed: number
  currentPath: string
}

export interface ScanStartInput {
  mediaId: number
  rootPath: string
  hashMode: HashMode
}

export interface AudioCdTrack {
  trackNumber: number
  startSector: number
  sectors: number
  durationSeconds: number
  sizeBytes: number
  isAudio: boolean
}

export interface AudioCdToc {
  tracks: AudioCdTrack[]
  leadoutSector: number
}

export interface AudioCdMetadata {
  discId: string
  releaseId: string | null
  albumTitle: string | null
  artist: string | null
  discNumber: number | null
  discTotal: number | null
  trackTitles: Record<number, string>
}

export const FILE_KINDS = ['image', 'video', 'audio', 'document', 'archive', 'other'] as const
export type FileKind = (typeof FILE_KINDS)[number]

export interface SearchFilters {
  mediaItemId?: number
  mediaType?: MediaType
  kind?: FileKind
  minSizeBytes?: number
  maxSizeBytes?: number
  modifiedAfter?: string
  modifiedBefore?: string
  tag?: string
}

export interface SearchQueryInput {
  text: string
  filters: SearchFilters
  page: number
  pageSize: number
}

export interface FileSearchResult {
  id: number
  mediaItemId: number
  mediaLabel: string
  path: string
  name: string
  sizeBytes: number
  modifiedAtSrc: string | null
  kind: string
}

export interface SearchResultPage {
  results: FileSearchResult[]
  total: number
}

export interface DuplicateOccurrence {
  mediaItemId: number
  mediaLabel: string
  path: string
}

export interface DuplicateGroup {
  hashValue: string
  sizeBytes: number
  occurrences: DuplicateOccurrence[]
}

export interface DuplicateReportFilters {
  minGroupSize?: number
  mediaType?: MediaType
  kind?: FileKind
}

export interface DuplicateReport {
  groups: DuplicateGroup[]
  totalGroups: number
  totalFiles: number
  reclaimableBytes: number
}

export interface FileEntry {
  path: string
  name: string
  kind: string
  isDirectory: boolean
  sizeBytes: number
  modifiedAtSrc: string | null
  durationSeconds: number | null
}

export interface FileAnnotation {
  tags: string[]
  note: string | null
}

export type Theme = 'light' | 'dark' | 'system'

export interface NotificationSettings {
  scanCompleted: boolean
  scanFailed: boolean
  verificationReminders: boolean
}

export interface AppSettings {
  defaultHashMode: HashMode
  excludePatterns: string[]
  followSymlinks: boolean
  theme: Theme
  notifications: NotificationSettings
  customMediaTypes: string[]
  customFieldNames: string[]
  verificationThresholdMonths: number
  maxConcurrentScans: number
  autoUpdateEnabled: boolean
  audioCdMetadataEnabled: boolean
  helpPanelOpen: boolean
  helpPanelWidthPercent: number
}

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'up-to-date' }
  | { state: 'available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

export interface Tag {
  id: number
  name: string
}

export interface Collection {
  id: number
  name: string
  description: string | null
  memberCount: number
  totalSizeBytes: number
  totalFiles: number
}

export interface CollectionInput {
  name: string
  description: string | null
}

export interface ScanErrorEntry {
  path: string
  errorType: string
  message: string | null
  scanStartedAt: string
}

export type ExportScope = { type: 'all' } | { type: 'media'; mediaId: number }
export type ExportFormat = 'json' | 'csv'

export interface CustomFieldValue {
  fieldName: string
  fieldValue: string
}
