# API Contract: POST /api/plan-schedule

**Date**: 2026-11-16 | **Plan**: [plan.md](../plan.md)

## Overview

Generates a schedule for a checked plan. The server rechecks the plan, fetches the forecast and places from their caches (or re-fetches if stale), runs the greedy scheduling algorithm, and returns the full schedule.

| Field           | Value                                       |
|-----------------|---------------------------------------------|
| Method          | `POST`                                      |
| Path            | `/api/plan-schedule`                        |
| Auth            | PlanCreator policy (Visitor or Active Registered User) |
| Rate limit      | Shared `PlanSetup` limit — 30 req/min per address, combined with forecast, places and location search |
| Content-Type    | `application/json`                          |
| Response type   | `application/json`                          |

---

## Request Body

Same shape as `POST /api/plan-forecast` and `POST /api/plan-places`.

```json
{
  "setup": {
    "locationId": "123e4567-e89b-12d3-a456-426614174000",
    "radiusKm": 10,
    "startDate": "2026-11-14",
    "endDate": "2026-11-20"
  },
  "activities": [
    {
      "id": "aaaaaaaa-0000-0000-0000-000000000001",
      "name": "Kayaking",
      "durationHours": 2,
      "categoryId": "bbbbbbbb-0000-0000-0000-000000000001",
      "type": "outdoor",
      "requiresDaylight": true,
      "maxWindMs": 8.0,
      "maxRainMmPerHour": 1.0,
      "minTemperatureC": 10.0,
      "maxTemperatureC": null
    },
    {
      "id": "aaaaaaaa-0000-0000-0000-000000000002",
      "name": "City Museum",
      "durationHours": 3,
      "categoryId": "bbbbbbbb-0000-0000-0000-000000000002",
      "type": "indoor",
      "requiresDaylight": false,
      "maxWindMs": null,
      "maxRainMmPerHour": null,
      "minTemperatureC": null,
      "maxTemperatureC": null
    }
  ]
}
```

**Validation** (same rules as `/api/plan-forecast`):

| Field                        | Rule                                   |
|------------------------------|----------------------------------------|
| `setup.locationId`           | Required, valid UUID                   |
| `setup.radiusKm`             | Required, 1–50                         |
| `setup.startDate`            | Required, ISO date, today or later     |
| `setup.endDate`              | Required, ISO date, >= startDate       |
| `activities`                 | Required, at least 1 item              |
| `activities[].id`            | Required, valid UUID                   |
| `activities[].name`          | Required, 1–100 chars                  |
| `activities[].durationHours` | Required, 1–24                         |
| `activities[].categoryId`    | Required, valid UUID                   |
| `activities[].type`          | Required, `"outdoor"` or `"indoor"`    |

---

## Responses

### 200 OK — Schedule generated

```json
{
  "scheduled": [
    {
      "activityName": "Kayaking",
      "date": "2026-11-15",
      "startTime": "10:00",
      "endTime": "14:00",
      "place": {
        "name": "Nemuno slipway",
        "latitude": 54.89720,
        "longitude": 23.88610,
        "distanceKm": 3.4,
        "area": "Kaunas"
      },
      "weather": {
        "temperatureC": 12.5,
        "rainMmPerHour": 0.0,
        "windMs": 3.2,
        "isIndoor": false
      }
    },
    {
      "activityName": "City Museum",
      "date": "2026-11-14",
      "startTime": "06:00",
      "endTime": "22:00",
      "place": {
        "name": "National Museum",
        "latitude": 54.89910,
        "longitude": 23.90220,
        "distanceKm": 1.1,
        "area": "Kaunas"
      },
      "weather": {
        "temperatureC": null,
        "rainMmPerHour": null,
        "windMs": null,
        "isIndoor": true
      }
    }
  ],
  "unscheduled": [
    {
      "activityName": "Rock Climbing",
      "reason": "noPlace"
    },
    {
      "activityName": "Cycling",
      "reason": "noSuitableTime"
    }
  ]
}
```

**Fields:**

| Field | Notes |
|-------|-------|
| `scheduled[].date` | ISO date string `"yyyy-MM-dd"` |
| `scheduled[].startTime` | `"HH:mm"` (24-hour) |
| `scheduled[].endTime` | `"HH:mm"` (24-hour) |
| `scheduled[].place` | Same shape as place entries in `/api/plan-places` response |
| `scheduled[].weather.isIndoor` | `true` → all weather fields are `null`; display "Weather does not affect this indoor activity." |
| `unscheduled[].reason` | `"noPlace"` or `"noSuitableTime"` |

Both `scheduled` and `unscheduled` arrays may be empty. An empty `scheduled` with non-empty `unscheduled` is a valid result (no activity could be scheduled).

---

### 400 Bad Request — Plan out of date

Same shape as the forecast and places endpoints. The `errors` field may include `"setup"` (location or dates changed) or `"activities"` (one or more activities changed).

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "setup": ["Plan setup has changed. Return to Plan Setup."],
    "activities": ["One or more activities have changed. Return to Activity Selection."]
  }
}
```

Frontend behaviour: `"setup"` key → redirect to `/plan/setup`; `"activities"` key → redirect to `/plan/activities`.

---

### 400 Bad Request — Field validation failure

Standard `ValidationProblemDetails` for missing or invalid request fields.

---

### 403 Forbidden

Caller is not a Visitor or Active Registered User (Active Administrator, Suspended, or deleted account). No body beyond the standard problem details.

---

### 429 Too Many Requests

The shared `PlanSetup` rate limit was reached.

```json
{
  "type": "https://tools.ietf.org/html/rfc6585#section-4",
  "title": "Too Many Requests",
  "status": 429
}
```

---

### 503 Service Unavailable — External service failure

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.6.4",
  "title": "Service Unavailable",
  "status": 503,
  "service": "forecast"
}
```

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.6.4",
  "title": "Service Unavailable",
  "status": 503,
  "service": "places"
}
```

`service` values and their frontend messages:

| `service`    | Frontend message                                        |
|--------------|---------------------------------------------------------|
| `"forecast"` | "Error: The weather service is unavailable."            |
| `"places"`   | "Error: The map data service is unavailable. No places are shown." |

---

### 500 Internal Server Error

Unexpected server error. Standard problem details, no schedule data.

---

## Scheduling Guarantees

The 200 response always satisfies:

1. Every activity in `activities[]` appears exactly once in either `scheduled` or `unscheduled`.
2. No two entries in `scheduled` have the same `date` and overlapping `[startTime, endTime)` intervals.
3. Each `scheduled` entry's `[startTime, endTime)` is a subset of a suitable forecast period for that activity on that date.
4. Each `scheduled` entry has `endTime > startTime` and the interval length ≥ the activity's `durationHours`.
5. Activities are assigned in plan order (the order given in `activities[]`); earlier activities get priority when time slots compete.
