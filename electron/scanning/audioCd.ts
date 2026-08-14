import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { AudioCdTrack } from '../../shared/types'

const execFileAsync = promisify(execFile)

const CDDA_BYTES_PER_SECTOR = 2352
const CDDA_SECTORS_PER_SECOND = 75

const MISSING_TOOLS_MESSAGE =
  'Reading audio CDs requires libcdio-utils (cd-info) or cdparanoia. Install one of them and try again.'

function sectorsToSeconds(sectors: number): number {
  return Math.round(sectors / CDDA_SECTORS_PER_SECOND)
}

function toTrack(trackNumber: number, sectors: number, isAudio: boolean): AudioCdTrack {
  return {
    trackNumber,
    sectors,
    durationSeconds: sectorsToSeconds(sectors),
    sizeBytes: sectors * CDDA_BYTES_PER_SECTOR,
    isAudio
  }
}

/**
 * Parses the `cd-info` track table, e.g.
 * `  1: 00:02:00  000000 audio  false  no    2        no`
 * with a trailing `170: 55:22:33 249183 leadout` entry used to size the final track.
 */
export function parseCdInfo(output: string): AudioCdTrack[] {
  const entries: { trackNumber: number; lsn: number; isAudio: boolean }[] = []
  let leadoutLsn: number | null = null

  for (const line of output.split('\n')) {
    const match = line.match(/^\s*(\d+):\s+\d+:\d+:\d+\s+(\d+)\s+(\S+)/)
    if (!match) continue

    const trackNumber = Number(match[1])
    const lsn = Number(match[2])
    const type = match[3].toLowerCase()

    if (type === 'leadout') {
      leadoutLsn = lsn
      continue
    }
    entries.push({ trackNumber, lsn, isAudio: type === 'audio' })
  }

  return entries.map((entry, index) => {
    const nextLsn = index + 1 < entries.length ? entries[index + 1].lsn : leadoutLsn
    const sectors = nextLsn !== null && nextLsn > entry.lsn ? nextLsn - entry.lsn : 0
    return toTrack(entry.trackNumber, sectors, entry.isAudio)
  })
}

/**
 * Parses the `cdparanoia -Q` table, e.g.
 * `  1.    18375 [04:05.00]        0 [00:00.00]    no   no  2`
 * where the second column is the track length in sectors.
 */
export function parseCdparanoia(output: string): AudioCdTrack[] {
  const tracks: AudioCdTrack[] = []
  for (const line of output.split('\n')) {
    const match = line.match(/^\s*(\d+)\.\s+(\d+)\s+\[[\d:.]+\]/)
    if (!match) continue
    tracks.push(toTrack(Number(match[1]), Number(match[2]), true))
  }
  return tracks
}

/**
 * Reads the raw track listing from an audio CD, which has no filesystem to walk (FR-1.7).
 * Prefers cd-info (reports data tracks too) and falls back to cdparanoia.
 */
export async function readAudioCdTracks(devicePath: string): Promise<AudioCdTrack[]> {
  try {
    const { stdout } = await execFileAsync('cd-info', [
      '--no-header',
      '--no-device-info',
      '--no-cddb',
      '--no-disc-mode',
      '-C',
      devicePath
    ])
    const tracks = parseCdInfo(stdout)
    if (tracks.length > 0) return tracks
  } catch {
    // fall through to cdparanoia
  }

  try {
    // cdparanoia writes its query table to stderr.
    const { stdout, stderr } = await execFileAsync('cdparanoia', ['-Q', '-d', devicePath])
    const tracks = parseCdparanoia(`${stderr}\n${stdout}`)
    if (tracks.length > 0) return tracks
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') throw new Error(MISSING_TOOLS_MESSAGE)
    throw new Error(`Could not read the disc: ${(err as Error).message}`)
  }

  throw new Error('No tracks found — the disc may be empty, unreadable, or not an audio CD.')
}
