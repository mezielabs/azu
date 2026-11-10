/*
|--------------------------------------------------------------------------
| HTTP limiters
|--------------------------------------------------------------------------
|
| The public demo (DEMO_MODE) limits write requests per IP address.
| start/kernel.ts adds this middleware only with DEMO_MODE on.
|
*/

import limiter from '@adonisjs/limiter/services/main'
import demo from '#config/demo'

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export const throttleWrites = limiter.define('demo_writes', ({ request }) => {
  if (!WRITES.has(request.method())) return limiter.noLimit()

  return limiter
    .allowRequests(demo.writeLimit.requests)
    .every(demo.writeLimit.every)
    .usingKey(`ip_${request.ip()}`)
    .limitExceeded((error) => {
      error.setMessage('Too many changes from your address. Wait a minute, then try again.')
    })
})
