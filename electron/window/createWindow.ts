import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { loadWindowState, trackWindowState } from './windowState'

const isDev = process.env.NODE_ENV === 'development'

export function createMainWindow(): BrowserWindow {
  const savedState = loadWindowState()

  const win = new BrowserWindow({
    width: savedState.width,
    height: savedState.height,
    x: savedState.x,
    y: savedState.y,
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

  win.once('ready-to-show', () => {
    if (savedState.maximized) win.maximize()
    win.show()
  })

  trackWindowState(win)

  // Never allow navigation to or opening of remote content from the renderer.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  // DevTools are not opened automatically; toggle manually with Ctrl+Shift+I.
  // Restart is bound to Ctrl+Shift+R. Only react to keyDown — before-input-event also fires
  // on keyUp, which would otherwise double-fire (e.g. toggle open then immediately close again).
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown' || !input.control || !input.shift) return
    const key = input.key.toLowerCase()
    if (key === 'i') {
      win.webContents.toggleDevTools()
    } else if (key === 'r') {
      app.relaunch()
      app.exit(0)
    }
  })

  if (isDev) {
    void win.loadURL('http://localhost:5173')
  } else {
    void win.loadFile(path.join(__dirname, '../../../dist/index.html'))
  }

  return win
}
