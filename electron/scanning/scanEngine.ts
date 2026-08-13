import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { createReadStream } from 'node:fs'
import type { HashMode } from '../../shared/types'
import { classifyKind, getExtension } from './fileKind'
import type { WalkedFile } from '../db/scanRepository'

const QUICK_HASH_SAMPLE_BYTES = 65536
const PROGRESS_YIELD_EVERY = 200

export interface ScanCallbacks {
  onFile: (file: WalkedFile) => void
  onProgress: (filesProcessed: number, bytesProcessed: number, currentPath: string) => void
  onError: (relativePath: string, errorType: string, message: string) => void
  isCancelled: () => boolean
}

async function hashFile(absolutePath: string, mode: HashMode, size: number): Promise<string | null> {
  if (mode === 'none') return null

  if (mode === 'quick') {
    const handle = await fs.open(absolutePath, 'r')
    try {
      const buffer = Buffer.alloc(Math.min(QUICK_HASH_SAMPLE_BYTES, size))
      await handle.read(buffer, 0, buffer.length, 0)
      const hash = crypto.createHash('sha256')
      hash.update(buffer)
      hash.update(String(size))
      return hash.digest('hex')
    } finally {
      await handle.close()
    }
  }

  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = createReadStream(absolutePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/**
 * Iteratively walks rootPath (stack-based, no recursion) so deep trees can't overflow the call stack.
 * Runs on the main process event loop but yields periodically so IPC/UI stay responsive (v0.1.0
 * simplification — see roadmap for moving this to a worker_thread/utility process).
 */
export async function walkAndScan(
  rootPath: string,
  hashMode: HashMode,
  callbacks: ScanCallbacks
): Promise<{ filesProcessed: number; bytesProcessed: number }> {
  const stack: string[] = [rootPath]
  let filesProcessed = 0
  let bytesProcessed = 0
  let sinceYield = 0

  while (stack.length > 0) {
    if (callbacks.isCancelled()) break
    const currentDir = stack.pop() as string

    let entries: string[]
    try {
      entries = await fs.readdir(currentDir)
    } catch (err) {
      callbacks.onError(currentDir, 'read_dir_failed', (err as Error).message)
      continue
    }

    for (const entryName of entries) {
      if (callbacks.isCancelled()) break
      const absolutePath = path.join(currentDir, entryName)
      const relativePath = path.relative(rootPath, absolutePath)

      let stat
      try {
        stat = await fs.lstat(absolutePath)
      } catch (err) {
        callbacks.onError(relativePath, 'stat_failed', (err as Error).message)
        continue
      }

      if (stat.isSymbolicLink()) continue // symlinks not followed by default (FR-2.5)

      if (stat.isDirectory()) {
        stack.push(absolutePath)
        callbacks.onFile({
          path: relativePath,
          name: entryName,
          extension: null,
          kind: 'folder',
          sizeBytes: 0,
          isDirectory: true,
          createdAtSrc: stat.birthtime?.toISOString() ?? null,
          modifiedAtSrc: stat.mtime?.toISOString() ?? null,
          hashAlgo: null,
          hashValue: null
        })
        continue
      }

      const extension = getExtension(entryName)
      let hashValue: string | null = null
      try {
        hashValue = await hashFile(absolutePath, hashMode, stat.size)
      } catch (err) {
        callbacks.onError(relativePath, 'hash_failed', (err as Error).message)
      }

      callbacks.onFile({
        path: relativePath,
        name: entryName,
        extension,
        kind: classifyKind(extension),
        sizeBytes: stat.size,
        isDirectory: false,
        createdAtSrc: stat.birthtime?.toISOString() ?? null,
        modifiedAtSrc: stat.mtime?.toISOString() ?? null,
        hashAlgo: hashMode === 'none' ? null : hashMode === 'quick' ? 'quick' : 'sha256',
        hashValue
      })

      filesProcessed += 1
      bytesProcessed += stat.size
      sinceYield += 1

      if (sinceYield >= PROGRESS_YIELD_EVERY) {
        sinceYield = 0
        callbacks.onProgress(filesProcessed, bytesProcessed, relativePath)
        await new Promise((resolve) => setImmediate(resolve))
      }
    }
  }

  callbacks.onProgress(filesProcessed, bytesProcessed, rootPath)
  return { filesProcessed, bytesProcessed }
}
