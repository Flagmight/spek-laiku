import { describe, expect, it, vi } from "vitest"
import { planRequestTimeoutMs } from "../helpers/timedRequest"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { useSavedPlansStore } from "../stores/useSavedPlansStore"
import { jsonResponse, routeFetch } from "./renderApp"

const plan = {
  id: "0b8f4c1e-7d2a-4f3b-9e6c-5a1d2c3b4e5f",
  name: "Weekend in Kaunas",
  locationName: "Kaunas",
  dates: ["2026-11-21"],
  savedAt: "2026-11-18T12:05:00Z",
}

function store() {
  return useSavedPlansStore.getState()
}

describe("useSavedPlansStore", () => {
  it("starts loading and keeps the plans when they arrive", async () => {
    routeFetch({ "GET /api/plans": () => jsonResponse(200, [plan]) })
    expect(store().status).toBe("loading")

    await store().load()

    expect(store().status).toBe("loaded")
    expect(store().plans).toEqual([plan])
  })

  it("reports a server error and loads again on retry", async () => {
    let calls = 0
    routeFetch({
      "GET /api/plans": () =>
        ++calls === 1 ? jsonResponse(500) : jsonResponse(200, [plan]),
    })

    await store().load()
    expect(store().status).toBe("serverError")

    await store().retry()
    expect(store().status).toBe("loaded")
    expect(store().plans).toEqual([plan])
  })

  it("reads the signed-in state again when the session has ended", async () => {
    const refresh = vi
      .spyOn(useCurrentUserStore.getState(), "refresh")
      .mockResolvedValue()
    routeFetch({ "GET /api/plans": () => jsonResponse(401) })

    await store().load()

    expect(refresh).toHaveBeenCalled()
    expect(store().status).toBe("serverError")
  })

  it("counts no answer within the time limit as a server error", async () => {
    vi.useFakeTimers()
    try {
      routeFetch({ "GET /api/plans": () => new Promise<Response>(() => {}) })

      const loading = store().load()
      await vi.advanceTimersByTimeAsync(planRequestTimeoutMs)
      await loading

      expect(store().status).toBe("serverError")
    } finally {
      vi.useRealTimers()
    }
  })

  it("drops a late answer after reset", async () => {
    let answer: (response: Response) => void = () => {}
    routeFetch({
      "GET /api/plans": () =>
        new Promise<Response>((resolve) => {
          answer = resolve
        }),
    })

    const loading = store().load()
    store().reset()
    answer(jsonResponse(200, [plan]))
    await loading

    expect(store().status).toBe("loading")
    expect(store().plans).toEqual([])
  })
})
