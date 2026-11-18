import { describe, expect, it, vi } from "vitest"
import { ApiError } from "../api/apiClient"
import { savePlan } from "../api/savedPlansApi"
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
