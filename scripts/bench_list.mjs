/**
 * Times the admin list screen against spec §2's target: list page
 * server response under 200 ms at p95, 25 per page.
 *
 * Signs in through the app's login form, then sends sequential requests
 * per scenario and reports p50, p95 and p99 server response times.
 *
 * Usage: node scripts/bench_list.mjs [baseUrl] [requestsPerScenario]
 * Credentials default to the demo seeder's admin; override with
 * BENCH_EMAIL and BENCH_PASSWORD.
 */
const base = process.argv[2] ?? 'http://localhost:3333'
const runs = Number(process.argv[3] ?? 200)
const email = process.env.BENCH_EMAIL ?? 'admin@azu.test'
const password = process.env.BENCH_PASSWORD ?? 'password'

const jar = new Map()
function remember(response) {
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(';')
    const [name, ...value] = pair.split('=')
    jar.set(name, value.join('='))
  }
}
const cookieHeader = () => [...jar].map(([name, value]) => `${name}=${value}`).join('; ')

async function request(path, init = {}) {
  const response = await fetch(base + path, {
    redirect: 'manual',
    ...init,
    headers: { cookie: cookieHeader(), ...init.headers },
  })
  remember(response)
  return response
}

// Sign in: Shield checks the XSRF cookie against the X-XSRF-TOKEN header
remember(await fetch(`${base}/login`))
const login = await request('/login', {
  method: 'POST',
  headers: {
    'content-type': 'application/x-www-form-urlencoded',
    'x-xsrf-token': decodeURIComponent(jar.get('XSRF-TOKEN') ?? ''),
  },
  body: new URLSearchParams({ email, password }),
})
const check = await request('/admin', {
  headers: { 'x-inertia': 'true', 'x-inertia-version': '1' },
})
if (check.status !== 200 && check.status !== 409) {
  console.error(`Sign-in failed (login ${login.status}, /admin ${check.status})`)
  process.exit(1)
}
const version = (await check.json().catch(() => ({})))?.version ?? '1'
const inertia = { 'x-inertia': 'true', 'x-inertia-version': String(version) }
const partial = {
  ...inertia,
  'x-inertia-partial-component': 'azu/resource/index',
  'x-inertia-partial-data': 'list',
}

const path = '/admin/resources/products'
const scenarios = [
  ['first page, default order (Inertia visit)', `${path}`, inertia],
  ['first page, full HTML load', `${path}`, {}],
  ['sort by price, descending (partial reload)', `${path}?sort=price&direction=desc`, partial],
  ['sort by name (partial reload)', `${path}?sort=name&direction=asc`, partial],
  ['search "product 09999", 101 matches (partial reload)', `${path}?search=product+09999`, partial],
  ['search "product 1", ~11,000 matches (partial reload)', `${path}?search=product+1`, partial],
  ['search "product", matches every row (partial reload)', `${path}?search=product`, partial],
  ['page 2,000 of 4,000 (partial reload)', `${path}?page=2000`, partial],
  ['100 per page (partial reload)', `${path}?perPage=100`, partial],
]

const percentile = (sorted, p) =>
  sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]

console.log(`${runs} sequential requests per scenario against ${base}\n`)
console.log('p50 ms   p95 ms   p99 ms   scenario')
let worst = 0
for (const [label, url, headers] of scenarios) {
  for (let i = 0; i < 10; i++) await (await request(url, { headers })).arrayBuffer()
  const times = []
  for (let i = 0; i < runs; i++) {
    const started = performance.now()
    const response = await request(url, { headers })
    await response.arrayBuffer()
    times.push(performance.now() - started)
    if (response.status !== 200) {
      console.error(`${label}: HTTP ${response.status}`)
      process.exit(1)
    }
  }
  times.sort((a, b) => a - b)
  const [p50, p95, p99] = [50, 95, 99].map((p) => percentile(times, p))
  worst = Math.max(worst, p95)
  console.log(
    `${p50.toFixed(1).padStart(6)}   ${p95.toFixed(1).padStart(6)}   ${p99.toFixed(1).padStart(6)}   ${label}`
  )
}
console.log(`\nWorst p95: ${worst.toFixed(1)} ms (target: under 200 ms)`)
process.exit(worst < 200 ? 0 : 1)
