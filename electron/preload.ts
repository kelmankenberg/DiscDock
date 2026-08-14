import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  Collection,
  CollectionInput,
  CustomFieldValue,
  DashboardSummary,
  DetectedDevice,
  DuplicateReport,
  DuplicateReportFilters,
  ExportFormat,
  ExportScope,
  FileAnnotation,
  FileEntry,
  HashMode,
  IpcResult,
  MediaItem,
  MediaItemInput,
  ScanErrorEntry,
  ScanJob,
  ScanProgress,
  SearchFilters,
  SearchResultPage,
  WindowState
} from '../shared/types'

const api = {
  window: {
    minimize: (): Promise<IpcResult<null>> => ipcRenderer.invoke('window:minimize'),
    maximize: (): Promise<IpcResult<null>> => ipcRenderer.invoke('window:maximize'),
    close: (): Promise<IpcResult<null>> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<IpcResult<WindowState>> => ipcRenderer.invoke('window:isMaximized'),
    onStateChanged: (callback: (state: WindowState) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: WindowState): void => callback(state)
      ipcRenderer.on('window:stateChanged', listener)
      return () => ipcRenderer.removeListener('window:stateChanged', listener)
    }
  },
  dashboard: {
    getSummary: (): Promise<IpcResult<DashboardSummary>> => ipcRenderer.invoke('dashboard:summary')
  },
  media: {
    list: (): Promise<IpcResult<MediaItem[]>> => ipcRenderer.invoke('media:list'),
    get: (id: number): Promise<IpcResult<MediaItem>> => ipcRenderer.invoke('media:get', { id }),
    create: (input: MediaItemInput): Promise<IpcResult<MediaItem>> =>
      ipcRenderer.invoke('media:create', input),
    update: (id: number, patch: Partial<MediaItemInput>): Promise<IpcResult<MediaItem>> =>
      ipcRenderer.invoke('media:update', { id, patch }),
    retire: (id: number): Promise<IpcResult<MediaItem>> => ipcRenderer.invoke('media:retire', { id }),
    markVerified: (id: number): Promise<IpcResult<MediaItem>> =>
      ipcRenderer.invoke('media:markVerified', { id }),
    delete: (id: number): Promise<IpcResult<{ deleted: true }>> =>
      ipcRenderer.invoke('media:delete', { id })
  },
  app: {
    getVersion: (): Promise<IpcResult<string>> => ipcRenderer.invoke('app:getVersion'),
    restart: (): Promise<IpcResult<null>> => ipcRenderer.invoke('app:restart'),
    toggleDevTools: (): Promise<IpcResult<null>> => ipcRenderer.invoke('app:toggleDevTools'),
    onOpenMedia: (callback: (mediaId: number) => void): (() => void) => {
      const listener = (_event: unknown, payload: { mediaId: number }): void => callback(payload.mediaId)
      ipcRenderer.on('app:openMedia', listener)
      return () => ipcRenderer.removeListener('app:openMedia', listener)
    }
  },
  devices: {
    list: (): Promise<IpcResult<DetectedDevice[]>> => ipcRenderer.invoke('devices:list'),
    onConnected: (callback: (device: DetectedDevice) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, device: DetectedDevice): void =>
        callback(device)
      ipcRenderer.on('devices:connected', listener)
      return () => ipcRenderer.removeListener('devices:connected', listener)
    },
    onDisconnected: (callback: (devicePath: string) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { devicePath: string }): void =>
        callback(payload.devicePath)
      ipcRenderer.on('devices:disconnected', listener)
      return () => ipcRenderer.removeListener('devices:disconnected', listener)
    },
    eject: (devicePath: string, isOptical: boolean): Promise<IpcResult<{ message: string }>> =>
      ipcRenderer.invoke('devices:eject', { devicePath, isOptical })
  },
  scan: {
    start: (mediaId: number, rootPath: string, hashMode?: HashMode): Promise<IpcResult<{ jobId: number }>> =>
      ipcRenderer.invoke('scan:start', { mediaId, rootPath, hashMode }),
    cancel: (jobId: number): Promise<IpcResult<{ cancelled: boolean }>> =>
      ipcRenderer.invoke('scan:cancel', { jobId }),
    history: (mediaId: number): Promise<IpcResult<ScanJob[]>> =>
      ipcRenderer.invoke('scan:history', { mediaId }),
    errors: (mediaId: number): Promise<IpcResult<ScanErrorEntry[]>> =>
      ipcRenderer.invoke('scan:errors', { mediaId }),
    onProgress: (callback: (progress: ScanProgress) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: ScanProgress): void => callback(progress)
      ipcRenderer.on('scan:progress', listener)
      return () => ipcRenderer.removeListener('scan:progress', listener)
    },
    onCompleted: (callback: (payload: { jobId: number }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { jobId: number }): void => callback(payload)
      ipcRenderer.on('scan:completed', listener)
      return () => ipcRenderer.removeListener('scan:completed', listener)
    },
    onFailed: (callback: (payload: { jobId: number; error: string }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { jobId: number; error: string }): void =>
        callback(payload)
      ipcRenderer.on('scan:failed', listener)
      return () => ipcRenderer.removeListener('scan:failed', listener)
    },
    onCancelled: (callback: (payload: { jobId: number }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { jobId: number }): void => callback(payload)
      ipcRenderer.on('scan:cancelled', listener)
      return () => ipcRenderer.removeListener('scan:cancelled', listener)
    }
  },
  dialogs: {
    pickFolder: (): Promise<IpcResult<{ path: string | null }>> => ipcRenderer.invoke('dialog:pickFolder'),
    pickSaveFile: (defaultName?: string): Promise<IpcResult<{ path: string | null }>> =>
      ipcRenderer.invoke('dialog:pickSaveFile', { defaultName }),
    pickOpenFile: (): Promise<IpcResult<{ path: string | null }>> => ipcRenderer.invoke('dialog:pickOpenFile')
  },
  search: {
    query: (text: string, filters: SearchFilters, page: number): Promise<IpcResult<SearchResultPage>> =>
      ipcRenderer.invoke('search:query', { text, filters, page })
  },
  duplicates: {
    report: (filters: DuplicateReportFilters): Promise<IpcResult<DuplicateReport>> =>
      ipcRenderer.invoke('duplicates:report', filters)
  },
  files: {
    list: (mediaId: number, folderPath: string): Promise<IpcResult<FileEntry[]>> =>
      ipcRenderer.invoke('files:list', { mediaId, folderPath }),
    annotations: (mediaId: number): Promise<IpcResult<Record<string, FileAnnotation>>> =>
      ipcRenderer.invoke('files:annotations', { mediaId }),
    setTags: (mediaId: number, filePath: string, tagNames: string[]): Promise<IpcResult<FileAnnotation>> =>
      ipcRenderer.invoke('files:setTags', { mediaId, filePath, tagNames }),
    setNote: (mediaId: number, filePath: string, note: string | null): Promise<IpcResult<FileAnnotation>> =>
      ipcRenderer.invoke('files:setNote', { mediaId, filePath, note }),
    open: (mediaId: number, filePath: string): Promise<IpcResult<{ opened: true }>> =>
      ipcRenderer.invoke('files:open', { mediaId, filePath }),
    reveal: (mediaId: number, filePath: string): Promise<IpcResult<{ revealed: true }>> =>
      ipcRenderer.invoke('files:reveal', { mediaId, filePath })
  },
  settings: {
    get: (): Promise<IpcResult<AppSettings>> => ipcRenderer.invoke('settings:get'),
    update: (patch: Partial<AppSettings>): Promise<IpcResult<AppSettings>> =>
      ipcRenderer.invoke('settings:update', patch)
  },
  backup: {
    run: (destinationPath: string): Promise<IpcResult<{ ok: true }>> =>
      ipcRenderer.invoke('backup:run', { destinationPath }),
    restore: (sourcePath: string): Promise<IpcResult<{ safetyBackupPath: string }>> =>
      ipcRenderer.invoke('backup:restore', { sourcePath })
  },
  tags: {
    list: (): Promise<IpcResult<string[]>> => ipcRenderer.invoke('tags:list'),
    allForMedia: (): Promise<IpcResult<Record<number, string[]>>> => ipcRenderer.invoke('tags:allForMedia'),
    setForMedia: (mediaId: number, tagNames: string[]): Promise<IpcResult<string[]>> =>
      ipcRenderer.invoke('tags:setForMedia', { mediaId, tagNames })
  },
  collections: {
    list: (): Promise<IpcResult<Collection[]>> => ipcRenderer.invoke('collections:list'),
    create: (input: CollectionInput): Promise<IpcResult<Collection>> => ipcRenderer.invoke('collections:create', input),
    delete: (id: number): Promise<IpcResult<{ deleted: true }>> => ipcRenderer.invoke('collections:delete', { id }),
    members: (collectionId: number): Promise<IpcResult<MediaItem[]>> =>
      ipcRenderer.invoke('collections:members', { collectionId }),
    addMember: (collectionId: number, mediaId: number): Promise<IpcResult<{ ok: true }>> =>
      ipcRenderer.invoke('collections:addMember', { collectionId, mediaId }),
    removeMember: (collectionId: number, mediaId: number): Promise<IpcResult<{ ok: true }>> =>
      ipcRenderer.invoke('collections:removeMember', { collectionId, mediaId })
  },
  export: {
    run: (scope: ExportScope, format: ExportFormat, destinationPath: string): Promise<IpcResult<{ fileCount: number }>> =>
      ipcRenderer.invoke('export:run', { scope, format, destinationPath })
  },
  customFields: {
    getForMedia: (mediaId: number): Promise<IpcResult<CustomFieldValue[]>> =>
      ipcRenderer.invoke('customFields:getForMedia', { mediaId }),
    setForMedia: (mediaId: number, fieldName: string, fieldValue: string | null): Promise<IpcResult<{ ok: true }>> =>
      ipcRenderer.invoke('customFields:setForMedia', { mediaId, fieldName, fieldValue })
  }
}

contextBridge.exposeInMainWorld('discdock', api)

export type DiscDockApi = typeof api
