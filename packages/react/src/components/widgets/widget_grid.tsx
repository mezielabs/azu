import { Deferred, Link, usePage } from '@inertiajs/react'
import {
  comparisonText,
  formatDecimal,
  percentOf,
  timeLeft,
  type ListState,
} from '@mezielabs/azu/shared'
import type { AzuSharedProps, ScreenSchema, WidgetData, WidgetSchema } from '@mezielabs/azu/types'
import type { ReactNode } from 'react'
import { DataTable } from '../list/data_table.tsx'

type Ok<Kind extends string> = Extract<WidgetData, { status: 'ok'; kind: Kind }>

const TABLE_STATE: ListState = {
  page: 1,
  perPage: 10,
  sort: null,
  direction: 'asc',
  search: '',
  filters: {},
}

/**
 * A widgets screen's grid (FR-24): one card per widget, each loading
 * on its own. A placeholder shows until its data arrives, and while a
 * range switch reloads it.
 */
export default function WidgetGrid(props: {
  azu: AzuSharedProps['azu']
  screen: ScreenSchema
  widgets: WidgetSchema[]
}) {
  if (props.widgets.length === 0) {
    return (
      <div className="azu-empty">
        <p>There's nothing on this screen you have access to.</p>
      </div>
    )
  }
  return (
    <div className="azu-widgets-area">
      <div className="azu-widgets" data-azu-screen={props.screen.name}>
        {props.widgets.map((widget) => (
          <Deferred
            key={widget.key}
            data={widget.key}
            fallback={() => <WidgetCard widget={widget} loading />}
          >
            {({ reloading }) => (
              <LoadedWidget azu={props.azu} widget={widget} reloading={reloading} />
            )}
          </Deferred>
        ))}
      </div>
    </div>
  )
}

function LoadedWidget(props: {
  azu: AzuSharedProps['azu']
  widget: WidgetSchema
  reloading: boolean
}) {
  const data = usePage().props[props.widget.key] as WidgetData | undefined
  return (
    <WidgetCard widget={props.widget} loading={props.reloading} data={data}>
      {data?.status === 'ok' && <WidgetBody azu={props.azu} widget={props.widget} data={data} />}
    </WidgetCard>
  )
}

/**
 * A widget's card: its label, then its body, a placeholder while it
 * loads, or "Couldn't load this" when it failed on the server.
 */
function WidgetCard(props: {
  widget: WidgetSchema
  loading: boolean
  data?: WidgetData
  children?: ReactNode
}) {
  const { widget, data } = props
  const id = `azu-${widget.key}-label`
  const href = data?.status === 'ok' && 'href' in data && widget.kind === 'value' ? data.href : null
  const aside = data?.status === 'ok' ? cardAside(data) : null
  return (
    <section
      className="azu-widget"
      data-azu-widget={widget.kind}
      data-azu-width={widget.width}
      data-azu-state={data?.status === 'error' ? 'error' : props.loading ? 'loading' : 'ready'}
      aria-labelledby={id}
      aria-busy={props.loading || undefined}
    >
      <div className="azu-widget-header">
        <h2 id={id} className="azu-widget-label">
          {href ? (
            // Stretched over the card, so the whole card opens the list
            <Link href={href} className="azu-widget-link">
              {widget.label}
            </Link>
          ) : (
            widget.label
          )}
        </h2>
        {aside}
      </div>
      {widget.note && <p className="azu-widget-note">{widget.note}</p>}
      {data?.status === 'error' ? (
        <p className="azu-widget-error" role="status">
          Couldn't load this
        </p>
      ) : data === undefined ? (
        <div className="azu-widget-placeholder" aria-hidden="true" data-azu-kind={widget.kind} />
      ) : (
        props.children
      )}
      {props.loading && data === undefined && (
        <span className="azu-visually-hidden">Loading {widget.label}</span>
      )}
    </section>
  )
}

/** What sits beside a card's label: "386 orders", "12 days left", "View all" */
function cardAside(data: Extract<WidgetData, { status: 'ok' }>): ReactNode {
  if (data.kind === 'progress') {
    return <span className="azu-widget-aside">{timeLeft(data.remaining)}</span>
  }
  if (data.kind === 'partition' && data.unit) {
    const count = formatDecimal(data.total, null)
    return (
      <span className="azu-widget-aside">
        {count} {data.total === '1' ? data.unit.one : data.unit.other}
      </span>
    )
  }
  if (data.kind === 'table' && data.href) {
    return (
      <Link href={data.href} className="azu-widget-more">
        View all {data.total > 0 ? data.total : ''}
      </Link>
    )
  }
  return null
}

function WidgetBody(props: {
  azu: AzuSharedProps['azu']
  widget: WidgetSchema
  data: Extract<WidgetData, { status: 'ok' }>
}) {
  const { data, widget } = props
  switch (data.kind) {
    case 'value':
      return <ValueBody widget={widget} data={data} />
    case 'progress':
      return <ProgressBody widget={widget} data={data} />
    case 'partition':
      return <PartitionBody widget={widget} data={data} />
    case 'table':
      return <TableBody azu={props.azu} widget={widget} data={data} />
  }
}

function ValueBody(props: { widget: WidgetSchema; data: Ok<'value'> }) {
  const { widget, data } = props
  const { comparison } = data
  const previous = data.previous === null ? '' : formatDecimal(data.previous, widget.format)
  return (
    <>
      <p className="azu-widget-figure">{formatDecimal(data.value, widget.format)}</p>
      {comparison && (
        <p
          className="azu-widget-delta"
          data-azu-direction={comparison.kind === 'change' ? comparison.direction : 'none'}
        >
          {comparison.kind === 'change' ? (
            <>
              <span className="azu-widget-change">
                <span aria-hidden="true">{comparison.direction === 'up' ? '▲' : '▼'}</span>
                <span className="azu-visually-hidden">
                  {comparison.direction === 'up' ? 'Up' : 'Down'}
                </span>{' '}
                {comparison.percent}
              </span>{' '}
              from {previous}
            </>
          ) : (
            <span className="azu-widget-change">{comparisonText(comparison, previous)}</span>
          )}
        </p>
      )}
    </>
  )
}

function ProgressBody(props: { widget: WidgetSchema; data: Ok<'progress'> }) {
  const { widget, data } = props
  const reached = percentOf(data.share)
  const pace = percentOf(data.pace)
  const value = formatDecimal(data.value, widget.format)
  const goal = formatDecimal(data.goal, widget.format)
  return (
    <>
      <p className="azu-widget-progress-figures">
        <span className="azu-widget-progress-value">{value}</span> <span>of {goal}</span>
      </p>
      <div
        className="azu-progress"
        role="progressbar"
        aria-label={widget.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.round(data.share * 100))}
        aria-valuetext={`${reached} of ${goal}, ${data.period}`}
      >
        <span
          className="azu-progress-fill"
          style={{ width: `${Math.min(1, data.share) * 100}%` }}
        />
        <span
          className="azu-progress-pace"
          aria-hidden="true"
          style={{ left: `${data.pace * 100}%` }}
        />
      </div>
      <p className="azu-widget-progress-text">
        {reached} reached · on pace would be {pace}
        <span className="azu-widget-period"> · {data.period}</span>
      </p>
    </>
  )
}

function PartitionBody(props: { widget: WidgetSchema; data: Ok<'partition'> }) {
  const { widget, data } = props
  if (data.rows.length === 0) return <p className="azu-widget-empty">Nothing in this range</p>
  return (
    <ul className="azu-partition">
      {data.rows.map((row) => {
        const value = formatDecimal(row.value, widget.format)
        const unit = data.unit ? (row.value === '1' ? data.unit.one : data.unit.other) : ''
        // Named by its content, with words a screen reader needs and the
        // eye doesn't: "Paid: 3 orders, 33%. Show them"
        const hidden = (text: string) => <span className="azu-visually-hidden">{text}</span>
        const content = (
          <>
            <span className="azu-partition-label">
              {row.label}
              {hidden(': ')}
            </span>
            <span className="azu-partition-bar" aria-hidden="true">
              <span style={{ width: `${row.share * 100}%` }} />
            </span>
            <span className="azu-partition-value">
              <strong>{value}</strong>
              {hidden(unit ? ` ${unit}, ` : ', ')} <span>{percentOf(row.percent)}</span>
              {row.href && hidden('. Show them')}
            </span>
          </>
        )
        return (
          <li key={row.key ?? `other-${row.label}`}>
            {row.href ? (
              <Link href={row.href} className="azu-partition-row">
                {content}
              </Link>
            ) : (
              <div className="azu-partition-row">{content}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function TableBody(props: { azu: AzuSharedProps['azu']; widget: WidgetSchema; data: Ok<'table'> }) {
  const { azu, widget, data } = props
  return (
    <div className="azu-widget-table">
      <DataTable
        label={widget.label}
        columns={data.columns}
        titleColumn={data.titleColumn}
        rows={data.rows}
        state={TABLE_STATE}
        timezone={azu.timezone}
        onSort={() => {}}
        selectable={false}
        emptyState={<p className="azu-widget-empty">Nothing to show</p>}
        rowHref={(row) =>
          row.abilities.view
            ? `${azu.path}/resources/${data.resource}/${encodeURIComponent(String(row.id))}`
            : undefined
        }
      />
    </div>
  )
}
