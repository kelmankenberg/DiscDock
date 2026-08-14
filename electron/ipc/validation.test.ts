import { describe, expect, it } from 'vitest'
import { validateSearchFilters, validateSettingsPatch } from './validation'

describe('IPC validation', () => {
  it('rejects invalid search ranges and accepts valid filters', () => {
    expect(validateSearchFilters({ minSizeBytes: 20, maxSizeBytes: 10 })).toBeNull()
    expect(validateSearchFilters({ mediaItemId: 2, kind: 'image', minSizeBytes: 10 })).toEqual({
      mediaItemId: 2,
      kind: 'image',
      minSizeBytes: 10
    })
  })

  it('rejects malformed settings and validates nested notifications', () => {
    expect(validateSettingsPatch({ maxConcurrentScans: 0 })).toBeNull()
    expect(validateSettingsPatch({ notifications: { scanCompleted: true } })).toBeNull()
    expect(validateSettingsPatch({ theme: 'dark', helpPanelWidthPercent: 35 })).toEqual({
      theme: 'dark',
      helpPanelWidthPercent: 35
    })
  })
})