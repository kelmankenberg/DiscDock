import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { walkAndScan } from './scanEngine'
import type { WalkedFile } from '../db/scanRepository'

const temporaryDirectories: string[] = []

async function createFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'discdock-scan-'))
  temporaryDirectories.push(root)
  await fs.mkdir(path.join(root, 'included'))
  await fs.writeFile(path.join(root, 'included', 'photo.JPG'), 'photo data')
  await fs.writeFile(path.join(root, 'excluded.txt'), 'ignore me')
  return root
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })))
})

async function scanFixture(rootPath: string, options: { hashMode: 'none' | 'quick' | 'full'; excludePatterns?: string[]; followSymlinks?: boolean }) {
  const files: WalkedFile[] = []
  const errors: { path: string; type: string }[] = []
  await walkAndScan(
    rootPath,
    {
      hashMode: options.hashMode,
      excludePatterns: options.excludePatterns ?? [],
      followSymlinks: options.followSymlinks ?? false
    },
    {
      onFile: (file) => files.push(file),
      onProgress: () => undefined,
      onError: (relativePath, errorType) => errors.push({ path: relativePath, type: errorType }),
      isCancelled: () => false
    }
  )
  return { files, errors }
}

describe('walkAndScan', () => {
  it('enumerates files and directories without hashing by default', async () => {
    const root = await createFixture()
    const result = await scanFixture(root, { hashMode: 'none', excludePatterns: ['excluded.txt'] })

    expect(result.errors).toEqual([])
    expect(result.files.map((file) => file.path)).toContain('included')
    expect(result.files.map((file) => file.path)).toContain(path.join('included', 'photo.JPG'))
    expect(result.files.map((file) => file.path)).not.toContain('excluded.txt')
    expect(result.files.find((file) => file.name === 'photo.JPG')?.kind).toBe('image')
    expect(result.files.find((file) => file.name === 'photo.JPG')?.hashValue).toBeNull()
  })

  it('computes a full SHA-256 hash', async () => {
    const root = await createFixture()
    const result = await scanFixture(root, { hashMode: 'full' })
    const file = result.files.find((entry) => entry.name === 'photo.JPG')

    expect(file?.hashAlgo).toBe('sha256')
    expect(file?.hashValue).toBe(crypto.createHash('sha256').update('photo data').digest('hex'))
  })

  it('computes a quick hash from both file ends and the size', async () => {
    const root = await createFixture()
    const filePath = path.join(root, 'included', 'photo.JPG')
    const content = Buffer.alloc(150000, 'a')
    content.write('start', 0, 'ascii')
    content.write('finish', content.length - 6, 'ascii')
    await fs.writeFile(filePath, content)
    const result = await scanFixture(root, { hashMode: 'quick' })
    const file = result.files.find((entry) => entry.name === 'photo.JPG')
    const expected = crypto.createHash('sha256')
    expected.update(content.subarray(0, 65536))
    expected.update(content.subarray(-65536))
    expected.update(String(content.length))

    expect(file?.hashAlgo).toBe('quick')
    expect(file?.hashValue).toBe(expected.digest('hex'))
  })

  it('skips symlinks unless following them is enabled', async () => {
    const root = await createFixture()
    await fs.symlink(path.join(root, 'included', 'photo.JPG'), path.join(root, 'linked.JPG'))

    const withoutLinks = await scanFixture(root, { hashMode: 'none' })
    const withLinks = await scanFixture(root, { hashMode: 'none', followSymlinks: true })

    expect(withoutLinks.files.map((file) => file.path)).not.toContain('linked.JPG')
    expect(withLinks.files.map((file) => file.path)).toContain('linked.JPG')
  })

  it('does not loop through symlinked directories when following links', async () => {
    const root = await createFixture()
    await fs.symlink(root, path.join(root, 'included', 'loop'))

    const result = await scanFixture(root, { hashMode: 'none', followSymlinks: true })

    expect(result.errors).toEqual([])
    expect(result.files.filter((file) => !file.isDirectory && file.name === 'photo.JPG')).toHaveLength(1)
  })

  it('reports directory errors without rejecting the scan', async () => {
    const result = await scanFixture(path.join(os.tmpdir(), 'discdock-missing-root'), { hashMode: 'none' })

    expect(result.files).toEqual([])
    expect(result.errors[0]?.type).toBe('read_dir_failed')
  })

  it('stops before the next file when cancellation is requested', async () => {
    const root = await createFixture()
    const files: string[] = []
    let cancelled = false
    await walkAndScan(root, { hashMode: 'none', excludePatterns: [], followSymlinks: false }, {
      onFile: (file) => {
        if (!file.isDirectory) {
          files.push(file.path)
          cancelled = true
        }
      },
      onProgress: () => undefined,
      onError: () => undefined,
      isCancelled: () => cancelled
    })

    expect(files).toHaveLength(1)
  })
})