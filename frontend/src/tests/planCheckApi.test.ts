import { describe, expect, it } from "vitest"
import { ApiError } from "../api/apiClient"
import { checkPlan } from "../api/planCheckApi"
import { jsonResponse, routeFetch } from "./renderApp"
import { planCheckNoProblems, savedPlanId } from "./savedPlansFixtures"

const route = `GET /api/plans/${savedPlanId}/check`

describe("checkPlan", () => {
  it("sends GET to the plan's check address and returns the check on 200", async () => {
    const { requests } = routeFetch({
      [route]: () => jsonResponse(200, planCheckNoProblems),
    })

    expect(await checkPlan(savedPlanId)).toEqual({
      kind: "check",
      check: planCheckNoProblems,
    })
    expect(requests).toHaveLength(1)
    expect(requests[0].method).toBe("GET")
    expect(requests[0].path).toBe(`/api/plans/${savedPlanId}/check`)
  })

  it("returns an allPast check on 200 too", async () => {
    const allPast = {
      ...planCheckNoProblems,
      status: "allPast",
      forecastUpdatedAt: null,
    }
    routeFetch({ [route]: () => jsonResponse(200, allPast) })

    expect(await checkPlan(savedPlanId)).toEqual({
      kind: "check",
      check: allPast,
    })
  })

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "notFound"],
    [429, "tooManyRequests"],
  ])("maps %i to %s", async (status, kind) => {
    routeFetch({ [route]: () => jsonResponse(status, { status }) })

    expect(await checkPlan(savedPlanId)).toEqual({ kind })
  })

  it("maps a 503 from the weather service to weatherUnavailable", async () => {
    routeFetch({
      [route]: () => jsonResponse(503, { status: 503, service: "forecast" }),
    })

    expect(await checkPlan(savedPlanId)).toEqual({
      kind: "weatherUnavailable",
    })
  })

  it("throws for a 503 from another service and for a 500", async () => {
    routeFetch({
      [route]: () => jsonResponse(503, { status: 503, service: "places" }),
    })
    await expect(checkPlan(savedPlanId)).rejects.toBeInstanceOf(ApiError)

    routeFetch({ [route]: () => jsonResponse(500, { status: 500 }) })
    await expect(checkPlan(savedPlanId)).rejects.toBeInstanceOf(ApiError)
  })
})
