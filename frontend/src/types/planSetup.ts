// A place in Lithuania, as the API returns it (contracts/plan-setup-api.md, Location object).
export interface PlanLocation {
  id: number
  name: string
  area: string
  latitude: number
  longitude: number
}

// What Continue sends. Only the place id is sent; the server looks the place up again.
export interface PlanSetupCheckRequest {
  locationId: number | null
  // yyyy-MM-dd
  dates: string[]
  // null means the default of 30
  maxTravelDistanceKm: number | null
}

// A setup the server checked: its location, dates in ascending order and the distance.
export interface CheckedPlanSetup {
  location: PlanLocation
  dates: string[]
  maxTravelDistanceKm: number
}

export type PlanSetupFieldKey =
  "locationId" | "dates" | "maxTravelDistanceKm" | `dates[${number}]`

export type PlanSetupFieldErrors = Partial<Record<PlanSetupFieldKey, string>>

// The date limits exactly as GET /api/plan-setup/period sends them. The page computes no dates
// itself; these values are the only source of the forecast period and the date limit (spec FR-010).
export interface PlanPeriod {
  firstDate: string
  lastDate: string
  maxDates: number
}
