import { app, screen } from 'electron'
import type { BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

interface SavedWindowState {
  width: number
  height: number
  x?: number
  y?: number
  maximized: boolean
}

const DEFAULT_STATE: SavedWindowState = { width: 1280, height: 800, maximized: false }
const SAVE_DEBOUNCE_MS = 400

function statePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json')
}

function isOnScreen(x: number, y: number, width: number, height: number): boolean {
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea
    return x >= area.x && y >= area.y && x + width <= area.x + area.width && y + height <= area.y + area.height
  })
}

export function loadWindowState(): SavedWindowState {
  try {
    const raw = fs.readFileSync(statePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<SavedWindowState>
    const state: SavedWindowState = { ...DEFAULT_STATE, ...parsed }

    // Ignore stale bounds from a display that's no longer connected (e.g. laptop undocked).
    if (state.x !== undefined && state.y !== undefined && !isOnScreen(state.x, state.y, state.width, state.height)) {
      return { ...state, x: undefined, y: undefined }
    }
    return state
  } catch {
    return DEFAULT_STATE
  }
}

/** Debounced persistence of window bounds/maximized state, called on resize/move/maximize/unmaximize. */
export function trackWindowState(win: BrowserWindow): void {
  let saveTimer: NodeJS.Timeout | null = null

  const save = (): void => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const maximized = win.isMaximized()
      // While maximized, getBounds() reflects the maximized size — persist the last known
      // restored bounds instead so un-maximizing later returns to the expected size/position.
      const bounds = maximized ? win.getNormalBounds() : win.getBounds()
      const state: SavedWindowState = {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        maximized
      }
      try {
        fs.mkdirSync(path.dirname(statePath()), { recursive: true })
        fs.writeFileSync(statePath(), JSON.stringify(state, null, 2))
      } catch {
        // best-effort persistence — not critical if a write occasionally fails
      }
    }, SAVE_DEBOUNCE_MS)
  }

  win.on('resize', save)
  win.on('move', save)
  win.on('maximize', save)
  win.on('unmaximize', save)
}
