export type ActivityType = "Indoor" | "Outdoor"

// The category object in contracts/categories-api.md. The limits are null for Indoor.
export interface ActivityCategory {
  id: string
  name: string
  type: ActivityType
  defaultDurationHours: number
  requiresDaylight: boolean
  maxWindMs: number | null
  maxRainMmPerHour: number | null
  minTemperatureC: number | null
  maxTemperatureC: number | null
  placeTags: string[]
  version: number
}

// The create and update body. A number field that is empty or not a number is sent as null,
// and placeTags is the text as the administrator typed it.
export interface ActivityCategoryRequest {
  name: string
  type: ActivityType | null
  defaultDurationHours: number | null
  requiresDaylight: boolean
  maxWindMs: number | null
  maxRainMmPerHour: number | null
  minTemperatureC: number | null
  maxTemperatureC: number | null
  placeTags: string
}

// The field keys in form order, as the server returns them.
export type ActivityCategoryField =
  | "name"
  | "type"
  | "defaultDurationHours"
  | "maxWindMs"
  | "maxRainMmPerHour"
  | "minTemperatureC"
  | "maxTemperatureC"
  | "placeTags"

// One message per failing field, as returned in errors of a 400 response.
export type ActivityCategoryFieldErrors = Partial<
  Record<ActivityCategoryField, string>
>
