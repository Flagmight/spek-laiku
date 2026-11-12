import type { NearbyPlace, PlanPlaces } from "../types/planPlaces"
import { jsonResponse } from "./renderApp"
import type { RecordedRequest } from "./renderApp"

// Place answers for tests, shaped like POST /api/plan-places (contracts/plan-places-api.md).

export const nemunoSlipway: NearbyPlace = {
  name: "Nemuno slipway",
  latitude: 54.89012,
  longitude: 23.9312,
  distanceKm: 3.4,
  area: "Kaunas",
}

export const lampedziai: NearbyPlace = {
  name: "Lampėdžių valčių nuleidimo vieta",
  latitude: 54.9177,
  longitude: 23.8523,
  distanceKm: 4.1,
  area: null,
}

// The places for the given categories, each with the same two places unless given its own.
export function planPlaces(
  categoryIds: string[],
  changes: Partial<PlanPlaces> = {},
  placesByCategory: Record<string, NearbyPlace[]> = {},
): PlanPlaces {
  return {
    updatedAt: "14:05",
    radiusKm: 30,
    categories: categoryIds.map((categoryId) => ({
      categoryId,
      places: placesByCategory[categoryId] ?? [nemunoSlipway, lampedziai],
    })),
    ...changes,
  }
}

// Answers POST /api/plan-places for whatever categories were sent: one entry per distinct category in order
// of first appearance, each with the same two places, and the radius capped at 50 km as on the server.
export function answerPlaces(request: RecordedRequest): Response {
  const body = request.body as {
    setup: { maxTravelDistanceKm: number }
    activities: { categoryId: string }[]
  }
  const categoryIds = [
    ...new Set(body.activities.map((activity) => activity.categoryId)),
  ]
  return jsonResponse(
    200,
    planPlaces(categoryIds, {
      radiusKm: Math.min(body.setup.maxTravelDistanceKm, 50),
    }),
  )
}

// Tests that only pass through step 3 spread placesRoutes into their routeFetch handlers.
export const placesRoutes = { "POST /api/plan-places": answerPlaces }
