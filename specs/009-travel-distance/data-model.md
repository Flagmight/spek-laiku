# Data Model: 009-travel-distance

**Date**: 2026-11-17 | **Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

No database change and no migration. Everything below lives in memory for one schedule request. It extends the feature 008 model in [../008-generate-schedule/data-model.md](../008-generate-schedule/data-model.md).

## Backend Service Records (in `Services/`)

### `TravelLeg` (new)

The trip from the previous scheduled activity on the same date to this one (spec Key Entities: Trip).

| Field | Type | Rule |
|-------|------|------|
| `FromPlaceName` | `string` | Name of the previous activity's chosen place. |
| `DistanceKm` | `decimal` | Straight-line distance between the two chosen places, `GeoDistance.RoundToTenth`. `0.0` when they are the same place. |
| `OverLimit` | `bool` | `DistanceKm > MaxDistanceKm` of the plan (strictly greater; spec FR-002). |

### `TravelSummary` (new)

The plan-level result of the check (spec Key Entities: Travel Summary).

| Field | Type | Rule |
|-------|------|------|
| `MaxDistanceKm` | `int` | The checked setup's `MaxTravelDistanceKm`, 1 to 200, 30 when none was sent (spec FR-003). |
| `TripsOverLimit` | `int` | Number of scheduled activities whose `Travel.OverLimit` is `true`. `0` or more. |

### `ScheduledActivity` (changed)

| Field | Change | Rule |
|-------|--------|------|
| `CategoryId` | **new** (`Guid`, first parameter) | Copied from the activity by `PlanScheduler`. Used only to find the category's listed places; never sent to the browser (research section 6). |
| `Place` | meaning extended | Nearest listed place for the first activity of a date. For later activities, the first listed place within the maximum from the previous place, or the nearest place when none is (spec FR-004, FR-005). |
| `Travel` | **new** (`TravelLeg?`, last parameter, default `null`) | `null` for the first scheduled activity of its date; set for every later one. `PlanScheduler` leaves it `null`; `TravelDistanceRules` fills it. |

All other fields (`ActivityName`, `Date`, `StartTime`, `EndTime`, `Weather`) are unchanged. The time slot is never changed by the travel check (spec FR-009).

### `PlanSchedule` (changed)

| Field | Change |
|-------|--------|
| `Scheduled` | Now in chronological order (date ascending, then start time). |
| `Unscheduled` | Unchanged. Unscheduled activities have no trip and are not stops (spec User Story 1 scenario 4). |
| `Travel` | **new** `TravelSummary`. |

### `TravelDistanceRules` (new, static)

`Apply(IReadOnlyList<ScheduledActivity> scheduled, IReadOnlyList<CategoryPlaces> categoryPlaces, int maxDistanceKm)` → `(IReadOnlyList<ScheduledActivity> Scheduled, TravelSummary Summary)`.

Behaviour (research section 5):

1. Group `scheduled` by `Date`, dates ascending. Within a date, order by `StartTime`.
2. The first activity of a date: `Place = places[0]`, `Travel = null`.
3. Each later activity: `candidates` = the listed places of its `CategoryId`, in list order. Pick the first candidate with `RoundToTenth(Kilometres(previous.Place, candidate)) <= maxDistanceKm`. If none fits, pick `places[0]`. Set `Travel = new TravelLeg(previous.Place.Name, rounded distance to the picked place, rounded > maxDistanceKm)`.
4. The picked place becomes `previous` for the next activity of the same date. Dates never share a `previous` (spec Edge Cases).
5. `TripsOverLimit` = count of `Travel.OverLimit == true`.

Invariants:

- Every scheduled activity keeps its `Date`, `StartTime`, `EndTime` and `Weather`.
- Every chosen place is one of its category's listed places.
- If any listed place is within the maximum from the previous place, `OverLimit` is `false` (spec SC-002).

### `GeoDistance` (changed)

| Member | Change |
|--------|--------|
| `RoundToTenth(double km) → decimal` | **new**: `Math.Round((decimal)km, 1, MidpointRounding.AwayFromZero)`. `NearbyPlaceRules` switches to it for place distances (research section 3). |

## Backend Response DTOs (in `DTOs/Responses/`)

### `TravelLegResponse` (new)

| Field | Type |
|-------|------|
| `FromPlaceName` | `string` |
| `DistanceKm` | `decimal` |
| `OverLimit` | `bool` |

### `TravelSummaryResponse` (new)

| Field | Type |
|-------|------|
| `MaxDistanceKm` | `int` |
| `TripsOverLimit` | `int` |

### `ScheduledActivityResponse` (changed)

Gains `TravelLegResponse? Travel` as the last field. No `CategoryId`.

### `PlanScheduleResponse` (changed)

Gains `TravelSummaryResponse Travel` as the last field.

## Mapping Rules (`PlanScheduleMappingProfile`)

- `TravelLeg` → `TravelLegResponse` (by name).
- `TravelSummary` → `TravelSummaryResponse` (by name).
- `ScheduledActivity.Travel` `null` → `ScheduledActivityResponse.Travel` `null`.
- `ScheduledActivity.CategoryId` has no destination member and is not mapped. The configuration check still passes because AutoMapper validates destination members only.

## Frontend Types (`types/planSchedule.ts`)

```ts
export interface TravelLeg {
  fromPlaceName: string
  distanceKm: number   // already rounded to 0.1 by the server
  overLimit: boolean
}

export interface TravelSummary {
  maxDistanceKm: number
  tripsOverLimit: number
}

// ScheduledActivity gains:   travel: TravelLeg | null
// PlanSchedule gains:        travel: TravelSummary
```

The store (`usePlanScheduleStore`) is unchanged: it keeps the whole `PlanSchedule`, so the new fields come along. It is still cleared when the page unmounts (spec FR-011).

## Display Rules (`helpers/scheduleText.ts`)

| Input | Text |
|-------|------|
| `travel === null` | `Travel: Start of the day` |
| `overLimit === false` | `Travel: 4.2 km from Kaunas Castle` |
| `overLimit === true` | `Travel: ✗ 42.0 km from Kaunas Castle, more than your 30 km limit` |
| summary, no date with 2+ scheduled activities | no travel summary |
| summary, `tripsOverLimit === 0` | `✓ All trips within your 30 km limit.` |
| summary, `tripsOverLimit === 1` | `✗ 1 trip longer than your 30 km limit.` |
| summary, `tripsOverLimit > 1` | `✗ 3 trips longer than your 30 km limit.` |

Distances are always written with one decimal place (`toFixed(1)`), like `placeDistanceText`. "A date with 2+ scheduled activities" is the same as "at least one scheduled activity has `travel !== null`".
