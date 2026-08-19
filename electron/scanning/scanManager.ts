import { BrowserWindow, Notification, app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { walkAndScan } from './scanEngine'
import { computeDiscId, fetchAudioCdMetadata, fetchCoverArtPng, readAudioCdToc } from './audioCd'
import { getMediaItem, setMediaCoverPath, updateMediaItem } from '../db/mediaRepository'
import {
  createScanJob,
  finalizeScanJob,
  markMediaScanned,
  markScanJobRunning,
  pruneUnseenFiles,
  recordScanError,
  upsertFileRecord
} from '../db/scanRepository'
import { getSettings } from '../settings/settingsStore'
import type { AudioCdMetadata, HashMode, ScanProgress } from '../../shared/types'
import { log } from '../logging'

interface ActiveJob {
  cancelled: boolean
}

interface QueuedJob {
  jobId: number
  mediaItemId: number
  rootPath: string
  hashMode: HashMode
}

const activeJobs = new Map<number, ActiveJob>()
const queue: QueuedJob[] = []
let win: BrowserWindow | null = null

export function initScanManager(mainWindow: BrowserWindow): void {
  win = mainWindow
}

function maxConcurrentScans(): number {
  const configured = getSettings().maxConcurrentScans
  return Number.isFinite(configured) ? Math.max(1, Math.trunc(configured)) : 1
}

function pumpQueue(): void {
  while (activeJobs.size < maxConcurrentScans() && queue.length > 0) {
    const next = queue.shift() as QueuedJob
    log.info('Scan started', { jobId: next.jobId, mediaItemId: next.mediaItemId, hashMode: next.hashMode })
    markScanJobRunning(next.jobId)
    win?.webContents.send('scan:started', { jobId: next.jobId, mediaItemId: next.mediaItemId })
    void runScan(next.jobId, next.mediaItemId, next.rootPath, next.hashMode)
  }
}

export function cancelScan(jobId: number): boolean {
  const job = activeJobs.get(jobId)
  if (job) {
    job.cancelled = true
    log.info('Scan cancellation requested', { jobId })
    return true
  }

  const queuedIndex = queue.findIndex((entry) => entry.jobId === jobId)
  if (queuedIndex === -1) return false

  queue.splice(queuedIndex, 1)
  finalizeScanJob(jobId, 'incomplete', {
    filesAdded: 0,
    filesRemoved: 0,
    filesModified: 0,
    filesUnchanged: 0,
    errorCount: 0
  })
  log.info('Queued scan cancelled', { jobId })
  win?.webContents.send('scan:cancelled', { jobId })
  return true
}

/** Creates the scan_job row synchronously and queues the walk; returns the job id immediately. */
export function startScan(mediaItemId: number, rootPath: string, hashMode: HashMode): number {
  const job = createScanJob(mediaItemId, hashMode)
  queue.push({ jobId: job.id, mediaItemId, rootPath, hashMode })
  pumpQueue()
  return job.id
}

/** Catalogs an audio CD's raw track list, which has no filesystem to walk (FR-1.7). */
export function startAudioCdScan(mediaItemId: number, devicePath: string): number {
  const job = createScanJob(mediaItemId, 'none')
  markScanJobRunning(job.id)
  void runAudioCdScan(job.id, mediaItemId, devicePath)
  return job.id
}

async function runAudioCdScan(jobId: number, mediaItemId: number, devicePath: string): Promise<void> {
  let filesAdded = 0
  let filesModified = 0
  let filesUnchanged = 0

  try {
    const toc = await readAudioCdToc(devicePath)
    const discId = computeDiscId(toc)

    let metadata: AudioCdMetadata | null = null
    let metadataWarning: string | null = null
    if (discId && getSettings().audioCdMetadataEnabled) {
      try {
        metadata = await fetchAudioCdMetadata(discId, toc.tracks.length)
        if (!metadata) metadataWarning = `This disc (${discId}) is not in the MusicBrainz database.`
      } catch (err) {
        metadataWarning = `Track titles unavailable: ${(err as Error).message}`
      }
    }

    for (const track of toc.tracks) {
      const extension = track.isAudio ? 'cdda' : 'bin'
      const title = metadata?.trackTitles[track.trackNumber]
      const numberPrefix = String(track.trackNumber).padStart(2, '0')
      const name = title
        ? `${numberPrefix} - ${title.replace(/\//g, '-')}.${extension}`
        : `Track ${numberPrefix}.${extension}`

      const outcome = upsertFileRecord(mediaItemId, jobId, {
        path: name,
        name,
        extension,
        kind: track.isAudio ? 'audio' : 'other',
        sizeBytes: track.sizeBytes,
        isDirectory: false,
        createdAtSrc: null,
        modifiedAtSrc: null,
        hashAlgo: null,
        hashValue: null,
        durationSeconds: track.durationSeconds,
        trackNumber: track.trackNumber
      })
      if (outcome === 'added') filesAdded += 1
      else if (outcome === 'modified') filesModified += 1
      else filesUnchanged += 1
    }

    if (metadata?.albumTitle) {
      applyAudioCdLabel(mediaItemId, audioCdLabel(metadata))
    }

    if (metadata?.releaseId) {
      const coverWarning = await saveCoverArt(mediaItemId, metadata.releaseId)
      if (coverWarning && !metadataWarning) metadataWarning = coverWarning
    }

    // Non-fatal: the tracks are cataloged either way, but the user should see why titles are missing.
    let errorCount = 0
    if (metadataWarning) {
      recordScanError(jobId, devicePath, 'metadata', metadataWarning)
      errorCount = 1
      win?.webContents.send('scan:warning', { jobId, message: metadataWarning })
    }

    const filesRemoved = pruneUnseenFiles(mediaItemId, jobId)
    const counts = { filesAdded, filesRemoved, filesModified, filesUnchanged, errorCount }
    finalizeScanJob(jobId, 'completed', counts)
    markMediaScanned(mediaItemId, true)
    win?.webContents.send('scan:completed', { jobId, summary: counts })
  } catch (err) {
    finalizeScanJob(jobId, 'failed', {
      filesAdded,
      filesRemoved: 0,
      filesModified,
      filesUnchanged,
      errorCount: 1
    })
    recordScanError(jobId, devicePath, 'audio_cd', (err as Error).message)
    win?.webContents.send('scan:failed', { jobId, error: (err as Error).message })
  }
}

/** Only renames placeholder labels, so a user-chosen label is never overwritten. */
function applyAudioCdLabel(mediaItemId: number, label: string): void {
  const item = getMediaItem(mediaItemId)
  if (!item) return
  if (!/^(audio cd|unknown|untitled)\b/i.test(item.label)) return
  updateMediaItem(mediaItemId, { label })
}

/** Multi-disc releases get their disc position in the label so set members stay distinguishable. */
function audioCdLabel(metadata: AudioCdMetadata): string {
  const base = metadata.artist ? `${metadata.artist} — ${metadata.albumTitle}` : `${metadata.albumTitle}`
  if (metadata.discTotal && metadata.discTotal > 1) {
    return `${base} (Disc ${metadata.discNumber ?? '?'} of ${metadata.discTotal})`
  }
  if (metadata.discNumber && metadata.discNumber > 1) return `${base} (Disc ${metadata.discNumber})`
  return base
}

/** Stores the cover under userData/covers; returns a warning message when it could not be fetched. */
async function saveCoverArt(mediaItemId: number, releaseId: string): Promise<string | null> {
  try {
    const png = await fetchCoverArtPng(releaseId)
    if (!png) return null

    const coversDir = path.join(app.getPath('userData'), 'covers')
    await fs.mkdir(coversDir, { recursive: true })
    const coverPath = path.join(coversDir, `${mediaItemId}.png`)
    await fs.writeFile(coverPath, png)
    setMediaCoverPath(mediaItemId, coverPath)
    return null
  } catch (err) {
    return `Cover art unavailable: ${(err as Error).message}`
  }
}

async function runScan(jobId: number, mediaItemId: number, rootPath: string, hashMode: HashMode): Promise<void> {
  const state: ActiveJob = { cancelled: false }
  activeJobs.set(jobId, state)
  const settings = getSettings()

  let filesAdded = 0
  let filesModified = 0
  let filesUnchanged = 0
  let errorCount = 0

  try {
    await walkAndScan(
      rootPath,
      { hashMode, excludePatterns: settings.excludePatterns, followSymlinks: settings.followSymlinks },
      {
        onFile: (file) => {
          const outcome = upsertFileRecord(mediaItemId, jobId, file)
          if (outcome === 'added') filesAdded += 1
          else if (outcome === 'modified') filesModified += 1
          else filesUnchanged += 1
        },
        onProgress: (filesProcessed, bytesProcessed, currentPath, elapsedMs) => {
          const progress: ScanProgress = { jobId, filesProcessed, bytesProcessed, currentPath, elapsedMs }
          win?.webContents.send('scan:progress', progress)
        },
        onError: (relativePath, errorType, message) => {
          errorCount += 1
          recordScanError(jobId, relativePath, errorType, message)
        },
        isCancelled: () => state.cancelled
      }
    )

    const status = state.cancelled ? 'incomplete' : 'completed'
    const filesRemoved = status === 'completed' ? pruneUnseenFiles(mediaItemId, jobId) : 0
    const counts = { filesAdded, filesRemoved, filesModified, filesUnchanged, errorCount }
    finalizeScanJob(jobId, status, counts)
    if (status === 'completed') {
      log.info('Scan completed', { jobId, mediaItemId, counts })
      markMediaScanned(mediaItemId, hashMode !== 'none' && errorCount === 0)
    }

    if (status === 'completed') {
      win?.webContents.send('scan:completed', { jobId, summary: counts })
      if (settings.notifications.scanCompleted) {
        new Notification({ title: 'DiscDock', body: `Scan completed: ${filesAdded} added, ${filesModified} modified, ${filesRemoved} removed` }).show()
      }
    } else {
      log.info('Scan incomplete', { jobId, mediaItemId, counts })
      win?.webContents.send('scan:cancelled', { jobId })
    }
  } catch (err) {
    log.error('Scan failed', { jobId, mediaItemId, error: (err as Error).message })
    finalizeScanJob(jobId, 'failed', { filesAdded, filesRemoved: 0, filesModified, filesUnchanged, errorCount })
    win?.webContents.send('scan:failed', { jobId, error: (err as Error).message })
    if (settings.notifications.scanFailed) {
      new Notification({ title: 'DiscDock', body: 'Scan failed — see logs for details' }).show()
    }
  } finally {
    activeJobs.delete(jobId)
    pumpQueue()
  }
}
