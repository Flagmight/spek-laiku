import { describe, expect, it } from "vitest"
import { ApiError } from "../api/apiClient"
import {
  checkPlanActivities,
  listPlanCategories,
} from "../api/planActivitiesApi"
import type {
  PlanActivitiesCheckRequest,
  PlanCategory,
} from "../types/planActivity"
import { jsonResponse, routeFetch } from "./renderApp"

const listRoute = "GET /api/plan-activities/categories"
const checkRoute = "POST /api/plan-activities/check"

const kayaking: PlanCategory = {
  id: "category-kayaking",
  name: "Kayaking",
  type: "Outdoor",
  defaultDurationHours: 2,
  requiresDaylight: true,
  maxWindMs: 8,
  maxRainMmPerHour: 0.5,
  minTemperatureC: 15,
  maxTemperatureC: 35,
}

const request: PlanActivitiesCheckRequest = {
  activities: [
    {
      categoryId: "category-kayaking",
      type: "Outdoor",
      durationHours: 2.5,
      requiresDaylight: true,
      maxWindMs: 8,
      maxRainMmPerHour: 0.5,
      minTemperatureC: 18,
      maxTemperatureC: 35,
    },
  ],
}

const checkedActivity = {
  categoryId: "category-kayaking",
  name: "Kayaking",
  type: "Outdoor",
  durationHours: 2.5,
  requiresDaylight: true,
  maxWindMs: 8,
  maxRainMmPerHour: 0.5,
  minTemperatureC: 18,
  maxTemperatureC: 35,
}

describe("checkPlanActivities", () => {
  it("posts the activities as JSON and returns the checked ones", async () => {
    const { requests } = routeFetch({
      [checkRoute]: () => jsonResponse(200, { activities: [checkedActivity] }),
    })

    expect(await checkPlanActivities(request)).toEqual({
      kind: "checked",
      activities: [checkedActivity],
    })
    expect(requests[0].body).toEqual(request)
  })

  it("returns the first message of every activities key", async () => {
    routeFetch({
      [checkRoute]: () =>
        jsonResponse(400, {
          errors: {
            activities: ["Add at least one activity."],
            "activities[0]": ["This activity is no longer available.", "x"],
            "activities[1].durationHours": ["Enter a duration."],
            somethingElse: ["Not a field on the page."],
          },
        }),
    })

    expect(await checkPlanActivities(request)).toEqual({
      kind: "invalid",
      errors: {
        activities: "Add at least one activity.",
        "activities[0]": "This activity is no longer available.",
        "activities[1].durationHours": "Enter a duration.",
      },
    })
  })

  it("throws when a 400 has no activities keys", async () => {
    routeFetch({
      [checkRoute]: () =>
        jsonResponse(400, { errors: { request: ["The request is invalid."] } }),
    })

    await expect(checkPlanActivities(request)).rejects.toMatchObject({
      status: 400,
    })
  })

  it("reports a refused caller", async () => {
    routeFetch({ [checkRoute]: () => jsonResponse(403) })

    expect(await checkPlanActivities(request)).toEqual({ kind: "forbidden" })
  })

  it("throws ApiError on any other status", async () => {
    routeFetch({ [checkRoute]: () => jsonResponse(500) })

    await expect(checkPlanActivities(request)).rejects.toBeInstanceOf(ApiError)
  })
})

describe("listPlanCategories", () => {
  it("returns the categories and the server's activity limit", async () => {
    routeFetch({
      [listRoute]: () =>
        jsonResponse(200, { categories: [kayaking], maxActivities: 10 }),
    })

    expect(await listPlanCategories()).toEqual({
      categories: [kayaking],
      maxActivities: 10,
    })
  })

  it.each([403, 500])("throws ApiError on %i", async (status) => {
    routeFetch({ [listRoute]: () => jsonResponse(status) })

    const error: unknown = await listPlanCategories().catch(
      (reason: unknown) => reason,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status })
  })
})
