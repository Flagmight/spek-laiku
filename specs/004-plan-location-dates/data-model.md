# Data Model: Plan Location and Dates

This feature stores **nothing in the database** and adds **no migration**. The plan setup lives in the browser tab's session storage (research section 7). The types below are backend service models, API DTOs and frontend state.

## Backend service models (`backend/src/SpekLaiku.Api/Services/`)

### PlaceLocation (record)

A place in Lithuania returned by the location search or the lookup by id.

| Field | Type | Rule |
|---|---|---|
| `Id` | `long` | Open-Meteo geocoding id; > 0 |
| `Name` | `string` | Place name in English where available |
| `Area` | `string` | From `LocationAreaName.For(...)` (research section 3) |
| `Latitude` | `double` | WGS84 |
| `Longitude` | `double` | WGS84 |

Only places with `country_code == "LT"` become a `PlaceLocation`; others are dropped (search) or treated as not found (lookup).

### CheckedPlanSetup (record)

The result of a successful check.

| Field | Type | Rule |
|---|---|---|
| `Location` | `PlaceLocation` | From the server lookup, never from the request |
| `Dates` | `IReadOnlyList<DateOnly>` | 1 to 7, distinct, sorted ascending, each within the forecast period |
| `MaxTravelDistanceKm` | `int` | 1 to 200; 30 when the request sent null |

### ForecastPeriod

| Member | Meaning |
|---|---|
| `Days = 7` | Length of the period including today |
| `TimeZoneId = "Europe/Vilnius"` | Zone used for "today" |
| `FirstDate` / `LastDate` (`DateOnly`) | Today in Lithuania and today + 6, from the injected `TimeProvider` |


The page receives `FirstDate`, `LastDate` and `PlanSetupValidator.MaxDates` through `GET /api/plan-setup/period` (`PlanPeriodResponse`) and computes no dates itself (research section 6).
### PlanSetupResult

`Success(CheckedPlanSetup)` or `Invalid(IReadOnlyDictionary<string, string> errors)`. Keys are in the order `locationId`, `dates`, `dates[i]` (ascending i), `maxTravelDistanceKm`.

### LocationSearchResult

`Success(IReadOnlyList<PlaceLocation>)` (0 to 10 items, in the service's order) or `Invalid(errors)` with key `query`.

## Validation rules

| Input | Rule | Message (API, without "Error: ") |
|---|---|---|
| `query` | 2 to 100 characters after trimming | "Enter between 2 and 100 characters." |
| `locationId` | present, > 0, found by lookup, country `LT` | "Select a location in Lithuania from the list." |
| `dates` | at least 1 | "Add at least one date." |
| `dates` | at most 7 (no per-date checks when exceeded) | "You can add up to 7 dates." |
| `dates[i]` | not equal to an earlier entry | "This date is already added." |
| `dates[i]` | ≥ `ForecastPeriod.FirstDate` | "Dates cannot be in the past." |
| `dates[i]` | ≤ `ForecastPeriod.LastDate` | "Forecast is not available that far ahead." |
| `maxTravelDistanceKm` | null (→ 30), or a whole number 1 to 200 | "Enter a whole number between 1 and 200." |

Frontend only (no request is sent): "Add date" with no date picked or an unreadable date gives "Choose a date first." (spec FR-011), and distance text that is not a number gives "Enter a whole number between 1 and 200.".

The location lookup is skipped when the location id is missing or not positive.

## External service shapes (`backend/src/SpekLaiku.Api/Clients/`)

- `GeocodingPlace` (record): `Id`, `Name`, `Latitude`, `Longitude`, `CountryCode`, `Admin1?`, `Admin2?`. The fields are mapped from the JSON `id`, `name`, `latitude`, `longitude`, `country_code`, `admin1` and `admin2`. Other fields are ignored.
- The search response has `results` (missing when nothing matches, which is read as an empty list). The get response is the place object itself.
- `ExternalServiceException(ExternalService service, FailureKind kind, int? statusCode)`. `FailureKind` is `Timeout`, `Network`, `UnexpectedStatus` or `InvalidResponse`.

## Frontend state (`frontend/src/types/planSetup.ts`, `frontend/src/stores/`)

### PlanLocation

`{ id: number, name: string, area: string, latitude: number, longitude: number }`. This is the same as the API location object.

### Plan setup store (`usePlanSetupStore`, persisted in `sessionStorage` under `spek-laiku-plan-setup`, version 1)

| Field | Type | Notes |
|---|---|---|
| `locationText` | `string` | What is typed in Location (max 100) |
| `location` | `PlanLocation \| null` | Set only by choosing a suggestion; cleared when `locationText` changes |
| `dates` | `string[]` | `yyyy-MM-dd`, kept sorted, no duplicates |
| `maxTravelDistanceText` | `string` | Starts as `"30"` |
| `checked` | `CheckedPlanSetup \| null` | Last successful check; set to null by any change above |

Actions: `setLocationText`, `chooseLocation`, `addDate`, `removeDate`, `setMaxTravelDistanceText`, `setChecked`, `clear`.

State transitions of `checked`:

```text
null --(Continue succeeds)--> CheckedPlanSetup --(any change to location, dates or distance)--> null
any  --(logout / clear)--> null (and all fields back to their initial values)
```

### Plan period store (`usePlanPeriodStore`, not persisted)

`status: "loading" | "loaded" | "error"`, `period: { firstDate: string, lastDate: string, maxDates: number } | null` (as sent by the server), `controller`. Loaded each time Plan setup opens; `error` after a server error, network failure or 10 s without an answer.

### Location search store (`useLocationSearchStore`, not persisted)

`status: "idle" | "loading" | "loaded" | "empty" | "unavailable" | "tooManyRequests"`, `results: PlanLocation[]`, `controller`. Fewer than 2 characters after trimming gives `idle`.

### Plan setup check store (`usePlanSetupCheckStore`, not persisted)

`status: "idle" | "pending" | "invalid" | "serverError" | "tooManyRequests"`, `errors` (keyed as in the API), `lastRequest`, `controller`.

## Configuration (`appsettings.json`)

| Key | Default | Meaning |
|---|---|---|
| `RateLimiting:PlanSetup:PermitLimit` | `30` | Location searches and plan setup checks allowed per window and network address (spec FR-027) |
| `RateLimiting:PlanSetup:WindowSeconds` | `60` | Length of the fixed window |

Both must be positive integers; start-up fails with a clear message otherwise. No secret is involved.
