import { useSyncExternalStore } from 'react'

type Toast = { id: number; message: string; tone: 'success' | 'error' }

/**
 * Toasts live outside React, so one shown just before an Inertia visit
 * (say, "Product saved" on the way to its detail page) survives the
 * page change.
 */
let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()
const DURATION = 5000

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function dismissToast(id: number) {
  toasts = toasts.filter((toast) => toast.id !== id)
  emit()
}

/**
 * Shows a message in Azu's toast region for five seconds.
 */
export function showToast(message: string, tone: Toast['tone'] = 'success') {
  const id = nextId++
  toasts = [...toasts, { id, message, tone }]
  emit()
  setTimeout(() => dismissToast(id), DURATION)
}

/**
 * Azu's own toast region (React Aria's toast isn't stable in 1.22). It's
 * rendered once, beside the Inertia app rather than inside a page, so
 * the live region is already in the DOM when a toast arrives and screen
 * readers announce it.
 */
export function ToastRegion() {
  const items = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => toasts
  )

  return (
    <div className="azu-toast-region" role="status" aria-live="polite">
      {items.map((toast) => (
        <div key={toast.id} className="azu-toast" data-azu-tone={toast.tone}>
          <span>{toast.message}</span>
          <button
            type="button"
            className="azu-toast-close"
            aria-label="Dismiss"
            onClick={() => dismissToast(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
