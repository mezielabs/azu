import type { Page } from 'playwright'

type Box = { x: number; y: number; width: number; height: number }

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/**
 * Where the toast with `text` sits against the form's save bar: the
 * bar's buttons it covers, and whether it overlaps the bar at all.
 */
export async function toastAgainstSaveBar(page: Page, text: string) {
  const toast = page.locator('.azu-toast', { hasText: text }).last()
  await toast.waitFor()
  const toastBox = (await toast.boundingBox())!
  const barBox = (await page.locator('.azu-save-bar').boundingBox())!
  const buttons = await page.locator('.azu-save-actions > *').all()
  const covered: string[] = []
  for (const button of buttons) {
    const box = await button.boundingBox()
    if (!box || !overlaps(toastBox, box)) continue
    const label = await button.innerText()
    covered.push(label.trim())
  }
  return { covered, overBar: overlaps(toastBox, barBox) }
}
