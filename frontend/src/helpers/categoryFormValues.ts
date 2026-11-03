import type {
  ActivityCategory,
  ActivityCategoryRequest,
  ActivityType,
} from "../types/activityCategory"
import { parseDecimal } from "./parseDecimal"

// The category form's values as typed; numbers stay text until they are sent.
export interface CategoryFormValues {
  name: string
  type: ActivityType | null
  duration: string
  maxWindMs: string
  maxRainMmPerHour: string
  minTemperatureC: string
  maxTemperatureC: string
  requiresDaylight: boolean
  placeTags: string
}

function numberText(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value)
}

// The stored values of a category, or empty values for a new one (tags joined with ", ").
export function categoryFormValues(
  category: ActivityCategory | null,
): CategoryFormValues {
  return {
    name: category?.name ?? "",
    type: category?.type ?? null,
    duration: numberText(category?.defaultDurationHours),
    maxWindMs: numberText(category?.maxWindMs),
    maxRainMmPerHour: numberText(category?.maxRainMmPerHour),
    minTemperatureC: numberText(category?.minTemperatureC),
    maxTemperatureC: numberText(category?.maxTemperatureC),
    requiresDaylight: category?.requiresDaylight ?? false,
    placeTags: category?.placeTags.join(", ") ?? "",
  }
}

export function categoryRequest(
  values: CategoryFormValues,
): ActivityCategoryRequest {
  // The name and tags are sent exactly as typed, so the server applies the 200-character
  // limit to the text as entered (FR-009). An Indoor category has no weather limits (FR-007).
  const outdoor = values.type === "Outdoor"
  const limit = (text: string) => (outdoor ? parseDecimal(text) : null)
  return {
    name: values.name,
    type: values.type,
    defaultDurationHours: parseDecimal(values.duration),
    requiresDaylight: values.requiresDaylight,
    maxWindMs: limit(values.maxWindMs),
    maxRainMmPerHour: limit(values.maxRainMmPerHour),
    minTemperatureC: limit(values.minTemperatureC),
    maxTemperatureC: limit(values.maxTemperatureC),
    placeTags: values.placeTags,
  }
}
