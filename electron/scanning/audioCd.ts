import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promisify } from 'node:util'
import { nativeImage } from 'electron'
import type { AudioCdMetadata, AudioCdToc, AudioCdTrack } from '../../shared/types'

const execFileAsync = promisify(execFile)

const CDDA_BYTES_PER_SECTOR = 2352
const CDDA_SECTORS_PER_SECOND = 75
// Audio CD track offsets are expressed from the start of the disc, which begins at sector 150.
const CDDA_LEADIN_SECTORS = 150

const MISSING_TOOLS_MESSAGE =
  'Reading audio CDs needs a CD tool that DiscDock does not bundle. Install one, then try again:\n' +
  '  Debian/Ubuntu/Mint:  sudo apt install libcdio-utils cdparanoia\n' +
  '  Fedora/RHEL:         sudo dnf install libcdio cdparanoia\n' +
  '  Arch:                sudo pacman -S libcdio cdparanoia'

const NO_DISC_MESSAGE = 'No disc detected in the drive — insert an audio CD and try again.'

/** True when the failure is "the binary is not installed" rather than a read error. */
function isMissingBinary(err: unknown): boolean {
  const error = err as NodeJS.ErrnoException & { stderr?: string }
  return error.code === 'ENOENT' || /not found/i.test(error.stderr ?? '')
}

function isEmptyDrive(err: unknown): boolean {
  const detail = (err as Error & { stderr?: string; stdout?: string })
  const text = `${detail.stderr ?? ''}${detail.stdout ?? ''}${detail.message ?? ''}`
  return /no medium|no disc|can't get first track|not ready/i.test(text)
}

function sectorsToSeconds(sectors: number): number {
  return Math.round(sectors / CDDA_SECTORS_PER_SECOND)
}

function toTrack(trackNumber: number, startSector: number, sectors: number, isAudio: boolean): AudioCdTrack {
  return {
    trackNumber,
    startSector,
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
export function parseCdInfo(output: string): AudioCdToc {
  const entries: { trackNumber: number; lsn: number; isAudio: boolean }[] = []
  let leadoutSector = 0

  for (const line of output.split('\n')) {
    const match = line.match(/^\s*(\d+):\s+\d+:\d+:\d+\s+(\d+)\s+(\S+)/)
    if (!match) continue

    const trackNumber = Number(match[1])
    const lsn = Number(match[2])
    const type = match[3].toLowerCase()

    if (type === 'leadout') {
      leadoutSector = lsn
      continue
    }
    entries.push({ trackNumber, lsn, isAudio: type === 'audio' })
  }

  const tracks = entries.map((entry, index) => {
    const nextLsn = index + 1 < entries.length ? entries[index + 1].lsn : leadoutSector
    const sectors = nextLsn > entry.lsn ? nextLsn - entry.lsn : 0
    return toTrack(entry.trackNumber, entry.lsn, sectors, entry.isAudio)
  })

  return { tracks, leadoutSector }
}

/**
 * Parses the `cdparanoia -Q` table, e.g.
 * `  1.    18375 [04:05.00]        0 [00:00.00]    no   no  2`
 * (length in sectors, then start sector).
 */
export function parseCdparanoia(output: string): AudioCdToc {
  const tracks: AudioCdTrack[] = []
  for (const line of output.split('\n')) {
    const match = line.match(/^\s*(\d+)\.\s+(\d+)\s+\[[\d:.]+\]\s+(\d+)\s+\[/)
    if (!match) continue
    tracks.push(toTrack(Number(match[1]), Number(match[3]), Number(match[2]), true))
  }

  const last = tracks[tracks.length - 1]
  return { tracks, leadoutSector: last ? last.startSector + last.sectors : 0 }
}

/**
 * Reads the raw track listing from an audio CD, which has no filesystem to walk (FR-1.7).
 * Prefers cd-info (reports data tracks too) and falls back to cdparanoia.
 */
export async function readAudioCdToc(devicePath: string): Promise<AudioCdToc> {
  let cdInfoMissing = false
  let sawEmptyDrive = false

  try {
    const { stdout } = await execFileAsync('cd-info', [
      '--no-header',
      '--no-device-info',
      '--no-cddb',
      '--no-disc-mode',
      '-C',
      devicePath
    ])
    const toc = parseCdInfo(stdout)
    if (toc.tracks.length > 0) return toc
    sawEmptyDrive = isEmptyDrive({ message: stdout } as Error)
  } catch (err) {
    cdInfoMissing = isMissingBinary(err)
    sawEmptyDrive = sawEmptyDrive || isEmptyDrive(err)
  }

  try {
    // cdparanoia writes its query table to stderr.
    const { stdout, stderr } = await execFileAsync('cdparanoia', ['-Q', '-d', devicePath])
    const toc = parseCdparanoia(`${stderr}\n${stdout}`)
    if (toc.tracks.length > 0) return toc
  } catch (err) {
    if (cdInfoMissing && isMissingBinary(err)) throw new Error(MISSING_TOOLS_MESSAGE)
    if (sawEmptyDrive || isEmptyDrive(err)) throw new Error(NO_DISC_MESSAGE)
    throw new Error(`Could not read the disc: ${(err as Error).message}`)
  }

  if (sawEmptyDrive) throw new Error(NO_DISC_MESSAGE)
  throw new Error('No tracks found — the disc may be empty, unreadable, or not an audio CD.')
}

/**
 * Computes the MusicBrainz Disc ID: SHA-1 over the first/last track numbers and 100 sector
 * offsets (leadout first, then tracks 1-99, zero-padded), base64'd with a URL-safe alphabet.
 * See https://musicbrainz.org/doc/Disc_ID_Calculation
 */
export function computeDiscId(toc: AudioCdToc): string | null {
  if (toc.tracks.length === 0 || toc.leadoutSector <= 0) return null

  const firstTrack = toc.tracks[0].trackNumber
  const lastTrack = toc.tracks[toc.tracks.length - 1].trackNumber

  const offsets = new Array<number>(100).fill(0)
  offsets[0] = toc.leadoutSector + CDDA_LEADIN_SECTORS
  for (const track of toc.tracks) {
    if (track.trackNumber >= 1 && track.trackNumber <= 99) {
      offsets[track.trackNumber] = track.startSector + CDDA_LEADIN_SECTORS
    }
  }

  const hex = (value: number, width: number): string =>
    value.toString(16).toUpperCase().padStart(width, '0')

  const payload = [hex(firstTrack, 2), hex(lastTrack, 2), ...offsets.map((offset) => hex(offset, 8))].join('')

  return createHash('sha1')
    .update(payload, 'ascii')
    .digest('base64')
    .replace(/\+/g, '.')
    .replace(/\//g, '_')
    .replace(/=/g, '-')
}

interface MusicBrainzRelease {
  id?: string
  title?: string
  'artist-credit'?: { name?: string }[]
  media?: { position?: number; tracks?: { position?: number; title?: string }[] }[]
}

interface MusicBrainzResponse {
  releases?: MusicBrainzRelease[]
}

const MUSICBRAINZ_HEADERS = {
  'User-Agent': 'DiscDock/0.1.0 (https://github.com/kelmankenberg/DiscDock)'
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** MusicBrainz allows ~1 request/second and answers 503 when that is exceeded, so retry once. */
async function musicBrainzGet(url: string): Promise<unknown | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(url, { headers: MUSICBRAINZ_HEADERS })
    if (response.ok) return response.json()
    if (response.status !== 503) {
      throw new Error(`MusicBrainz returned ${response.status} ${response.statusText}`)
    }
    await delay(1500)
  }
  throw new Error('MusicBrainz is rate limiting requests — try scanning again in a moment.')
}

/** The disc ID lookup only returns the matching medium, so the disc count needs a second call. */
async function fetchDiscTotal(releaseId: string): Promise<number | null> {
  try {
    await delay(1100)
    const body = (await musicBrainzGet(
      `https://musicbrainz.org/ws/2/release/${encodeURIComponent(releaseId)}?fmt=json&inc=media`
    )) as { media?: unknown[] } | null
    return body?.media?.length ?? null
  } catch {
    return null
  }
}

/**
 * Looks up disc/track titles from MusicBrainz. Returns null when the disc simply isn't in the
 * database; throws when the lookup itself failed so the caller can report why.
 */
export async function fetchAudioCdMetadata(discId: string): Promise<AudioCdMetadata | null> {
  const body = (await musicBrainzGet(
    `https://musicbrainz.org/ws/2/discid/${encodeURIComponent(discId)}?fmt=json&inc=artist-credits+recordings`
  )) as MusicBrainzResponse | null

  const release = body?.releases?.[0]
  if (!release) return null

  const trackTitles: Record<number, string> = {}
  for (const medium of release.media ?? []) {
    for (const track of medium.tracks ?? []) {
      if (typeof track.position === 'number' && track.title) trackTitles[track.position] = track.title
    }
  }

  const discNumber = release.media?.[0]?.position ?? null
  const discTotal = release.id ? await fetchDiscTotal(release.id) : null

  return {
    discId,
    releaseId: release.id ?? null,
    albumTitle: release.title ?? null,
    artist: release['artist-credit']?.[0]?.name ?? null,
    discNumber,
    discTotal,
    trackTitles
  }
}

/**
 * Downloads the release's front cover from the Cover Art Archive and normalises it to PNG
 * (the archive serves JPEG for most releases). Returns null when the release has no cover.
 */
export async function fetchCoverArtPng(releaseId: string): Promise<Buffer | null> {
  const response = await fetch(`https://coverartarchive.org/release/${encodeURIComponent(releaseId)}/front`, {
    headers: MUSICBRAINZ_HEADERS,
    redirect: 'follow'
  })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`Cover Art Archive returned ${response.status} ${response.statusText}`)
  }

  const source = Buffer.from(await response.arrayBuffer())
  if (source.subarray(1, 4).toString('ascii') === 'PNG') return source

  const image = nativeImage.createFromBuffer(source)
  if (image.isEmpty()) throw new Error('Downloaded cover art could not be decoded')
  return image.toPNG()
}
