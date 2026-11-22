import { describe, expect, it, vi } from "vitest"
import { planRequestTimeoutMs } from "../helpers/timedRequest"
import { usePlanCheckStore } from "../stores/usePlanCheckStore"
import { useSavedPlanStore } from "../stores/useSavedPlanStore"
import { jsonResponse, routeFetch, signedInUser } from "./renderApp"
import {
  planCheckNoProblems,
  planCheckWith,
  problem,
  savedPlan,
  savedPlanId,
} from "./savedPlansFixtures"

const route = `GET /api/plans/${savedPlanId}/check`

function store() {
  return usePlanCheckStore.getState()
}

// A check answer the test releases itself.
function heldAnswer() {
  let release: (response: Response) => void = () => {}
  const answer = new Promise<Response>((resolve) => (release = resolve))
  return { answer, release }
}

describe("usePlanCheckStore", () => {
  it("is checking while the request runs, then checked with the result", async () => {
    const { answer, release } = heldAnswer()
    routeFetch({ [route]: () => answer })

    const checking = store().check(savedPlanId)
    expect(store().status).toBe("checking")
    release(jsonResponse(200, planCheckNoProblems))
    await checking

    expect(store().status).toBe("checked")
    expect(store().result).toEqual(planCheckNoProblems)
    expect(store().controller).toBeNull()
  })

  it("is allPast for an allPast answer", async () => {
    const allPast = {
      ...planCheckNoProblems,
      status: "allPast",
      forecastUpdatedAt: null,
    }
    routeFetch({ [route]: () => jsonResponse(200, allPast) })

    await store().check(savedPlanId)

    expect(store().status).toBe("allPast")
    expect(store().result).toEqual(allPast)
  })

  it.each([
    [503, { status: 503, service: "forecast" }, "weatherUnavailable"],
    [429, { status: 429 }, "tooManyRequests"],
    [500, { status: 500 }, "serverError"],
    [503, { status: 503, service: "places" }, "serverError"],
  ] as const)(
    "maps %i %j to %s with no result",
    async (status, body, expected) => {
      routeFetch({ [route]: () => jsonResponse(status, body) })

      await store().check(savedPlanId)

      expect(store().status).toBe(expected)
      expect(store().result).toBeNull()
    },
  )

  it("counts a network error as a server error", async () => {
    routeFetch({ [route]: () => Promise.reject(new TypeError("offline")) })

    await store().check(savedPlanId)

    expect(store().status).toBe("serverError")
  })

  it("tells the plan store that a deleted plan no longer exists", async () => {
    routeFetch({
      [`GET /api/plans/${savedPlanId}`]: () => jsonResponse(200, savedPlan),
      [route]: () => jsonResponse(404, { status: 404 }),
    })
    await useSavedPlanStore.getState().load(savedPlanId)

    await store().check(savedPlanId)

    expect(store().status).toBe("idle")
    expect(useSavedPlanStore.getState().status).toBe("notFound")
  })

  it.each([401, 403])(
    "reads the signed-in state again on %i",
    async (status) => {
      const { requests } = routeFetch({
        "GET /api/auth/me": () => jsonResponse(200, signedInUser()),
        [route]: () => jsonResponse(status, { status }),
      })

      await store().check(savedPlanId)

      expect(store().status).toBe("idle")
      await vi.waitFor(() =>
        expect(requests.map((request) => request.path)).toContain(
          "/api/auth/me",
        ),
      )
    },
  )

  it("sends one request when check is called again while checking", async () => {
    const { answer, release } = heldAnswer()
    const { requests } = routeFetch({ [route]: () => answer })

    const first = store().check(savedPlanId)
    await store().check(savedPlanId)
    release(jsonResponse(200, planCheckNoProblems))
    await first

    expect(requests).toHaveLength(1)
    expect(store().status).toBe("checked")
  })

  it("drops an answer that arrives after reset", async () => {
    const { answer, release } = heldAnswer()
    routeFetch({ [route]: () => answer })

    const checking = store().check(savedPlanId)
    store().reset()
    release(jsonResponse(200, planCheckNoProblems))
    await checking

    expect(store().status).toBe("idle")
    expect(store().result).toBeNull()
  })

  it("checks the same plan again on retry", async () => {
    const { requests } = routeFetch({
      [route]: () => jsonResponse(503, { status: 503, service: "forecast" }),
    })
    await store().check(savedPlanId)

    await store().retry()

    expect(requests).toHaveLength(2)
    expect(requests[1].path).toBe(`/api/plans/${savedPlanId}/check`)
  })

  it("clears the previous result when a new check starts", async () => {
    const withWind = planCheckWith([
      { problems: [problem("wind", { time: "11:00", value: 9, limit: 8 })] },
    ])
    const { answer, release } = heldAnswer()
    let calls = 0
    routeFetch({
      [route]: () => (++calls === 1 ? jsonResponse(200, withWind) : answer),
    })
    await store().check(savedPlanId)

    const again = store().check(savedPlanId)
    expect(store().result).toBeNull()
    release(jsonResponse(500, { status: 500 }))
    await again

    expect(store().status).toBe("serverError")
    expect(store().result).toBeNull()
  })

  it("counts no answer within the time limit as a server error", async () => {
    vi.useFakeTimers()
    try {
      routeFetch({ [route]: () => new Promise<Response>(() => {}) })

      const checking = store().check(savedPlanId)
      await vi.advanceTimersByTimeAsync(planRequestTimeoutMs)
      await checking

      expect(store().status).toBe("serverError")
    } finally {
      vi.useRealTimers()
    }
  })
})
