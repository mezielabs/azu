/*
|--------------------------------------------------------------------------
| Package entrypoint
|--------------------------------------------------------------------------
*/

import './src/inertia_pages.ts'

export { configure } from './configure.ts'
export { stubsRoot } from './stubs/main.ts'
export { defineConfig } from './src/define_config.ts'
export {
  defineResource,
  Resource,
  type ResourceOptions,
  type ValidatorLike,
} from './src/resources/define_resource.ts'
export { column, Column, type ColumnFor } from './src/resources/columns.ts'
export { field, Field, type FieldFor } from './src/resources/fields.ts'
export { filter, Filter, type FilterFor } from './src/resources/filters.ts'
export { action, Action, type ActionFor, type ActionResult } from './src/resources/actions.ts'
export {
  defineScreen,
  Screen,
  type ScreenOptions,
  type ComponentScreenOptions,
  type FormScreenOptions,
  type ScreenForm,
  type ScreenFieldFor,
  type ScreenAbility,
} from './src/screens/define_screen.ts'
export type { Azu } from './src/azu.ts'
export type * from './src/types.ts'
