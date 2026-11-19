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

  it("removes one plan and keeps the others and the status", async () => {
    const other = { ...plan, id: "5d2e9a7c-1b3f-4c8d-a6e2-9f0b1c2d3e4f" }
    routeFetch({ "GET /api/plans": () => jsonResponse(200, [plan, other]) })
    await store().load()

    store().remove(plan.id)

    expect(store().plans).toEqual([other])
    expect(store().status).toBe("loaded")
  })

  it("puts a copy directly above its original", async () => {
    // A plan saved later, so it is listed above the original.
    const other = { ...plan, id: "plan-other", savedAt: "2026-11-19T09:00:00Z" }
    const copy = { ...plan, id: "plan-copy", name: "Copy of Weekend in Kaunas" }
    routeFetch({ "GET /api/plans": () => jsonResponse(200, [other, plan]) })
    await store().load()

    store().insertAbove(copy, plan.id)

    expect(store().plans.map((item) => item.id)).toEqual([
      "plan-other",
      "plan-copy",
      plan.id,
    ])
  })

  it("puts a second copy above the first, as the server lists the newest created first", async () => {
    const firstCopy = {
      ...plan,
      id: "copy-1",
      name: "Copy of Weekend in Kaunas",
    }
    const secondCopy = {
      ...plan,
      id: "copy-2",
      name: "Copy of Weekend in Kaunas",
    }
    routeFetch({ "GET /api/plans": () => jsonResponse(200, [plan]) })
    await store().load()

    store().insertAbove(firstCopy, plan.id)
    store().insertAbove(secondCopy, plan.id)

    expect(store().plans.map((item) => item.id)).toEqual([
      "copy-2",
      "copy-1",
      plan.id,
    ])
  })

  it("puts a copy first when its original is not in the list", async () => {
    const copy = { ...plan, id: "plan-copy" }
    routeFetch({ "GET /api/plans": () => jsonResponse(200, [plan]) })
    await store().load()

    store().insertAbove(copy, "missing")

    expect(store().plans.map((item) => item.id)).toEqual(["plan-copy", plan.id])
  })
})
