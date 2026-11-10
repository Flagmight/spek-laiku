# Plan Forecast API

One endpoint under `/api/plan-forecast`. JSON uses camelCase, numbers are JSON numbers and a string where a number belongs is refused (the existing strict number handling). Dates are `"yyyy-MM-dd"` and times are `"HH:mm"` in Lithuanian time.

## Authorization

The `PlanCreator` policy from feature 004 applies:

| Caller | Result |
|---|---|
| Visitor (no sign-in cookie) | Allowed |
| Active Registered User | Allowed |
| Suspended Registered User | `403` |
| Active Administrator | `403` |
| Suspended Administrator | `403` |
| Sign-in cookie for a deleted account | `403` |

A refused caller never reaches the location search or weather service.

## Request limit

The endpoint uses the existing `PlanSetup` rate limiting policy, so its requests count **together with** `GET /api/locations` and `POST /api/plan-setup/check`: at most 30 per minute per network address by default (`RateLimiting:PlanSetup`). The 31st request in the window gets `429` with `Retry-After` and:

```json
{ "status": 429, "title": "Too many requests.", "detail": "Too many requests. Wait a minute and try again." }
```

It reaches neither service and is not logged.

## Get the forecast for the plan

`POST /api/plan-forecast`

Request: the checked setup and activities, in the shapes of `POST /api/plan-setup/check` (feature 004) and `POST /api/plan-activities/check` (feature 005):

```json
{
  "setup": {
    "locationId": 593116,
    "dates": ["2026-11-14", "2026-11-15"],
    "maxTravelDistanceKm": 30
  },
  "activities": [
    {
      "categoryId": "6f1c2c1e-5d8c-4a5e-9b1a-2b7f0c3e9d41",
      "type": "Outdoor",
      "durationHours": 2,
      "requiresDaylight": true,
      "maxWindMs": 8,
      "maxRainMmPerHour": 0.5,
      "minTemperatureC": 15,
      "maxTemperatureC": 35
    },
    {
      "categoryId": "0b5f7f0e-2a51-4e1e-8f7c-3c1f0d5b2a77",
      "type": "Indoor",
      "durationHours": 1.5,
      "requiresDaylight": false,
      "maxWindMs": null,
      "maxRainMmPerHour": null,
      "minTemperatureC": null,
      "maxTemperatureC": null
    }
  ]
}
```

### `200`: the forecast

```json
{
  "updatedAt": "14:05",
  "days": [
    {
      "date": "2026-11-14",
      "sunrise": "07:46",
      "sunset": "16:15",
      "hours": [
        { "start": "06:00", "end": "07:00", "temperatureC": 4.2, "rainMmPerHour": 0.0, "windMs": 3.1, "daylight": false },
        { "start": "12:00", "end": "13:00", "temperatureC": 16.4, "rainMmPerHour": 1.2, "windMs": 9.0, "daylight": true },
        { "start": "21:00", "end": "22:00", "temperatureC": null, "rainMmPerHour": null, "windMs": null, "daylight": false }
      ]
    }
  ],
  "activities": [
    {
      "weatherIndependent": false,
      "suitableHours": 3,
      "datesWithSuitableHours": 1,
      "hasLongEnoughPeriod": true,
      "days": [
        {
          "date": "2026-11-14",
          "periods": [
            { "start": "10:00", "end": "11:00", "lengthHours": 1, "shorterThanDuration": true },
            { "start": "13:00", "end": "15:00", "lengthHours": 2, "shorterThanDuration": false }
          ],
          "hours": [
            { "start": "06:00", "suitable": false, "reasons": ["Too cold: 4.2 °C, minimum 15.0 °C", "Outside daylight"] },
            { "start": "12:00", "suitable": false, "reasons": ["Too much rain: 1.2 mm/h, maximum 0.5 mm/h", "Too windy: 9.0 m/s, maximum 8.0 m/s"] },
            { "start": "21:00", "suitable": false, "reasons": ["Outside daylight", "No forecast for this hour"] }
          ]
        }
      ]
    },
    {
      "weatherIndependent": true,
      "suitableHours": 32,
      "datesWithSuitableHours": 2,
      "hasLongEnoughPeriod": true,
      "days": [ "… same shape, every hour suitable …" ]
    }
  ]
}
```

(The arrays are shortened here; a real day has one entry per planning hour.)

- `days` has one entry per plan date in date order. `hours` lists the planning hours from 06:00 to 22:00 (`Forecast:FirstHour` and `Forecast:LastHour`). On today's date, hours that have already started are left out, and the list is empty when none is left. A value is `null` when the weather service has none ("No data").
- Every value is rounded to one decimal place, and that rounded value is the one compared with the limits (`data-model.md`, research section 5).
- `activities` has one entry per requested activity, **in request order**. Its `days[i].hours[j]` matches `days[i].hours[j]` of the top-level list.
- `reasons` are ready to show, in the order of `data-model.md` (HourSuitabilityRules), without an "Error: " prefix. An empty list means suitable.
- `updatedAt` is when the forecast was received from the weather service. It is never more than `Forecast:MaxAgeMinutes` (30) old.

### `400`: the setup or the activities are out of date

`ValidationProblemDetails` with the keys and messages of the two Continue checks:

```json
{
  "status": 400,
  "title": "One or more request fields are invalid.",
  "errors": { "setup.dates[0]": ["Dates cannot be in the past."] }
}
```

- Any key starting with `setup` means the setup failed (feature 004 rules; `setup` alone when the object is missing). The activities are not checked then.
- Otherwise the keys are those of `POST /api/plan-activities/check` (`activities`, `activities[i]`, `activities[i].<field>`).
- A body that cannot be read gives the existing `{ "request": ["The request is invalid."] }`.
- The weather service is never called for a `400`.

### `403`

See Authorization.

### `503`: a service is unavailable

```json
{
  "status": 503,
  "title": "Service unavailable.",
  "detail": "The weather service is unavailable. No forecast is shown.",
  "service": "forecast"
}
```

- `service` is `"forecast"` when the weather service failed: an error status, no answer within 4 seconds, a network failure, or an answer without the hourly values or the sunrise and sunset of a period date.
- It is `"locationSearch"`, with the existing detail "Location search is unavailable. Try again later.", when the location lookup in the setup check failed.
- Every service failure is logged once as a warning with only the service, the kind of failure and the status code. The position, dates, location id and user are never logged.
- The `503` answers of `GET /api/locations` and `POST /api/plan-setup/check` gain the same `service` field. Nothing else in them changes.

### `500`

Any other failure: the existing general problem answer from `ApiExceptionHandler`.

## How the page uses the answers

| Answer | Step 3 shows |
|---|---|
| `200` | The forecast, and "Forecast updated at <updatedAt>" |
| `400` with a `setup…` key | Redirect to the Plan setup page with the notice "Your plan setup needs to be checked again. Select Continue." |
| `400` with other keys except `request` | Redirect to Activity selection with "Your activities need to be checked again. Select Continue." |
| `403` | The current user is read again, so the route guard shows Access denied or Account suspended; meanwhile "Error: Something went wrong. Try again." with Retry |
| `429` | "Error: Too many requests. Wait a minute and try again." with Retry |
| `503` with `service: "forecast"` | "Error: The weather service is unavailable. No forecast is shown." with Retry |
| Any other status, `400` with `request`, a 10-second timeout, or a network failure | "Error: Something went wrong. Try again." with Retry |

## Not provided

No `GET` variant, no forecast for a place other than the plan's location, no stored forecast, and no hours outside the planning window.
