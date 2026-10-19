/**
 * Named places on a resource's pages where an app component renders
 * (FR-15), set with the resource's `slots` option.
 */
export const SLOT_NAMES = ['header', 'toolbar', 'beforeTable', 'afterForm'] as const

export type SlotName = (typeof SLOT_NAMES)[number]
