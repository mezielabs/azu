/**
 * SPIKE (Phase 1 UI check). Timezone-aware date picker: the server sends
 * a UTC instant, the picker shows and edits it in the app's timezone, and
 * the submit sends the UTC instant back.
 */
import { useState } from 'react'
import { parseAbsolute, type ZonedDateTime } from '@internationalized/date'
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  DateInput,
  DatePicker,
  DateSegment,
  Dialog,
  Group,
  Heading,
  Label,
  Popover,
} from 'react-aria-components'
import { cx, xsrfToken } from './utils.ts'

type Echo = { received: string; utc: string; inAppZone: string; offset: string; valid: boolean }

export function ZonedDatePicker(props: {
  label: string
  iso: string
  timezone: string
  path: string
  id: string
}) {
  const [value, setValue] = useState<ZonedDateTime | null>(() =>
    parseAbsolute(props.iso, props.timezone)
  )
  const [echo, setEcho] = useState<Echo | null>(null)

  async function submit() {
    const response = await fetch(`${props.path}/ui-check/date`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json',
        'x-xsrf-token': xsrfToken(),
      },
      body: JSON.stringify({ value: value ? value.toAbsoluteString() : '' }),
    })
    setEcho((await response.json()) as Echo)
  }

  return (
    <div className="azu-check" data-azu-check={`date-${props.id}`}>
      <DatePicker
        className="azu-date-picker"
        value={value}
        onChange={setValue}
        granularity="minute"
        hourCycle={24}
      >
        <Label className="azu-label">{props.label}</Label>
        <Group className="azu-date-field">
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
          <Button className="azu-icon-button" aria-label="Open calendar">
            📅
          </Button>
        </Group>
        <Popover className="azu-popover">
          <Dialog className="azu-dialog">
            <Calendar className="azu-calendar">
              <header className="azu-calendar-header">
                <Button slot="previous" className="azu-icon-button">
                  ‹
                </Button>
                <Heading />
                <Button slot="next" className="azu-icon-button">
                  ›
                </Button>
              </header>
              <CalendarGrid>
                {(date) => (
                  <CalendarCell
                    date={date}
                    className={({ isSelected, isFocused }) =>
                      cx(
                        'azu-calendar-cell',
                        isSelected && 'azu-is-selected',
                        isFocused && 'azu-is-focused'
                      )
                    }
                  />
                )}
              </CalendarGrid>
            </Calendar>
          </Dialog>
        </Popover>
      </DatePicker>
      <p className="azu-check-meta" data-azu-check-result={`date-${props.id}`}>
        value={value?.toString() ?? 'null'} utc={value?.toAbsoluteString() ?? 'null'}
      </p>
      <Button className="azu-button" onPress={submit}>
        Send to server
      </Button>
      {echo && (
        <p className="azu-check-meta" data-azu-check-echo={`date-${props.id}`}>
          server: utc={echo.utc} inAppZone={echo.inAppZone} ({echo.offset})
        </p>
      )}
    </div>
  )
}
