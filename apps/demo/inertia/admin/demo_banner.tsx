/**
 * The public demo's banner across the admin panel (DEMO_MODE). The admin
 * entry loads this file only when the server sets the `azu_demo` cookie,
 * so it adds nothing to the panel otherwise. It sits above Azu's root,
 * outside the pages, since Azu has no slot on every page.
 */
import './demo_banner.css'
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import DemoBanner from '~/components/demo_banner'
import { readDemoCookie } from '~/lib/demo_reset'

/**
 * Every response refreshes the cookie, Inertia visits included, so the
 * banner re-reads it and shows a reset that happened since the page loaded.
 */
function AdminDemoBanner() {
  const [demo, setDemo] = useState(() => readDemoCookie(document.cookie))
  useEffect(() => {
    const timer = setInterval(() => setDemo(readDemoCookie(document.cookie)), 30_000)
    return () => clearInterval(timer)
  }, [])

  if (!demo) return null
  return (
    <DemoBanner
      everyMinutes={demo.everyMinutes}
      lastResetAt={demo.lastResetAt}
      className="demo-admin-banner"
    />
  )
}

export function mountDemoBanner() {
  if (document.getElementById('demo-banner')) return

  const host = document.createElement('div')
  host.id = 'demo-banner'
  document.body.prepend(host)
  // The panel's sticky parts sit below the banner, however tall it wraps
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--demo-banner-height', `${host.offsetHeight}px`)
  }).observe(host)
  createRoot(host).render(<AdminDemoBanner />)
}
