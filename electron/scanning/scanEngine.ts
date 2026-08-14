import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { createReadStream } from 'node:fs'
import type { HashMode } from '../../shared/types'
import { classifyKind, getExtension } from './fileKind'
import type { WalkedFile } from '../db/scanRepository'

const QUICK_HASH_SAMPLE_BYTES = 65536
const PROGRESS_YIELD_EVERY = 200

export interface ScanOptions {
  hashMode: HashMode
  excludePatterns: string[]
  followSymlinks: boolean
}

export interface ScanCallbacks {
  onFile: (file: WalkedFile) => void
  onProgress: (filesProcessed: number, bytesProcessed: number, currentPath: string, elapsedMs: number) => void
  onError: (relativePath: string, errorType: string, message: string) => void
  isCancelled: () => boolean
}

/** Converts a simple glob (`*`, `**`) into a RegExp for exclude-pattern matching (FR-2.4). */
function globToRegExp(pattern: string): RegExp {
  let escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  escaped = escaped.replace(/\*\*\//g, '(?:.*/)?') // "**/" matches zero or more leading path segments
  escaped = escaped.replace(/\*\*/g, '.*')
  escaped = escaped.replace(/\*/g, '[^/]*')
  return new RegExp(`^${escaped}$`)
}

function isExcluded(relativePath: string, excludeRegexes: RegExp[]): boolean {
  return excludeRegexes.some((re) => re.test(relativePath))
}

async function hashFile(absolutePath: string, mode: HashMode, size: number): Promise<string | null> {
  if (mode === 'none') return null

  if (mode === 'quick') {
    const handle = await fs.open(absolutePath, 'r')
    try {
      const hash = crypto.createHash('sha256')
      const firstLength = Math.min(QUICK_HASH_SAMPLE_BYTES, size)
      const firstBuffer = Buffer.alloc(firstLength)
      const firstRead = await handle.read(firstBuffer, 0, firstLength, 0)
      hash.update(firstBuffer.subarray(0, firstRead.bytesRead))

      if (size > QUICK_HASH_SAMPLE_BYTES) {
        const lastLength = Math.min(QUICK_HASH_SAMPLE_BYTES, size)
        const lastBuffer = Buffer.alloc(lastLength)
        const lastRead = await handle.read(lastBuffer, 0, lastLength, size - lastLength)
        hash.update(lastBuffer.subarray(0, lastRead.bytesRead))
      }

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
  options: ScanOptions,
  callbacks: ScanCallbacks
): Promise<{ filesProcessed: number; bytesProcessed: number }> {
  const { hashMode, followSymlinks } = options
  const excludeRegexes = options.excludePatterns.map(globToRegExp)
  const stack: string[] = [rootPath]
  const visitedDirectories = new Set<string>()
  let filesProcessed = 0
  let bytesProcessed = 0
  let sinceYield = 0
  const startedAt = Date.now()
  let lastProgressAt = startedAt

  while (stack.length > 0) {
    if (callbacks.isCancelled()) break
    const currentDir = stack.pop() as string

    if (followSymlinks) {
      try {
        const realDirectory = await fs.realpath(currentDir)
        if (visitedDirectories.has(realDirectory)) continue
        visitedDirectories.add(realDirectory)
      } catch (err) {
        callbacks.onError(path.relative(rootPath, currentDir), 'realpath_failed', (err as Error).message)
        continue
      }
    }

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

      if (isExcluded(relativePath, excludeRegexes)) continue

      let stat
      try {
        stat = followSymlinks ? await fs.stat(absolutePath) : await fs.lstat(absolutePath)
      } catch (err) {
        callbacks.onError(relativePath, 'stat_failed', (err as Error).message)
        continue
      }

      if (!followSymlinks && stat.isSymbolicLink()) continue // symlinks not followed by default (FR-2.5)

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

      const now = Date.now()
      if (sinceYield >= PROGRESS_YIELD_EVERY || now - lastProgressAt >= 250) {
        sinceYield = 0
        lastProgressAt = now
        callbacks.onProgress(filesProcessed, bytesProcessed, relativePath, now - startedAt)
        await new Promise((resolve) => setImmediate(resolve))
      }
    }
  }

  callbacks.onProgress(filesProcessed, bytesProcessed, rootPath, Date.now() - startedAt)
  return { filesProcessed, bytesProcessed }
}
