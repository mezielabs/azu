import { lazy, Suspense } from 'react'
import type { AzuSharedProps, ScreenSchema, WidgetSchema } from '@mezielabs/azu/types'

const WidgetGrid = lazy(() => import('./widget_grid.tsx'))

/**
 * A widgets screen's widgets (FR-24), in a grid of cards. Loaded on
 * first use, so other screens don't carry the widgets' code.
 */
export function ScreenWidgets(props: {
  azu: AzuSharedProps['azu']
  screen: ScreenSchema
  widgets: WidgetSchema[]
}) {
  return (
    <Suspense fallback={<div className="azu-widgets" aria-busy="true" />}>
      <WidgetGrid {...props} />
    </Suspense>
  )
}
