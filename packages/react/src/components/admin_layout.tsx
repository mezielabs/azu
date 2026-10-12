import { Link } from '@inertiajs/react'
import type { ReactNode } from 'react'

export function AdminLayout(props: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-azu-surface text-azu-text">
      <header className="flex items-center gap-4 border-b border-azu-border px-6 py-3">
        <Link href="/admin" className="font-semibold text-azu-brand">
          Azu
        </Link>
        <span className="text-sm text-azu-muted">{props.title}</span>
      </header>
      <main className="p-6">{props.children}</main>
    </div>
  )
}
