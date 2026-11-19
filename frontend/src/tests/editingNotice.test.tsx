import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { useKeptScheduleStore } from "../stores/useKeptScheduleStore"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanEditStore } from "../stores/usePlanEditStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import {
  jsonResponse,
  renderAppWithLocation,
  routeFetch,
  signedInUser,
} from "./renderApp"
import {
  acceptMuseumPlan,
  museumSchedule,
  savedPlanId,
} from "./savedPlansFixtures"

const notice =
  "Editing 'Weekend in Kaunas'. Your saved plan is not changed until you save."

// Every request the planning steps make; they never answer, so each step shows only its loading state.
function renderStep(path: string) {
  const pending = () => new Promise<Response>(() => {})
  routeFetch({
    "GET /api/auth/me": () => jsonResponse(200, signedInUser()),
    "GET /api/plan-setup/period": pending,
    "GET /api/plan-activities/categories": pending,
    "POST /api/plan-forecast": pending,
    "POST /api/plan-places": pending,
    "POST /api/plan-schedule": pending,
    [`GET /api/plans/${savedPlanId}`]: pending,
  })
  return renderAppWithLocation(path)
}

function startEditing(ownerEmail = "user@example.com") {
  acceptMuseumPlan()
  usePlanEditStore.getState().start({
    planId: savedPlanId,
    planName: "Weekend in Kaunas",
    ownerEmail,
  })
}

// The notice on every planning step while a saved plan is being edited (feature 011 spec FR-008).
describe("EditingNotice", () => {
  it.each([
    "/plan/setup",
    "/plan/activities",
    "/plan/places",
    "/plan/schedule",
  ])("is shown on %s with Cancel editing", async (path) => {
    startEditing()
    renderStep(path)

    expect(await screen.findByText(notice)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Cancel editing" }),
    ).toBeInTheDocument()
  })

  it("is not shown without an edit", async () => {
    acceptMuseumPlan()
    renderStep("/plan/setup")

    await screen.findByRole("heading", { level: 1, name: "Plan setup" })
    expect(screen.queryByText(notice)).toBeNull()
  })

  it("discards the changes and opens the saved plan on Cancel editing", async () => {
    const user = userEvent.setup()
    startEditing()
    useKeptScheduleStore
      .getState()
      .keep(
        usePlanSetupStore.getState().checked!,
        usePlanActivitiesStore.getState().checked!,
        museumSchedule,
      )
    const { currentLocation } = renderStep("/plan/activities")

    await user.click(
      await screen.findByRole("button", { name: "Cancel editing" }),
    )

    await waitFor(() => expect(currentLocation()).toBe(`/plans/${savedPlanId}`))
    expect(usePlanEditStore.getState().edit).toBeNull()
    expect(usePlanSetupStore.getState().checked).toBeNull()
    expect(usePlanActivitiesStore.getState().activities).toEqual([])
    expect(useKeptScheduleStore.getState().kept).toBeNull()
  })

  it("discards an edit started by another account", async () => {
    startEditing("someone.else@example.com")
    usePlanEditStore.setState({ savedPlanKey: "saved" })
    renderStep("/plan/setup")

    await waitFor(() => expect(usePlanEditStore.getState().edit).toBeNull())
    expect(usePlanEditStore.getState().savedPlanKey).toBeNull()
    expect(usePlanSetupStore.getState().checked).toBeNull()
    expect(screen.queryByText(notice)).toBeNull()
  })
})
