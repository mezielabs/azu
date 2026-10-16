import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import { processTimezone } from '../define_config.ts'
import { deleteFiles, diskFor, FILE_KINDS } from '../files/uploads.ts'
import { toValidatorDateTime } from '../forms/datetime_input.ts'
import { toFormErrors } from '../forms/save_record.ts'
import { selectedRelations, usableFilters } from '../list/filters.ts'
import { columnName, matchingQuery } from '../list/list_records.ts'
import type { RelationsContext } from '../records/relations.ts'
import { allows } from '../resources/abilities.ts'
import type { Action } from '../resources/actions.ts'
import { isBuiltInDelete, type Resource } from '../resources/define_resource.ts'
import { canList } from '../resources/navigation.ts'
import type { ActionKey, ActionResponse, FormErrors } from '../schema.ts'
import { ACTION_CHUNK_SIZE, MAX_MATCHING_RECORDS, type MatchingRows } from '../shared/actions.ts'
import { parseListState } from '../shared/list_state.ts'

type AnyAction = Action<'row' | 'bulk', any, any, any>

/**
 * The most selected records one request may act on. A run on all
 * matching rows (FR-17) goes in chunks instead, up to
 * `MAX_MATCHING_RECORDS`.
 */
export const MAX_ACTION_RECORDS = 1000

export function actionKey(item: Pick<AnyAction, 'kind' | 'name'>): ActionKey {
  return `${item.kind}.${item.name}`
}

/**
 * The actions this user may run on a record, as `row.publish` and
 * `bulk.delete` keys: each action's policy method, called with the
 * record. One check per distinct method.
 */
export async function actionAbilities(
  ctx: HttpContext,
  resource: Resource<any, any>,
  record: LucidRow,
  kinds: ('row' | 'bulk')[] = ['row', 'bulk']
): Promise<ActionKey[]> {
  const answers = new Map<string, Promise<boolean>>()
  const keys: ActionKey[] = []
  for (const item of resource.actions()) {
    if (!kinds.includes(item.kind)) continue
    const ability = item.effectiveAbility
    if (!answers.has(ability)) answers.set(ability, allows(ctx, resource, ability, record))
    if (await answers.get(ability)) keys.push(actionKey(item))
  }
  return keys
}

function noun(resource: Resource<any, any>, count: number) {
  return count === 1 ? resource.singularLabel.toLowerCase() : resource.label.toLowerCase()
}

const count = (value: number) => new Intl.NumberFormat('en').format(value)

/**
 * The message a thrown error shows. An AdonisJS exception below 500 is
 * meant for the user; anything else stays in the log.
 */
function errorMessage(error: unknown, label: string) {
  if (error instanceof Exception && error.status < 500) return error.message
  return `${label} failed, so nothing was changed.`
}

/**
 * The validated dialog input, or its errors.
 */
async function dialogInput(
  ctx: HttpContext,
  item: AnyAction,
  timezone: string
): Promise<{ input: unknown; errors?: never } | { errors: FormErrors; input?: never }> {
  if (!item.validator) return { input: undefined }
  const body = (ctx.request.body().input ?? {}) as Record<string, unknown>
  const timezones = { admin: timezone, process: processTimezone() }
  const data: Record<string, unknown> = {}
  for (const field of item.toJSON().fields) {
    if (!Object.hasOwn(body, field.name)) continue
    data[field.name] =
      field.kind === 'datetime'
        ? toValidatorDateTime(body[field.name], timezones)
        : body[field.name]
  }
  try {
    return { input: await item.validator.validate(data) }
  } catch (error) {
    const messages =
      (error as { code?: string; messages?: unknown }).code === 'E_VALIDATION_ERROR'
        ? (error as { messages: { field: string; message: string }[] }).messages
        : null
    if (!messages) throw error
    return { errors: toFormErrors(messages) }
  }
}

/**
 * Deletes records in the action's transaction, each after the
 * resource's `beforeDelete` hook. Returns their stored files, which are
 * removed once the transaction commits.
 */
async function deleteRecords(
  ctx: HttpContext,
  resource: Resource<any, any>,
  records: LucidRow[],
  defaultDisk: string | undefined
) {
  const files: { key: string; disk: string | undefined }[] = []
  const fileFields = resource.toSchema().fields.filter((field) => FILE_KINDS.has(field.kind))
  for (const record of records) {
    await resource.options.beforeDelete?.(record, ctx)
    for (const field of fileFields) {
      const key = (record as unknown as Record<string, unknown>)[field.name]
      if (typeof key === 'string' && key !== '' && !/^(https?:)?\/\//.test(key)) {
        files.push({ key, disk: diskFor(field, defaultDisk) })
      }
    }
    await record.delete()
  }
  return files
}

export type ActionOutcome =
  | { status: 200; body: ActionResponse }
  | { status: number; body: { message: string; errors?: FormErrors } }

type RunOptions = {
  timezone: string
  defaultDisk?: string
  /** For a run on all matching rows: the filters this user may use */
  context: RelationsContext
}

/**
 * The `matching` part of a request: a search, filter values as the
 * list's URL holds them, and a positive count. The body parser turns an
 * empty search into `null`.
 */
function readMatching(value: unknown): MatchingRows | null {
  const candidate = value as Partial<MatchingRows> | null
  if (typeof candidate !== 'object' || candidate === null) return null
  const { filters = {}, count: confirmed } = candidate
  const search = candidate.search ?? ''
  if (typeof search !== 'string' || typeof filters !== 'object' || filters === null) return null
  if (!Number.isInteger(confirmed) || (confirmed as number) < 1) return null
  const values = Object.entries(filters).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  )
  return { search, filters: Object.fromEntries(values), count: confirmed as number }
}

/**
 * Runs a bulk action on every row the list's search and filters match
 * (FR-17), from a request's `matching`.
 *
 * 1. The user must pass the resource's `viewList`, which gates the list
 *    the rows come from. Search and filters are read as the list reads
 *    them, so a filter the user can't use is ignored.
 * 2. The matching keys are read once, up front: the run covers those
 *    rows and no others, so rows that appear while it runs are left
 *    out. More than `MAX_MATCHING_RECORDS`, or more than the count the
 *    user confirmed, and nothing runs.
 * 3. Each chunk of `ACTION_CHUNK_SIZE` keys runs in its own
 *    transaction: its records are read again inside it, still through
 *    the `query` hook, search and filters, so a row that no longer
 *    matches (or was deleted) is skipped. Each record must pass the
 *    action's policy method; the rest are skipped. Then the handler (or
 *    the built-in Delete) runs on the chunk.
 * 4. A failed chunk rolls back and stops the run. The chunks before it
 *    stay committed, and the response counts what was done, skipped and
 *    left unchanged (`failed`).
 *
 * The handler runs once per chunk. Azu reports the totals, so a
 * handler's `message` isn't shown; its `redirect` is followed when the
 * whole run succeeds.
 */
async function runOnMatching(
  ctx: HttpContext,
  resource: Resource<any, any>,
  item: AnyAction,
  matching: unknown,
  options: RunOptions
): Promise<ActionOutcome> {
  const { label } = item.toJSON()
  const verb = label.toLowerCase()
  const many = noun(resource, 2)

  if (!(await canList(ctx, resource))) {
    return { status: 403, body: { message: `You can't ${verb} these ${many}.` } }
  }
  const requested = readMatching(matching)
  if (!requested) {
    return {
      status: 422,
      body: { message: 'A run on all matching rows needs the search, filters and count' },
    }
  }

  const filters = await usableFilters(ctx, options.context, resource)
  const state = parseListState(
    { search: requested.search, ...requested.filters },
    { defaultPerPage: 25, sortable: [], filters }
  )
  const relations = await selectedRelations(options.context, resource, filters, state.filters)
  const scope = { search: state.search, filters: relations.values }

  const dialog = await dialogInput(ctx, item, options.timezone)
  if (dialog.errors) {
    return { status: 422, body: { message: 'Check the form', errors: dialog.errors } }
  }

  // The rows matching now, by key. The run covers these and no others
  const model: LucidModel = resource.model
  const key = columnName(model, model.primaryKey)
  const qualified = `${model.table}.${key}`
  const rows = await matchingQuery(resource, scope, { timezone: options.timezone })
    .select(qualified)
    .orderBy(qualified, 'asc')
    .limit(MAX_MATCHING_RECORDS + 1)
    .pojo<Record<string, string | number>>()
  const ids = [...new Set(rows.map((row) => row[key]))]

  if (ids.length === 0) {
    return { status: 422, body: { message: `No ${many} match the search and filters now.` } }
  }
  if (ids.length > MAX_MATCHING_RECORDS) {
    return {
      status: 422,
      body: {
        message:
          `More than ${count(MAX_MATCHING_RECORDS)} ${many} match, and a bulk action runs on at most ` +
          `${count(MAX_MATCHING_RECORDS)} at once. Nothing was changed. Narrow the search or filters, ` +
          'and run it on each part.',
      },
    }
  }
  if (ids.length > requested.count) {
    return {
      status: 409,
      body: {
        message:
          `${count(ids.length)} ${many} match now, more than the ${count(requested.count)} you ` +
          'confirmed. Nothing was changed. Check the list and run it again.',
      },
    }
  }

  let done = 0
  let denied = 0
  let gone = 0
  let redirect: string | null = null
  for (let start = 0; start < ids.length; start += ACTION_CHUNK_SIZE) {
    const chunk = ids.slice(start, start + ACTION_CHUNK_SIZE)
    const tally = { done: 0, denied: 0, gone: 0 }
    let files: { key: string; disk: string | undefined }[] = []
    try {
      await model.transaction(async (trx) => {
        const found = await matchingQuery(resource, scope, {
          timezone: options.timezone,
          client: trx,
        }).whereIn(qualified, chunk as never[])
        const allowed: LucidRow[] = []
        for (const record of found) {
          if (await allows(ctx, resource, item.effectiveAbility, record)) allowed.push(record)
        }
        tally.done = allowed.length
        tally.denied = found.length - allowed.length
        tally.gone = chunk.length - found.length
        if (allowed.length === 0) return

        if (isBuiltInDelete(item)) {
          files = await deleteRecords(ctx, resource, allowed, options.defaultDisk)
        } else if (item.handler) {
          const result = (await (item.handler as (records: unknown, context: unknown) => unknown)(
            allowed,
            { ctx, input: dialog.input, trx }
          )) as { redirect?: string } | undefined
          if (result?.redirect) redirect = result.redirect
        }
      })
    } catch (error) {
      ctx.logger.error(
        { err: error },
        `Azu action "${resource.name}.bulk.${item.name}" failed on all matching rows`
      )
      if (done === 0) {
        const status = error instanceof Exception && error.status < 500 ? error.status : 500
        return { status, body: { message: errorMessage(error, label) } }
      }
      const failed = ids.length - done - denied - gone
      const reason =
        error instanceof Exception && error.status < 500
          ? `: ${error.message}`
          : ' at a failed batch'
      const message =
        `${label} stopped after ${count(done)} ${noun(resource, done)}${reason}. ` +
        `Those stay done; ${count(failed)} ${noun(resource, failed)} weren't changed` +
        skippedNote(denied, gone, verb)
      return {
        status: 200,
        body: { message, redirect: null, done, skipped: denied + gone, failed },
      }
    }
    await deleteFiles(ctx, files)
    done += tally.done
    denied += tally.denied
    gone += tally.gone
  }

  if (done === 0 && denied === 0) {
    return { status: 422, body: { message: `No ${many} match the search and filters now.` } }
  }
  if (done === 0) {
    return { status: 403, body: { message: `You can't ${verb} any of the matching ${many}.` } }
  }
  const message =
    (isBuiltInDelete(item)
      ? `Deleted ${count(done)} ${noun(resource, done)}`
      : `${label}: done for ${count(done)} ${noun(resource, done)}`) +
    skippedNote(denied, gone, verb)
  return {
    status: 200,
    body: { message, redirect, done, skipped: denied + gone, failed: 0 },
  }
}

/**
 * The end of a run's message: what it skipped, and why.
 */
function skippedNote(denied: number, gone: number, verb: string) {
  const parts: string[] = []
  if (denied > 0) parts.push(`${count(denied)} you can't ${verb}`)
  if (gone > 0) parts.push(`${count(gone)} that no longer matched`)
  return parts.length > 0 ? `. Skipped ${parts.join(' and ')}.` : '.'
}

/**
 * Runs a row or bulk action from `POST …/actions/:kind/:action`
 * (FR-12). The body is `{ ids, input? }`.
 *
 * 1. The records are found through the resource's `query` hook, so a
 *    scoped resource can't reach records outside its scope.
 * 2. Each record must pass the action's policy method. In bulk, the
 *    rest are skipped and reported; when none pass, it's a 403.
 * 3. The dialog's input goes through the action's validator (422).
 * 4. The handler (or the built-in Delete) runs in one transaction, with
 *    the records bound to it. A thrown error rolls it back.
 *
 * A bulk action with `{ matching, input? }` instead runs on every row
 * the list's search and filters match, in chunks (`runOnMatching`).
 */
export async function runAction(
  ctx: HttpContext,
  resource: Resource<any, any>,
  kind: 'row' | 'bulk',
  name: string,
  options: RunOptions
): Promise<ActionOutcome> {
  const item = resource
    .actions()
    .find((candidate) => candidate.kind === kind && candidate.name === name)
  if (!item) return { status: 404, body: { message: 'Not found' } }
  const { label } = item.toJSON()

  const body = ctx.request.body()
  if (kind === 'bulk' && Object.hasOwn(body, 'matching')) {
    return runOnMatching(ctx, resource, item, body.matching, options)
  }

  const ids = body.ids
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > (kind === 'row' ? 1 : MAX_ACTION_RECORDS) ||
    !ids.every((id) => typeof id === 'string' || typeof id === 'number')
  ) {
    return {
      status: 422,
      body: {
        message:
          kind === 'row'
            ? 'A row action runs on one record'
            : `Select between 1 and ${MAX_ACTION_RECORDS} records`,
      },
    }
  }

  const model: LucidModel = resource.model
  const query = model.query()
  resource.options.query?.(query)
  const found = await query.whereIn(columnName(model, model.primaryKey), ids as never[])

  const allowed: LucidRow[] = []
  for (const record of found) {
    if (await allows(ctx, resource, item.effectiveAbility, record)) allowed.push(record)
  }
  // Ids that don't exist (or are out of scope) count as skipped
  const skipped = ids.length - allowed.length
  if (allowed.length === 0) {
    return {
      status: 403,
      body: {
        message: `You can't ${label.toLowerCase()} ${ids.length === 1 ? `this ${noun(resource, 1)}` : `these ${noun(resource, 2)}`}.`,
      },
    }
  }

  const dialog = await dialogInput(ctx, item, options.timezone)
  if (dialog.errors) {
    return { status: 422, body: { message: 'Check the form', errors: dialog.errors } }
  }

  let result: unknown
  let files: { key: string; disk: string | undefined }[] = []
  try {
    await model.transaction(async (trx) => {
      for (const record of allowed) record.useTransaction(trx)
      if (isBuiltInDelete(item)) {
        files = await deleteRecords(ctx, resource, allowed, options.defaultDisk)
      } else if (item.handler) {
        const records = kind === 'row' ? allowed[0] : allowed
        result = await (item.handler as (records: unknown, context: unknown) => unknown)(records, {
          ctx,
          input: dialog.input,
          trx,
        })
      }
    })
  } catch (error) {
    ctx.logger.error({ err: error }, `Azu action "${resource.name}.${kind}.${name}" failed`)
    const status = error instanceof Exception && error.status < 500 ? error.status : 500
    return { status, body: { message: errorMessage(error, label) } }
  }
  await deleteFiles(ctx, files)

  const returned = (result ?? {}) as { message?: string; redirect?: string }
  const done = allowed.length
  let message =
    returned.message ??
    (isBuiltInDelete(item)
      ? `Deleted ${done} ${noun(resource, done)}`
      : `${label}: done for ${done} ${noun(resource, done)}`)
  if (skipped > 0) {
    message += `. Skipped ${skipped} you can't ${label.toLowerCase()}.`
  }
  return {
    status: 200,
    body: { message, redirect: returned.redirect ?? null, done, skipped, failed: 0 },
  }
}
