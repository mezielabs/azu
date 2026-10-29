import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import type { Azu } from '../azu.ts'
import {
  detailFields,
  fieldAllowed,
  formFields,
  formValues,
  recordData,
  recordTimestamp,
  type FormMode,
} from '../forms/form_fields.ts'
import { saveRecord } from '../forms/save_record.ts'
import { fileValues } from '../files/uploads.ts'
import { actionAbilities, runAction } from '../actions/run_action.ts'
import { listFilters, selectedRelations, usableFilters } from '../list/filters.ts'
import { listRecords, recordCells } from '../list/list_records.ts'
import { findRecord } from '../records/find_record.ts'
import {
  canListRelated,
  hasManyTables,
  manyToManyReadOnlyReason,
  relationOptions,
  relationValues,
} from '../records/relations.ts'
import { renderPage } from '../render.ts'
import { allows } from '../resources/abilities.ts'
import type { Resource } from '../resources/define_resource.ts'
import { canList } from '../resources/navigation.ts'
import { listStateUrl, parseListState } from '../shared/list_state.ts'
import { AFTER_SAVE_INPUT, afterSave } from '../shared/after_save.ts'
import type { CellValue, FormErrors, FormFieldSchema } from '../schema.ts'
import type { AzuConfig, RelationOptionsResponse } from '../types.ts'

type Context = { config: AzuConfig; azu: Azu }

function notFound(ctx: HttpContext, context: Context) {
  ctx.response.status(404)
  return renderPage(ctx, context, 'azu/errors/not_found', {})
}

function forbidden(ctx: HttpContext, context: Context) {
  ctx.response.status(403)
  return renderPage(ctx, context, 'azu/errors/forbidden', {})
}

/**
 * The session flash key "Create & add another" names the new record in
 */
const SAVED_FLASH = 'azu.saved'

/**
 * The request's session, when the app has session middleware. Without
 * one, "Create & add another" still works, with no View link.
 */
function sessionOf(ctx: HttpContext) {
  return (
    ctx as unknown as {
      session?: {
        flash(key: string, value: unknown): void
        flashMessages: { get(key: string): unknown }
      }
    }
  ).session
}

function savedRecord(ctx: HttpContext): { id: string | number; title: string | null } | null {
  const saved = sessionOf(ctx)?.flashMessages.get(SAVED_FLASH) as
    { id: string | number; title: string | null } | undefined
  return saved && (typeof saved.id === 'string' || typeof saved.id === 'number')
    ? { id: saved.id, title: typeof saved.title === 'string' ? saved.title : null }
    : null
}

function resourcePath(context: Context, resource: Resource<any, any>, ...segments: unknown[]) {
  return [`${context.config.path}/resources/${resource.name}`, ...segments.map(String)].join('/')
}

/**
 * The generic resource screens. Every handler resolves the resource,
 * then checks its policy on the server, on every request: hiding a
 * button is only a convenience.
 */
export class ResourcesController {
  constructor(protected context: Context) {}

  /**
   * The resource and, for record routes, the record, or the response
   * that ends the request: 404 for an unknown resource or record, 403
   * when the policy says no.
   */
  async #authorize(
    ctx: HttpContext,
    ability: 'create' | 'view' | 'update'
  ): Promise<
    | { ok: true; resource: Resource<any, any>; record: LucidRow | undefined }
    | { ok: false; response: unknown }
  > {
    const resource = this.context.azu.resources.get(ctx.params.resource)
    if (!resource) return { ok: false, response: await notFound(ctx, this.context) }

    let record: LucidRow | undefined
    if (ability !== 'create') {
      record = (await findRecord(resource, ctx.params.id)) ?? undefined
      if (!record) return { ok: false, response: await notFound(ctx, this.context) }
    }

    const allowed = record
      ? await allows(ctx, resource, ability, record)
      : await allows(ctx, resource, ability)
    if (!allowed) return { ok: false, response: await forbidden(ctx, this.context) }

    return { ok: true, resource, record }
  }

  /**
   * The list screen (FR-05, FR-13): server-side pagination, sorting,
   * search and filters, all in the URL. The policy check runs on every
   * request, partial reloads included.
   */
  async index(ctx: HttpContext) {
    const { config } = this.context
    const resource = this.context.azu.resources.get(ctx.params.resource)
    if (!resource) return notFound(ctx, this.context)
    if (!(await canList(ctx, resource))) return forbidden(ctx, this.context)

    const schema = resource.toSchema()
    const filters = await usableFilters(ctx, this.context, resource)
    const options = {
      defaultPerPage: config.perPage,
      sortable: schema.columns.filter((column) => column.sortable).map((column) => column.name),
      filters,
      columns: schema.columns.map((column) => column.name),
    }
    const parsed = parseListState(ctx.request.qs(), options)
    const relations = await selectedRelations(this.context, resource, filters, parsed.filters)
    const state = { ...parsed, filters: relations.values }
    const { rows, meta } = await listRecords(ctx, resource, state, {
      defaultDisk: config.defaultDisk,
      timezone: config.timezone,
    })

    // Past the last page (say, after deleting rows): go to the last one
    if (state.page > meta.lastPage && meta.lastPage >= 1) {
      // withQs(false): apps can forward the query string on redirects by default
      return ctx.response
        .redirect()
        .withQs(false)
        .toPath(
          listStateUrl(
            resourcePath(this.context, resource),
            { ...state, page: meta.lastPage },
            options
          )
        )
    }

    return renderPage(ctx, this.context, 'azu/resource/index', {
      resource: schema,
      list: {
        rows,
        meta,
        state,
        defaultPerPage: config.perPage,
        filters: listFilters(
          filters,
          state.filters,
          relations.selected,
          resourcePath(this.context, resource)
        ),
      },
      abilities: { create: await allows(ctx, resource, 'create') },
    })
  }

  /**
   * The create form (FR-06), gated by the policy's `create`.
   */
  async create(ctx: HttpContext) {
    const auth = await this.#authorize(ctx, 'create')
    if (!auth.ok) return auth.response
    const { resource } = auth

    return this.#renderCreate(ctx, resource, await this.#formFields(ctx, resource, 'create'))
  }

  /**
   * Creates a record through the create validator, then redirects to
   * its detail page. Invalid input renders the form again with a 422.
   */
  async store(ctx: HttpContext) {
    const auth = await this.#authorize(ctx, 'create')
    if (!auth.ok) return auth.response
    const { resource } = auth

    const fields = await this.#formFields(ctx, resource, 'create')
    const result = await saveRecord(ctx, resource, 'create', fields, {
      timezone: this.context.config.timezone,
      defaultDisk: this.context.config.defaultDisk,
    })
    if (result.errors) {
      ctx.response.status(422)
      return this.#renderCreate(ctx, resource, fields, result.errors)
    }

    // "Create & add another": a fresh form, which names the new record
    // for its toast's View link, only to a user who may view it
    if (afterSave(ctx.request.input(AFTER_SAVE_INPUT), 'create') === 'create') {
      if (await allows(ctx, resource, 'view', result.record)) {
        const { id, title } = recordData(resource, result.record, [])
        sessionOf(ctx)?.flash(SAVED_FLASH, { id, title })
      }
      return this.#redirect(ctx, resourcePath(this.context, resource, 'create'))
    }
    return this.#toDetail(ctx, resource, result.record)
  }

  /**
   * The detail page (FR-06), gated by the policy's `view`.
   */
  async show(ctx: HttpContext) {
    const auth = await this.#authorize(ctx, 'view')
    if (!auth.ok) return auth.response
    const { resource, record } = auth

    const fields = await detailFields(ctx, resource, record!)
    const resolved = {
      ...(await relationValues(ctx, this.context, resource.model, fields, record!)),
      ...(await fileValues(ctx, fields, record!, this.context.config.defaultDisk)),
    }
    const tables = []
    for (const field of resource.toSchema().fields) {
      if (field.kind === 'hasMany' && (await fieldAllowed(ctx, resource, field, record))) {
        tables.push(field)
      }
    }
    const schema = resource.toSchema()
    // No fields this user may see: the page shows the columns instead
    let cells: Record<string, CellValue> | null = null
    if (fields.length === 0 && schema.columns.length > 0) {
      for (const column of schema.columns) {
        if (column.kind !== 'belongsTo') continue
        const loaded = (record as unknown as { $preloaded: Record<string, unknown> }).$preloaded
        if (!(column.name in loaded)) {
          await (record as unknown as { load(name: string): Promise<void> }).load(column.name)
        }
      }
      cells = await recordCells(ctx, resource, record!, this.context.config.defaultDisk)
    }
    return renderPage(ctx, this.context, 'azu/resource/show', {
      resource: schema,
      fields,
      record: recordData(resource, record!, fields, resolved),
      timestamps: {
        createdAt: recordTimestamp(resource.model, record!, 'createdAt'),
        updatedAt: recordTimestamp(resource.model, record!, 'updatedAt'),
      },
      cells,
      relations: await hasManyTables(ctx, this.context, resource, tables, record!),
      abilities: {
        update: await allows(ctx, resource, 'update', record),
        actions: await actionAbilities(ctx, resource, record!, ['row']),
      },
    })
  }

  /**
   * The edit form (FR-06), gated by the policy's `update`.
   */
  async edit(ctx: HttpContext) {
    const auth = await this.#authorize(ctx, 'update')
    if (!auth.ok) return auth.response
    const { resource, record } = auth

    return this.#renderEdit(
      ctx,
      resource,
      record!,
      await this.#formFields(ctx, resource, 'edit', record)
    )
  }

  /**
   * Updates a record through the update validator (or the create one),
   * then redirects to its detail page. Invalid input renders the form
   * again with a 422.
   */
  async update(ctx: HttpContext) {
    const auth = await this.#authorize(ctx, 'update')
    if (!auth.ok) return auth.response
    const { resource, record } = auth

    const fields = await this.#formFields(ctx, resource, 'edit', record)
    const result = await saveRecord(ctx, resource, 'edit', fields, {
      record,
      timezone: this.context.config.timezone,
      defaultDisk: this.context.config.defaultDisk,
    })
    if (result.errors) {
      ctx.response.status(422)
      return this.#renderEdit(ctx, resource, record!, fields, result.errors)
    }

    // "Save & keep editing": the edit form again, with the values as stored
    if (afterSave(ctx.request.input(AFTER_SAVE_INPUT), 'edit') === 'edit') {
      return this.#redirect(
        ctx,
        resourcePath(this.context, resource, result.record.$primaryKeyValue, 'edit')
      )
    }
    return this.#toDetail(ctx, resource, result.record)
  }

  /**
   * Runs a row or bulk action (FR-12), as JSON: `{ ids, input? }` in,
   * `ActionResponse` out. Every record is checked against the action's
   * policy method on the server.
   */
  async action(ctx: HttpContext) {
    const resource = this.context.azu.resources.get(ctx.params.resource)
    const kind = ctx.params.kind
    if (!resource || (kind !== 'row' && kind !== 'bulk')) {
      return ctx.response.status(404).send({ message: 'Not found' })
    }
    const outcome = await runAction(ctx, resource, kind, ctx.params.action, {
      timezone: this.context.config.timezone,
      defaultDisk: this.context.config.defaultDisk,
      context: this.context,
    })
    return ctx.response.status(outcome.status).send(outcome.body)
  }

  /**
   * Options for a `belongsTo` field's select (FR-08) or a `manyToMany`
   * field's picker (FR-09), as JSON. Gated
   * like the form it serves: `create`, or `update` on the record named
   * by `?record=`, and the field must be on that form for this user.
   * The user must also pass the related resource's `viewList` (fails
   * closed), and a read-only field has no options.
   */
  async options(ctx: HttpContext): Promise<RelationOptionsResponse | unknown> {
    const resource = this.context.azu.resources.get(ctx.params.resource)
    if (!resource) return ctx.response.status(404).send({ error: 'Not found' })

    const { record: recordId, search } = ctx.request.qs()
    let record: LucidRow | undefined
    if (recordId !== undefined) {
      record = (await findRecord(resource, String(recordId))) ?? undefined
      if (!record) return ctx.response.status(404).send({ error: 'Not found' })
      if (!(await allows(ctx, resource, 'update', record))) {
        return ctx.response.status(403).send({ error: 'Forbidden' })
      }
    } else if (!(await allows(ctx, resource, 'create'))) {
      return ctx.response.status(403).send({ error: 'Forbidden' })
    }

    const fields = await this.#formFields(ctx, resource, record ? 'edit' : 'create', record)
    const field = fields.find(
      (item) =>
        item.name === ctx.params.field && (item.kind === 'belongsTo' || item.kind === 'manyToMany')
    )
    if (!field) return ctx.response.status(404).send({ error: 'Not found' })
    if (field.readOnly) return ctx.response.status(403).send({ error: 'Forbidden' })

    const term = typeof search === 'string' ? search.trim().slice(0, 100) : ''
    return { options: await relationOptions(this.context, resource.model, field, term) }
  }

  /**
   * Options for a `belongsTo` filter's select (FR-13), as JSON. The
   * same query and rule as a field's options: the user must pass the
   * resource's `viewList` (it gates the list the filter is on) and the
   * related resource's `viewList`, failing closed.
   */
  async filterOptions(ctx: HttpContext): Promise<RelationOptionsResponse | unknown> {
    const resource = this.context.azu.resources.get(ctx.params.resource)
    if (!resource) return ctx.response.status(404).send({ error: 'Not found' })
    if (!(await canList(ctx, resource))) {
      return ctx.response.status(403).send({ error: 'Forbidden' })
    }

    const filter = resource
      .toSchema()
      .filters.find((item) => item.name === ctx.params.filter && item.kind === 'belongsTo')
    if (!filter) return ctx.response.status(404).send({ error: 'Not found' })
    if (!(await canListRelated(ctx, this.context, resource.model, filter))) {
      return ctx.response.status(403).send({ error: 'Forbidden' })
    }

    const { search } = ctx.request.qs()
    const term = typeof search === 'string' ? search.trim().slice(0, 100) : ''
    return {
      options: await relationOptions(
        this.context,
        resource.model,
        { name: filter.name, searchable: null },
        term
      ),
    }
  }

  /**
   * The form's fields, with each `belongsTo` and `manyToMany` field's
   * options URL. One whose related resource the user can't list is
   * read-only: it shows the current records, with no options. So is a
   * `manyToMany` field on an edit form with more records attached than
   * the form loads, which says why: submitting the ones it shows would
   * detach the rest.
   */
  async #formFields(
    ctx: HttpContext,
    resource: Resource<any, any>,
    mode: FormMode,
    record?: LucidRow
  ): Promise<FormFieldSchema[]> {
    const fields = await formFields(ctx, resource, mode, record)
    const query = record ? `?record=${encodeURIComponent(String(record.$primaryKeyValue))}` : ''
    const result: FormFieldSchema[] = []
    for (const field of fields) {
      if (field.kind !== 'belongsTo' && field.kind !== 'manyToMany') {
        result.push(field)
      } else if (!(await canListRelated(ctx, this.context, resource.model, field))) {
        result.push({ ...field, readOnly: true, optionsUrl: null })
      } else {
        const reason =
          field.kind === 'manyToMany' && record
            ? await manyToManyReadOnlyReason(this.context, resource.model, field, record)
            : null
        const url = resourcePath(this.context, resource, 'fields', field.name, 'options')
        result.push(
          reason
            ? { ...field, readOnly: true, optionsUrl: null, readOnlyReason: reason }
            : { ...field, optionsUrl: field.readOnly ? null : `${url}${query}` }
        )
      }
    }
    return result
  }

  #renderCreate(
    ctx: HttpContext,
    resource: Resource<any, any>,
    fields: FormFieldSchema[],
    errors: FormErrors = {}
  ) {
    return renderPage(ctx, this.context, 'azu/resource/create', {
      resource: resource.toSchema(),
      // Set only right after "Create & add another"
      saved: errors && Object.keys(errors).length > 0 ? null : savedRecord(ctx),
      form: { fields, values: formValues(fields) },
      errors,
    })
  }

  async #renderEdit(
    ctx: HttpContext,
    resource: Resource<any, any>,
    record: LucidRow,
    fields: FormFieldSchema[],
    errors: FormErrors = {}
  ) {
    const { id, title } = recordData(resource, record, [])
    const resolved = {
      ...(await relationValues(ctx, this.context, resource.model, fields, record)),
      ...(await fileValues(ctx, fields, record, this.context.config.defaultDisk)),
    }
    return renderPage(ctx, this.context, 'azu/resource/edit', {
      resource: resource.toSchema(),
      record: { id, title },
      form: { fields, values: formValues(fields, record, resolved) },
      errors,
    })
  }

  /**
   * 303, so the browser follows a POST or PUT with a GET.
   */
  #toDetail(ctx: HttpContext, resource: Resource<any, any>, record: LucidRow) {
    return this.#redirect(ctx, resourcePath(this.context, resource, record.$primaryKeyValue))
  }

  #redirect(ctx: HttpContext, path: string) {
    return ctx.response.redirect().withQs(false).status(303).toPath(path)
  }
}
