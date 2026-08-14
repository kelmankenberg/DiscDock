import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { AppSettings } from '../../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  defaultHashMode: 'none',
  excludePatterns: ['**/.Trash-*', '**/System Volume Information', '**/.DS_Store'],
  followSymlinks: false,
  theme: 'system',
  notifications: {
    scanCompleted: true,
    scanFailed: true,
    verificationReminders: true
  },
  customMediaTypes: [],
  customFieldNames: [],
  verificationThresholdMonths: 12,
  maxConcurrentScans: 1,
  autoUpdateEnabled: true,
  helpPanelOpen: false,
  helpPanelWidthPercent: 30
}

let cached: AppSettings | null = null

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function getSettings(): AppSettings {
  if (cached) return cached
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8')
    cached = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) }
  } catch {
    cached = { ...DEFAULT_SETTINGS }
  }
  return cached
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  cached = { ...current, ...patch }
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true })
  fs.writeFileSync(settingsPath(), JSON.stringify(cached, null, 2))
  return cached
}
