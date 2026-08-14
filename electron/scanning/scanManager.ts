import { BrowserWindow, Notification } from 'electron'
import { walkAndScan } from './scanEngine'
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
import type { HashMode, ScanProgress } from '../../shared/types'

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
    markScanJobRunning(next.jobId)
    win?.webContents.send('scan:started', { jobId: next.jobId, mediaItemId: next.mediaItemId })
    void runScan(next.jobId, next.mediaItemId, next.rootPath, next.hashMode)
  }
}

export function cancelScan(jobId: number): boolean {
  const job = activeJobs.get(jobId)
  if (job) {
    job.cancelled = true
    return true
  }

  const queuedIndex = queue.findIndex((entry) => entry.jobId === jobId)
  if (queuedIndex === -1) return false

  queue.splice(queuedIndex, 1)
  finalizeScanJob(jobId, 'cancelled', {
    filesAdded: 0,
    filesRemoved: 0,
    filesModified: 0,
    filesUnchanged: 0,
    errorCount: 0
  })
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
        onProgress: (filesProcessed, bytesProcessed, currentPath) => {
          const progress: ScanProgress = { jobId, filesProcessed, bytesProcessed, currentPath }
          win?.webContents.send('scan:progress', progress)
        },
        onError: (relativePath, errorType, message) => {
          errorCount += 1
          recordScanError(jobId, relativePath, errorType, message)
        },
        isCancelled: () => state.cancelled
      }
    )

    const filesRemoved = pruneUnseenFiles(mediaItemId, jobId)
    const status = state.cancelled ? 'cancelled' : 'completed'
    const counts = { filesAdded, filesRemoved, filesModified, filesUnchanged, errorCount }
    finalizeScanJob(jobId, status, counts)
    markMediaScanned(mediaItemId, hashMode !== 'none' && errorCount === 0 && !state.cancelled)

    if (status === 'completed') {
      win?.webContents.send('scan:completed', { jobId, summary: counts })
      if (settings.notifications.scanCompleted) {
        new Notification({ title: 'DiscDock', body: `Scan completed: ${filesAdded} added, ${filesModified} modified, ${filesRemoved} removed` }).show()
      }
    } else {
      win?.webContents.send('scan:cancelled', { jobId })
    }
  } catch (err) {
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
