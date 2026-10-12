/**
 * SPIKE: a component swap. `column.text('sku').component('SkuBadge')`
 * resolves to this file by name.
 */
export default function SkuBadge({ value }: { value: unknown }) {
  return (
    <code
      className="rounded bg-azu-subtle px-1.5 py-0.5 font-mono text-xs"
      data-azu-component="SkuBadge"
    >
      {String(value)}
    </code>
  )
}
