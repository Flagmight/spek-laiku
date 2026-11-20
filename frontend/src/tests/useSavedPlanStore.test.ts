import { describe, expect, it, vi } from "vitest"
import { planRequestTimeoutMs } from "../helpers/timedRequest"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { useSavedPlanStore } from "../stores/useSavedPlanStore"
import { jsonResponse, routeFetch } from "./renderApp"

const id = "0b8f4c1e-7d2a-4f3b-9e6c-5a1d2c3b4e5f"
const route = `GET /api/plans/${id}`

const plan = {
  id,
  name: "Weekend in Kaunas",
  savedAt: "2026-11-18T12:05:00Z",
  location: {
    name: "Kaunas",
    area: "Kaunas County",
    latitude: 54.9,
    longitude: 23.9,
  },
  dates: ["2026-11-21"],
  maxTravelDistanceKm: 30,
  scheduled: [],
  unscheduled: [],
  travel: { maxDistanceKm: 30, tripsOverLimit: 0 },
}

function store() {
  return useSavedPlanStore.getState()
}

describe("useSavedPlanStore", () => {
  it("loads the plan", async () => {
    routeFetch({ [route]: () => jsonResponse(200, plan) })

    await store().load(id)

    expect(store().status).toBe("loaded")
    expect(store().plan).toEqual(plan)
  })

  it.each([
    [404, "notFound"],
    [403, "forbidden"],
    [500, "serverError"],
  ] as const)("maps %i to %s with no plan", async (status, expected) => {
    routeFetch({ [route]: () => jsonResponse(status, { status }) })

    await store().load(id)

    expect(store().status).toBe(expected)
    expect(store().plan).toBeNull()
  })

  it("reads the signed-in state again when the session has ended", async () => {
    const refresh = vi
      .spyOn(useCurrentUserStore.getState(), "refresh")
      .mockResolvedValue()
    routeFetch({ [route]: () => jsonResponse(401) })

    await store().load(id)

    expect(refresh).toHaveBeenCalled()
  })

  it("loads the same plan again on retry", async () => {
    let calls = 0
    routeFetch({
      [route]: () =>
        ++calls === 1 ? jsonResponse(500) : jsonResponse(200, plan),
    })

    await store().load(id)
    await store().retry()

    expect(store().status).toBe("loaded")
    expect(calls).toBe(2)
  })

  it("says a loaded plan no longer exists after markGone", async () => {
    routeFetch({ [route]: () => jsonResponse(200, plan) })
    await store().load(id)

    store().markGone()

    expect(store().status).toBe("notFound")
    expect(store().plan).toBeNull()
  })

  it("drops a pending load when markGone is called", async () => {
    let answer: (response: Response) => void = () => {}
    routeFetch({
      [route]: () => new Promise<Response>((resolve) => (answer = resolve)),
    })
    const loading = store().load(id)

    store().markGone()
    answer(jsonResponse(200, plan))
    await loading

    expect(store().status).toBe("notFound")
    expect(store().plan).toBeNull()
  })

  it("counts no answer within the time limit as a server error", async () => {
    vi.useFakeTimers()
    try {
      routeFetch({ [route]: () => new Promise<Response>(() => {}) })

      const loading = store().load(id)
      await vi.advanceTimersByTimeAsync(planRequestTimeoutMs)
      await loading

      expect(store().status).toBe("serverError")
    } finally {
      vi.useRealTimers()
    }
  })
})
