import { describe, expect, it, vi } from "vitest"
import { planRequestTimeoutMs } from "../helpers/timedRequest"
import { usePlanEditStore } from "../stores/usePlanEditStore"
import { useSavePlanStore } from "../stores/useSavePlanStore"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { CheckedPlanSetup } from "../types/planSetup"
import { jsonResponse, routeFetch } from "./renderApp"

const saveRoute = "POST /api/plans"
const scheduleId = "6f1c2a8e-3b7d-4e55-9a10-0c4f2d9b7e31"

const plan = {
  id: "0b8f4c1e-7d2a-4f3b-9e6c-5a1d2c3b4e5f",
  name: "Weekend",
  locationName: "Kaunas",
  dates: ["2026-11-21"],
  savedAt: "2026-11-18T12:05:00Z",
}

// The setup and activities the schedule was generated from; they become the saved marker (feature 011).
const setup: CheckedPlanSetup = {
  location: {
    id: 598316,
    name: "Kaunas",
    area: "Kaunas County",
    latitude: 54.9,
    longitude: 23.9,
  },
  dates: ["2026-11-21"],
  maxTravelDistanceKm: 30,
}

const activities: CheckedPlanActivity[] = []

// A new plan, as in feature 010; the edit tests add a plan id.
const submission = { generatedScheduleId: scheduleId, setup, activities }

function store() {
  return useSavePlanStore.getState()
}

function openWithName(name: string) {
  store().open()
  store().setName(name)
}

describe("useSavePlanStore", () => {
  it("opens and cancels the form", () => {
    store().open()
    expect(store().status).toBe("open")

    store().cancel()
    expect(store().status).toBe("closed")
  })

  it("refuses an empty or spaces-only name without a request", async () => {
    const { requests } = routeFetch({})
    openWithName("   ")

    await store().submit(submission)

    expect(store().status).toBe("invalid")
    expect(store().nameError).toBe("Enter a plan name.")
    expect(requests).toEqual([])
  })

  it("saves and keeps the plan", async () => {
    const { requests } = routeFetch({
      [saveRoute]: () => jsonResponse(201, plan),
    })
    openWithName("Weekend")

    await store().submit(submission)

    expect(store().status).toBe("saved")
    expect(store().savedPlan).toEqual(plan)
    expect(requests[0].body).toEqual({
      generatedScheduleId: scheduleId,
      name: "Weekend",
    })
  })

  it("shows the server's name message", async () => {
    routeFetch({
      [saveRoute]: () =>
        jsonResponse(400, {
          errors: { name: ["Plan name can be at most 80 characters."] },
        }),
    })
    openWithName("a".repeat(81))

    await store().submit(submission)

    expect(store().status).toBe("invalid")
    expect(store().nameError).toBe("Plan name can be at most 80 characters.")
  })

  it("treats a generatedScheduleId error as expired and keeps the name", async () => {
    routeFetch({
      [saveRoute]: () =>
        jsonResponse(400, {
          errors: {
            generatedScheduleId: ["Generate the schedule again to save it."],
          },
        }),
    })
    openWithName("Weekend")

    await store().submit(submission)

    expect(store().status).toBe("expired")
    expect(store().name).toBe("Weekend")
    store().reopen()
    expect(store().status).toBe("open")
    expect(store().name).toBe("Weekend")
  })

  it("maps 401 to sessionExpired", async () => {
    routeFetch({ [saveRoute]: () => jsonResponse(401) })
    openWithName("Weekend")

    await store().submit(submission)

    expect(store().status).toBe("sessionExpired")
  })

  it("maps a server error to serverError and retries the same request", async () => {
    let calls = 0
    const { requests } = routeFetch({
      [saveRoute]: () => jsonResponse(++calls === 1 ? 500 : 201, plan),
    })
    openWithName("Weekend")

    await store().submit(submission)
    expect(store().status).toBe("serverError")

    store().setName("Changed")
    await store().retry()

    expect(store().status).toBe("saved")
    expect(requests.map((request) => request.body)).toEqual([
      { generatedScheduleId: scheduleId, name: "Weekend" },
      { generatedScheduleId: scheduleId, name: "Weekend" },
    ])
  })

  it("sends one request for a double submit", async () => {
    const { requests } = routeFetch({
      [saveRoute]: () => jsonResponse(201, plan),
    })
    openWithName("Weekend")

    await Promise.all([store().submit(submission), store().submit(submission)])

    expect(requests).toHaveLength(1)
  })

  it("counts no answer within the time limit as a server error", async () => {
    vi.useFakeTimers()
    try {
      routeFetch({ [saveRoute]: () => new Promise<Response>(() => {}) })
      openWithName("Weekend")

      const saving = store().submit(submission)
      await vi.advanceTimersByTimeAsync(planRequestTimeoutMs)
      await saving

      expect(store().status).toBe("serverError")
    } finally {
      vi.useRealTimers()
    }
  })
})

// Feature 011 User Story 3: Save changes replaces the edited plan, and a successful save is remembered so that a
// later "Edit plan" does not warn about an unsaved plan (research section 10).
describe("useSavePlanStore while editing", () => {
  const planId = plan.id
  const replaceRoute = `PUT /api/plans/${planId}`
  const editing = { ...submission, planId }

  it("sends the id and name to the edited plan's address", async () => {
    const { requests } = routeFetch({
      [replaceRoute]: () => jsonResponse(200, plan),
    })
    openWithName("Weekend")

    await store().submit(editing)

    expect(store().status).toBe("saved")
    expect(requests).toEqual([
      {
        method: "PUT",
        path: `/api/plans/${planId}`,
        body: { generatedScheduleId: scheduleId, name: "Weekend" },
      },
    ])
  })

  it("repeats the same PUT on Retry, with the name that was sent", async () => {
    let calls = 0
    const { requests } = routeFetch({
      [replaceRoute]: () =>
        ++calls === 1 ? jsonResponse(500) : jsonResponse(200, plan),
    })
    openWithName("Weekend")
    await store().submit(editing)
    expect(store().status).toBe("serverError")
    store().setName("Changed after the error")

    await store().retry()

    expect(store().status).toBe("saved")
    expect(requests.map((request) => request.body)).toEqual([
      { generatedScheduleId: scheduleId, name: "Weekend" },
      { generatedScheduleId: scheduleId, name: "Weekend" },
    ])
    expect(requests.every((request) => request.method === "PUT")).toBe(true)
  })

  it("reports a plan that no longer exists", async () => {
    routeFetch({ [replaceRoute]: () => jsonResponse(404, {}) })
    openWithName("Weekend")

    await store().submit(editing)

    expect(store().status).toBe("planGone")
  })

  it("saves as a new plan after saveAsNew, keeping the name", async () => {
    const { requests } = routeFetch({
      [replaceRoute]: () => jsonResponse(404, {}),
      [saveRoute]: () => jsonResponse(201, plan),
    })
    openWithName("Weekend")
    await store().submit(editing)

    store().saveAsNew()
    expect(store().status).toBe("open")
    expect(store().name).toBe("Weekend")
    await store().submit(submission)

    expect(store().status).toBe("saved")
    expect(requests.map((request) => request.method)).toEqual(["PUT", "POST"])
  })

  it("shows an expired schedule as for a new plan", async () => {
    routeFetch({
      [replaceRoute]: () =>
        jsonResponse(400, {
          errors: {
            generatedScheduleId: ["Generate the schedule again to save it."],
          },
        }),
    })
    openWithName("Weekend")

    await store().submit(editing)

    expect(store().status).toBe("expired")
  })

  it("records the saved marker after a successful save or replace, but not after a failure", async () => {
    let fail = true
    routeFetch({
      [saveRoute]: () => (fail ? jsonResponse(500) : jsonResponse(201, plan)),
      [replaceRoute]: () => jsonResponse(200, plan),
    })
    openWithName("Weekend")

    await store().submit(submission)
    expect(usePlanEditStore.getState().savedPlanKey).toBeNull()

    fail = false
    await store().retry()
    expect(usePlanEditStore.getState().savedPlanKey).not.toBeNull()

    usePlanEditStore.setState({ savedPlanKey: null })
    await store().submit(editing)
    expect(usePlanEditStore.getState().savedPlanKey).not.toBeNull()
  })
})
