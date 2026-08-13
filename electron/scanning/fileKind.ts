import path from 'node:path'

const KIND_BY_EXTENSION: Record<string, string> = {
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', bmp: 'image', webp: 'image', svg: 'image', heic: 'image',
  mp4: 'video', mkv: 'video', avi: 'video', mov: 'video', wmv: 'video', webm: 'video', m4v: 'video',
  mp3: 'audio', flac: 'audio', wav: 'audio', aac: 'audio', ogg: 'audio', m4a: 'audio',
  pdf: 'document', doc: 'document', docx: 'document', txt: 'document', rtf: 'document', odt: 'document',
  xls: 'document', xlsx: 'document', ppt: 'document', pptx: 'document', csv: 'document',
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive', iso: 'archive'
}

export function classifyKind(extension: string | null): string {
  if (!extension) return 'other'
  return KIND_BY_EXTENSION[extension.toLowerCase()] ?? 'other'
}

export function getExtension(fileName: string): string | null {
  const ext = path.extname(fileName).replace(/^\./, '')
  return ext ? ext : null
}
