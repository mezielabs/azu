/**
 * Public entry for `@mezielabs/azu-react`.
 *
 * Package pages import shared pieces from here, never by relative path,
 * so a page copied into an app by `admin:publish` compiles there
 * unchanged. `Head` and `Link` are re-exported for the same reason: the
 * AdonisJS lint config rejects `Link` from `@inertiajs/react` in apps.
 */
export { Head, Link } from '@inertiajs/react'
export { createAzuApp, type CreateAzuAppOptions } from './app.tsx'
export { AdminLayout, type AdminLayoutProps } from './components/admin_layout.tsx'
export { useComponent } from './components/registry.tsx'
export { DataTable, selectedIds } from './components/list/data_table.tsx'
export { ListCell } from './components/list/cell.tsx'
export { ListToolbar } from './components/list/list_toolbar.tsx'
export { Pagination } from './components/list/pagination.tsx'
export { ResourceForm } from './components/form/resource_form.tsx'
export { FormField } from './components/form/form_field.tsx'
export { UnsavedChanges } from './components/form/unsaved_changes.tsx'
export { FieldValueView } from './components/detail/field_value.tsx'
export { RelationTableView } from './components/detail/relation_table.tsx'
export { RelationControl } from './components/form/relation_control.tsx'
export { FileControl } from './components/form/file_control.tsx'
export { RichTextControl } from './components/form/rich_text_control.tsx'
export { showToast, ToastRegion } from './components/toast.tsx'

/**
 * Contracts are defined in `@mezielabs/azu`, so a future Vue package
 * shares them.
 */
export type {
  FieldProps,
  DashboardPageProps,
  ResourceIndexPageProps,
  ResourceCreatePageProps,
  ResourceEditPageProps,
  ResourceShowPageProps,
  ResourceFormData,
  FormFieldSchema,
  FormErrors,
  FieldValue,
  RecordData,
  RelationValue,
  FileValue,
  RelationOption,
  RelationTable,
  RelationOptionsResponse,
  ForbiddenPageProps,
  NotFoundPageProps,
  AzuSharedProps,
  NavigationGroup,
  NavigationItem,
  ResourceSchema,
  ColumnSchema,
  FieldSchema,
  FilterSchema,
  ActionSchema,
} from '@mezielabs/azu/types'
