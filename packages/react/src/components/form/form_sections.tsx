import { useId, type ReactNode } from 'react'
import { formSections } from '@mezielabs/azu/shared'
import type { FormFieldSchema } from '@mezielabs/azu/types'

/**
 * Shared grouping for resource, screen and action forms. Hidden fields
 * are removed by the server. Headings are `h2` under the page's title,
 * or `h3` in an action dialog, whose title is its own heading.
 */
export function FormSections(props: {
  fields: FormFieldSchema[]
  /** The section headings' level: 2 on a page (the default), 3 in a dialog */
  level?: 2 | 3
  children: (field: FormFieldSchema) => ReactNode
}) {
  const id = useId()
  const Heading = props.level === 3 ? 'h3' : 'h2'
  const sections = formSections(props.fields)
  if (sections.every((section) => section.heading === null)) {
    return <>{props.fields.map(props.children)}</>
  }
  return sections.map((section, index) => (
    <section
      key={section.heading ?? ''}
      className="azu-form-section"
      aria-labelledby={section.heading ? `${id}-${index}` : undefined}
    >
      {section.heading && (
        <Heading id={`${id}-${index}`} className="azu-form-section-heading">
          {section.heading}
        </Heading>
      )}
      <div className="azu-form-section-fields">{section.fields.map(props.children)}</div>
    </section>
  ))
}
