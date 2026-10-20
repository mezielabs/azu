/**
 * Exact decimal strings for widget results (FR-24). Postgres and MySQL
 * return sums and averages of decimal columns as strings, SQLite as
 * numbers; both become plain decimal strings here, without going
 * through floating point where the database didn't.
 */

const DECIMAL = /^(-?)(\d*)(?:\.(\d*))?$/

/**
 * A number as a plain decimal string, never in exponent form:
 * `1e21` → "1000000000000000000000", `0.1 + 0.2` → "0.30000000000000004".
 */
export function plainNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const text = String(value)
  if (!/e/i.test(text)) return text
  // Huge integers in full; tiny fractions to 20 places
  if (Number.isInteger(value)) return BigInt(value).toString()
  return value.toFixed(20).replace(/\.?0+$/, '')
}

/**
 * Rounds a decimal string to `scale` places, half away from zero,
 * padding with zeros: ("1234.565", 2) → "1234.57", ("7.5", 2) → "7.50".
 */
export function roundDecimal(value: string, scale: number): string {
  const match = DECIMAL.exec(value.trim())
  if (!match) return value
  const [, sign, whole = '', fraction = ''] = match
  const padded = fraction.padEnd(scale + 1, '0')
  // The digits up to `scale` places, as one integer; the next one decides
  let scaled = BigInt(`${whole || '0'}${padded.slice(0, scale)}`)
  if (Number(padded[scale]) >= 5) scaled += 1n
  const text = scaled.toString().padStart(scale + 1, '0')
  const result = scale > 0 ? `${text.slice(0, -scale)}.${text.slice(-scale)}` : text
  return sign && /[1-9]/.test(result) ? `-${result}` : result
}

/**
 * A database result as an exact decimal string: `null` (no rows) is 0,
 * numbers are written out plainly, and `scale` (when given) rounds or
 * pads to that many places.
 */
export function decimalResult(value: unknown, scale: number | null): string {
  let text: string
  if (value === null || value === undefined || value === '') text = '0'
  else if (typeof value === 'number') text = plainNumber(value)
  else if (typeof value === 'bigint') text = value.toString()
  else text = String(value).trim()
  if (!DECIMAL.test(text)) return '0'
  return scale === null ? stripZeros(text) : roundDecimal(text, scale)
}

/** "12.000" → "12", "1.50" → "1.5" (for values with no fixed scale) */
function stripZeros(value: string): string {
  if (!value.includes('.')) return value
  return value.replace(/\.?0+$/, '') || '0'
}

/**
 * The sum of decimal strings, exactly, at the widest scale among them
 */
export function addDecimals(values: string[]): string {
  const scale = Math.max(0, ...values.map((value) => value.split('.')[1]?.length ?? 0))
  let total = 0n
  for (const value of values) {
    const match = DECIMAL.exec(value)
    if (!match) continue
    const [, sign, whole = '', fraction = ''] = match
    const scaled = BigInt(`${whole || '0'}${fraction.padEnd(scale, '0')}`)
    total += sign ? -scaled : scaled
  }
  const negative = total < 0n
  const text = (negative ? -total : total).toString().padStart(scale + 1, '0')
  const result = scale > 0 ? `${text.slice(0, -scale)}.${text.slice(-scale)}` : text
  return negative ? `-${result}` : result
}
