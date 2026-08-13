import { contextBridge, ipcRenderer } from 'electron'
import type { DashboardSummary, IpcResult, WindowState } from '../shared/types'

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
  app: {
    getVersion: (): Promise<IpcResult<string>> => ipcRenderer.invoke('app:getVersion')
  }
}

contextBridge.exposeInMainWorld('discdock', api)

export type DiscDockApi = typeof api
