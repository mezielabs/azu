import { lazy, Suspense } from 'react'
import type { AzuSharedProps, FormErrors, ScreenFormData, ScreenSchema } from '@mezielabs/azu/types'

const ResourceForm = lazy(async () => ({
  default: (await import('./resource_form.tsx')).ResourceForm,
}))

/**
 * A form screen's form (FR-23): Azu's resource form, submitting with
 * PUT to the screen's own URL, with a single "Save changes" button and
 * no Cancel. Loaded on first use, so component screens don't carry the
 * form's code.
 */
export function ScreenForm(props: {
  azu: AzuSharedProps['azu']
  screen: ScreenSchema
  form: ScreenFormData
  errors: FormErrors
}) {
  const { azu, screen, form, errors } = props
  return (
    <Suspense fallback={<div className="azu-slot-loading" aria-busy="true" />}>
      <ResourceForm
        form={form}
        errors={errors}
        action={`${azu.path}/screens/${screen.name}`}
        method="put"
        timezone={azu.timezone}
        submitLabel="Save changes"
        successMessage={form.successMessage}
      />
    </Suspense>
  )
}
