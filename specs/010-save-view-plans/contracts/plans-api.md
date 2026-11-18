# API Contract: Saved plans (`/api/plans`)

**Date**: 2026-11-18 | **Plan**: [plan.md](../plan.md) | **Data model**: [data-model.md](../data-model.md)

All three endpoints:

- **Authorization**: policy `ActiveRegisteredUser`, a signed-in account with role "Registered User" and status Active, read on every request (research section 7).
  - Not signed in, or the session has ended → **401** with no body.
  - Signed in as an Administrator or a Suspended user → **403**, with the API's standard problem body (`application/problem+json`, as for every other 403, feature 003 contract) and no plan data.
- **Rate limit**: none. No external service is called (spec FR-016).
- **Unexpected failure**: **500**, the general problem body from `ApiExceptionHandler`.
- Times are UTC ISO 8601 and dates `yyyy-MM-dd`. JSON is camelCase.

---

## POST /api/plans: save a generated schedule

### Request

```json
{
  "generatedScheduleId": "6f1c2a8e-3b7d-4e55-9a10-0c4f2d9b7e31",
  "name": "Weekend in Kaunas"
}
```

| Field | Type | Rules |
|---|---|---|
| `generatedScheduleId` | string (GUID) | Required. The `generatedScheduleId` from `POST /api/plan-schedule`, at most 30 minutes old. |
| `name` | string | Required. 1 to 80 characters after trimming. Not unique. |

Any other field, including an `ownerId`, is ignored. The plan always belongs to the signed-in user (spec FR-013).

### 201 Created: plan saved

`Location: /api/plans/{id}`

```json
{
  "id": "0b8f4c1e-7d2a-4f3b-9e6c-5a1d2c3b4e5f",
  "name": "Weekend in Kaunas",
  "locationName": "Kaunas",
  "dates": ["2026-11-21", "2026-11-22"],
  "savedAt": "2026-11-18T12:05:00Z"
}
```

### 200 OK: already saved

The same user already saved this `generatedScheduleId`, for example after a double click or a Retry. The body is the existing plan, in the same shape as 201. No second plan is created (spec FR-005).

### 400 Bad Request: invalid

A validation problem. One or both keys can appear:

```json
{
  "title": "One or more request fields are invalid.",
  "status": 400,
  "errors": {
    "name": ["Enter a plan name."],
    "generatedScheduleId": ["Generate the schedule again to save it."]
  }
}
```

| Key | Message | When |
|---|---|---|
| `name` | "Enter a plan name." | Missing, empty or only spaces |
| `name` | "Plan name can be at most 80 characters." | More than 80 characters after trimming |
| `generatedScheduleId` | "Generate the schedule again to save it." | Missing, unknown, expired, or already saved by another user |
| `generatedScheduleId` | "There is nothing to save in this schedule." | The schedule has no scheduled activity |
| `request` | "The request is invalid." | The body is empty or not JSON (existing rule) |

A `generatedScheduleId` that is not a GUID is a model-binding error and is reported as `generatedScheduleId: ["Invalid value."]` by the existing `InvalidModelStateResponseFactory`. The page treats any `generatedScheduleId` error as "expired".

---

## GET /api/plans: the signed-in user's saved plans

### 200 OK

The user's plans, newest saved first (ties ordered by `id`). The array is empty when the user has none. No plan of another user is ever included.

```json
[
  {
    "id": "0b8f4c1e-7d2a-4f3b-9e6c-5a1d2c3b4e5f",
    "name": "Weekend in Kaunas",
    "locationName": "Kaunas",
    "dates": ["2026-11-21", "2026-11-22"],
    "savedAt": "2026-11-18T12:05:00Z"
  }
]
```

---

## GET /api/plans/{id}: one saved plan

`{id}` is a GUID. An address whose id is not a GUID does not match the route and gives **404**.

### 200 OK

```json
{
  "id": "0b8f4c1e-7d2a-4f3b-9e6c-5a1d2c3b4e5f",
  "name": "Weekend in Kaunas",
  "savedAt": "2026-11-18T12:05:00Z",
  "location": { "name": "Kaunas", "area": "Kaunas City Municipality", "latitude": 54.90272, "longitude": 23.90961 },
  "dates": ["2026-11-21", "2026-11-22"],
  "maxTravelDistanceKm": 30,
  "scheduled": [
    {
      "activityName": "Cycling",
      "date": "2026-11-21",
      "startTime": "10:00",
      "endTime": "13:00",
      "place": { "name": "Nemunas cycle path", "latitude": 54.8972, "longitude": 23.8861, "distanceKm": 3.4, "area": "Kaunas" },
      "weather": { "temperatureC": 8.5, "rainMmPerHour": 0.0, "windMs": 3.2, "isIndoor": false },
      "travel": null
    }
  ],
  "unscheduled": [
    { "activityName": "Kayaking", "reason": "noSuitableTime" }
  ],
  "travel": { "maxDistanceKm": 30, "tripsOverLimit": 0 }
}
```

`scheduled`, `unscheduled` and `travel` have exactly the shapes of the `POST /api/plan-schedule` response (features 008 and 009), as they were when the plan was saved. Opening a plan never calls the weather or map data services (spec FR-010).

### 403 Forbidden

The plan exists but belongs to another user. The body is the API's standard 403 problem body and contains no plan data: no name, dates, location or schedule (spec FR-012, clarification Q4).

### 404 Not Found

No plan has this id. Problem body with `"detail": "This plan no longer exists."`.
