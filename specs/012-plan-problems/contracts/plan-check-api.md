# API Contract: Plan check (`GET /api/plans/{id}/check`)

**Date**: 2026-11-20 | **Plan**: [plan.md](../plan.md) | **Data model**: [data-model.md](../data-model.md)

This contract adds one endpoint next to the saved plan endpoints of features 010 and 011 ([../../011-plan-management/contracts/plans-api.md](../../011-plan-management/contracts/plans-api.md)). No existing endpoint changes its request or response. `GET /api/plans/{id}` still returns the plan exactly as saved and still calls no external service.

## GET /api/plans/{id}/check: check a saved plan against the latest forecast

Called when the plan page opens and when the user selects **Recalculate** or **Retry** (spec FR-002). It changes nothing on the server (spec FR-014): the same request can be sent any number of times.

- **Request**: no body, no query parameters. Everything the check needs comes from the saved plan (spec FR-004).
- **Authorization**: policy `ActiveRegisteredUser` (the controller's).
  - Not signed in, or the session has ended → **401** with no body.
  - An Administrator or a Suspended user → **403** with the standard problem body and no plan data.
- **Ownership**: another user's plan → **403**, the standard problem body, no plan data.
- **Not found**: no plan with this id → **404** with `"detail": "This plan no longer exists."`, the same body as `GET /api/plans/{id}`. An `{id}` that is not a GUID does not match the route and also gives 404.
- **Rate limit**: policy `PlanSetup`, shared with location search, the plan setup check, the forecast, the places and the schedule requests: at most 30 per minute per network address (spec FR-015).
- **External service**: the weather service, through the forecast cache (at most 30 minutes old; spec FR-012). It is never contacted for a 401, 403, 404 or 429 answer, nor when every scheduled activity has started (spec FR-001, FR-006, SC-005).
- Dates are `yyyy-MM-dd`, times `HH:mm` in Lithuanian time, `savedAt` UTC ISO 8601. JSON is camelCase.

### 200 OK: checked

```json
{
  "savedAt": "2026-11-18T12:05:00Z",
  "status": "checked",
  "forecastUpdatedAt": "14:05",
  "entries": [
    {
      "date": "2026-11-20",
      "startTime": "09:00",
      "endTime": "11:00",
      "activityName": "Museum",
      "past": true,
      "weather": null,
      "problems": []
    },
    {
      "date": "2026-11-21",
      "startTime": "10:00",
      "endTime": "12:00",
      "activityName": "Kayaking",
      "past": false,
      "weather": { "temperatureC": 6.5, "rainMmPerHour": 0.0, "windMs": 7.2, "isIndoor": false },
      "problems": [
        { "rule": "wind", "time": "11:00", "value": 9.0, "limit": 8.0,
          "sunTime": null, "otherActivityName": null, "otherStartTime": null, "otherEndTime": null, "fromPlaceName": null },
        { "rule": "travel", "time": null, "value": 34.2, "limit": 30,
          "sunTime": null, "otherActivityName": null, "otherStartTime": null, "otherEndTime": null, "fromPlaceName": "Kaunas Castle" }
      ]
    },
    {
      "date": "2026-11-21",
      "startTime": "13:00",
      "endTime": "15:00",
      "activityName": "Bowling",
      "past": false,
      "weather": { "temperatureC": null, "rainMmPerHour": null, "windMs": null, "isIndoor": true },
      "problems": []
    }
  ]
}
```

| Field | Notes |
|---|---|
| `savedAt` | The checked plan's `savedAt`, the same value as `GET /api/plans/{id}`. If it differs from the plan on the page, the schedule was replaced since the page loaded, and the page loads the plan again (research section 12). |
| `status` | `"checked"`, or `"allPast"` (below). |
| `forecastUpdatedAt` | When the forecast used was received from the weather service, not when the check ran (spec FR-011, Edge Cases). `null` only for `allPast`. |
| `entries` | Exactly one per scheduled activity of the saved plan, **in the same order as `scheduled` in `GET /api/plans/{id}`** (date, then start time). `date`, `startTime`, `endTime` and `activityName` repeat the saved values. |
| `entries[].past` | `true` when the activity's start time has passed in Lithuanian time (spec FR-005, User Story 5). Such an entry has `weather: null` and no problems, and the page shows "Already past. Not checked." with its saved weather. |
| `entries[].weather` | The latest forecast at the entry's start hour, in the shape of the schedule's `weather` (features 008 and 010). For an Indoor activity that does not require daylight, `isIndoor` is `true` and every value is `null`. A value with no forecast is `null`. |
| `entries[].problems` | Every broken rule, in the order wind, rain, cold, heat, noForecast, beforeSunrise, afterSunset, overlap, travel (data-model.md). Empty when the entry fits. |

**Problem fields** (data-model.md `PlanProblem`). Every field is always present, and the fields a rule does not use are `null`:

| `rule` | `time` | `value` | `limit` | `sunTime` | `otherActivityName`, `otherStartTime`, `otherEndTime` | `fromPlaceName` |
|---|---|---|---|---|---|---|
| `wind` | first hour with the highest wind | m/s | max wind | – | – | – |
| `rain` | first hour with the most rain | mm/h | max rain | – | – | – |
| `cold` | first hour with the lowest temperature | °C | min temperature | – | – | – |
| `heat` | first hour with the highest temperature | °C | max temperature | – | – | – |
| `noForecast` | first hour with a missing value | – | – | – | – | – |
| `beforeSunrise` | the entry's start | – | – | sunrise | – | – |
| `afterSunset` | the entry's end | – | – | sunset | – | – |
| `overlap` | – | – | – | – | the other scheduled activity | – |
| `travel` | – | distance km (0.1) | the plan's maximum km | – | – | the previous activity's place |

### 200 OK: every scheduled activity has started

The weather service is not contacted (spec User Story 5 scenario 2).

```json
{
  "savedAt": "2026-11-10T08:30:00Z",
  "status": "allPast",
  "forecastUpdatedAt": null,
  "entries": [
    { "date": "2026-11-12", "startTime": "10:00", "endTime": "12:00", "activityName": "Cycling",
      "past": true, "weather": null, "problems": [] }
  ]
}
```

### 401 / 403 / 404

As above. The 403 and 404 bodies are the same as for `GET /api/plans/{id}`.

### 429 Too Many Requests

The body is the same as for the other requests under the `PlanSetup` limit. A `Retry-After` header is sent when known.

```json
{ "status": 429, "title": "Too many requests.", "detail": "Too many requests. Wait a minute and try again." }
```

### 503 Service Unavailable: the weather service failed

The service did not answer in time, could not be reached, or sent an answer that could not be used. The failure is logged by the client with its time and kind, without the user (spec FR-016). The saved plan is unchanged.

```json
{
  "status": 503,
  "title": "Service unavailable.",
  "detail": "The weather service is unavailable. No forecast is shown.",
  "service": "forecast"
}
```

The page shows "Error: The forecast could not be updated. Your saved plan is unchanged." with **Retry**. The `detail` text is not shown (research section 10).

### 500 Internal Server Error

The general problem body from `ApiExceptionHandler`. The page shows "Error: Something went wrong. Try again." with **Retry**.

## Browser API function

`frontend/src/api/planCheckApi.ts`:

```ts
export type PlanCheckAnswer =
  | { kind: "check"; check: PlanCheck }   // 200, status "checked" or "allPast"
  | { kind: "unauthorized" }              // 401
  | { kind: "forbidden" }                 // 403
  | { kind: "notFound" }                  // 404
  | { kind: "tooManyRequests" }           // 429
  | { kind: "weatherUnavailable" }        // 503 with service "forecast"

export function checkPlan(id: string, signal?: AbortSignal): Promise<PlanCheckAnswer>
```

Any other status throws `ApiError`. Network errors and aborts pass through. The store treats them all as a server error, as the existing plan step stores do.
