# API Contract: Plan Location and Dates

Base path `/api`. JSON only. Messages have no "Error: " prefix; the frontend adds it. Unknown JSON properties are ignored. Numbers must be JSON numbers, not strings (existing strict number handling).

## Authorization

All three endpoints use the policy `PlanCreator` (research section 8).

| Caller | Result |
|---|---|
| Not signed in (Visitor) | Allowed |
| Signed in, Registered User, Active | Allowed |
| Signed in, Registered User, Suspended | `403` |
| Signed in, Administrator, Active | `403` |
| Signed in, Administrator, Suspended | `403` |
| Cookie whose account no longer exists | `403` |

`403` uses the existing cookie event (no body is required by the client).

## Request limit

Location search and the plan setup check share the rate limiting policy `PlanSetup` (research section 14): at most 30 requests per 60-second fixed window per client network address. The values are configurable under `RateLimiting:PlanSetup`. The limit is checked before authorization, the cache and the geocoding service. The date limits endpoint is not limited, because it makes no external call.

- `429`: problem details `{ "status": 429, "title": "Too many requests.", "detail": "Too many requests. Wait a minute and try again." }`, plus a `Retry-After` header (seconds) when available. The request does nothing else.

## Location object

```json
{
  "id": 598316,
  "name": "Kaunas",
  "area": "Kaunas County",
  "latitude": 54.90156,
  "longitude": 23.90909
}
```

## Search locations

`GET /api/locations?query=<text>`

- `200`: `{ "locations": [ <location>, ... ] }` with 0 to 10 places in Lithuania, in the order the geocoding service returns. An empty list means nothing was found. Only the trimmed text before the first comma is searched; when fewer than 2 characters remain there, the answer is an empty list and the geocoding service is not called (research section 1).
- `400`: `ValidationProblemDetails` with `errors.query = ["Enter between 2 and 100 characters."]` when the trimmed text is shorter than 2 or longer than 100 characters, or missing.
- `429`: see Request limit. The page shows "Error: Too many requests. Wait a minute and try again."
- `503`: problem details `{ "status": 503, "title": "Service unavailable.", "detail": "Location search is unavailable. Try again later." }` when the geocoding service fails, times out (5 s) or returns something unreadable.

## Get the date limits

`GET /api/plan-setup/period`, policy `PlanCreator`, **not** rate limited (no external call). The page calls it when Plan setup opens and uses only these values for the date picker and its add-date checks (spec FR-010, research section 6).

- `200`: `{ "firstDate": "2026-11-04", "lastDate": "2026-11-10", "maxDates": 7 }`. `firstDate` is today in Lithuania, `lastDate` is `firstDate` + 6, and `maxDates` is `PlanSetupValidator.MaxDates`.
- `403`: see Authorization.

## Check a plan setup

`POST /api/plan-setup/check`

Request:

```json
{
  "locationId": 598316,
  "dates": ["2026-11-08", "2026-11-07"],
  "maxTravelDistanceKm": 30
}
```

| Field | Type | Notes |
|---|---|---|
| `locationId` | number or null | Geocoding id from a search result |
| `dates` | array of `yyyy-MM-dd` strings, or null | Any order |
| `maxTravelDistanceKm` | number or null | null means 30 |

- `200`, the checked setup. Dates are sorted and the location comes from the server lookup:

  ```json
  {
    "location": { "id": 598316, "name": "Kaunas", "area": "Kaunas County", "latitude": 54.90156, "longitude": 23.90909 },
    "dates": ["2026-11-07", "2026-11-08"],
    "maxTravelDistanceKm": 30
  }
  ```

- `400`: `ValidationProblemDetails`, title "One or more request fields are invalid.", with keys in this order:

  ```json
  {
    "errors": {
      "locationId": ["Select a location in Lithuania from the list."],
      "dates": ["Add at least one date."],
      "dates[1]": ["This date is already added."],
      "maxTravelDistanceKm": ["Enter a whole number between 1 and 200."]
    }
  }
  ```

  Messages per key are listed in `data-model.md` (Validation rules). A body that is not valid JSON, a date not in `yyyy-MM-dd` form or a string where a number belongs gives the existing `errors.request = ["The request is invalid."]`.
- `403`: see Authorization.
- `429`: see Request limit. The page shows "Error: Too many requests. Wait a minute and try again." with Retry.
- `503`: as for search, when the location had to be looked up and the geocoding service failed. The page shows its general server error for this.

## Technical failure

Any other unexpected exception gives the existing `500` problem details ("An unexpected error occurred.").

## Not provided

No endpoint stores a plan.
