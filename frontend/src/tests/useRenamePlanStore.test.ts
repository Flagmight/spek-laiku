import { describe, expect, it, vi } from "vitest"
import { planRequestTimeoutMs } from "../helpers/timedRequest"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { usePlanEditStore } from "../stores/usePlanEditStore"
import { useRenamePlanStore } from "../stores/useRenamePlanStore"
import { useSavedPlanStore } from "../stores/useSavedPlanStore"
import { jsonResponse, routeFetch } from "./renderApp"
import { savedPlan } from "./savedPlansFixtures"

const planId = savedPlan.id
const route = `PUT /api/plans/${planId}/name`

function store() {
  return useRenamePlanStore.getState()
}

function renamed(name: string) {
  return {
    id: planId,
    name,
    locationName: "Kaunas",
    dates: savedPlan.dates,
    savedAt: savedPlan.savedAt,
  }
}

// Renaming a saved plan on its page (feature 011 spec User Story 4, FR-014).
describe("useRenamePlanStore", () => {
  it("opens with the current name and closes on cancel", () => {
    store().open("Weekend in Kaunas")
    expect(store().status).toBe("open")
    expect(store().name).toBe("Weekend in Kaunas")

    store().cancel()
    expect(store().status).toBe("closed")
  })

  it("refuses an empty name without a request, counting each refusal", async () => {
    const { requests } = routeFetch({})
    store().open("Weekend")
    store().setName("   ")

    await store().submit(planId)
    await store().submit(planId)

    expect(store().status).toBe("invalid")
    expect(store().nameError).toBe("Enter a plan name.")
    expect(store().nameRefusals).toBe(2)
    expect(requests).toEqual([])
  })

  it("renames and updates the loaded plan's name", async () => {
    useSavedPlanStore.setState({ status: "loaded", plan: savedPlan })
    const { requests } = routeFetch({
      [route]: () => jsonResponse(200, renamed("Kaunas trip")),
    })
    store().open(savedPlan.name)
    store().setName("Kaunas trip")

    await store().submit(planId)

    expect(store().status).toBe("renamed")
    expect(useSavedPlanStore.getState().plan?.name).toBe("Kaunas trip")
    expect(useSavedPlanStore.getState().plan?.savedAt).toBe(savedPlan.savedAt)
    expect(requests).toEqual([
      {
        method: "PUT",
        path: `/api/plans/${planId}/name`,
        body: { name: "Kaunas trip" },
      },
    ])
  })

  it("shows the server's name message", async () => {
    routeFetch({
      [route]: () =>
        jsonResponse(400, {
          errors: { name: ["Plan name can be at most 80 characters."] },
        }),
    })
    store().open("Weekend")
    store().setName("a".repeat(81))

    await store().submit(planId)

    expect(store().status).toBe("invalid")
    expect(store().nameError).toBe("Plan name can be at most 80 characters.")
  })

  it("reports a plan that no longer exists", async () => {
    routeFetch({ [route]: () => jsonResponse(404, {}) })
    store().open("Weekend")

    await store().submit(planId)

    expect(store().status).toBe("notFound")
  })

  it("reports a server error and sends the same request on retry", async () => {
    let calls = 0
    const { requests } = routeFetch({
      [route]: () =>
        ++calls === 1 ? jsonResponse(500) : jsonResponse(200, renamed("Trip")),
    })
    store().open("Weekend")
    store().setName("Trip")
    await store().submit(planId)
    expect(store().status).toBe("serverError")
    store().setName("Changed after the error")

    await store().retry()

    expect(store().status).toBe("renamed")
    expect(requests.map((request) => request.body)).toEqual([
      { name: "Trip" },
      { name: "Trip" },
    ])
  })

  it("counts no answer within the time limit as a server error", async () => {
    vi.useFakeTimers()
    try {
      routeFetch({ [route]: () => new Promise<Response>(() => {}) })
      store().open("Weekend")

      const renaming = store().submit(planId)
      await vi.advanceTimersByTimeAsync(planRequestTimeoutMs)
      await renaming

      expect(store().status).toBe("serverError")
    } finally {
      vi.useRealTimers()
    }
  })

  it("reports an ended session, and refreshes the user for a refused account", async () => {
    const refresh = vi
      .spyOn(useCurrentUserStore.getState(), "refresh")
      .mockResolvedValue()
    routeFetch({ [route]: () => jsonResponse(401) })
    store().open("Weekend")
    await store().submit(planId)
    expect(store().status).toBe("sessionExpired")

    routeFetch({ [route]: () => jsonResponse(403, {}) })
    await store().submit(planId)
    expect(store().status).toBe("serverError")
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})

// Feature 011 code review: renaming a plan that is being edited keeps the new name in the edit, so Save changes
// starts with it and does not undo the rename.
describe("useRenamePlanStore while the plan is being edited", () => {
  it("renames the edit of this plan and leaves an edit of another plan alone", async () => {
    routeFetch({ [route]: () => jsonResponse(200, renamed("Vilnius trip")) })
    usePlanEditStore.getState().start({
      planId,
      planName: "Weekend",
      ownerEmail: "user@example.com",
    })
    store().open("Weekend")
    store().setName("Vilnius trip")

    await store().submit(planId)

    expect(usePlanEditStore.getState().edit?.planName).toBe("Vilnius trip")

    usePlanEditStore.getState().start({
      planId: "another-plan",
      planName: "Other",
      ownerEmail: "user@example.com",
    })
    await store().submit(planId)
    expect(usePlanEditStore.getState().edit?.planName).toBe("Other")
  })
})
