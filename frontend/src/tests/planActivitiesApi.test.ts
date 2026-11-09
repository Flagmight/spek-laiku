import { describe, expect, it } from "vitest"
import { ApiError } from "../api/apiClient"
import { listPlanCategories } from "../api/planActivitiesApi"
import type { PlanCategory } from "../types/planActivity"
import { jsonResponse, routeFetch } from "./renderApp"

const listRoute = "GET /api/plan-activities/categories"

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
