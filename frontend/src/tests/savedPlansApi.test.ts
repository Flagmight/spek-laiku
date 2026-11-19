import { describe, expect, it, vi } from "vitest"
import { ApiError } from "../api/apiClient"
import {
  deletePlan,
  duplicatePlan,
  getSavedPlan,
  getSavedPlans,
  replacePlan,
  savePlan,
} from "../api/savedPlansApi"
import type { SavePlanRequest } from "../types/savedPlan"
import { jsonResponse, routeFetch } from "./renderApp"

const saveRoute = "POST /api/plans"

const request: SavePlanRequest = {
  generatedScheduleId: "6f1c2a8e-3b7d-4e55-9a10-0c4f2d9b7e31",
  name: "Weekend in Kaunas",
}

const plan = {
  id: "0b8f4c1e-7d2a-4f3b-9e6c-5a1d2c3b4e5f",
  name: "Weekend in Kaunas",
  locationName: "Kaunas",
  dates: ["2026-11-21", "2026-11-22"],
  savedAt: "2026-11-18T12:05:00Z",
}

describe("savePlan", () => {
  it.each([201, 200])(
    "posts the id and name and returns the plan on %i",
    async (status) => {
      const { requests } = routeFetch({
        [saveRoute]: () => jsonResponse(status, plan),
      })

      const answer = await savePlan(request)

      expect(answer).toEqual({ kind: "saved", plan })
      expect(requests).toEqual([
        { method: "POST", path: "/api/plans", body: request },
      ])
    },
  )

  it("returns the first message of each field on 400", async () => {
    routeFetch({
      [saveRoute]: () =>
        jsonResponse(400, {
          status: 400,
          errors: {
            name: ["Enter a plan name.", "Second message."],
            generatedScheduleId: ["Generate the schedule again to save it."],
          },
        }),
    })

    expect(await savePlan(request)).toEqual({
      kind: "invalid",
      errors: {
        name: "Enter a plan name.",
        generatedScheduleId: "Generate the schedule again to save it.",
      },
    })
  })

  it("returns no field errors for a 400 without a readable body", async () => {
    routeFetch({ [saveRoute]: () => new Response("not json", { status: 400 }) })

    expect(await savePlan(request)).toEqual({ kind: "invalid", errors: {} })
  })

  it("maps 401 to unauthorized and 403 to forbidden", async () => {
    routeFetch({ [saveRoute]: () => jsonResponse(401) })
    expect(await savePlan(request)).toEqual({ kind: "unauthorized" })

    routeFetch({ [saveRoute]: () => jsonResponse(403, { status: 403 }) })
    expect(await savePlan(request)).toEqual({ kind: "forbidden" })
  })

  it.each([500, 502])("throws ApiError for %i", async (status) => {
    routeFetch({ [saveRoute]: () => jsonResponse(status) })

    await expect(savePlan(request)).rejects.toEqual(new ApiError(status))
  })

  it("passes a network error through", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    )

    await expect(savePlan(request)).rejects.toBeInstanceOf(TypeError)
  })
})

describe("getSavedPlans", () => {
  it("returns the plans in the server's order on 200", async () => {
    const newer = { ...plan, id: "newer", name: "Newer" }
    const { requests } = routeFetch({
      "GET /api/plans": () => jsonResponse(200, [newer, plan]),
    })

    expect(await getSavedPlans()).toEqual({
      kind: "plans",
      plans: [newer, plan],
    })
    expect(requests).toEqual([
      { method: "GET", path: "/api/plans", body: undefined },
    ])
  })

  it("maps 401 to unauthorized and 403 to forbidden", async () => {
    routeFetch({ "GET /api/plans": () => jsonResponse(401) })
    expect(await getSavedPlans()).toEqual({ kind: "unauthorized" })

    routeFetch({ "GET /api/plans": () => jsonResponse(403, { status: 403 }) })
    expect(await getSavedPlans()).toEqual({ kind: "forbidden" })
  })

  it("throws ApiError for 500", async () => {
    routeFetch({ "GET /api/plans": () => jsonResponse(500) })

    await expect(getSavedPlans()).rejects.toEqual(new ApiError(500))
  })
})

describe("getSavedPlan", () => {
  const savedPlan = {
    id: plan.id,
    name: plan.name,
    savedAt: plan.savedAt,
    location: {
      name: "Kaunas",
      area: "Kaunas County",
      latitude: 54.9,
      longitude: 23.9,
    },
    dates: plan.dates,
    maxTravelDistanceKm: 30,
    scheduled: [],
    unscheduled: [{ activityName: "Kayaking", reason: "noPlace" }],
    travel: { maxDistanceKm: 30, tripsOverLimit: 0 },
  }

  it("returns the plan on 200", async () => {
    const { requests } = routeFetch({
      [`GET /api/plans/${plan.id}`]: () => jsonResponse(200, savedPlan),
    })

    expect(await getSavedPlan(plan.id)).toEqual({
      kind: "plan",
      plan: savedPlan,
    })
    expect(requests[0].path).toBe(`/api/plans/${plan.id}`)
  })

  it("maps 403 to forbidden, 404 to notFound and 401 to unauthorized", async () => {
    const route = `GET /api/plans/${plan.id}`
    routeFetch({ [route]: () => jsonResponse(403, { status: 403 }) })
    expect(await getSavedPlan(plan.id)).toEqual({ kind: "forbidden" })

    routeFetch({
      [route]: () =>
        jsonResponse(404, {
          status: 404,
          detail: "This plan no longer exists.",
        }),
    })
    expect(await getSavedPlan(plan.id)).toEqual({ kind: "notFound" })

    routeFetch({ [route]: () => jsonResponse(401) })
    expect(await getSavedPlan(plan.id)).toEqual({ kind: "unauthorized" })
  })

  it("throws ApiError for 500", async () => {
    routeFetch({ [`GET /api/plans/${plan.id}`]: () => jsonResponse(500) })

    await expect(getSavedPlan(plan.id)).rejects.toEqual(new ApiError(500))
  })
})

describe("deletePlan", () => {
  const route = `DELETE /api/plans/${plan.id}`

  it("sends DELETE to the plan's address and returns deleted on 204", async () => {
    const { requests } = routeFetch({ [route]: () => jsonResponse(204) })

    expect(await deletePlan(plan.id)).toEqual({ kind: "deleted" })
    expect(requests).toEqual([
      { method: "DELETE", path: `/api/plans/${plan.id}`, body: undefined },
    ])
  })

  it("maps 404 to notFound, 403 to forbidden and 401 to unauthorized", async () => {
    routeFetch({
      [route]: () =>
        jsonResponse(404, {
          status: 404,
          detail: "This plan no longer exists.",
        }),
    })
    expect(await deletePlan(plan.id)).toEqual({ kind: "notFound" })

    routeFetch({ [route]: () => jsonResponse(403, { status: 403 }) })
    expect(await deletePlan(plan.id)).toEqual({ kind: "forbidden" })

    routeFetch({ [route]: () => jsonResponse(401) })
    expect(await deletePlan(plan.id)).toEqual({ kind: "unauthorized" })
  })

  it("throws ApiError for 500", async () => {
    routeFetch({ [route]: () => jsonResponse(500) })

    await expect(deletePlan(plan.id)).rejects.toEqual(new ApiError(500))
  })
})

describe("duplicatePlan", () => {
  const route = `POST /api/plans/${plan.id}/copies`
  const copy = { ...plan, id: "5d2e9a7c", name: "Copy of Weekend in Kaunas" }

  it("posts with no body and returns the copy on 201", async () => {
    const { requests } = routeFetch({
      [route]: () => jsonResponse(201, copy),
    })

    expect(await duplicatePlan(plan.id)).toEqual({
      kind: "duplicated",
      plan: copy,
    })
    expect(requests).toEqual([
      {
        method: "POST",
        path: `/api/plans/${plan.id}/copies`,
        body: undefined,
      },
    ])
  })

  it("maps 404 to notFound, 403 to forbidden and 401 to unauthorized", async () => {
    routeFetch({ [route]: () => jsonResponse(404, { status: 404 }) })
    expect(await duplicatePlan(plan.id)).toEqual({ kind: "notFound" })

    routeFetch({ [route]: () => jsonResponse(403, { status: 403 }) })
    expect(await duplicatePlan(plan.id)).toEqual({ kind: "forbidden" })

    routeFetch({ [route]: () => jsonResponse(401) })
    expect(await duplicatePlan(plan.id)).toEqual({ kind: "unauthorized" })
  })

  it("throws ApiError for 500", async () => {
    routeFetch({ [route]: () => jsonResponse(500) })

    await expect(duplicatePlan(plan.id)).rejects.toEqual(new ApiError(500))
  })
})

describe("replacePlan", () => {
  const route = `PUT /api/plans/${plan.id}`

  it("puts the id and name to the plan's address and returns the plan on 200", async () => {
    const { requests } = routeFetch({ [route]: () => jsonResponse(200, plan) })

    expect(await replacePlan(plan.id, request)).toEqual({
      kind: "saved",
      plan,
    })
    expect(requests).toEqual([
      { method: "PUT", path: `/api/plans/${plan.id}`, body: request },
    ])
  })

  it("returns the first message of each field on 400", async () => {
    routeFetch({
      [route]: () =>
        jsonResponse(400, {
          errors: {
            name: ["Enter a plan name."],
            generatedScheduleId: ["Generate the schedule again to save it."],
          },
        }),
    })

    expect(await replacePlan(plan.id, request)).toEqual({
      kind: "invalid",
      errors: {
        name: "Enter a plan name.",
        generatedScheduleId: "Generate the schedule again to save it.",
      },
    })
  })

  it("maps 404 to notFound, 403 to forbidden and 401 to unauthorized", async () => {
    routeFetch({ [route]: () => jsonResponse(404, { status: 404 }) })
    expect(await replacePlan(plan.id, request)).toEqual({ kind: "notFound" })

    routeFetch({ [route]: () => jsonResponse(403, { status: 403 }) })
    expect(await replacePlan(plan.id, request)).toEqual({ kind: "forbidden" })

    routeFetch({ [route]: () => jsonResponse(401) })
    expect(await replacePlan(plan.id, request)).toEqual({
      kind: "unauthorized",
    })
  })

  it("throws ApiError for 500", async () => {
    routeFetch({ [route]: () => jsonResponse(500) })

    await expect(replacePlan(plan.id, request)).rejects.toEqual(
      new ApiError(500),
    )
  })
})
