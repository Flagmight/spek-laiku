import { describe, expect, it } from "vitest"
import { ApiError } from "../api/apiClient"
import { checkPlanSetup } from "../api/planSetupApi"
import type {
  CheckedPlanSetup,
  PlanSetupCheckRequest,
} from "../types/planSetup"
import { jsonResponse, routeFetch } from "./renderApp"

const checkRoute = "POST /api/plan-setup/check"

const request: PlanSetupCheckRequest = {
  locationId: 598316,
  dates: ["2026-11-07", "2026-11-08"],
  maxTravelDistanceKm: null,
}

const checked: CheckedPlanSetup = {
  location: {
    id: 598316,
    name: "Kaunas",
    area: "Kaunas County",
    latitude: 54.90156,
    longitude: 23.90909,
  },
  dates: ["2026-11-07", "2026-11-08"],
  maxTravelDistanceKm: 30,
}

describe("checkPlanSetup", () => {
  it("posts the setup as JSON and returns the checked setup", async () => {
    const { requests } = routeFetch({
      [checkRoute]: () => jsonResponse(200, checked),
    })

    const outcome = await checkPlanSetup(request)

    expect(outcome).toEqual({ kind: "checked", setup: checked })
    expect(requests[0].body).toEqual(request)
  })

  it("returns the first message for every known field, including single dates", async () => {
    routeFetch({
      [checkRoute]: () =>
        jsonResponse(400, {
          errors: {
            locationId: ["Select a location in Lithuania from the list."],
            "dates[1]": ["This date is already added.", "ignored"],
            maxTravelDistanceKm: ["Enter a whole number between 1 and 200."],
            somethingElse: ["Not a field on the page."],
          },
        }),
    })

    expect(await checkPlanSetup(request)).toEqual({
      kind: "invalid",
      errors: {
        locationId: "Select a location in Lithuania from the list.",
        "dates[1]": "This date is already added.",
        maxTravelDistanceKm: "Enter a whole number between 1 and 200.",
      },
    })
  })

  it.each([
    [403, { kind: "forbidden" }],
    [429, { kind: "tooManyRequests" }],
  ])("maps %i", async (status, expected) => {
    routeFetch({ [checkRoute]: () => jsonResponse(status) })

    expect(await checkPlanSetup(request)).toEqual(expected)
  })

  it.each([
    [400, { errors: { request: ["The request is invalid."] } }],
    [500, undefined],
    [503, { detail: "Location search is unavailable. Try again later." }],
  ])("throws ApiError for %i", async (status, body) => {
    routeFetch({ [checkRoute]: () => jsonResponse(status, body) })

    const error = await checkPlanSetup(request).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(status)
  })
})
