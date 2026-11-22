import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type {
  PlanCheck,
  PlanCheckEntry,
  PlanProblem,
  PlanRule,
} from "../types/planCheck"
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
    id: 598316,
    name: "Kaunas",
    area: "Kaunas County",
    latitude: 54.90156,
    longitude: 23.90909,
  },
  dates: ["2026-11-14"],
  maxTravelDistanceKm: 30,
  // One outdoor activity with limits and one indoor activity without, for loading a plan into editing
  // (feature 011 research section 4).
  activities: [
    {
      categoryId: "c1d2e3f4-0000-4000-8000-000000000001",
      name: "Cycling",
      type: "Outdoor",
      durationHours: 2.5,
      requiresDaylight: true,
      maxWindMs: 10,
      maxRainMmPerHour: 1,
      minTemperatureC: 5,
      maxTemperatureC: 32,
    },
    {
      categoryId: "c1d2e3f4-0000-4000-8000-000000000002",
      name: "Museum",
      type: "Indoor",
      durationHours: 2,
      requiresDaylight: false,
      maxWindMs: null,
      maxRainMmPerHour: null,
      minTemperatureC: null,
      maxTemperatureC: null,
    },
  ],
  scheduled: museumSchedule.scheduled,
  unscheduled: [],
  travel: museumSchedule.travel,
}

// A check of savedPlan that finds no problem (feature 012 contracts/plan-check-api.md): one entry per scheduled
// activity, with the same date, times, name and weather.
export const planCheckNoProblems: PlanCheck = planCheckWith([])

// A check of a plan (savedPlan unless another is given) whose entries take the given overrides, by position;
// entries without one have no problem.
export function planCheckWith(
  entries: Partial<PlanCheckEntry>[],
  plan: SavedPlan = savedPlan,
): PlanCheck {
  return {
    savedAt: plan.savedAt,
    status: "checked",
    forecastUpdatedAt: "14:05",
    entries: plan.scheduled.map((activity, index) => ({
      date: activity.date,
      startTime: activity.startTime,
      endTime: activity.endTime,
      activityName: activity.activityName,
      past: false,
      weather: activity.weather,
      problems: [],
      ...entries[index],
    })),
  }
}

// One problem of the given rule; every field it does not set is null, as the server sends it.
export function problem(
  rule: PlanRule,
  fields: Partial<PlanProblem> = {},
): PlanProblem {
  return {
    rule,
    time: null,
    value: null,
    limit: null,
    sunTime: null,
    otherActivityName: null,
    otherStartTime: null,
    otherEndTime: null,
    fromPlaceName: null,
    ...fields,
  }
}

// The check route of a plan page that finds no problem in the given plan (feature 012).
export function noProblemCheckRoute(plan: SavedPlan) {
  return {
    [`GET /api/plans/${plan.id}/check`]: () =>
      jsonResponse(200, planCheckWith([], plan)),
  }
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
    // Opening the plan page checks the plan (feature 012).
    [`GET /api/plans/${savedPlanId}/check`]: () =>
      jsonResponse(200, planCheckNoProblems),
  }
}

// Two problems on savedPlan's only entry, for the keyboard, screen reader and phone checks (feature 012 User
// Story 7).
export const twoProblemCheck: PlanCheck = planCheckWith([
  {
    problems: [
      problem("overlap", {
        otherActivityName: "Cycling",
        otherStartTime: "10:00",
        otherEndTime: "12:00",
      }),
      problem("travel", {
        value: 34.2,
        limit: 30,
        fromPlaceName: "Kaunas Castle",
      }),
    ],
  },
])

// The names of twoProblemCheck's links in the "Plan check" list.
export const twoProblemLinkNames = [
  "Museum, Sat 14 Nov 06:00–22:00: Overlaps with Cycling (10:00–12:00).",
  "Museum, Sat 14 Nov 06:00–22:00: Travel of 34.2 km from Kaunas Castle, more than your 30 km limit.",
]

// The saved plan screens' routes, with a plan check that finds twoProblemCheck's problems.
export function twoProblemRoutes() {
  return {
    ...savedPlanRoutes(),
    [`GET /api/plans/${savedPlanId}/check`]: () =>
      jsonResponse(200, twoProblemCheck),
  }
}
