import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import { processTimezone } from '../define_config.ts'
import { deleteFiles, diskFor, FILE_KINDS } from '../files/uploads.ts'
import { toValidatorDateTime } from '../forms/datetime_input.ts'
import { toFormErrors } from '../forms/save_record.ts'
import { columnName } from '../list/list_records.ts'
import { allows } from '../resources/abilities.ts'
import type { Action } from '../resources/actions.ts'
import { isBuiltInDelete, type Resource } from '../resources/define_resource.ts'
import type { ActionKey, ActionResponse, FormErrors } from '../schema.ts'

type AnyAction = Action<'row' | 'bulk', any, any, any>

/**
 * The most records one request may act on. FR-17 runs actions on all
 * filtered rows in chunks instead.
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
 */
export async function runAction(
  ctx: HttpContext,
  resource: Resource<any, any>,
  kind: 'row' | 'bulk',
  name: string,
  options: { timezone: string; defaultDisk?: string }
): Promise<ActionOutcome> {
  const item = resource
    .actions()
    .find((candidate) => candidate.kind === kind && candidate.name === name)
  if (!item) return { status: 404, body: { message: 'Not found' } }
  const { label } = item.toJSON()

  const ids = ctx.request.body().ids
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
    body: { message, redirect: returned.redirect ?? null, done, skipped },
  }
}
