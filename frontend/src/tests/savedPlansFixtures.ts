import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { PlanSchedule } from "../types/planSchedule"
import type { SavedPlan, SavedPlanSummary } from "../types/savedPlan"
import { jsonResponse, signedInUser } from "./renderApp"

// Shared data for the saved plan screens (feature 010): the Save plan form, My plans, Home and the plan page.

export const savedPlanId = "0b8f4c1e-7d2a-4f3b-9e6c-5a1d2c3b4e5f"

// 80 characters, the longest name the server accepts (spec FR-002).
export const longPlanName =
  "Kauno marių regioninio parko pažintinis savaitgalis su visa šeima ir draugais 26"

export const museumSchedule: PlanSchedule = {
  generatedScheduleId: "6f1c2a8e-3b7d-4e55-9a10-0c4f2d9b7e31",
  scheduled: [
    {
      activityName: "Museum",
      date: "2026-11-14",
      startTime: "06:00",
      endTime: "22:00",
      place: {
        name: "City Museum",
        latitude: 54.9,
        longitude: 23.9,
        distanceKm: 1.1,
        area: "Kaunas",
      },
      weather: {
        temperatureC: null,
        rainMmPerHour: null,
        windMs: null,
        isIndoor: true,
      },
      travel: null,
    },
  ],
  unscheduled: [],
  travel: { maxDistanceKm: 30, tripsOverLimit: 0 },
}

// A checked plan whose schedule is museumSchedule, so the Schedule Overview opens on it.
export function acceptMuseumPlan() {
  usePlanSetupStore.getState().setChecked({
    location: {
      id: 598316,
      name: "Kaunas",
      area: "Kaunas County",
      latitude: 54.90156,
      longitude: 23.90909,
    },
    dates: ["2026-11-14"],
    maxTravelDistanceKm: 30,
  })
  usePlanActivitiesStore.getState().setChecked([
    {
      id: "act-1",
      categoryId: "cat-museum",
      name: "Museum",
      type: "Indoor",
      durationHours: 2,
      requiresDaylight: false,
      maxWindMs: null,
      maxRainMmPerHour: null,
      minTemperatureC: null,
      maxTemperatureC: null,
    },
  ])
}

export function savedPlanSummaries(
  count: number,
  name: (index: number) => string = (index) => `Plan ${index}`,
): SavedPlanSummary[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `plan-${index + 1}`,
    name: name(index + 1),
    locationName: "Kaunas",
    dates: ["2026-11-21", "2026-11-22"],
    savedAt: "2026-11-18T12:05:00Z",
  }))
}

export const savedPlan: SavedPlan = {
  id: savedPlanId,
  name: longPlanName,
  savedAt: "2026-11-18T12:05:00Z",
  location: {
    name: "Kaunas",
    area: "Kaunas County",
    latitude: 54.90156,
    longitude: 23.90909,
  },
  dates: ["2026-11-14"],
  maxTravelDistanceKm: 30,
  scheduled: museumSchedule.scheduled,
  unscheduled: [],
  travel: museumSchedule.travel,
}

// The routes for a signed-in Active Registered User on the saved plan screens.
export function savedPlanRoutes(
  plans: SavedPlanSummary[] = savedPlanSummaries(2),
) {
  return {
    "GET /api/auth/me": () => jsonResponse(200, signedInUser()),
    "POST /api/plan-schedule": () => jsonResponse(200, museumSchedule),
    "GET /api/plans": () => jsonResponse(200, plans),
    [`GET /api/plans/${savedPlanId}`]: () => jsonResponse(200, savedPlan),
  }
}
