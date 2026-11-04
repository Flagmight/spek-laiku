import { useRef, useState } from "react"
import { formatErrorMessage } from "../helpers/formatErrorMessage"
import { formatPlanDate } from "../helpers/formatPlanDate"
import { checkKeptDate, checkNewDate } from "../helpers/planDateRules"
import { usePlanPeriodStore } from "../stores/usePlanPeriodStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"

export const dateInputId = "plan-date"
const dateErrorId = "plan-date-error"
const countId = "plan-dates-count"

interface PlanDatesFieldProps {
  // The error for the dates as a whole, from Continue (for example "Add at least one date.").
  error?: string
  // Errors for single dates, keyed by the date (yyyy-MM-dd), from Continue.
  dateErrors?: Partial<Record<string, string>>
}

function countText(count: number) {
  return count === 1 ? "1 date added" : `${count} dates added`
}

// Dates: a labelled group with a date picker limited to the server's forecast period, "Add date",
// and one chip per added date in date order (spec FR-009 to FR-011). Nothing can be added until the
// server has sent the date limits (spec FR-010).
export function PlanDatesField({
  error,
  dateErrors = {},
}: PlanDatesFieldProps) {
  const dates = usePlanSetupStore((state) => state.dates)
  const status = usePlanPeriodStore((state) => state.status)
  const period = usePlanPeriodStore((state) => state.period)
  const [value, setValue] = useState("")
  const [addError, setAddError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const ready = status === "loaded" && period !== null
  const fieldError = addError ?? error
  const describedBy = [fieldError && dateErrorId, countId]
    .filter(Boolean)
    .join(" ")

  function add() {
    if (!period) {
      return
    }

    const message = checkNewDate(value, dates, period)
    if (message) {
      setAddError(message)
      return
    }

    usePlanSetupStore.getState().addDate(value)
    setValue("")
    setAddError(null)
    setAnnouncement(`${formatPlanDate(value)} added.`)
  }

  function remove(date: string) {
    usePlanSetupStore.getState().removeDate(date)
    setAnnouncement(`${formatPlanDate(date)} removed.`)
    inputRef.current?.focus()
  }

  return (
    <fieldset className="form-field plan-dates">
      <legend>Dates</legend>
      <div className="date-picker">
        <label htmlFor={dateInputId}>Date</label>
        <input
          ref={inputRef}
          id={dateInputId}
          type="date"
          min={period?.firstDate}
          max={period?.lastDate}
          value={value}
          disabled={!ready}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="button" disabled={!ready} onClick={add}>
          Add date
        </button>
      </div>
      {fieldError && (
        <p id={dateErrorId} className="field-error">
          {formatErrorMessage(fieldError)}
        </p>
      )}
      <p role="status" className="field-hint">
        {status === "loading" ? "Loading available dates…" : announcement}
      </p>
      <div role="alert" className="server-error">
        {status === "error" && (
          <>
            <p>
              {formatErrorMessage(
                "Available dates could not be loaded. Try again.",
              )}
            </p>
            <button
              type="button"
              onClick={() => void usePlanPeriodStore.getState().load()}
            >
              Retry
            </button>
          </>
        )}
      </div>
      <p id={countId} className="field-hint">
        {countText(dates.length)}
      </p>
      <ul className="date-chips">
        {dates.map((date) => {
          const label = formatPlanDate(date)
          // A server error wins; otherwise a kept date that has passed since is marked (spec FR-018).
          const chipError =
            dateErrors[date] ??
            (status === "loaded" && period ? checkKeptDate(date, period) : null)
          const chipErrorId = `${dateInputId}-${date}-error`
          return (
            <li key={date} className="date-chip">
              <span aria-describedby={chipError ? chipErrorId : undefined}>
                {label}
              </span>
              <button
                type="button"
                aria-label={`Remove ${label}`}
                onClick={() => remove(date)}
              >
                Remove
              </button>
              {chipError && (
                <p id={chipErrorId} className="field-error">
                  {formatErrorMessage(chipError)}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}
