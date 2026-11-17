# API Contract Change: POST /api/plan-schedule (travel distance)

**Date**: 2026-11-17 | **Plan**: [plan.md](../plan.md)

Feature 009 changes only the **200 OK** response of the existing endpoint. The method, path, authorization (`PlanCreator`), shared `PlanSetup` rate limit, request body and every error response (400, 403, 429, 503 with `service`, 500) stay exactly as in [../../008-generate-schedule/contracts/plan-schedule-api.md](../../008-generate-schedule/contracts/plan-schedule-api.md). No new endpoint is added (spec FR-010).

The request body is the same as the plan forecast and places requests: `setup` (`locationId`, `dates`, `maxTravelDistanceKm`) and `activities`. `maxTravelDistanceKm` is already sent and checked (feature 004: a whole number from 1 to 200, `null` means 30). The schedule now also uses it for the travel check, and it is not sent anywhere else (spec FR-003).

## 200 OK — Schedule generated (changed)

In this example, a windy hour at 11:00 on 14 November splits the day, so the two outdoor activities get the suitable periods before and after it (feature 008 gives each activity its whole suitable period). An indoor activity takes 06:00–22:00 and therefore never shares a date with another activity.

```json
{
  "scheduled": [
    {
      "activityName": "Kayaking",
      "date": "2026-11-14",
      "startTime": "08:00",
      "endTime": "11:00",
      "place": {
        "name": "Nemuno slipway",
        "latitude": 54.8972,
        "longitude": 23.8861,
        "distanceKm": 3.4,
        "area": "Kaunas"
      },
      "weather": { "temperatureC": 8.5, "rainMmPerHour": 0.0, "windMs": 3.2, "isIndoor": false },
      "travel": null
    },
    {
      "activityName": "Picnic",
      "date": "2026-11-14",
      "startTime": "12:00",
      "endTime": "16:00",
      "place": {
        "name": "Santakos parkas",
        "latitude": 54.8968,
        "longitude": 23.8857,
        "distanceKm": 3.5,
        "area": "Kaunas"
      },
      "weather": { "temperatureC": 11.0, "rainMmPerHour": 0.0, "windMs": 4.0, "isIndoor": false },
      "travel": {
        "fromPlaceName": "Nemuno slipway",
        "distanceKm": 0.1,
        "overLimit": false
      }
    },
    {
      "activityName": "Cycling",
      "date": "2026-11-15",
      "startTime": "10:00",
      "endTime": "14:00",
      "place": { "name": "Ąžuolynas park", "latitude": 54.9001, "longitude": 23.9395, "distanceKm": 2.6, "area": "Kaunas" },
      "weather": { "temperatureC": 9.0, "rainMmPerHour": 0.0, "windMs": 4.1, "isIndoor": false },
      "travel": null
    }
  ],
  "unscheduled": [
    { "activityName": "Rock Climbing", "reason": "noPlace" }
  ],
  "travel": {
    "maxDistanceKm": 30,
    "tripsOverLimit": 0
  }
}
```

### New and changed fields

| Field | Type | Notes |
|-------|------|-------|
| `scheduled` | array | **Order changed**: now chronological (`date` ascending, then `startTime`). The page still sorts, so it does not depend on this order. |
| `scheduled[].place` | object | Same shape as before. It is now the place chosen by the travel check: the nearest listed place, or the first listed place within the maximum from the previous activity's place (spec FR-004, FR-005). `distanceKm` is still the distance from the plan location. |
| `scheduled[].travel` | object or `null` | **New**. `null` for the first scheduled activity of its date. |
| `scheduled[].travel.fromPlaceName` | string | The previous scheduled activity's `place.name` on the same date. |
| `scheduled[].travel.distanceKm` | number | Straight-line distance between the previous activity's place and this one, rounded to 0.1 km. `0.0` for the same place. |
| `scheduled[].travel.overLimit` | boolean | `true` when `distanceKm > travel.maxDistanceKm` (strictly greater). |
| `travel` | object | **New**. Always present, also when `scheduled` is empty. |
| `travel.maxDistanceKm` | integer | The checked plan's maximum travel distance (1 to 200, default 30). |
| `travel.tripsOverLimit` | integer | Number of `scheduled[]` entries with `travel.overLimit === true`. |

`unscheduled[]` is unchanged. No new `reason` value is added (spec FR-005, clarification Q1).

## Added Scheduling Guarantees

These are added to the guarantees in the feature 008 contract, which all still hold:

6. The travel check never changes an activity's `date`, `startTime`, `endTime` or `weather`. Those are the same as without the check.
7. For each date, exactly the earliest `scheduled` entry has `travel: null`.
8. For every other entry, `travel.fromPlaceName` is the `place.name` of the entry right before it on the same date, and `travel.distanceKm` is the rounded straight-line distance between the two `place` positions.
9. If an entry has `travel.overLimit: true`, none of its activity's listed places (from `/api/plan-places`) is within `maxDistanceKm` of the previous entry's place, and the entry uses its nearest listed place.
10. `travel.tripsOverLimit` equals the number of entries with `travel.overLimit: true`.
