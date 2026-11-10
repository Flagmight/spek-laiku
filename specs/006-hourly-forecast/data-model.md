# Data Model: Hourly Forecast

Nothing is stored in the database: no entity, no schema change, no migration. The models below exist only while a request runs (backend) or while step 3 is open (frontend). Times are Lithuanian local times. `TimeOnly` values are sent as `"HH:mm"` and dates as `"yyyy-MM-dd"`.

## Client models (`backend/src/SpekLaiku.Api/Clients/`)

### IForecastClient

`Task<HourlyForecast> GetAsync(double latitude, double longitude, DateOnly firstDate, DateOnly lastDate, CancellationToken cancellationToken)`. Throws `ExternalServiceException(ExternalService.Forecast, kind, status)` on every failure (research section 11). Tests replace it with `FakeForecastClient` (integration) or call `OpenMeteoForecastClient` through `FakeHttpMessageHandler` (unit).

### HourlyForecast (record)

| Field | Type | Notes |
|---|---|---|
| `Hours` | `IReadOnlyList<ForecastHourValues>` | One entry per hour the service sent, in time order. |
| `Days` | `IReadOnlyList<ForecastDaylight>` | One entry per day the service sent. |

### ForecastHourValues (record)

| Field | Type | Notes |
|---|---|---|
| `Time` | `DateTimeOffset` | The exact instant the values are stamped at. |
| `TemperatureC` | `double?` | Instant value at `Time`. `null` when the service has none. |
| `PrecipitationMm` | `double?` | Sum of the hour **before** `Time` (research section 2). |
| `WindSpeedMs` | `double?` | Instant value at `Time`, in m/s. |

### ForecastDaylight (record)

`Date` (`DateOnly`, the Lithuanian date), `Sunrise` and `Sunset` (`DateTimeOffset`). An answer without the sunrise or sunset of a date in the requested period is `InvalidResponse`.

### ExternalService (enum, changed)

`LocationSearch`, `Forecast` (new).

## Service models (`backend/src/SpekLaiku.Api/Services/`)

### ForecastPeriod (changed)

New method `DateTimeOffset GetNow()`: the injected `TimeProvider`'s current time converted to Lithuanian time (`TimeZoneId`). `GetCurrent()` uses it too. This is the only clock the forecast services read, so "today", "now" and `ReceivedAt` always agree with the forecast period, and the integration tests control all of them through `PostgreSqlApiFactory.Clock` (research section 3).

### ForecastOptions (section `Forecast`)

| Setting | Default | Rule (validated at start) |
|---|---|---|
| `MaxAgeMinutes` | 30 | > 0 |
| `FirstHour` | 6 | 0 ≤ `FirstHour` < `LastHour` |
| `LastHour` | 22 | `LastHour` ≤ 23; the last planning hour is (`LastHour` − 1):00 to `LastHour`:00 |

### ReceivedForecast (record)

`Data` (`HourlyForecast`), `ReceivedAt` (`DateTimeOffset`, from `ForecastPeriod.GetNow()` when the service answered).

### WeatherForecastService

`Task<ReceivedForecast> GetAsync(PlaceLocation location, CancellationToken cancellationToken)`. It asks for the whole current forecast period (`ForecastPeriod.GetCurrent()`) and caches the answer under `forecast:<location.Id>:<firstDate>`. A cached answer is reused only while `ForecastPeriod.GetNow() − ReceivedAt < MaxAgeMinutes` (research section 4). Failures are not cached. It does not inject `TimeProvider` itself.

### PlanningHour (record)

| Field | Type | Notes |
|---|---|---|
| `Start` | `TimeOnly` | HH:00, from `FirstHour` to `LastHour` − 1. |
| `End` | `TimeOnly` | `Start` + 1 hour. |
| `TemperatureC` | `decimal?` | Rounded to one decimal place (research section 5); `null` is "No data". |
| `RainMmPerHour` | `decimal?` | The same. |
| `WindMs` | `decimal?` | The same. |
| `Daylight` | `bool` | True when `Start` ≥ sunrise and `End` ≤ sunset on that date. |

### PlanningDay (record)

`Date` (`DateOnly`), `Sunrise` and `Sunset` (`TimeOnly`, rounded down to the minute for display), `Hours` (`IReadOnlyList<PlanningHour>`, empty when today has no hour left).

### PlanningDays (static)

`IReadOnlyList<PlanningDay> Build(HourlyForecast forecast, IReadOnlyList<DateOnly> dates, DateTimeOffset now, ForecastOptions options)` builds one day per plan date, in date order:
- Hours from `FirstHour` to `LastHour` − 1. On today's date, hours whose start is at or before `now` are left out.
- Temperature and wind come from the entry stamped at the hour's start, and rain from the entry stamped one hour later (research section 2).
- A missing entry or value is `null`.
- Daylight is compared with the exact sunrise and sunset instants, not the rounded display times.

### HourSuitabilityRules (static)

`IReadOnlyList<string> Check(PlanningHour hour, CheckedPlanActivity activity)` returns the reasons in this order (empty means suitable). Values are formatted with one decimal place, invariant culture:

| # | When | Reason |
|---|---|---|
| 1 | Outdoor, all three values present, temperature < `MinTemperatureC` | `Too cold: <t> °C, minimum <min> °C` |
| 2 | Outdoor, all present, temperature > `MaxTemperatureC` | `Too warm: <t> °C, maximum <max> °C` |
| 3 | Outdoor, all present, rain > `MaxRainMmPerHour` | `Too much rain: <r> mm/h, maximum <max> mm/h` |
| 4 | Outdoor, all present, wind > `MaxWindMs` | `Too windy: <w> m/s, maximum <max> m/s` |
| 5 | `RequiresDaylight` and not `Daylight` | `Outside daylight` |
| 6 | Outdoor, and temperature, rain or wind is `null` | `No forecast for this hour` (instead of 1 to 4) |

An Indoor activity is checked only against row 5. A value equal to its limit passes.

### HourSuitability (record)

`Start` (`TimeOnly`), `Reasons` (`IReadOnlyList<string>`), `Suitable` (`Reasons.Count == 0`).

### SuitablePeriod (record)

`Start`, `End` (`TimeOnly`), `LengthHours` (`int`), `ShorterThanDuration` (`bool`, `LengthHours < DurationHours`). A length equal to the duration is not shorter.

### SuitablePeriods (static)

`IReadOnlyList<SuitablePeriod> From(IReadOnlyList<HourSuitability> hours, decimal durationHours)` joins runs of consecutive suitable hours, in time order. Hours are consecutive when one's `End` equals the next one's `Start`.

### ActivityDayForecast (record)

`Date` (`DateOnly`), `Periods` (`IReadOnlyList<SuitablePeriod>`), `Hours` (`IReadOnlyList<HourSuitability>`, one per `PlanningHour` of that day, same order).

### ActivityForecast (record)

| Field | Type | Notes |
|---|---|---|
| `WeatherIndependent` | `bool` | Indoor and not `RequiresDaylight`. The page then shows only the indoor message (spec FR-022). |
| `SuitableHours` | `int` | Suitable hours over all dates. |
| `DatesWithSuitableHours` | `int` | Dates with at least one suitable hour. |
| `HasLongEnoughPeriod` | `bool` | At least one period on any date has `ShorterThanDuration == false`. |
| `Days` | `IReadOnlyList<ActivityDayForecast>` | One per plan date, in date order. |

### ActivityForecasts (static)

`ActivityForecast For(CheckedPlanActivity activity, IReadOnlyList<PlanningDay> days)` runs `HourSuitabilityRules` on every hour, then `SuitablePeriods`, and counts.

### PlanForecast (record)

`UpdatedAt` (`TimeOnly`, `ReceivedAt` in Lithuanian time, to the minute), `Days` (`IReadOnlyList<PlanningDay>`), `Activities` (`IReadOnlyList<ActivityForecast>`, in the request's activity order).

### PlanForecastResult

`Success(PlanForecast)` or `Invalid(errors)`, where the errors keep their order: either only `setup…` keys or only `activities…` keys (see Validation).

### PlanForecastService

`Task<PlanForecastResult> GetAsync(PlanForecastRequest request, CancellationToken cancellationToken)` (research section 8):
1. `request.Setup` is `null`: `Invalid([("setup", "The request is invalid.")])`.
2. `PlanSetupService.CheckAsync(request.Setup)`. On failure, `Invalid` with every key prefixed `setup.` (for example `setup.dates[0]`).
3. `PlanActivityService.CheckAsync(new PlanActivitiesCheckRequest(request.Activities))`. On failure, `Invalid` with its keys unchanged.
4. `WeatherForecastService.GetAsync(setup.Location)`, `PlanningDays.Build(…, setup.Dates, forecastPeriod.GetNow(), options)`, and `ActivityForecasts.For` for each checked activity. The service gets the time only from `ForecastPeriod`, not from `TimeProvider`.

## Validation

The forecast endpoint adds no rule of its own. It reuses:

| Part | Rules | Keys in the `400` answer |
|---|---|---|
| `setup` missing | — | `setup` |
| `setup` fields | feature 004 `PlanSetupValidator` and the location lookup (`PlanSetupService`) | `setup.locationId`, `setup.dates`, `setup.dates[i]`, `setup.maxTravelDistanceKm` |
| `activities` | feature 005 `PlanActivityValidator` and `ActivityLimitRules` | `activities`, `activities[i]`, `activities[i].<field>` |
| Malformed JSON, a string for a number | the existing `InvalidModelStateResponseFactory` | `request` |

The page needs only the first part of the key: `setup…` means the setup is out of date, `activities…` means the activities are, and `request` is a server error.

## Frontend types (`frontend/src/types/planForecast.ts`)

```ts
interface ForecastHour { start: string; end: string; temperatureC: number | null; rainMmPerHour: number | null; windMs: number | null; daylight: boolean }
interface ForecastDay { date: string; sunrise: string; sunset: string; hours: ForecastHour[] }
interface SuitablePeriod { start: string; end: string; lengthHours: number; shorterThanDuration: boolean }
interface HourSuitability { start: string; suitable: boolean; reasons: string[] }
interface ActivityDayForecast { date: string; periods: SuitablePeriod[]; hours: HourSuitability[] }
interface ActivityForecast { weatherIndependent: boolean; suitableHours: number; datesWithSuitableHours: number; hasLongEnoughPeriod: boolean; days: ActivityDayForecast[] }
interface PlanForecast { updatedAt: string; days: ForecastDay[]; activities: ActivityForecast[] }
interface PlanForecastRequest { setup: PlanSetupCheckRequest; activities: PlanActivityRequest[] }
```

`PlanSetupCheckRequest` and `PlanActivityRequest` are the existing types. The request is built from the **checked** setup and activities: `locationId` from `checked.location.id`, the checked dates and distance, and each checked activity with its type and numbers.

## Frontend stores (`frontend/src/stores/`)

### Plan forecast store (`usePlanForecastStore`, new, not persisted)

| Field / action | Meaning |
|---|---|
| `status` | `"idle"`, `"loading"`, `"loaded"`, `"weatherUnavailable"`, `"tooManyRequests"`, `"serverError"`, `"setupOutdated"`, `"activitiesOutdated"` |
| `forecast` | `PlanForecast \| null`; set only with `"loaded"`, cleared by every other status (spec FR-006) |
| `controller` | The pending request's `AbortController` |
| `load(setup, activities)` | Ignored while `"loading"`. Sends the request with a 10-second timeout and sets the status from the outcome. On `setupOutdated` it calls `usePlanSetupStore.getState().markOutdated()`; on `activitiesOutdated` it calls `usePlanActivitiesStore.getState().markOutdated()`. On `forbidden` it refreshes the current user, as the check stores do. |
| `retry()` | `load` with the last setup and activities. |
| `reset()` | Aborts, and returns to the initial state. An answer for an aborted request is dropped (spec FR-006). |

### Plan setup store (`usePlanSetupStore`, changed, still version 1)

- New persisted field `recheckNotice: boolean` (initial `false`).
- New action `markOutdated()`: `checked = null`, `recheckNotice = true`.
- `setChecked` also sets `recheckNotice = false`; `clear` resets it.

### Plan activities store (`usePlanActivitiesStore`, changed, still version 1)

- The same new field `recheckNotice` and action `markOutdated()`.
- `setChecked` sets `recheckNotice = false`; `clear` resets it.
- `add`, `remove` and `update` leave it unchanged: only a successful Continue removes the notice.

## Helpers (`frontend/src/helpers/`)

| Helper | Result |
|---|---|
| `formatPlanDateLong(isoDate)` (in `formatPlanDate.ts`) | `"2026-11-14"` → `"Saturday 14 November 2026"` |
| `forecastSummaryText(forecast, totalDates, durationHours)` | `"Suitable hours: 9 on 2 of 3 dates."` (`"… of 1 date."` for a one-date plan, spec FR-022), with `" No period is long enough for this activity's 2 h."` added when `!hasLongEnoughPeriod`; `"No suitable hours on any of your dates. Try other dates or change this activity's limits."` when `suitableHours` is 0 |
| `suitablePeriodText(period, durationHours)` | `"★ Suitable 10:00–14:00 (4 h)"`, or with `", shorter than this activity's 2 h"` added |
| `planForecastRequest(setup, activities)` | The request above, from the checked values |

Each helper only words or reshapes values the server decided.
