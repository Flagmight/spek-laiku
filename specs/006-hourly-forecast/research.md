# Research: Hourly Forecast

All decisions below resolve the open points of the Technical Context in `plan.md`. Nothing is left as NEEDS CLARIFICATION.

## 1. Weather service request (spec FR-003, FR-011, Assumptions)

- **Decision**: One call to the Open-Meteo forecast API per location and forecast period:
  `GET https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&hourly=temperature_2m,precipitation,wind_speed_10m&daily=sunrise,sunset&wind_speed_unit=ms&timezone=Europe%2FVilnius&timeformat=unixtime&start_date=<first>&end_date=<last>`.
  The dates are always the whole forecast period from `ForecastPeriod.GetCurrent()` (today and the next 6 days), not only the plan's dates.
- **Rationale**:
  - `temperature_2m` (°C, 2 m above ground), `precipitation` (mm, rain, showers and snow) and `wind_speed_10m` with `wind_speed_unit=ms` (m/s, 10 m above ground) match the spec's Assumptions and the units of the activity limits, so no unit conversion is needed.
  - `daily=sunrise,sunset` gives the daylight times from the same call.
  - `timeformat=unixtime` gives every time as an exact instant. The service converts nothing, and the backend converts to Lithuanian time with `TimeZoneInfo` (`ForecastPeriod.TimeZoneId`). `timezone=Europe/Vilnius` still makes the hours and days start at local midnight.
  - Asking for the whole period lets one cached answer serve every plan for that location today, whatever dates it has (section 4). It is 168 hours, a few kilobytes.
- **Alternatives considered**:
  - Local ISO times (`timeformat=iso8601`). Rejected: times without an offset are ambiguous on the day the clocks go back.
  - Only the plan's date range. Rejected: it gives a different cache entry for every date choice.
  - `wind_gusts_10m`, humidity, UV. Rejected: the activity limits have no such fields (spec Out of scope).

## 2. Which values describe one planning hour (spec FR-010, FR-011, FR-013 to FR-015)

- **Decision**: The hour HH:00–(HH+1):00 uses the temperature and wind stamped at HH:00, and the precipitation stamped at (HH+1):00. A value that is missing in the answer (a `null` or no entry for that time) is "No data".
- **Rationale**: Open-Meteo gives temperature and wind as instant values at the stamped time, and precipitation as the sum of the **preceding** hour. The precipitation stamped at (HH+1):00 is therefore exactly the rain that falls during the planning hour, and the instant values at the start describe the conditions when the hour begins. The rule is simple to explain and to test with fixed answers.
- **Alternatives considered**: The worse of the start and end values for temperature and wind. Rejected for now: it is harder to explain next to the shown value, and a neighbouring hour already shows the end value.

## 3. Planning hours, today and the clock change (spec FR-010, Clarifications, Edge cases)

- **Decision**:
  - For each plan date, the hours start at `Forecast:FirstHour` (6) and the last one starts at `Forecast:LastHour` − 1 (21). Both values are in configuration (section 9).
  - On today's date, an hour whose start is at or before the current time in Lithuania has already started and is left out. When none is left, the date has no hours and the page shows "No hours left to plan today."
  - Each hour's start is built as a Lithuanian local time and converted to an instant to look up its values (section 2).
- **Rationale**: Lithuania changes the clocks at 03:00 and 04:00 local time, outside the 06:00–22:00 window, so every planning hour exists exactly once on every date. No hour is invented or shown twice (spec Edge cases), and no special code is needed for those days. `TimeProvider` gives the current time, so tests control "today" and "now" (constitution III).
- **Alternatives considered**: All 24 hours. Rejected by the clarification. A day window chosen on the page. Rejected: it would widen the scope (spec Clarifications).

## 4. Freshness and reuse (spec FR-009, Assumptions)

- **Decision**: `WeatherForecastService` keeps the answer in the existing `IMemoryCache` under `forecast:<locationId>:<firstDate>`, together with the instant it was received (`TimeProvider`). An entry is used only while `now − receivedAt` is less than `Forecast:MaxAgeMinutes` (30). The cache entry also expires after the same time, so old answers do not stay in memory. Failures are not cached.
- **Rationale**:
  - The age is checked against `TimeProvider`, not only by the cache's own expiry, so tests can prove the 30-minute rule with a fixed clock.
  - The key holds the first date of the period, so an answer from yesterday is never used today.
  - The location id identifies the position, because the position always comes from the location search service (spec FR-004).
- **Alternatives considered**:
  - No reuse. Rejected: reloading the page or going Back and forward would call the public API every time.
  - A database table. Rejected: the spec stores nothing, and it would need a migration.

## 5. Rounding and comparison (spec FR-011, FR-018, Edge cases)

- **Decision**: Each value from the service (`double`) becomes a `decimal` rounded to one decimal place with `MidpointRounding.AwayFromZero`, once, when the planning hours are built. The rounded value is both shown and compared with the plan's limits (which are `decimal` with at most one decimal place since feature 003). Every comparison includes its limit (`>=` minimum, `<=` maximum).
- **Rationale**: The user sees the same number the rule used, so "15.0 °C, minimum 15.0 °C" can never be refused. `decimal` avoids binary rounding surprises such as 0.1 + 0.2.
- **Alternatives considered**: Comparing the raw values. Rejected: 14.96 °C would show as "15.0" but be refused.

## 6. Suitability rules and reasons (spec FR-013 to FR-019)

- **Decision**: The static `HourSuitabilityRules.Check(hour, activity)` returns the reasons in the fixed spec order. An empty list means the hour is suitable.
  - **Outdoor**: if any of temperature, rain or wind is "No data", the only weather reason is "No forecast for this hour". Otherwise there is one reason for each failed check: "Too cold: …", "Too warm: …", "Too much rain: …", "Too windy: …".
  - **Daylight**: "Outside daylight" is added when the activity requires daylight and the hour is not fully between sunrise and sunset.
  - **Indoor**: the weather is never checked and "No forecast for this hour" is never given; only daylight can make an hour unsuitable.
  - The reason texts are built on the server with the shown values formatted as `0.0` (invariant culture), as `PlanActivityValidator` builds its messages.
- **Rationale**: One small, pure, fully table-tested class holds every rule (constitution I and III). The page shows the texts as they are, so it holds no rules or wording of its own for reasons.
- **Note on order**: the spec lists "No forecast for this hour" last. When values are missing the weather checks cannot run, so that reason replaces them. "Outside daylight" still comes before it, which keeps the spec order.

## 7. Suitable periods and counts (spec FR-021, FR-022, Clarifications)

- **Decision**: The static `SuitablePeriods.From(hours, durationHours)` joins consecutive suitable hours of one date into periods `(start, end, lengthHours, shorterThanDuration)`, where `shorterThanDuration` is `lengthHours < durationHours`. For each activity, `PlanForecastService` also returns three values:
  - the number of suitable hours;
  - the number of dates with at least one suitable hour;
  - whether any period on any date is at least as long as the duration.

  It also sets `weatherIndependent` for an Indoor activity that does not require daylight.
- **Rationale**: Every rule, including the comparison with the duration, stays on the server. The page only words the numbers ("Suitable hours: 9 on 2 of 3 dates.") and the flags, as it words `maxActivities` in feature 005.
- **Alternatives considered**: The page counting and comparing. Rejected: that would put business rules in the browser (constitution II).

## 8. The forecast request and the checks before it (spec FR-004, FR-005, User Story 4)

- **Decision**: `POST /api/plan-forecast` with `{ "setup": <PlanSetupCheckRequest>, "activities": [<PlanActivityRequest>, …] }`, the same shapes the two Continue checks already accept. `PlanForecastService`:
  1. runs `PlanSetupService.CheckAsync`; on errors it answers `400` with every key prefixed `setup.`, and nothing else runs;
  2. runs `PlanActivityService.CheckAsync`; on errors it answers `400` with the existing `activities…` keys, and the weather service is not called;
  3. gets the forecast for the checked location (section 4), builds the hours and judges every checked activity.

  The page treats any `setup…` key as "the setup is out of date" and any other `400` key as "the activities are out of date" (spec FR-005).
- **Rationale**:
  - Reusing both services means the rules exist once, and the position comes from the location search service by id (spec FR-004).
  - The setup check normally finds the place in the location cache from step 1 (one hour, feature 004 research section 5), so the extra location lookup rarely reaches the external service.
  - `POST` is used because the body holds up to 10 activities, as in the existing checks.
- **Alternatives considered**:
  - Sending the checked results instead of the entered values. Rejected: the server must not trust them (constitution IV).
  - `409 Conflict`. Rejected: `400` with keys follows the existing contracts and still lets the page tell the two cases apart.

## 9. Configuration (spec FR-009, FR-010, Assumptions)

- **Decision**: A new `Forecast` section with `ForecastOptions`: `MaxAgeMinutes` (30), `FirstHour` (6), `LastHour` (22). It is validated at start: `MaxAgeMinutes` > 0, and 0 ≤ `FirstHour` < `LastHour` ≤ 23. The upper bound keeps every hour's end a valid time of the same day. It is bound like `PlanSetupRateLimitOptions`, so it can be changed with environment variables such as `Forecast__MaxAgeMinutes`.
- **Rationale**: The spec calls the 30 minutes and the window defaults that can be changed without a code change.

## 10. Request limit (spec FR-008, Clarifications)

- **Decision**: `PlanForecastController` uses `[EnableRateLimiting(RateLimitPolicies.PlanSetup)]`. A policy's limiter is shared by every endpoint that names it, so location searches, plan setup checks and forecast requests from one address count together towards the 30 per minute. The refusal (`429`, "Too many requests. Wait a minute and try again.", no log entry) is the existing one. `RateLimitPolicies.PlanSetup`'s comment is updated to name the forecast too.
- **Rationale**: This is the shared limit the clarification asked for, with no new policy or option. The middleware runs before authorization, so a refused request reaches neither service.

## 11. Failures, the 503 answer and failure records (spec FR-006, FR-007, User Story 3)

- **Decision**:
  - `ExternalService` gets `Forecast`.
  - The HTTP and JSON error handling of `OpenMeteoGeocodingClient` moves to a shared internal class, `Clients/ExternalServiceJson`, used by both clients. It covers the timeout, network failure, unexpected status, unreadable JSON, the single warning log and the `ExternalServiceException`.
  - `OpenMeteoForecastClient` has a 4-second timeout and logs "Forecast service failed: {FailureKind} {StatusCode}". It never logs the position or dates. Its HTTP client also uses `RemoveAllLoggers()`.
  - An answer without `hourly` or `daily` arrays, with arrays of different lengths, or without the sunrise or sunset of a period date is `InvalidResponse`.
  - `ApiExceptionHandler` answers `503` with `detail` chosen by service ("The weather service is unavailable. No forecast is shown." or the existing location text) and a `service` extension (`"forecast"` or `"locationSearch"`).
  - On the page, `503` with `service: "forecast"` shows the weather message (spec FR-006). Any other `503`, a `5xx`, the 10-second timeout or a network failure shows "Something went wrong. Try again."
- **Rationale**:
  - The warning log is the failure record that features 004 and 015 rely on (time and kind, no identity, spec FR-007). Moving the shared code keeps the two clients from repeating about 50 lines (constitution I, DRY).
  - The timeout budget is 5 s for an uncached location lookup plus 4 s for the forecast, under the page's 10 s.
  - The `service` field lets the page tell the weather service apart from the location service without parsing text.
- **Alternatives considered**:
  - A database error log. Rejected: feature 015 decides how errors are reviewed, and feature 004 already records failures as logs.
  - Copying the geocoding error handling. Rejected (DRY).

## 12. Frontend state and the "checked again" notices (spec FR-005, FR-006, FR-025, Clarifications)

- **Decision**:
  - A new, not persisted `usePlanForecastStore` holds `status` (`idle`, `loading`, `loaded`, `weatherUnavailable`, `tooManyRequests`, `serverError`, `setupOutdated`, `activitiesOutdated`), `forecast` and its `AbortController`.
    - `load` ignores a call while one is pending.
    - It aborts after 10 seconds.
    - `reset` (called when the page closes) aborts and drops a late answer.
  - On `setupOutdated` the store calls a new `usePlanSetupStore.markOutdated()`. On `activitiesOutdated` it calls a new `usePlanActivitiesStore.markOutdated()`.
    - Each sets `checked` to `null` and a persisted `recheckNotice` to `true`.
    - `setChecked` sets `recheckNotice` back to `false`, and `clear` (logout) resets it.
  - The existing step guards then redirect, and the Plan setup and Activity selection pages show the notice while `recheckNotice` is true.
- **Rationale**:
  - The forecast is not kept in the session (spec FR-025).
  - A flag in the persisted store survives a reload and disappears only after the next successful Continue, as the spec requires. Router state would come back with the browser's Back button after a successful Continue.
  - Adding a field to a persisted store needs no version change: `persist` merges a stored value over the initial state, so older sessions get `false`.
- **Alternatives considered**:
  - Router state, as `SuccessBanner` uses. Rejected for the reason above.
  - Keeping the forecast in `sessionStorage`. Rejected by spec FR-025 and NFR-007.

## 13. Showing the forecast (spec FR-020 to FR-024, FR-026, FR-027, User Story 6)

- **Decision**:
  - Step 3 keeps the setup summary. `PlanActivitiesSummary` is changed so each activity is a `<section aria-labelledby>` with the shown name as an `h2`. It takes an optional per-activity forecast, which it renders with a new `ActivityForecast` component under the settings (matched by position, because the server answers in request order).
  - Each date is an `h3` with the long date ("Saturday 15 November 2026", a new `formatPlanDateLong` beside `formatPlanDate`), "Sunrise HH:MM · Sunset HH:MM", and the period list.
  - Each date also has a disclosure button with `aria-expanded` and `aria-controls`. Its visible text is "Show hours for <date>" or "Hide hours for <date>", and its accessible name adds the activity: "Show hours for Kayaking on Saturday 15 November 2026".
  - The hours are a real `<table>` with a caption and header cells. Below the existing 40em breakpoint, CSS shows each row as a card: each cell carries a visually hidden label that becomes visible, giving the "Label: value" text.
  - Status messages ("Getting the forecast…", the errors, "Forecast updated at HH:MM") are in one `role="status"` region above the activities. Errors have Retry.
- **Rationale**:
  - Native buttons and tables give keyboard and screen reader support without a library.
  - The card layout reuses the page's breakpoint and keeps the table semantics on desktop (`docs/ux-design.md` sections 8 and 9).
  - `PlanActivitiesSummary` is used only by step 3, so changing it affects no other page.

## 14. Dependencies

- **Decision**: No new NuGet or npm package. The new client uses `HttpClient` through `IHttpClientFactory`, `System.Net.Http.Json` and `TimeZoneInfo`, all already in use.
- **Rationale**: Constitution VIII. Everything needed is already in the project.
