import { BrowserWindow, shell } from 'electron'
import path from 'node:path'

const isDev = process.env.NODE_ENV === 'development'

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    // Frameless: DiscDock renders its own title bar/toolbar and window controls.
    frame: false,
    backgroundColor: '#1e1e1e',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win.show())

  // Never allow navigation to or opening of remote content from the renderer.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    void win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    void win.loadFile(path.join(__dirname, '../../../dist/index.html'))
  }

  return win
}
