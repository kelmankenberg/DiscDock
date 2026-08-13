import { contextBridge, ipcRenderer } from 'electron'
import type {
  DashboardSummary,
  DetectedDevice,
  IpcResult,
  MediaItem,
  MediaItemInput,
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
    delete: (id: number): Promise<IpcResult<{ deleted: true }>> =>
      ipcRenderer.invoke('media:delete', { id })
  },
  app: {
    getVersion: (): Promise<IpcResult<string>> => ipcRenderer.invoke('app:getVersion')
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
    }
  }
}

contextBridge.exposeInMainWorld('discdock', api)

export type DiscDockApi = typeof api
