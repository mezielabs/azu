/**
 * Public entry for `@mezielabs/azu-react`.
 *
 * Package pages import shared pieces from here, never by relative path,
 * so a page copied into an app by `azu:publish` compiles there
 * unchanged. `Head` and `Link` are re-exported for the same reason: the
 * AdonisJS lint config rejects `Link` from `@inertiajs/react` in apps.
 */
export { Head, Link } from '@inertiajs/react'
export { createAzuApp, type CreateAzuAppOptions } from './app.tsx'
export { AdminLayout, type AdminLayoutProps } from './components/admin_layout.tsx'
export { PageHeader, type Breadcrumb } from './components/page_header.tsx'
export { useComponent } from './components/registry.tsx'
export { Slot } from './components/slot.tsx'
export { DataTable, selectedIds } from './components/list/data_table.tsx'
export { ListCell } from './components/list/cell.tsx'
export { ListToolbar } from './components/list/list_toolbar.tsx'
export { ListCards } from './components/list/list_cards.tsx'
export { MobileListControls } from './components/list/mobile_list_controls.tsx'
export { useMediaQuery, PHONE_QUERY, COMPACT_QUERY } from './components/use_media_query.ts'
export { FilterBar } from './components/list/filter_bar.tsx'
export { AccountMenu, ThemeRadios } from './components/account_menu.tsx'
export { Pagination } from './components/list/pagination.tsx'
export { ResourceForm } from './components/form/resource_form.tsx'
export { ScreenForm } from './components/form/screen_form.tsx'
export { ScreenWidgets } from './components/widgets/screen_widgets.tsx'
export { RangeSwitch } from './components/widgets/range_switch.tsx'
export { FormField } from './components/form/form_field.tsx'
export { UnsavedChanges } from './components/form/unsaved_changes.tsx'
export { FieldValueView } from './components/detail/field_value.tsx'
export { RelationTableView } from './components/detail/relation_table.tsx'
export { RelationControl } from './components/form/relation_control.tsx'
export { RichTextControl } from './components/form/rich_text_control.tsx'
export { showToast, ToastRegion } from './components/toast.tsx'
export { ActionDialog } from './components/actions/action_dialog.tsx'
export { useActions, type ActionTarget } from './components/actions/use_actions.tsx'
export { RowActionsMenu, ActionsMenu } from './components/actions/row_actions.tsx'

/**
 * Contracts are defined in `@mezielabs/azu`, so a future Vue package
 * shares them.
 */
export type {
  FieldProps,
  CellProps,
  SlotProps,
  SlotName,
  DashboardPageProps,
  ResourceIndexPageProps,
  ResourceCreatePageProps,
  ResourceEditPageProps,
  ResourceShowPageProps,
  ScreenPageProps,
  ScreenFormData,
  WidgetSchema,
  WidgetData,
  WidgetProps,
  PartitionRow,
  ScreenProps,
  ScreenSchema,
  ResourceFormData,
  FormFieldSchema,
  FormErrors,
  FieldValue,
  RecordData,
  RelationValue,
  FileValue,
  ActionKey,
  ActionResponse,
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
  ListFilter,
  ActionSchema,
} from '@mezielabs/azu/types'
