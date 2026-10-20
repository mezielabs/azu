import { router } from '@inertiajs/react'
import {
  axisLabel,
  axisTicks,
  bucketAt,
  bucketLabels,
  compactValue,
  formatDecimal,
  niceTicks,
  trendShapes,
  type ChartBox,
} from '@mezielabs/azu/shared'
import type { WidgetData, WidgetSchema } from '@mezielabs/azu/types'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'

type Trend = Extract<WidgetData, { status: 'ok'; kind: 'trend' }>

const HEIGHT = 240
/** Room for the y-axis labels, the x-axis labels, and air on the right */
const AXIS_LEFT = 52
const AXIS_BOTTOM = 26
const RIGHT = 8
const TOP = 10

/** Roughly how wide a 11px axis label is */
const labelWidth = (text: string) => text.length * 6.6

/**
 * A trend widget's chart (FR-25): hand-written SVG, a line with a light
 * area under it or bars, and the previous period as a muted line.
 *
 * The plot is one tab stop: arrow keys move between buckets, Home and
 * End jump to the ends, Enter opens a bucket's filtered list. Hovering
 * does the same with the pointer. The SVG is an image whose label sums
 * the trend up, and "View as table" shows the numbers.
 */
export function TrendChart(props: { widget: WidgetSchema; data: Trend; timezone: string }) {
  const { widget, data, timezone } = props
  const id = useId()
  const plot = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [active, setActive] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)

  useEffect(() => {
    const element = plot.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [asTable])

  const values = data.buckets.map((bucket) => Number(bucket.value))
  const previous =
    data.previousTotal === null ? null : data.buckets.map((bucket) => Number(bucket.previous ?? 0))
  const labels = useMemo(
    () => bucketLabels(data.buckets, data.unit, timezone),
    [data.buckets, data.unit, timezone]
  )
  const format = (value: string) => formatDecimal(value, widget.format)
  const empty =
    values.every((value) => value === 0) && (previous ?? []).every((value) => value === 0)

  const ticks = niceTicks(Math.max(0, ...values, ...(previous ?? [])))
  const top = ticks.at(-1)!
  const box: ChartBox = {
    left: AXIS_LEFT,
    top: TOP,
    width: Math.max(40, width - AXIS_LEFT - RIGHT),
    height: HEIGHT - TOP - AXIS_BOTTOM,
  }
  const shapes = trendShapes(values, previous, box, top)
  const axis = data.buckets.map((bucket) => axisLabel(bucket, data.unit, timezone))
  const shown = axisTicks(data.buckets.length, box.width, Math.max(...axis.map(labelWidth), 0))

  const peak = values.indexOf(Math.max(...values))
  const summary = empty
    ? `${widget.label}: no ${data.noun} in this range`
    : `${widget.label}: ${format(data.total)} in total over ${data.buckets.length} ${data.unit}s; ` +
      `highest ${labels[peak]}, ${format(data.buckets[peak].value)}` +
      (data.previousTotal === null ? '' : `; previous period ${format(data.previousTotal)}`)

  const describe = (index: number) => {
    const bucket = data.buckets[index]
    const previousText =
      bucket.previous === null ? '' : `, previous period ${format(bucket.previous)}`
    return `${labels[index]}: ${format(bucket.value)}${previousText}`
  }

  function open(index: number | null) {
    const href = index === null ? null : data.buckets[index].href
    if (href) router.visit(href)
  }

  function onKeyDown(event: KeyboardEvent) {
    const last = data.buckets.length - 1
    const current = active ?? last
    const moves: Record<string, number> = {
      ArrowLeft: Math.max(0, current - 1),
      ArrowRight: Math.min(last, current + 1),
      Home: 0,
      End: last,
    }
    if (event.key in moves) {
      event.preventDefault()
      setActive(moves[event.key])
    } else if (event.key === 'Enter') {
      open(active)
    } else if (event.key === 'Escape') {
      setActive(null)
    }
  }

  const tooltipLeft =
    active === null ? 0 : Math.min(Math.max(shapes.x[active], 90), Math.max(90, width - 90))

  return (
    <div className="azu-trend" data-azu-chart={data.chart}>
      <div className="azu-trend-toolbar">
        {previous && (
          <ul className="azu-trend-legend" aria-label="Legend">
            <li data-azu-series="current">This period</li>
            <li data-azu-series="previous">Previous period</li>
          </ul>
        )}
        <button
          type="button"
          className="azu-button azu-trend-toggle"
          aria-pressed={asTable}
          onClick={() => setAsTable((value) => !value)}
        >
          View as table
        </button>
      </div>

      {asTable ? (
        <div className="azu-trend-table-wrap">
          <table className="azu-trend-table">
            <caption className="azu-visually-hidden">{widget.label}</caption>
            <thead>
              <tr>
                <th scope="col">
                  {data.unit === 'hour'
                    ? 'Hour'
                    : data.unit === 'day'
                      ? 'Day'
                      : data.unit === 'week'
                        ? 'Week'
                        : 'Month'}
                </th>
                <th scope="col">{previous ? 'This period' : widget.label}</th>
                {previous && <th scope="col">Previous period</th>}
              </tr>
            </thead>
            <tbody>
              {data.buckets.map((bucket, index) => (
                <tr key={bucket.start}>
                  <th scope="row">{labels[index]}</th>
                  <td>{format(bucket.value)}</td>
                  {previous && <td>{format(bucket.previous ?? '0')}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={plot}
          className="azu-trend-plot"
          tabIndex={0}
          role="group"
          aria-roledescription="chart"
          aria-label={`${widget.label}. Arrow keys move between ${data.unit}s${data.buckets.some((bucket) => bucket.href) ? '; Enter opens one' : ''}`}
          aria-describedby={`${id}-active`}
          data-azu-linked={data.buckets.some((bucket) => bucket.href) || undefined}
          onKeyDown={onKeyDown}
          onFocus={() => setActive((current) => current ?? data.buckets.length - 1)}
          onBlur={() => setActive(null)}
          onPointerMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect()
            setActive(bucketAt(event.clientX - bounds.left, box, data.buckets.length))
          }}
          onPointerLeave={() => setActive(null)}
          onClick={() => open(active)}
        >
          <svg
            role="img"
            aria-label={summary}
            width={width}
            height={HEIGHT}
            className="azu-trend-svg"
          >
            {/* Recessive gridlines and the y axis's labels */}
            {ticks.map((tick) => {
              const y = shapes.base - (top > 0 ? (tick / top) * box.height : 0)
              return (
                <g key={tick}>
                  <line
                    className={tick === 0 ? 'azu-trend-baseline' : 'azu-trend-grid'}
                    x1={box.left}
                    x2={box.left + box.width}
                    y1={y}
                    y2={y}
                  />
                  <text
                    className="azu-trend-axis"
                    x={box.left - 8}
                    y={y}
                    dy="0.32em"
                    textAnchor="end"
                  >
                    {compactValue(tick, widget.format)}
                  </text>
                </g>
              )
            })}

            {shapes.previous && (
              <path className="azu-trend-previous" d={shapes.previous} fill="none" />
            )}
            {data.chart === 'bars' ? (
              shapes.bars.map((bar, index) =>
                bar ? (
                  <path
                    key={data.buckets[index].start}
                    className="azu-trend-bar"
                    data-azu-active={active === index || undefined}
                    d={bar}
                  />
                ) : null
              )
            ) : (
              <>
                {shapes.area && <path className="azu-trend-area" d={shapes.area} />}
                <path className="azu-trend-line" d={shapes.line} fill="none" />
                {values.length === 1 && (
                  <circle className="azu-trend-dot" cx={shapes.x[0]} cy={shapes.y[0]} r={3} />
                )}
              </>
            )}

            {/* The crosshair on the active bucket */}
            {active !== null && (
              <g className="azu-trend-crosshair">
                <line x1={shapes.x[active]} x2={shapes.x[active]} y1={box.top} y2={shapes.base} />
                {data.chart === 'line' && (
                  <circle cx={shapes.x[active]} cy={shapes.y[active]} r={4} />
                )}
              </g>
            )}

            {shown.map((index) => {
              const anchor =
                index === 0 ? 'start' : index === data.buckets.length - 1 ? 'end' : 'middle'
              const x =
                anchor === 'start'
                  ? box.left
                  : anchor === 'end'
                    ? box.left + box.width
                    : shapes.x[index]
              return (
                <text
                  key={data.buckets[index].start}
                  className="azu-trend-axis azu-trend-x"
                  x={x}
                  y={HEIGHT - 6}
                  textAnchor={anchor}
                >
                  {axis[index]}
                </text>
              )
            })}
          </svg>

          {active !== null && (
            <div className="azu-trend-tooltip" style={{ left: tooltipLeft }} aria-hidden="true">
              <span className="azu-trend-tooltip-label">{labels[active]}</span>
              <strong>{format(data.buckets[active].value)}</strong>
              {data.buckets[active].previous !== null && (
                <span>Previous: {format(data.buckets[active].previous!)}</span>
              )}
            </div>
          )}
          <p id={`${id}-active`} className="azu-visually-hidden" aria-live="polite">
            {active === null ? '' : describe(active)}
          </p>
        </div>
      )}

      {empty && <p className="azu-widget-empty azu-trend-empty">No {data.noun} in this range</p>}
    </div>
  )
}
