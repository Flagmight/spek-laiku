import type { PlanForecastRequest } from "./planForecast"

// The places for a plan as POST /api/plan-places sends them (contracts/plan-places-api.md). Every rule
// behind these values (matching, names, distance, radius, order, count) is decided on the server; the page
// only shows and words them.

// One listed place. distanceKm is already rounded to one decimal place; area is null when unknown.
export interface NearbyPlace {
  name: string
  latitude: number
  longitude: number
  distanceKm: number
  area: string | null
}

// The places of one category, shared by every activity of that category.
export interface CategoryPlaces {
  categoryId: string
  // Empty: no place found within radiusKm.
  places: NearbyPlace[]
}

export interface PlanPlaces {
  // "HH:mm" in Lithuanian time: the oldest receive time of the places shown.
  updatedAt: string
  // The search radius: the plan's maximum travel distance, capped on the server.
  radiusKm: number
  categories: CategoryPlaces[]
}

// The same body as the forecast request.
export type PlanPlacesRequest = PlanForecastRequest
