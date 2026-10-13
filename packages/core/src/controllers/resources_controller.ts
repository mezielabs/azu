import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import type { Azu } from '../azu.ts'
import { detailFields, formFields, formValues, recordData } from '../forms/form_fields.ts'
import { saveRecord } from '../forms/save_record.ts'
import { listRecords } from '../list/list_records.ts'
import { findRecord } from '../records/find_record.ts'
import { renderPage } from '../render.ts'
import { allows } from '../resources/abilities.ts'
import type { Resource } from '../resources/define_resource.ts'
import { canList } from '../resources/navigation.ts'
import { listStateUrl, parseListState } from '../shared/list_state.ts'
import type { AzuConfig } from '../types.ts'

type Context = { config: AzuConfig; azu: Azu }

function notFound(ctx: HttpContext, context: Context) {
  ctx.response.status(404)
  return renderPage(ctx, context, 'azu/errors/not_found', {})
}

function forbidden(ctx: HttpContext, context: Context) {
  ctx.response.status(403)
  return renderPage(ctx, context, 'azu/errors/forbidden', {})
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
   * The list screen (FR-05): server-side pagination, sorting and
   * search, all in the URL. The policy check runs on every request,
   * partial reloads included.
   */
  async index(ctx: HttpContext) {
    const { config } = this.context
    const resource = this.context.azu.resources.get(ctx.params.resource)
    if (!resource) return notFound(ctx, this.context)
    if (!(await canList(ctx, resource))) return forbidden(ctx, this.context)

    const schema = resource.toSchema()
    const options = {
      defaultPerPage: config.perPage,
      sortable: schema.columns.filter((column) => column.sortable).map((column) => column.name),
    }
    const state = parseListState(ctx.request.qs(), options)
    const { rows, meta } = await listRecords(ctx, resource, state)

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
      list: { rows, meta, state, defaultPerPage: config.perPage },
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

    const fields = await formFields(ctx, resource, 'create')
    return renderPage(ctx, this.context, 'azu/resource/create', {
      resource: resource.toSchema(),
      form: { fields, values: formValues(fields) },
      errors: {},
    })
  }

  /**
   * Creates a record through the create validator, then redirects to
   * its detail page. Invalid input renders the form again with a 422.
   */
  async store(ctx: HttpContext) {
    const auth = await this.#authorize(ctx, 'create')
    if (!auth.ok) return auth.response
    const { resource } = auth

    const fields = await formFields(ctx, resource, 'create')
    const result = await saveRecord(ctx, resource, 'create', fields)
    if (result.errors) {
      ctx.response.status(422)
      return renderPage(ctx, this.context, 'azu/resource/create', {
        resource: resource.toSchema(),
        form: { fields, values: formValues(fields) },
        errors: result.errors,
      })
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
    return renderPage(ctx, this.context, 'azu/resource/show', {
      resource: resource.toSchema(),
      fields,
      record: recordData(resource, record!, fields),
      abilities: { update: await allows(ctx, resource, 'update', record) },
    })
  }

  /**
   * The edit form (FR-06), gated by the policy's `update`.
   */
  async edit(ctx: HttpContext) {
    const auth = await this.#authorize(ctx, 'update')
    if (!auth.ok) return auth.response
    const { resource, record } = auth

    return this.#renderEdit(ctx, resource, record!, await formFields(ctx, resource, 'edit', record))
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

    const fields = await formFields(ctx, resource, 'edit', record)
    const result = await saveRecord(ctx, resource, 'edit', fields, record)
    if (result.errors) {
      ctx.response.status(422)
      return this.#renderEdit(ctx, resource, record!, fields, result.errors)
    }

    return this.#toDetail(ctx, resource, result.record)
  }

  #renderEdit(
    ctx: HttpContext,
    resource: Resource<any, any>,
    record: LucidRow,
    fields: Awaited<ReturnType<typeof formFields>>,
    errors = {}
  ) {
    const { id, title } = recordData(resource, record, [])
    return renderPage(ctx, this.context, 'azu/resource/edit', {
      resource: resource.toSchema(),
      record: { id, title },
      form: { fields, values: formValues(fields, record) },
      errors,
    })
  }

  /**
   * 303, so the browser follows a POST or PUT with a GET.
   */
  #toDetail(ctx: HttpContext, resource: Resource<any, any>, record: LucidRow) {
    return ctx.response
      .redirect()
      .withQs(false)
      .status(303)
      .toPath(resourcePath(this.context, resource, record.$primaryKeyValue))
  }
}
