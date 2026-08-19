import { protocol } from 'electron'
import fs from 'node:fs'
import { PassThrough, Readable } from 'node:stream'
import { getFileMeta } from '../db/fileRepository'
import { getMediaItem } from '../db/mediaRepository'
import { listConnectedDevices } from '../devices/deviceDetection'
import { buildWavHeader, spawnCddaTrackStream } from '../scanning/audioCd'
import { log } from '../logging'
import { resolveLivePath } from './files'

/** Custom scheme the renderer's <audio> element streams cataloged audio files through. */
export const AUDIO_STREAM_SCHEME = 'discdock-media'

function guessAudioMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg'
    case 'wav':
      return 'audio/wav'
    case 'flac':
      return 'audio/flac'
    case 'ogg':
      return 'audio/ogg'
    case 'm4a':
    case 'aac':
      return 'audio/aac'
    case 'opus':
      return 'audio/opus'
    default:
      return 'application/octet-stream'
  }
}

/** Finds the currently connected optical drive backing this media item, if any. */
async function resolveOpticalDevicePath(mediaId: number): Promise<string> {
  const item = getMediaItem(mediaId)
  if (!item) throw new Error(`Media item ${mediaId} not found`)
  if (!item.deviceFingerprint) throw new Error(`"${item.label}" is not linked to a device`)

  const devices = await listConnectedDevices()
  const device = devices.find((d) => (d.uuid ?? d.devicePath) === item.deviceFingerprint)
  if (!device) throw new Error(`"${item.label}" is not currently inserted — insert the disc and try again`)
  return device.devicePath
}

/**
 * Streams a CDDA track live: a WAV header (data size known upfront from the TOC) followed by
 * cdparanoia's raw PCM output, piped through as it's produced. Playback starts almost
 * immediately instead of waiting for the whole track to be ripped first. Not seekable ahead of
 * what's been streamed so far — the process is killed if the client disconnects.
 */
function streamCddaTrack(devicePath: string, trackNumber: number, dataSizeBytes: number, request: Request): Response {
  const child = spawnCddaTrackStream(devicePath, trackNumber)
  const body = new PassThrough()
  body.write(buildWavHeader(dataSizeBytes))
  child.stdout.pipe(body)

  let stderrTail = ''
  child.stderr.on('data', (chunk: Buffer) => {
    stderrTail = (stderrTail + chunk.toString()).slice(-2000)
  })
  child.on('error', (err) => body.destroy(err))
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) log.warn(`cdparanoia (track ${trackNumber}) exited ${code}: ${stderrTail}`)
    body.end()
  })
  request.signal?.addEventListener('abort', () => {
    child.kill('SIGTERM')
    body.destroy()
  })

  const headers: Record<string, string> = {
    'Content-Type': 'audio/wav',
    'Content-Length': String(44 + dataSizeBytes),
    'Accept-Ranges': 'none'
  }
  return new Response(Readable.toWeb(body) as ReadableStream, { status: 200, headers })
}

/** Must be called before app.whenReady(), pairs with registerAudioStreamProtocol(). */
export function registerAudioStreamSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: AUDIO_STREAM_SCHEME, privileges: { stream: true, supportFetchAPI: true, corsEnabled: true } }
  ])
}

/**
 * Serves cataloged audio files at discdock-media://<mediaId>/<encoded relative path>. Real files
 * stream straight from the mounted device with Range support; CDDA tracks (raw audio-CD sectors,
 * no underlying file) are streamed live from cdparanoia (see streamCddaTrack).
 */
export function registerAudioStreamProtocol(): void {
  protocol.handle(AUDIO_STREAM_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      const mediaId = Number(url.hostname)
      const filePath = decodeURIComponent(url.pathname.slice(1))
      if (!Number.isInteger(mediaId) || mediaId <= 0 || !filePath) {
        return new Response('Invalid audio request', { status: 400 })
      }

      const meta = getFileMeta(mediaId, filePath)
      if (!meta || meta.kind !== 'audio') return new Response('Not an audio file', { status: 403 })

      if (meta.extension === 'cdda') {
        // Older catalog entries (scanned before track_number was added) fall back to the
        // filename's leading digits, e.g. "01 - Title.cdda" / "Track 01.cdda".
        const trackNumber = meta.trackNumber ?? Number(filePath.match(/(\d+)/)?.[1])
        if (!Number.isInteger(trackNumber) || trackNumber <= 0) {
          return new Response('Could not determine this track\u2019s track number', { status: 500 })
        }
        const devicePath = await resolveOpticalDevicePath(mediaId)
        return streamCddaTrack(devicePath, trackNumber, meta.sizeBytes, request)
      }

      const resolved = await resolveLivePath(mediaId, filePath)
      const stat = await fs.promises.stat(resolved)

      let start = 0
      let end = stat.size - 1
      let status = 200
      const headers: Record<string, string> = {
        'Content-Type': guessAudioMimeType(resolved),
        'Accept-Ranges': 'bytes'
      }

      const range = request.headers.get('range')
      if (range) {
        const match = /bytes=(\d*)-(\d*)/.exec(range)
        if (match && (match[1] || match[2])) {
          if (match[1]) start = Number(match[1])
          if (match[2]) end = Number(match[2])
          status = 206
          headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`
        }
      }

      headers['Content-Length'] = String(end - start + 1)
      const nodeStream = fs.createReadStream(resolved, { start, end })
      return new Response(Readable.toWeb(nodeStream) as ReadableStream, { status, headers })
    } catch (err) {
      return new Response(`Audio stream error: ${(err as Error).message}`, { status: 404 })
    }
  })
}
