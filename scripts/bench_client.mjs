/**
 * What the benchmarks share: signing in to the demo through its login
 * form, requests with the session's cookies, and percentiles.
 *
 * Credentials default to the demo seeder's admin; override with
 * BENCH_EMAIL and BENCH_PASSWORD.
 */
export async function signIn(base) {
  const email = process.env.BENCH_EMAIL ?? 'admin@azu.test'
  const password = process.env.BENCH_PASSWORD ?? 'password'
  const jar = new Map()
  const remember = (response) => {
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
  return { request, inertia: { 'x-inertia': 'true', 'x-inertia-version': String(version) } }
}

export const percentile = (sorted, p) =>
  sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]

/**
 * Times `runs` sequential requests after 10 warm-up ones, failing on
 * anything but a 200. Returns [p50, p95, p99] in milliseconds.
 */
export async function time(request, url, headers, runs, label) {
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
  return [50, 95, 99].map((p) => percentile(times, p))
}
