import { useMemo, type ReactNode } from 'react'
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  DateInput,
  DatePicker,
  DateSegment,
  Dialog,
  FieldError,
  Group,
  Heading,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  NumberField,
  Popover,
  Radio,
  RadioGroup,
  Select,
  SelectValue,
  Switch,
  Text,
  TextArea,
  TextField,
} from 'react-aria-components'
import type { CalendarDate, ZonedDateTime } from '@internationalized/date'
import type { FieldValue, FormFieldSchema } from '@mezielabs/azu/types'
import {
  fromCalendarDate,
  fromZonedDateTime,
  toCalendarDate,
  toZonedDateTime,
  zonedPlaceholder,
} from './date_values.ts'

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ')

/**
 * The value selects and radios use for "no value", since React Aria
 * keys can't be null.
 */
const NONE = '__azu_none__'

/**
 * Selects with this many options or fewer render as radios (spec §5).
 */
const RADIO_LIMIT = 4

export type ControlProps = {
  field: FormFieldSchema
  value: FieldValue
  onChange: (value: FieldValue) => void
  errors: string[]
  timezone: string
}

function FieldLabel({ field }: { field: FormFieldSchema }) {
  return (
    <Label className="azu-label">
      {field.label}
      {field.required && (
        <span className="azu-required" aria-hidden>
          {' '}
          *
        </span>
      )}
    </Label>
  )
}

/**
 * The limits the form knows about, in words. They come from the
 * validator or from explicit field hints; the server enforces them.
 */
function limits(field: FormFieldSchema): string | null {
  const { minLength, maxLength, min, max } = field
  if (minLength !== null && maxLength !== null) {
    return `${minLength} to ${maxLength} characters`
  }
  if (maxLength !== null) return `Up to ${maxLength} characters`
  if (minLength !== null) return `At least ${minLength} characters`
  if (min !== null && max !== null) return `Between ${min} and ${max}`
  if (min !== null) return `At least ${min}`
  if (max !== null) return `At most ${max}`
  return null
}

function Description({ field }: { field: FormFieldSchema }) {
  const text = [field.help, limits(field)].filter(Boolean).join('. ')
  if (!text) return null
  return (
    <Text slot="description" className="azu-description">
      {text}
    </Text>
  )
}

function Errors({ errors }: { errors: string[] }) {
  return (
    <FieldError className="azu-field-error">
      {errors.map((message, index) => (
        <span key={index} className="azu-field-error-message">
          {message}
        </span>
      ))}
    </FieldError>
  )
}

/**
 * Props every React Aria field gets. Validation is `aria`: the browser
 * never blocks a submit, because the server's validator decides.
 */
function common({ field, errors }: ControlProps) {
  return {
    'name': field.name,
    'className': 'azu-field',
    'data-azu-field': field.name,
    'isRequired': field.required,
    'isInvalid': errors.length > 0,
    'isReadOnly': field.readOnly,
    'validationBehavior': 'aria' as const,
  }
}

function Affix({ children }: { children: string | null }) {
  return children ? <span className="azu-affix">{children}</span> : null
}

export function TextControl(props: ControlProps & { multiline?: boolean; decimal?: boolean }) {
  const { field, value, onChange, errors } = props
  const input = props.multiline ? (
    <TextArea className="azu-input azu-textarea" placeholder={field.placeholder ?? undefined} />
  ) : (
    <div className="azu-input-group">
      <Affix>{field.prefix}</Affix>
      <Input
        className="azu-input"
        placeholder={field.placeholder ?? undefined}
        inputMode={props.decimal ? 'decimal' : undefined}
      />
      <Affix>{field.suffix}</Affix>
    </div>
  )

  return (
    <TextField
      {...common(props)}
      value={value === null ? '' : String(value)}
      // Empty means no value, whatever the app's bodyparser does with ""
      onChange={(next) => onChange(next === '' ? null : next)}
      minLength={field.minLength ?? undefined}
      maxLength={field.maxLength ?? undefined}
    >
      <FieldLabel field={field} />
      {input}
      <Description field={field} />
      <Errors errors={errors} />
    </TextField>
  )
}

function toNumber(value: number | string | null) {
  if (value === null) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

export function NumberControl(props: ControlProps) {
  const { field, value, onChange, errors } = props
  return (
    <NumberField
      {...common(props)}
      value={typeof value === 'number' ? value : Number.NaN}
      onChange={(next) => onChange(Number.isNaN(next) ? null : next)}
      minValue={toNumber(field.min)}
      maxValue={toNumber(field.max)}
      step={toNumber(field.step)}
      formatOptions={{ useGrouping: false, maximumFractionDigits: 20 }}
    >
      <FieldLabel field={field} />
      <Group className="azu-input-group">
        <Input className="azu-input" placeholder={field.placeholder ?? undefined} />
      </Group>
      <Description field={field} />
      <Errors errors={errors} />
    </NumberField>
  )
}

export function BooleanControl(props: ControlProps) {
  const { field, value, onChange, errors } = props
  const errorId = `azu-${field.name}-error`
  return (
    <div className="azu-field" data-azu-field={field.name}>
      <Switch
        name={field.name}
        className="azu-switch"
        isSelected={Boolean(value)}
        onChange={onChange}
        isReadOnly={field.readOnly}
        aria-describedby={errors.length > 0 ? errorId : undefined}
      >
        {({ isSelected, isFocusVisible }) => (
          <>
            <span
              className={cx(
                'azu-switch-track',
                isSelected && 'azu-is-selected',
                isFocusVisible && 'azu-is-focused'
              )}
              aria-hidden
            >
              <span className="azu-switch-thumb" />
            </span>
            <span className="azu-label">{field.label}</span>
          </>
        )}
      </Switch>
      {field.help && <p className="azu-description">{field.help}</p>}
      {errors.length > 0 && (
        <p id={errorId} className="azu-field-error">
          {errors.join(' ')}
        </p>
      )}
    </div>
  )
}

function choices(field: FormFieldSchema): [string, string][] {
  const options: [string, string][] = Object.entries(field.options ?? {})
  return field.required ? options : [[NONE, 'None'], ...options]
}

export function SelectControl(props: ControlProps) {
  const { field, value, onChange, errors } = props
  const options = choices(field)
  const selected = value === null ? (field.required ? null : NONE) : String(value)
  const change = (next: string | number | null) =>
    onChange(next === null || next === NONE ? null : String(next))

  if (Object.keys(field.options ?? {}).length <= RADIO_LIMIT) {
    return (
      <RadioGroup {...common(props)} value={selected} onChange={change}>
        <FieldLabel field={field} />
        <div className="azu-radios">
          {options.map(([option, label]) => (
            <Radio key={option} value={option} className="azu-radio">
              {({ isSelected, isFocusVisible }) => (
                <>
                  <span
                    className={cx(
                      'azu-radio-dot',
                      isSelected && 'azu-is-selected',
                      isFocusVisible && 'azu-is-focused'
                    )}
                    aria-hidden
                  />
                  {label}
                </>
              )}
            </Radio>
          ))}
        </div>
        <Description field={field} />
        <Errors errors={errors} />
      </RadioGroup>
    )
  }

  return (
    <Select
      {...common(props)}
      selectedKey={selected}
      onSelectionChange={(key) => change(key as string | null)}
      placeholder={field.placeholder ?? 'Select…'}
    >
      <FieldLabel field={field} />
      <Button className="azu-input azu-select-button">
        <SelectValue />
        <span aria-hidden>▾</span>
      </Button>
      <Description field={field} />
      <Errors errors={errors} />
      <Popover className="azu-popover">
        <ListBox className="azu-listbox">
          {options.map(([option, label]) => (
            <ListBoxItem
              key={option}
              id={option}
              className={({ isFocused, isSelected }) =>
                cx('azu-option', isFocused && 'azu-is-focused', isSelected && 'azu-is-selected')
              }
            >
              {label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  )
}

function CalendarPopover() {
  return (
    <Popover className="azu-popover">
      <Dialog className="azu-calendar-dialog" aria-label="Calendar">
        <Calendar className="azu-calendar">
          <header className="azu-calendar-header">
            <Button slot="previous" className="azu-button" aria-label="Previous month">
              ‹
            </Button>
            <Heading className="azu-calendar-heading" />
            <Button slot="next" className="azu-button" aria-label="Next month">
              ›
            </Button>
          </header>
          <CalendarGrid className="azu-calendar-grid">
            {(date) => (
              <CalendarCell
                date={date}
                className={({ isSelected, isFocusVisible, isOutsideMonth }) =>
                  cx(
                    'azu-calendar-cell',
                    isSelected && 'azu-is-selected',
                    isFocusVisible && 'azu-is-focused',
                    isOutsideMonth && 'azu-is-outside'
                  )
                }
              />
            )}
          </CalendarGrid>
        </Calendar>
      </Dialog>
    </Popover>
  )
}

function DateGroup({ children }: { children?: ReactNode }) {
  return (
    <Group className="azu-input azu-date-group">
      <DateInput className="azu-date-input">
        {(segment) => (
          <DateSegment
            segment={segment}
            className={({ isPlaceholder, isFocused }) =>
              cx(
                'azu-date-segment',
                isPlaceholder && 'azu-is-placeholder',
                isFocused && 'azu-is-focused'
              )
            }
          />
        )}
      </DateInput>
      {children}
      <Button className="azu-date-button" aria-label="Open calendar">
        <span aria-hidden>▾</span>
      </Button>
    </Group>
  )
}

export function DateControl(props: ControlProps) {
  const { field, value, onChange, errors } = props
  return (
    <DatePicker
      {...common(props)}
      value={toCalendarDate(value as string | null)}
      onChange={(next) => onChange(fromCalendarDate(next as CalendarDate | null))}
      granularity="day"
    >
      <FieldLabel field={field} />
      <DateGroup />
      <Description field={field} />
      <Errors errors={errors} />
      <CalendarPopover />
    </DatePicker>
  )
}

/**
 * Edits in the app's timezone, whatever the browser's is, including
 * across a DST change (docs/ui-check.md §2).
 */
export function DateTimeControl(props: ControlProps) {
  const { field, value, onChange, errors, timezone } = props
  const placeholder = useMemo(() => zonedPlaceholder(timezone), [timezone])
  return (
    <DatePicker
      {...common(props)}
      value={toZonedDateTime(value as string | null, timezone)}
      onChange={(next) => onChange(fromZonedDateTime(next as ZonedDateTime | null))}
      placeholderValue={placeholder}
      granularity="minute"
    >
      <FieldLabel field={field} />
      <DateGroup />
      <Description field={field} />
      <Errors errors={errors} />
      <CalendarPopover />
    </DatePicker>
  )
}
