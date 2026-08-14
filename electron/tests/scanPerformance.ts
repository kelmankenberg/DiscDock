import assert from 'node:assert/strict'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { walkAndScan } from '../scanning/scanEngine'

const fileCount = Number(process.env.DISCDOCK_BENCHMARK_FILES ?? 5000)
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'discdock-scan-benchmark-'))

async function main(): Promise<void> {
  for (let index = 0; index < fileCount; index += 1) {
    await fsPromises.writeFile(path.join(root, `file-${index}.txt`), `benchmark-${index}`)
  }

  let processed = 0
  const startedAt = performance.now()
  const result = await walkAndScan(root, { hashMode: 'none', excludePatterns: [], followSymlinks: false }, {
    onFile: (file) => {
      if (!file.isDirectory) processed += 1
    },
    onProgress: () => undefined,
    onError: (_filePath, _errorType, message) => { throw new Error(message) },
    isCancelled: () => false
  })
  const elapsedMs = performance.now() - startedAt
  assert.equal(processed, fileCount)
  const filesPerSecond = Math.round((processed / elapsedMs) * 1000)
  console.log(JSON.stringify({ fileCount: processed, bytesProcessed: result.bytesProcessed, elapsedMs: Math.round(elapsedMs), filesPerSecond }))
}

void main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })
