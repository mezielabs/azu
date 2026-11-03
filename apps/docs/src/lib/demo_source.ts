/**
 * Code samples come from apps/demo, not copies. A page names a demo
 * file, and optionally a region marked in it:
 *
 *   // #region columns
 *   ...
 *   // #endregion
 *
 * In JSX, `{/* #region name *\/}` works too. Regions may nest; marker
 * lines are never shown. A missing file or region fails the build, so a
 * renamed region can't leave a page showing stale code.
 */

const files = import.meta.glob<string>(
  ['../../../demo/{app,config,start,inertia}/**/*.{ts,tsx}', '../../../demo/vite.config.ts'],
  { query: '?raw', import: 'default', eager: true }
)

const PREFIX = '../../../demo/'

const START = /^\s*(?:\/\/|\{?\/\*)\s*#region\b\s*(.*?)\s*(?:\*\/\}?)?\s*$/
const END = /^\s*(?:\/\/|\{?\/\*)\s*#endregion\b.*$/

/** The demo file's source, by its path from apps/demo */
export function demoFile(path: string): string {
  const source = files[PREFIX + path]
  if (source === undefined) {
    throw new Error(`DemoCode: apps/demo/${path} doesn't exist (or isn't .ts or .tsx)`)
  }
  return source
}

/** Removes the common leading indentation */
function dedent(lines: string[]): string[] {
  const indents = lines
    .filter((line) => line.trim() !== '')
    .map((line) => /^ */.exec(line)![0].length)
  const shift = indents.length ? Math.min(...indents) : 0
  return lines.map((line) => line.slice(shift))
}

/** Every region name a file marks, in order */
export function regionNames(source: string): string[] {
  return source
    .split('\n')
    .map((line) => START.exec(line)?.[1])
    .filter((name): name is string => Boolean(name))
}

/**
 * A region of a demo file (or the whole file without `region`), with
 * every marker line removed and the indentation shifted left.
 */
export function demoSource(path: string, region?: string): string {
  const lines = demoFile(path).replace(/\n$/, '').split('\n')
  let selected = lines

  if (region) {
    const start = lines.findIndex((line) => START.exec(line)?.[1] === region)
    if (start === -1) {
      throw new Error(
        `DemoCode: apps/demo/${path} has no "${region}" region. It has: ${regionNames(lines.join('\n')).join(', ') || 'none'}`
      )
    }
    let depth = 0
    let end = -1
    for (let index = start; index < lines.length; index++) {
      if (START.test(lines[index])) depth++
      else if (END.test(lines[index]) && --depth === 0) {
        end = index
        break
      }
    }
    if (end === -1)
      throw new Error(`DemoCode: the "${region}" region in apps/demo/${path} never ends`)
    selected = lines.slice(start + 1, end)
  }

  return dedent(selected.filter((line) => !START.test(line) && !END.test(line))).join('\n')
}
