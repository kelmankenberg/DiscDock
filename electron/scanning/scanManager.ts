import { BrowserWindow, Notification } from 'electron'
import { walkAndScan } from './scanEngine'
import {
  createScanJob,
  finalizeScanJob,
  markMediaScanned,
  pruneUnseenFiles,
  recordScanError,
  upsertFileRecord
} from '../db/scanRepository'
import { getSettings } from '../settings/settingsStore'
import type { HashMode, ScanProgress } from '../../shared/types'

interface ActiveJob {
  cancelled: boolean
}

const activeJobs = new Map<number, ActiveJob>()
let win: BrowserWindow | null = null

export function initScanManager(mainWindow: BrowserWindow): void {
  win = mainWindow
}

export function cancelScan(jobId: number): boolean {
  const job = activeJobs.get(jobId)
  if (!job) return false
  job.cancelled = true
  return true
}

/** Creates the scan_job row synchronously and runs the walk in the background; returns the job id immediately. */
export function startScan(mediaItemId: number, rootPath: string, hashMode: HashMode): number {
  const job = createScanJob(mediaItemId, hashMode)
  void runScan(job.id, mediaItemId, rootPath, hashMode)
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
  }
}
