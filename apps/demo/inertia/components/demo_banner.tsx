import { useEffect, useState } from 'react'
import { demoResetMessage } from '~/lib/demo_reset'

/**
 * "This demo resets every hour. Last reset N minutes ago." The public
 * demo (DEMO_MODE) shows it on the login page and across the admin
 * panel. It updates every 30 seconds.
 */
export default function DemoBanner({
  everyMinutes,
  lastResetAt,
  className = 'demo-banner',
}: {
  everyMinutes: number
  lastResetAt: string | null
  className?: string
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <p className={className} role="status" data-demo-banner>
      {demoResetMessage(everyMinutes, lastResetAt, now)}
    </p>
  )
}
