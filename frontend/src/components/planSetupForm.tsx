import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { formatErrorMessage } from "../helpers/formatErrorMessage"
import { parseTravelDistance } from "../helpers/parseTravelDistance"
import {
  dateErrorsByDate,
  summaryErrors,
} from "../helpers/planSetupFieldErrors"
import { usePlanSetupCheckStore } from "../stores/usePlanSetupCheckStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { PlanSetupFieldErrors } from "../types/planSetup"
import { ErrorSummary } from "./errorSummary"
import { LocationSearchField, locationInputId } from "./locationSearchField"
import { dateInputId, PlanDatesField } from "./planDatesField"
import { TextField } from "./textField"

export const distanceInputId = "max-travel-distance"

const fieldIds = {
  location: locationInputId,
  date: dateInputId,
  distance: distanceInputId,
}

// Stable empty values, so the focus effect below runs only when a new set of errors arrives.
const noErrors: PlanSetupFieldErrors = {}
const noDates: string[] = []

const serverMessages = {
  serverError: "Something went wrong. Try again.",
  tooManyRequests: "Too many requests. Wait a minute and try again.",
}

// The Plan setup form: Location, Dates, Maximum travel distance and Continue (spec FR-012 to
// FR-016). Continue first checks what the page can see (a chosen place, at least one date, a
// distance that is a number), then asks the server to check everything; an accepted setup opens the
// Activity selection step.
export function PlanSetupForm() {
  const navigate = useNavigate()
  const distanceText = usePlanSetupStore((state) => state.maxTravelDistanceText)
  const status = usePlanSetupCheckStore((state) => state.status)
  const serverErrors = usePlanSetupCheckStore((state) => state.errors)
  const lastRequest = usePlanSetupCheckStore((state) => state.lastRequest)
  // Errors found before sending; they replace the server's until the next Continue.
  const [pageErrors, setPageErrors] = useState<PlanSetupFieldErrors | null>(
    null,
  )

  const errors = pageErrors ?? (status === "invalid" ? serverErrors : noErrors)
  // dates[i] errors point at the dates that were sent, not at the list as it is now.
  const sentDates = pageErrors ? noDates : (lastRequest?.dates ?? noDates)

  // After a failed Continue, focus the first invalid field (spec FR-013).
  useEffect(() => {
    const first = summaryErrors(errors, sentDates, fieldIds)[0]
    if (first) {
      document.getElementById(first.fieldId)?.focus()
    }
  }, [errors, sentDates])

  function finish(accepted: boolean) {
    if (accepted) {
      navigate("/plan/activities")
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const { location, dates, maxTravelDistanceText } =
      usePlanSetupStore.getState()
    const distance = parseTravelDistance(maxTravelDistanceText)
    const found: PlanSetupFieldErrors = {}
    if (!location) {
      found.locationId = "Select a location in Lithuania from the list."
    }
    if (dates.length === 0) {
      found.dates = "Add at least one date."
    }
    if (distance.kind === "invalid") {
      found.maxTravelDistanceKm = "Enter a whole number between 1 and 200."
    }
    if (!location || Object.keys(found).length > 0) {
      usePlanSetupCheckStore.getState().reset()
      setPageErrors(found)
      return
    }

    setPageErrors(null)
    finish(
      await usePlanSetupCheckStore.getState().submit({
        locationId: location.id,
        dates,
        // Empty means the default; the server then uses 30 (spec FR-016).
        maxTravelDistanceKm: distance.kind === "number" ? distance.value : null,
      }),
    )
  }

  async function retry() {
    finish(await usePlanSetupCheckStore.getState().retry())
  }

  const serverMessage =
    status === "serverError" || status === "tooManyRequests"
      ? serverMessages[status]
      : null

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)}>
      <ErrorSummary errors={summaryErrors(errors, sentDates, fieldIds)} />
      <LocationSearchField error={errors.locationId} />
      <PlanDatesField
        error={errors.dates}
        dateErrors={dateErrorsByDate(errors, sentDates)}
      />
      <TextField
        id={distanceInputId}
        label="Maximum travel distance (km)"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        hint="Whole number from 1 to 200"
        value={distanceText}
        error={errors.maxTravelDistanceKm}
        onChange={(text) =>
          usePlanSetupStore.getState().setMaxTravelDistanceText(text)
        }
      />
      <p role="status" className="loading-status">
        {status === "pending" ? "Checking your plan setup…" : ""}
      </p>
      {serverMessage && (
        <div role="alert" className="server-error">
          <p>{formatErrorMessage(serverMessage)}</p>
          <button type="button" onClick={() => void retry()}>
            Retry
          </button>
        </div>
      )}
      <button type="submit" disabled={status === "pending"}>
        Continue
      </button>
    </form>
  )
}
