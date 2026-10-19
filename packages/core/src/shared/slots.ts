/**
 * Named places on a resource's pages where an app component renders
 * (FR-15), set with the resource's `slots` option.
 */
export const SLOT_NAMES = ['header', 'toolbar', 'beforeTable', 'afterForm'] as const

export type SlotName = (typeof SLOT_NAMES)[number]

/** The resource pages, as `SlotProps.page` names them */
export type SlotPage = 'index' | 'create' | 'edit' | 'show'

/** The slots each resource page renders (see `ResourceOptions.slots`) */
export const PAGE_SLOTS: Record<SlotPage, readonly SlotName[]> = {
  index: ['header', 'toolbar', 'beforeTable'],
  create: ['header', 'toolbar', 'afterForm'],
  edit: ['header', 'toolbar', 'afterForm'],
  show: ['header', 'toolbar'],
}
