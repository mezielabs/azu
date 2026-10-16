import type { SlotName, SlotProps } from '@mezielabs/azu/types'
import { useComponent } from './registry.tsx'

/**
 * A named place on a resource page (FR-15). It renders the app
 * component the resource names for it (`slots: { beforeTable:
 * 'LowStockNotice' }`), registered from `inertia/admin/components`, with
 * `SlotProps`. Nothing when the resource names none.
 * `node ace admin:doctor` reports a name with no registered component.
 */
export function Slot(props: SlotProps & { name: SlotName }) {
  const { name, ...slot } = props
  const Component = useComponent(slot.resource.slots[name] ?? undefined)
  if (!Component) return null
  return (
    <div className="azu-slot" data-azu-slot={name}>
      <Component {...slot} />
    </div>
  )
}
