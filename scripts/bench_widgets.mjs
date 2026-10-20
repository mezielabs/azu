/**
 * Times each of a widgets screen's widgets (FR-24) against the target:
 * under 100 ms at p95 per widget on Postgres.
 *
 * Signs in, reads the screen's widgets from its page, then sends
 * sequential partial reloads of each widget's prop, one range at a
 * time, as the client does after a range switch.
 *
 * Usage: node scripts/bench_widgets.mjs [baseUrl] [requestsPerScenario] [screenPath]
 * (credentials: scripts/bench_client.mjs)
 */
import { signIn, time } from './bench_client.mjs'

const base = process.argv[2] ?? 'http://localhost:3333'
const runs = Number(process.argv[3] ?? 100)
const screen = process.argv[4] ?? '/admin'
const TARGET = 100
const { request, inertia } = await signIn(base)

const page = await (await request(screen, { headers: inertia })).json()
const { widgets, ranges } = page.props
if (!widgets) {
  console.error(`${screen} isn't a widgets screen`)
  process.exit(1)
}

console.log(`${runs} sequential requests per widget and range against ${base}${screen}\n`)
console.log('p50 ms   p95 ms   p99 ms   widget')
let worst = 0
for (const range of ranges) {
  for (const widget of widgets) {
    const headers = {
      ...inertia,
      'x-inertia-partial-component': 'azu/screen',
      'x-inertia-partial-data': widget.key,
    }
    const label = `${widget.label} (${widget.kind}), ${range}`
    const [p50, p95, p99] = await time(request, `${screen}?range=${range}`, headers, runs, label)
    worst = Math.max(worst, p95)
    console.log(
      `${p50.toFixed(1).padStart(6)}   ${p95.toFixed(1).padStart(6)}   ${p99.toFixed(1).padStart(6)}   ${label}`
    )
  }
}
console.log(`\nWorst p95: ${worst.toFixed(1)} ms (target: under ${TARGET} ms per widget)`)
process.exit(worst < TARGET ? 0 : 1)
