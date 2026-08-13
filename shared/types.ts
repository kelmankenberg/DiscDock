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

export type MediaType =
  | 'cd'
  | 'dvd'
  | 'bluray'
  | 'usb_drive'
  | 'external_hdd'
  | 'external_ssd'
  | 'sd_card'
  | 'network_share'
  | 'other'

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
}

export interface DashboardSummary {
  totalMediaItems: number
  totalFiles: number
  totalSizeBytes: number
  mediaNeedingVerification: number
}
