import type { Figure } from '@mezielabs/azu/shared'
import { Fragment } from 'react'

/**
 * Intl puts a no-break space after a currency code ("NGN 1,234…"), so a
 * long figure could only wrap by splitting its digits: allow a break
 * there first. The text stays the same.
 */
function Breakable(props: { text: string }) {
  const parts = props.text.split('\u00a0')
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <>
              {'\u00a0'}
              <wbr />
            </>
          )}
          {part}
        </Fragment>
      ))}
    </>
  )
}

/**
 * A widget figure's text (U01). An abbreviated one ("NGN 4.28M") is
 * hidden from screen readers, which read the exact figure beside it
 * instead; the element around it carries the exact figure as its title
 * (see `figureTitle`).
 */
export function FigureText(props: { figure: Figure }) {
  const { figure } = props
  if (!figure.compact) return <Breakable text={figure.text} />
  return (
    <>
      <span aria-hidden="true">
        <Breakable text={figure.text} />
      </span>
      <span className="azu-visually-hidden">{figure.exact}</span>
    </>
  )
}

/** The tooltip for an abbreviated figure: the exact one */
export function figureTitle(figure: Figure): string | undefined {
  return figure.compact ? figure.exact : undefined
}
