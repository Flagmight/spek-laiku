import { describe, expect, it, vi } from "vitest"
import { planRequestTimeoutMs } from "../helpers/timedRequest"
import { useSavePlanStore } from "../stores/useSavePlanStore"
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

    await store().submit(scheduleId)

    expect(store().status).toBe("invalid")
    expect(store().nameError).toBe("Enter a plan name.")
    expect(requests).toEqual([])
  })

  it("saves and keeps the plan", async () => {
    const { requests } = routeFetch({
      [saveRoute]: () => jsonResponse(201, plan),
    })
    openWithName("Weekend")

    await store().submit(scheduleId)

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

    await store().submit(scheduleId)

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

    await store().submit(scheduleId)

    expect(store().status).toBe("expired")
    expect(store().name).toBe("Weekend")
    store().reopen()
    expect(store().status).toBe("open")
    expect(store().name).toBe("Weekend")
  })

  it("maps 401 to sessionExpired", async () => {
    routeFetch({ [saveRoute]: () => jsonResponse(401) })
    openWithName("Weekend")

    await store().submit(scheduleId)

    expect(store().status).toBe("sessionExpired")
  })

  it("maps a server error to serverError and retries the same request", async () => {
    let calls = 0
    const { requests } = routeFetch({
      [saveRoute]: () => jsonResponse(++calls === 1 ? 500 : 201, plan),
    })
    openWithName("Weekend")

    await store().submit(scheduleId)
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

    await Promise.all([store().submit(scheduleId), store().submit(scheduleId)])

    expect(requests).toHaveLength(1)
  })

  it("counts no answer within the time limit as a server error", async () => {
    vi.useFakeTimers()
    try {
      routeFetch({ [saveRoute]: () => new Promise<Response>(() => {}) })
      openWithName("Weekend")

      const saving = store().submit(scheduleId)
      await vi.advanceTimersByTimeAsync(planRequestTimeoutMs)
      await saving

      expect(store().status).toBe("serverError")
    } finally {
      vi.useRealTimers()
    }
  })
})
