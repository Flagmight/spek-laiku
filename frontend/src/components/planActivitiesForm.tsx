import { useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { formatErrorMessage } from "../helpers/formatErrorMessage"
import {
  planActivitiesHeadingId,
  planActivitySummaryErrors,
} from "../helpers/planActivityFieldIds"
import { planActivityNames } from "../helpers/planActivityNames"
import { usePlanActivitiesCheckStore } from "../stores/usePlanActivitiesCheckStore"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import type { PlanActivityErrors } from "../types/planActivity"
import { ErrorSummary } from "./errorSummary"
import { PlanActivitySettings } from "./planActivitySettings"
import { categoriesToggleId } from "./planCategoryList"

const noErrors: PlanActivityErrors = { byActivity: {} }
const noActivityErrors = {}

// The plan's activities and Continue (spec FR-007 to FR-009, FR-014, FR-015). The server judges every
// value; the page itself only notices an empty plan.
export function PlanActivitiesForm() {
  const navigate = useNavigate()
  const activities = usePlanActivitiesStore((state) => state.activities)
  const status = usePlanActivitiesCheckStore((state) => state.status)
  const serverErrors = usePlanActivitiesCheckStore((state) => state.errors)
  const lastRequest = usePlanActivitiesCheckStore((state) => state.lastRequest)
  const [removed, setRemoved] = useState({ message: "", activityCount: 0 })
  const [continuedEmpty, setContinuedEmpty] = useState(false)
  const continueButton = useRef<HTMLButtonElement>(null)
  const names = planActivityNames(activities)

  const errors = status === "invalid" ? serverErrors : noErrors
  const listError =
    continuedEmpty && activities.length === 0
      ? "Add at least one activity."
      : errors.list
  // Retry resends what was sent, so it is offered only while that is still what the page shows.
  const showServerError = status === "serverError" && lastRequest === activities

  useEffect(() => () => usePlanActivitiesCheckStore.getState().reset(), [])

  function remove(id: string) {
    const index = activities.findIndex((activity) => activity.id === id)
    const neighbour = activities[index + 1] ?? activities[index - 1]
    usePlanActivitiesStore.getState().remove(id)
    setContinuedEmpty(false)
    const message = `${names[id]} removed.`
    // Renumbering can make two removals in a row read the same. A live region is read out only when
    // its text changes, so a repeat differs by an invisible space.
    setRemoved((current) => ({
      message: current.message === message ? `${message} ` : message,
      activityCount: activities.length - 1,
    }))
    // Both targets stay on the page while the removed activity goes, so focus can move straight away.
    // With none left, the category list opens by itself (spec FR-023).
    document
      .getElementById(
        neighbour ? `activity-${neighbour.id}-heading` : categoriesToggleId,
      )
      ?.focus()
  }

  // Every field is already on the page, so focus can move as soon as the answer is in (spec FR-014).
  async function finish(check: Promise<boolean>) {
    if (await check) {
      navigate("/plan/places")
      return
    }

    const { status: result, errors: found } =
      usePlanActivitiesCheckStore.getState()
    const { activities: current } = usePlanActivitiesStore.getState()
    const [first] = planActivitySummaryErrors(
      found,
      current,
      planActivityNames(current),
    )
    if (result === "invalid" && first) {
      document.getElementById(first.fieldId)?.focus()
      return
    }

    // Continue was disabled and Retry goes away during a check, so a keyboard user may be left with
    // focus nowhere. Someone who moved on to a field stays there.
    const focused = document.activeElement
    if (
      result === "serverError" &&
      (focused === document.body || focused === continueButton.current)
    ) {
      document.getElementById(planActivitiesHeadingId)?.focus()
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (activities.length === 0) {
      usePlanActivitiesCheckStore.getState().reset()
      setContinuedEmpty(true)
      document.getElementById(planActivitiesHeadingId)?.focus()
      return
    }

    await finish(usePlanActivitiesCheckStore.getState().submit(activities))
  }

  return (
    <section aria-labelledby={planActivitiesHeadingId}>
      {/* noValidate: the browser's own bubbles must never replace the server's messages. */}
      <form noValidate onSubmit={(event) => void onSubmit(event)}>
        <ErrorSummary
          errors={planActivitySummaryErrors(
            { ...errors, list: listError },
            activities,
            names,
          )}
        />
        <h2 id={planActivitiesHeadingId} tabIndex={-1}>
          Your activities
        </h2>
        {listError && (
          <p role="alert" className="field-error">
            {formatErrorMessage(listError)}
          </p>
        )}
        {activities.length === 0 && (
          <p>
            No activities added yet. Select at least one category to continue.
          </p>
        )}
        {activities.map((activity) => (
          <PlanActivitySettings
            key={activity.id}
            activity={activity}
            shownName={names[activity.id]}
            errors={errors.byActivity[activity.id] ?? noActivityErrors}
            onRemove={() => remove(activity.id)}
          />
        ))}
        {/* Empty again after the next Add: a live region is read out only when its text changes. */}
        <p role="status" className="loading-status">
          {removed.activityCount === activities.length ? removed.message : ""}
        </p>
        <p role="status" className="loading-status">
          {status === "pending" ? "Checking your activities…" : ""}
        </p>
        {showServerError && (
          <div role="alert" className="server-error">
            <p>{formatErrorMessage("Something went wrong. Try again.")}</p>
            <button
              type="button"
              onClick={() =>
                void finish(usePlanActivitiesCheckStore.getState().retry())
              }
            >
              Retry
            </button>
          </div>
        )}
        <button
          ref={continueButton}
          type="submit"
          disabled={status === "pending"}
        >
          Continue
        </button>
      </form>
    </section>
  )
}
