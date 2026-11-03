import { describe, expect, it } from "vitest"
import {
  createCategory,
  getCategory,
  listCategories,
  updateCategory,
} from "../api/activityCategoriesApi"
import { ApiError } from "../api/apiClient"
import type {
  ActivityCategory,
  ActivityCategoryRequest,
} from "../types/activityCategory"
import { jsonResponse, routeFetch } from "./renderApp"

const id = "6c1f0d1e-6a43-4b8e-9d0a-1f2a3b4c5d6e"

const kayaking: ActivityCategory = {
  id,
  name: "Kayaking",
  type: "Outdoor",
  defaultDurationHours: 2,
  requiresDaylight: true,
  maxWindMs: 8,
  maxRainMmPerHour: 0.5,
  minTemperatureC: 15,
  maxTemperatureC: 35,
  placeTags: ["leisure=slipway", "sport=canoe"],
  version: 1042,
}

const request: ActivityCategoryRequest = {
  name: "Kayaking",
  type: "Outdoor",
  defaultDurationHours: 2,
  requiresDaylight: true,
  maxWindMs: 8,
  maxRainMmPerHour: 0.5,
  minTemperatureC: 15,
  maxTemperatureC: 35,
  placeTags: "leisure=slipway, sport=canoe",
}

describe("activityCategoriesApi", () => {
  it("lists the categories", async () => {
    routeFetch({
      "GET /api/admin/categories": () => jsonResponse(200, [kayaking]),
    })

    await expect(listCategories()).resolves.toEqual([kayaking])
  })

  it.each([401, 403, 500])(
    "throws ApiError %i when listing fails",
    async (status) => {
      routeFetch({ "GET /api/admin/categories": () => jsonResponse(status) })

      await expect(listCategories()).rejects.toEqual(new ApiError(status))
    },
  )

  it("returns null for a category that does not exist", async () => {
    routeFetch({ [`GET /api/admin/categories/${id}`]: () => jsonResponse(404) })

    await expect(getCategory(id)).resolves.toBeNull()
  })

  it("creates a category with the request as the body", async () => {
    const { requests } = routeFetch({
      "POST /api/admin/categories": () => jsonResponse(201, kayaking),
    })

    await expect(createCategory(request)).resolves.toEqual({
      kind: "saved",
      category: kayaking,
    })
    expect(requests[0].body).toEqual(request)
  })

  it("sends the version when updating a category", async () => {
    const { requests } = routeFetch({
      [`PUT /api/admin/categories/${id}`]: () => jsonResponse(200, kayaking),
    })

    await updateCategory(id, request, 1042)

    expect(requests[0].body).toEqual({ ...request, version: 1042 })
  })

  it("returns the first message of each known field in form order", async () => {
    routeFetch({
      "POST /api/admin/categories": () =>
        jsonResponse(400, {
          errors: {
            placeTags: ["Map place tags can be at most 200 characters."],
            name: ["Enter a category name.", "A second message."],
            unknownField: ["Ignored."],
          },
        }),
    })

    const outcome = await createCategory(request)

    expect(outcome).toEqual({
      kind: "invalid",
      errors: {
        name: "Enter a category name.",
        placeTags: "Map place tags can be at most 200 characters.",
      },
    })
    expect(outcome.kind === "invalid" && Object.keys(outcome.errors)).toEqual([
      "name",
      "placeTags",
    ])
  })

  it("throws ApiError for a 400 without known field errors", async () => {
    routeFetch({
      "POST /api/admin/categories": () =>
        jsonResponse(400, { errors: { request: ["The request is invalid."] } }),
    })

    await expect(createCategory(request)).rejects.toEqual(new ApiError(400))
  })

  it.each([
    [401, "sessionEnded"],
    [403, "forbidden"],
    [404, "notFound"],
    [409, "conflict"],
  ])("returns the outcome for status %i", async (status, kind) => {
    routeFetch({
      [`PUT /api/admin/categories/${id}`]: () => jsonResponse(status),
    })

    await expect(updateCategory(id, request, 1)).resolves.toEqual({ kind })
  })

  it("throws ApiError for a server error when saving", async () => {
    routeFetch({ "POST /api/admin/categories": () => jsonResponse(500) })

    await expect(createCategory(request)).rejects.toEqual(new ApiError(500))
  })
})
