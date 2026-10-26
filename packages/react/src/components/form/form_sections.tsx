import { useId, type ReactNode } from 'react'
import { formSections } from '@mezielabs/azu/shared'
import type { FormFieldSchema } from '@mezielabs/azu/types'

/** Shared grouping for resource, screen and action forms. Hidden fields are removed by the server. */
export function FormSections(props: {
  fields: FormFieldSchema[]
  children: (field: FormFieldSchema) => ReactNode
}) {
  const id = useId()
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
      {section.heading && <h2 id={`${id}-${index}`}>{section.heading}</h2>}
      <div className="azu-form-section-fields">{section.fields.map(props.children)}</div>
    </section>
  ))
}
