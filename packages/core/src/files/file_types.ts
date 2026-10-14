/**
 * Upload type checks (FR-07). The bodyparser detects a type from the
 * file's bytes only for some extensions, and otherwise takes the
 * client's extension and `Content-Type`; past 4100 bytes it falls back
 * to the client's claim even then. So Azu checks the bytes itself for
 * every format with a signature, and trusts an extension only for
 * formats that have none (plain text, CSV).
 */

type Format = {
  mime: string
  extensions: string[]
  /** Does the file start with this format's signature? `null` = no signature */
  matches: ((head: Uint8Array) => boolean) | null
}

function startsWith(head: Uint8Array, bytes: number[], offset = 0) {
  return bytes.every((byte, index) => head[offset + index] === byte)
}

function ascii(text: string) {
  return [...text].map((character) => character.charCodeAt(0))
}

/**
 * ZIP-based formats (Office documents) share the ZIP signature.
 */
const zip = (head: Uint8Array) => startsWith(head, [0x50, 0x4b, 0x03, 0x04])

/**
 * The formats Azu recognises, by MIME type.
 */
export const FORMATS: Format[] = [
  {
    mime: 'image/jpeg',
    extensions: ['jpg', 'jpeg'],
    matches: (h) => startsWith(h, [0xff, 0xd8, 0xff]),
  },
  {
    mime: 'image/png',
    extensions: ['png'],
    matches: (h) => startsWith(h, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  { mime: 'image/gif', extensions: ['gif'], matches: (h) => startsWith(h, ascii('GIF8')) },
  {
    mime: 'image/webp',
    extensions: ['webp'],
    matches: (h) => startsWith(h, ascii('RIFF')) && startsWith(h, ascii('WEBP'), 8),
  },
  {
    mime: 'image/avif',
    extensions: ['avif'],
    matches: (h) => startsWith(h, ascii('ftyp'), 4) && startsWith(h, ascii('avi'), 8),
  },
  { mime: 'application/pdf', extensions: ['pdf'], matches: (h) => startsWith(h, ascii('%PDF-')) },
  { mime: 'application/zip', extensions: ['zip'], matches: zip },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['docx'],
    matches: zip,
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['xlsx'],
    matches: zip,
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extensions: ['pptx'],
    matches: zip,
  },
  { mime: 'text/plain', extensions: ['txt'], matches: null },
  { mime: 'text/csv', extensions: ['csv'], matches: null },
  { mime: 'image/svg+xml', extensions: ['svg'], matches: null },
  { mime: 'text/html', extensions: ['html', 'htm'], matches: null },
]

export const DEFAULT_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]

export const DEFAULT_FILE_TYPES = [
  ...DEFAULT_IMAGE_TYPES,
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

export const DEFAULT_MAX_SIZE = { image: '5mb', file: '10mb' } as const

/**
 * Whether `mime` is in an accept list, which may use wildcards
 * (`image/*`).
 */
export function isAccepted(mime: string, accept: string[]): boolean {
  return accept.some((pattern) =>
    pattern.endsWith('/*') ? mime.startsWith(pattern.slice(0, -1)) : pattern === mime
  )
}

/**
 * What an upload is, from its first bytes and its extension, or `null`
 * when it's not a format Azu recognises. A format with a signature must
 * match it, whatever the extension says. Formats without one (text) go
 * by extension, and only when no signed format matches the bytes.
 */
export function detectFormat(head: Uint8Array, extension: string): Format | null {
  const ext = extension.toLowerCase().replace(/^\./, '')
  const signed = FORMATS.filter((format) => format.matches?.(head))
  if (signed.length > 0) {
    // ZIP-based formats share a signature: the extension picks between them
    return signed.find((format) => format.extensions.includes(ext)) ?? signed[0]
  }
  return (
    FORMATS.find((format) => format.matches === null && format.extensions.includes(ext)) ?? null
  )
}
