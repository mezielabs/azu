/**
 * Where a successful save goes (layout 4/4): the detail page, a fresh
 * create form ("Create & add another"), or back to the edit form ("Save
 * & keep editing"). The form sends it as `_after`; it's read by the
 * controller and never reaches the validator or the model.
 */
export type AfterSave = 'show' | 'create' | 'edit'

/** The hidden form input that carries it */
export const AFTER_SAVE_INPUT = '_after'

/**
 * The `_after` a save may use: the create form offers `create`, the
 * edit form `edit`, and both `show`. Anything else, missing or forged,
 * is `show`.
 */
export function afterSave(value: unknown, mode: 'create' | 'edit'): AfterSave {
  if (value === mode) return mode
  return 'show'
}
