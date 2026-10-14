import { randomUUID } from 'node:crypto'
import { open } from 'node:fs/promises'
import { extname } from 'node:path'
import type { HttpContext } from '@adonisjs/core/http'
import { RuntimeException } from '@adonisjs/core/exceptions'
import string from '@adonisjs/core/helpers/string'
import type { Resource } from '../resources/define_resource.ts'
import type { FieldSchema, FileValue, FormErrors, FormFieldSchema } from '../schema.ts'
import {
  DEFAULT_FILE_TYPES,
  DEFAULT_IMAGE_TYPES,
  DEFAULT_MAX_SIZE,
  FORMATS,
  detectFormat,
  isAccepted,
} from './file_types.ts'

/**
 * The parts of Drive (`@adonisjs/drive`, an optional peer) Azu uses.
 * It's resolved from the container, so apps without uploads don't need
 * Drive at all.
 */
type Disk = {
  getUrl(key: string): Promise<string>
  delete(key: string): Promise<void>
}
type DriveManager = { use(disk?: string): Disk }

type Upload = {
  clientName: string
  size: number
  extname?: string
  tmpPath?: string
  isValid: boolean
  errors: { message: string }[]
  moveToDisk(key: string, disk?: string): Promise<void>
}

export const FILE_KINDS = new Set(['file', 'image'])

/**
 * The Drive manager, or a clear error when Drive isn't set up.
 */
export async function driveManager(ctx: HttpContext): Promise<DriveManager> {
  try {
    return (await ctx.containerResolver.make('drive.manager' as never)) as DriveManager
  } catch {
    throw new RuntimeException(
      'Azu file and image fields store uploads with Drive. Install it with "node ace add @adonisjs/drive".'
    )
  }
}

/**
 * The disk a field stores on: its own `disk()`, else `defaultDisk` in
 * config/admin.ts, else Drive's default.
 */
export function diskFor(field: Pick<FieldSchema, 'disk'>, defaultDisk: string | undefined) {
  return field.disk ?? defaultDisk ?? undefined
}

function isUrl(value: string) {
  return /^(https?:)?\/\//.test(value) || value.startsWith('/')
}

/**
 * A stored file's value: its key, name and URL. Ready-made URLs (seed
 * data, external images) pass through as their own URL.
 */
export async function fileValue(
  ctx: HttpContext,
  disk: string | undefined,
  key: unknown
): Promise<FileValue | null> {
  if (typeof key !== 'string' || key === '') return null
  const name = key.split('/').pop() ?? key
  if (isUrl(key)) return { key, name, url: key }
  try {
    const drive = await driveManager(ctx)
    return { key, name, url: await drive.use(disk).getUrl(key) }
  } catch (error) {
    ctx.logger.warn({ err: error }, `Azu couldn't make a URL for "${key}"`)
    return { key, name, url: null }
  }
}

async function readHead(path: string) {
  const handle = await open(path, 'r')
  try {
    const head = new Uint8Array(16)
    await handle.read(head, 0, 16, 0)
    return head
  } finally {
    await handle.close()
  }
}

function describe(accept: string[]) {
  const names = FORMATS.filter((format) => isAccepted(format.mime, accept)).map((format) =>
    format.extensions[0].toUpperCase()
  )
  return names.length > 0 ? names.join(', ') : accept.join(', ')
}

export type PlannedUpload = {
  field: FormFieldSchema
  upload: Upload
  key: string
  disk: string | undefined
}

/**
 * Checks each `file` and `image` field's upload on the server: size
 * against `maxSize`, and type against `accept`, from the file's bytes
 * (see file_types.ts). A valid upload gets a new Drive key, which is the
 * value the app's validator sees; it's stored only once the record
 * saves. The result says, per field:
 *
 * - `uploads`: new files to store
 * - `unchanged`: fields the request didn't touch, kept as they are
 * - `errors`: uploads that failed the checks
 */
export async function planUploads(
  ctx: HttpContext,
  resource: Resource<any, any>,
  fields: FormFieldSchema[],
  defaultDisk: string | undefined
): Promise<{ uploads: PlannedUpload[]; unchanged: FormFieldSchema[]; errors: FormErrors }> {
  const uploads: PlannedUpload[] = []
  const unchanged: FormFieldSchema[] = []
  const errors: FormErrors = {}
  const body = ctx.request.body()

  for (const field of fields) {
    if (!FILE_KINDS.has(field.kind) || field.readOnly) continue
    const upload = ctx.request.file(field.input) as Upload | null

    if (!upload) {
      // Not sent at all: keep the stored file. Sent empty: remove it.
      if (!Object.hasOwn(body, field.input)) unchanged.push(field)
      continue
    }

    const maxSize = field.maxSize ?? DEFAULT_MAX_SIZE[field.kind as 'file' | 'image']
    const accept =
      field.accept ?? (field.kind === 'image' ? DEFAULT_IMAGE_TYPES : DEFAULT_FILE_TYPES)
    const fail = (message: string) => (errors[field.input] ??= []).push(message)

    if (!upload.tmpPath || !upload.isValid) {
      fail(upload.errors[0]?.message ?? `The ${field.label.toLowerCase()} couldn't be uploaded`)
      continue
    }
    if (upload.size > (string.bytes.parse(maxSize) ?? 0)) {
      fail(`The ${field.label.toLowerCase()} must be ${maxSize} or smaller`)
      continue
    }
    const format = detectFormat(
      await readHead(upload.tmpPath),
      upload.extname ?? extname(upload.clientName)
    )
    if (!format || !isAccepted(format.mime, accept)) {
      fail(`The ${field.label.toLowerCase()} must be one of these types: ${describe(accept)}`)
      continue
    }

    uploads.push({
      field,
      upload,
      key: `${resource.name}/${field.name}/${randomUUID()}.${format.extensions[0]}`,
      disk: diskFor(field, defaultDisk),
    })
  }

  return { uploads, unchanged, errors }
}

/**
 * Moves planned uploads to their disks. If one fails, the ones already
 * moved are deleted, so a failed save leaves nothing behind.
 */
export async function storeUploads(ctx: HttpContext, uploads: PlannedUpload[]) {
  const stored: PlannedUpload[] = []
  try {
    for (const planned of uploads) {
      await planned.upload.moveToDisk(planned.key, planned.disk)
      stored.push(planned)
    }
  } catch (error) {
    await deleteFiles(
      ctx,
      stored.map(({ key, disk }) => ({ key, disk }))
    )
    throw error
  }
  return {
    /** Undo, for a save that fails after the files moved */
    rollback: () =>
      deleteFiles(
        ctx,
        stored.map(({ key, disk }) => ({ key, disk }))
      ),
  }
}

/**
 * Deletes stored files, best effort: a file that can't be deleted is
 * logged, never fails the request.
 */
export async function deleteFiles(
  ctx: HttpContext,
  files: { key: string; disk: string | undefined }[]
) {
  if (files.length === 0) return
  const drive = await driveManager(ctx)
  for (const { key, disk } of files) {
    try {
      await drive.use(disk).delete(key)
    } catch (error) {
      ctx.logger.warn({ err: error }, `Azu couldn't delete "${key}"`)
    }
  }
}

/**
 * Every `file` and `image` field's value for a record, keyed by field
 * name, with URLs from Drive.
 */
export async function fileValues(
  ctx: HttpContext,
  fields: FieldSchema[],
  record: { [key: string]: unknown } | object,
  defaultDisk: string | undefined
): Promise<Record<string, FileValue | null>> {
  const values: Record<string, FileValue | null> = {}
  for (const field of fields) {
    if (FILE_KINDS.has(field.kind)) {
      const key = (record as Record<string, unknown>)[field.name]
      values[field.name] = await fileValue(ctx, diskFor(field, defaultDisk), key)
    }
  }
  return values
}
