import { introspectValidator, isIntrospectable } from '../forms/introspect.ts'
import { FORM_KINDS, inputName, validatorFor, type FormMode } from '../forms/form_fields.ts'
import { PAGE_NAMES, readStamp, sourceHash, type PageName } from '../publish/pages.ts'
import { isBuiltInDelete, type Resource } from '../resources/define_resource.ts'
import { SLOT_NAMES } from '../shared/slots.ts'
import type { AzuConfig } from '../types.ts'

/**
 * One thing `azu:doctor` found (FR-15). Errors mean configuration that
 * can't work as written; warnings, something that works but probably
 * isn't what was meant; notes, what doctor couldn't check.
 */
export type Finding = {
  level: 'error' | 'warning' | 'note'
  area: 'config' | 'policies' | 'validators' | 'components' | 'published pages'
  message: string
}

function hasMethod(resource: Resource<any, any>, method: string): boolean {
  const policy = resource.options.policy as { prototype?: Record<string, unknown> } | undefined
  return typeof policy?.prototype?.[method] === 'function'
}

function policyName(resource: Resource<any, any>): string {
  return (resource.options.policy as { name?: string } | undefined)?.name || 'its policy'
}

/**
 * Policy methods the resource relies on and the policy doesn't have. A
 * missing method means denied, so each one quietly hides something.
 */
export function checkPolicies(resources: Resource<any, any>[]): Finding[] {
  const findings: Finding[] = []
  const add = (level: Finding['level'], resource: Resource<any, any>, text: string) =>
    findings.push({ level, area: 'policies', message: `${resource.name}: ${text}` })

  for (const resource of resources) {
    const policy = policyName(resource)
    const schema = resource.toSchema()
    if (!hasMethod(resource, 'viewList')) {
      add('warning', resource, `${policy} has no viewList, so no one sees the resource`)
    }
    if (!hasMethod(resource, 'view')) {
      add('warning', resource, `${policy} has no view, so no record opens`)
    }
    const formFields = schema.fields.filter((field) => FORM_KINDS.has(field.kind))
    if (formFields.length > 0) {
      for (const method of ['create', 'update'] as const) {
        if (!hasMethod(resource, method)) {
          add('warning', resource, `${policy} has no ${method}, so the ${method} form never shows`)
        }
      }
    }
    for (const item of resource.actions()) {
      if (isBuiltInDelete(item)) continue
      const ability = item.effectiveAbility
      if (!hasMethod(resource, ability)) {
        add(
          'error',
          resource,
          `the ${item.kind} action "${item.name}" checks ${ability}, which ${policy} doesn't have, so it never runs`
        )
      }
    }
    for (const field of schema.fields) {
      if (field.ability && !hasMethod(resource, field.ability)) {
        add(
          'warning',
          resource,
          `the "${field.name}" field checks ${field.ability}, which ${policy} doesn't have, so it never shows`
        )
      }
    }
  }
  return findings
}

/**
 * Form fields whose input the validator doesn't declare. VineJS drops
 * undeclared keys, so whatever the user enters there is never saved.
 */
export function checkValidators(resources: Resource<any, any>[]): Finding[] {
  const findings: Finding[] = []
  for (const resource of resources) {
    const fields = resource
      .toSchema()
      .fields.filter((field) => FORM_KINDS.has(field.kind) && !field.readOnly)
    const forms = [
      { mode: 'create', method: 'create' },
      { mode: 'edit', method: 'update' },
    ] as const satisfies { mode: FormMode; method: string }[]
    for (const { mode, method } of forms) {
      const shown = fields.filter((field) => !field.visibleOn || field.visibleOn === mode)
      if (shown.length === 0 || !hasMethod(resource, method)) continue

      const validator = validatorFor(resource, mode)
      // Update falls back to the create validator
      const which = method === 'update' && !resource.options.validators?.update ? 'create' : method
      if (!validator) {
        findings.push({
          level: 'error',
          area: 'validators',
          message: `${resource.name}: there's no ${method} validator, so saving the ${method} form fails`,
        })
        continue
      }
      if (!isIntrospectable(validator)) {
        findings.push({
          level: 'note',
          area: 'validators',
          message: `${resource.name}: the ${which} validator isn't a VineJS 4 validator, so its fields can't be checked`,
        })
        continue
      }
      const declared = introspectValidator(validator)
      for (const field of shown) {
        const input = inputName(resource, field)
        if (declared.has(input)) continue
        findings.push({
          level: 'error',
          area: 'validators',
          message:
            `${resource.name}: the ${which} validator has no "${input}" for the "${field.name}" field, ` +
            "so what users enter there isn't saved",
        })
      }
    }
  }
  return findings
}

/**
 * Component names that fields, columns and slots use, which no file in
 * `inertia/admin/components` registers. Azu then renders its own
 * control, or nothing for a slot.
 */
export function checkComponents(
  resources: Resource<any, any>[],
  registered: Map<string, string[]>
): Finding[] {
  const findings: Finding[] = []
  for (const [name, files] of registered) {
    if (files.length > 1) {
      findings.push({
        level: 'warning',
        area: 'components',
        message: `${files.join(' and ')} both register ${name}; only one is used`,
      })
    }
  }
  for (const resource of resources) {
    const schema = resource.toSchema()
    const uses = [
      ...schema.fields.map((field) => [`the "${field.name}" field`, field.component] as const),
      ...schema.columns.map((column) => [`the "${column.name}" column`, column.component] as const),
      ...SLOT_NAMES.map((slot) => [`the ${slot} slot`, schema.slots[slot]] as const),
    ]
    for (const [where, name] of uses) {
      if (!name || registered.has(name)) continue
      findings.push({
        level: 'error',
        area: 'components',
        message: `${resource.name}: ${where} uses ${name}, but no file in inertia/admin/components registers it`,
      })
    }
  }
  return findings
}

/**
 * Pages in `inertia/admin/pages`, checked against the installed
 * `@mezielabs/azu-react`: a stamped copy whose original changed since it
 * was published has drifted.
 */
export function checkPublished(
  files: { page: string; content: string }[],
  pkg: { version: string; sources: Map<PageName, string | null> } | null
): Finding[] {
  const findings: Finding[] = []
  const add = (level: Finding['level'], message: string) =>
    findings.push({ level, area: 'published pages', message })

  for (const file of files) {
    const path = `inertia/admin/pages/${file.page}.tsx`
    if (!(PAGE_NAMES as readonly string[]).includes(file.page)) {
      add('warning', `${path}: Azu has no page named ${file.page}, so this file is never rendered`)
      continue
    }
    const stamp = readStamp(file.content)
    if (!stamp) {
      add('note', `${path} has no azu:publish stamp, so it can't be checked for drift`)
      continue
    }
    if (stamp.page !== file.page) {
      add('warning', `${path} was published as ${stamp.page}; it now replaces ${file.page}`)
    }
    if (!pkg) {
      add('warning', `${path}: @mezielabs/azu-react isn't installed, so drift can't be checked`)
      continue
    }
    const source = pkg.sources.get(file.page as PageName)
    if (!source) {
      add('warning', `${path}: @mezielabs/azu-react ${pkg.version} has no ${file.page} page`)
      continue
    }
    if (sourceHash(source) !== stamp.hash) {
      add(
        'warning',
        `${path} drifted: Azu's original changed since it was published from @mezielabs/azu-react ` +
          `${stamp.version} (installed: ${pkg.version}). Compare it with ` +
          `node_modules/@mezielabs/azu-react/src/pages/${file.page}.tsx, then merge the changes or ` +
          `run node ace azu:publish ${file.page} --force`
      )
    }
  }
  return findings
}

/**
 * What `checkConfig` needs to know about the app, gathered by the
 * command.
 */
export type ConfigFacts = {
  config: AzuConfig
  /** Guards in config/auth.ts; `null` without one */
  guards: string[] | null
  /** Disks in config/drive.ts; `null` without one */
  disks: string[] | null
  /** Disks `file` and `image` fields store on (`undefined`: the default) */
  uploadDisks: (string | undefined)[]
  entryExists: boolean
  /** vite.config.ts's source; `null` without one */
  viteConfig: string | null
  /** Whether `resources.autoload` exists; `null` when autoload is off */
  autoloadExists: boolean | null
  resourceCount: number
}

/**
 * Settings in config/azu.ts that point at things the app doesn't have.
 * Values `defineConfig` validates (perPage, timezone, brand.color) fail
 * at boot, before doctor runs.
 */
export function checkConfig(facts: ConfigFacts): Finding[] {
  const findings: Finding[] = []
  const add = (level: Finding['level'], message: string) =>
    findings.push({ level, area: 'config', message })
  const { config } = facts

  if (facts.guards === null) {
    add('error', 'config/auth.ts is missing, so no one can sign in to the admin panel')
  } else if (config.guard && !facts.guards.includes(config.guard)) {
    add(
      'error',
      `"guard" is "${config.guard}", but config/auth.ts has only ${facts.guards.join(', ') || 'no guards'}`
    )
  }

  if (facts.uploadDisks.length > 0) {
    if (facts.disks === null) {
      add('error', 'file and image fields need Drive: node ace add @adonisjs/drive')
    } else {
      const named = new Set(
        [config.defaultDisk, ...facts.uploadDisks].filter(
          (disk): disk is string => typeof disk === 'string'
        )
      )
      for (const disk of named) {
        if (!facts.disks.includes(disk)) {
          add('error', `uploads use the "${disk}" disk, which config/drive.ts doesn't define`)
        }
      }
    }
  }

  if (!facts.entryExists) {
    add('error', `"entry" is ${config.entry}, which doesn't exist`)
  }
  if (facts.viteConfig === null) {
    add('error', 'vite.config.ts is missing, so the admin assets are never built')
  } else if (!/@mezielabs\/azu\/vite/.test(facts.viteConfig)) {
    add('error', "vite.config.ts doesn't use the azu() plugin from @mezielabs/azu/vite")
  }

  if (facts.autoloadExists === false) {
    add('warning', `"resources.autoload" is ${config.resources.autoload}, which doesn't exist`)
  }
  if (facts.resourceCount === 0) {
    add('warning', 'no resources are registered, so the admin panel is empty')
  }
  return findings
}
