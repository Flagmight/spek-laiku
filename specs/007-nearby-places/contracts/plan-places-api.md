# Plan Places API

This is one endpoint, `/api/plan-places`. JSON uses camelCase, and numbers are JSON numbers: a string where a number belongs is refused (the existing strict number handling). Times are `"HH:mm"` in Lithuanian time.

## Authorization

The `PlanCreator` policy from feature 004 applies, as for `/api/plan-forecast`:

| Caller | Result |
|---|---|
| Visitor (no sign-in cookie) | Allowed |
| Active Registered User | Allowed |
| Suspended Registered User | `403` |
| Active Administrator | `403` |
| Suspended Administrator | `403` |
| Sign-in cookie for a deleted account | `403` |

A refused caller never reaches the location search service, the database category lookup or the map data service.

## Request limit

The endpoint uses the existing `PlanSetup` rate limiting policy. Its requests count **together with** `GET /api/locations`, `POST /api/plan-setup/check` and `POST /api/plan-forecast`: at most 30 per minute per network address by default (`RateLimiting:PlanSetup`). The 31st request in the window gets `429` with `Retry-After` and this body:

```json
{ "status": 429, "title": "Too many requests.", "detail": "Too many requests. Wait a minute and try again." }
```

A refused request reaches no service, and it is not logged as a service failure.

## Get the places for the plan

`POST /api/plan-places`

**Request**: the same body as `POST /api/plan-forecast`, which is the checked setup and activities in the shapes of `POST /api/plan-setup/check` and `POST /api/plan-activities/check`:

```json
{
  "setup": {
    "locationId": 598316,
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

The server checks the setup and the activities again (`PlanRecheckService`). It takes the location's position from the location search service by `locationId`, and each category's map place tags from the database. No tag is read from the request.

### `200`: the places

```json
{
  "updatedAt": "14:05",
  "radiusKm": 30,
  "categories": [
    {
      "categoryId": "6f1c2c1e-5d8c-4a5e-9b1a-2b7f0c3e9d41",
      "places": [
        { "name": "Nemuno slipway", "latitude": 54.89012, "longitude": 23.93120, "distanceKm": 3.4, "area": "Kaunas" },
        { "name": "Lampėdžių valčių nuleidimo vieta", "latitude": 54.91770, "longitude": 23.85230, "distanceKm": 4.1, "area": null }
      ]
    },
    {
      "categoryId": "0b5f7f0e-2a51-4e1e-8f7c-3c1f0d5b2a77",
      "places": []
    }
  ]
}
```

- **`updatedAt`**: the oldest time, among the categories, at which their places were received from the map data service, in Lithuanian time to the minute. Places are reused for up to `Places:MaxAgeHours` (24).
- **`radiusKm`**: the search radius, `min(maxTravelDistanceKm, Places:MaxRadiusKm)` (default cap 50). The page uses it in "✗ No place found within 30 km."
- **`categories`**: one entry per distinct `categoryId` of the request, in order of first appearance. The page finds each activity's places by its `categoryId`, so two activities of the same category show the same places.
- **`places`**: at most `Places:MaxPlacesPerActivity` (5). They are ordered by `distanceKm`, then `name` (Lithuanian order). An empty list means no named place matched within the radius.
- **`distanceKm`**: the straight-line distance from the location to the place (the centre of a line or area), rounded to one decimal place. It is always ≤ `radiusKm`.
- **`latitude`, `longitude`**: rounded to 5 decimal places, for the "View on map" link.
- **`area`**: the place's own `addr:city`, or `null`.
- **Never included**: the category's map place tags, the map element ids or any other map data (spec FR-013).

### `400`: the setup or the activities are out of date

These are the same keys, in the same order, as `POST /api/plan-forecast`:

```json
{
  "status": 400,
  "title": "One or more request fields are invalid.",
  "errors": { "setup.dates[0]": ["Choose today or a date within the next 6 days."] }
}
```

- A missing `setup` gives `setup`. Setup errors give `setup.<key>`, and no activity check runs.
- Activity errors give the existing `activities…` keys.
- In every case the map data service is not contacted.
- A body that cannot be read, or a string for a number, gives `request`. The page shows the general error for it.

### `403`

The caller is not allowed (see Authorization). The body is empty.

### `429`

The shared request limit was reached (see Request limit).

### `503`: an external service failed

**Map data service** (timeout after 4 seconds, network failure, a non-success status including the service's own `429` and `504`, unreadable JSON, or a `remark` reporting a runtime error):

```json
{
  "status": 503,
  "title": "Service unavailable.",
  "detail": "The map data service is unavailable. No places are shown.",
  "service": "places"
}
```

- No places are returned for any category, even when some were reused from the cache (Clarifications: all or nothing).
- One warning is logged: `Map data service failed: <FailureKind> <StatusCode>`. It contains no position, tags, location id or identity.

**Location search service** (during the setup check): the existing answer with `"service": "locationSearch"`. The page shows "Error: Something went wrong. Try again." for it.

### `500`

Anything else, with the existing general problem body.

## How the page reads the answer (`api/planPlacesApi.ts`)

| Answer | Outcome |
|---|---|
| `200` | `{ kind: "places", places }` |
| `400` with any `setup…` key | `{ kind: "setupOutdated" }` |
| `400` with any other `activities…` key | `{ kind: "activitiesOutdated" }` |
| `403` | `{ kind: "forbidden" }` |
| `429` | `{ kind: "tooManyRequests" }` |
| `503` with `service: "places"` | `{ kind: "mapUnavailable" }` |
| Anything else (`400` with only `request`, another `503`, `5xx`) | throws `ApiError` |
| Network error, abort, the page's 10-second timeout | passes through (server error) |
