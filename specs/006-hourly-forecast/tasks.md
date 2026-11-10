---

description: "Task list for feature 006 Hourly Forecast"
---

# Tasks: Hourly Forecast

**Input**: Design documents from `/specs/006-hourly-forecast/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/plan-forecast-api.md, quickstart.md

**Tests**: Required. Constitution principle III requires backend tests for business logic and API behaviour, frontend tests for the relevant screens, an authorization test for every protected operation, and fake responses instead of the live Open-Meteo services. Within each story, write the tests first and confirm they fail before the implementation tasks.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested on its own. The P1 stories come first, in the order their dependencies need:
- US1 (suitable hours per activity);
- US2 (hourly details and reasons, which extend the US1 date entries);
- US3 (weather service unavailable and the shared request limit);
- US4 (the checks before the forecast and the "checked again" notices);
- US5 (access).

Then the P2 story US6 (keyboard, screen reader, phone).

Commands are in `AGENTS.md`. Backend commands run from the repository root with `.\SpekLaiku.slnx`; frontend commands run from `frontend/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: The user story the task belongs to (US1 to US6, as numbered in `spec.md`)
- Paths are from the repository root. `Api/` below is short for `backend/src/SpekLaiku.Api/`, `UnitTests/` for `backend/tests/SpekLaiku.UnitTests/` and `IntegrationTests/` for `backend/tests/SpekLaiku.IntegrationTests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the starting point. No new package, no migration and no new folder.

- [X] T001 From the repository root, run `dotnet build .\SpekLaiku.slnx` and `dotnet test .\SpekLaiku.slnx`. From `frontend/`, run `npm run lint`, `npm test` and `npm run build`. This confirms that the baseline after feature 005 passes before any change. Record the test counts and any pre-existing failure in this task instead of fixing it in this feature. If the first `npm test` fails with "Failed to start forks worker", re-run it once before investigating. Result (2026-11-10): no failing test. The backend build has 0 errors and 568 tests pass (364 unit, 204 integration). Lint is clean and the build succeeds. The first `npm test` again reported "Failed to start forks worker" for 2 files and ran only 51 of 54; the unchanged re-run passed 654 tests in 54 files.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The weather client, the planning hours, the suitability rules, the periods and counts, the configuration, the test fakes, and the frontend types and wording helpers, which every story uses.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Backend: shared client code

- [X] T002 Move the HTTP and JSON error handling of `Api/Clients/OpenMeteoGeocodingClient.cs` into a new `Api/Clients/ExternalServiceJson.cs` (research section 11).
  - Make it an `internal static class` with `Task<T?> GetAsync<T>(HttpClient httpClient, string path, ExternalService service, ILogger logger, bool badRequestMeansNotFound, CancellationToken cancellationToken) where T : class`.
  - It keeps the existing behaviour exactly: timeout, network failure, `badRequestMeansNotFound`, unexpected status, unreadable JSON and empty body.
  - It logs one warning per failure as `"{Service} failed: {FailureKind} {StatusCode}"`, using a display name per service: "Location search service" for `LocationSearch` and "Forecast service" for `Forecast`. That keeps the geocoding log text unchanged.
  - It throws `ExternalServiceException(service, kind, status, inner)`.
  - In `Api/Clients/ExternalService.cs`, add `Forecast` and update the comment.
  - Change `OpenMeteoGeocodingClient` to call it. Its public behaviour and log text must not change: `UnitTests/OpenMeteoGeocodingClientTests.cs`, `LocationSearchServiceTests.cs` and every integration test must pass unchanged.

### Backend: the weather client

- [X] T003 [P] Create the client models in `Api/Clients/` (`data-model.md`, Client models):
  - `IForecastClient.cs`: `Task<HourlyForecast> GetAsync(double latitude, double longitude, DateOnly firstDate, DateOnly lastDate, CancellationToken cancellationToken)`. Comment that the interface exists so tests replace the external service with fake responses (constitution III).
  - `HourlyForecast.cs` with three records:
    - `HourlyForecast(IReadOnlyList<ForecastHourValues> Hours, IReadOnlyList<ForecastDaylight> Days)`;
    - `ForecastHourValues(DateTimeOffset Time, double? TemperatureC, double? PrecipitationMm, double? WindSpeedMs)`, with a comment that precipitation is the sum of the hour **before** `Time` (research section 2);
    - `ForecastDaylight(DateOnly Date, DateTimeOffset Sunrise, DateTimeOffset Sunset)`.
- [X] T004 Create `Api/Clients/OpenMeteoForecastResponse.cs` and `Api/Clients/OpenMeteoForecastClient.cs` (research sections 1 and 11).
  - **Response records** (`internal`): `hourly` with `time` (`long[]?`), `temperature_2m`, `precipitation` and `wind_speed_10m` (`double?[]?`); `daily` with `time`, `sunrise` and `sunset` (`long?[]?`). Use `[JsonPropertyName]` as in `OpenMeteoGeocodingResponse.cs`.
  - **Constants**: `BaseAddress = new("https://api.open-meteo.com/")` and `Timeout = TimeSpan.FromSeconds(4)`, with a comment on the 10-second page budget (5 s location lookup + 4 s forecast).
  - **Request path**: `v1/forecast?latitude=<lat>&longitude=<lon>&hourly=temperature_2m,precipitation,wind_speed_10m&daily=sunrise,sunset&wind_speed_unit=ms&timezone=Europe%2FVilnius&timeformat=unixtime&start_date=<yyyy-MM-dd>&end_date=<yyyy-MM-dd>`. Format the numbers and dates with `CultureInfo.InvariantCulture`.
  - **Converting the answer**: the unix seconds become `DateTimeOffset` values. Each daily `time` (local midnight) becomes the Lithuanian `DateOnly` through `TimeZoneInfo` with `ForecastPeriod.TimeZoneId`.
  - **`InvalidResponse`**: through `ExternalServiceJson`'s failure path, with one warning, when:
    - `hourly` or `daily` is missing;
    - an hourly array's length differs from `hourly.time`, or a daily array's length differs from `daily.time`;
    - a date from `firstDate` to `lastDate` has no daily entry, or a daily entry has no sunrise or sunset.
  - A `null` hourly value stays `null`.
  - It never logs the position or the dates. Keep the class under 200 lines.
- [X] T005 Add `UnitTests/OpenMeteoForecastClientTests.cs` with `FakeHttpMessageHandler`, following `OpenMeteoGeocodingClientTests.cs`. Cover:
  - the exact request path for latitude 54.6872, longitude 25.2797, 2026-11-10 to 2026-11-16, including the units, `timeformat=unixtime` and `timezone`;
  - a full answer parsed into hours and days, with times as the right instants and dates as Lithuanian dates;
  - `null` values kept as `null`;
  - unequal array lengths, a missing `daily`, and a missing sunrise for a requested date each give `InvalidResponse`;
  - a `500` gives `UnexpectedStatus` with the status, a timeout gives `Timeout`, an `HttpRequestException` gives `Network`, and invalid JSON gives `InvalidResponse`, each with `Service == ExternalService.Forecast`;
  - each failure logs exactly one warning starting "Forecast service failed" and containing no latitude, longitude or date (`CapturingLoggerProvider`).

### Backend: configuration

- [X] T006 Create `Api/Services/ForecastOptions.cs` (section `Forecast`, research section 9) with `MaxAgeMinutes = 30`, `FirstHour = 6` and `LastHour = 22`. Comment that each can be changed with an environment variable such as `Forecast__MaxAgeMinutes`.
  - In `Api/Program.cs`, bind it with `AddOptions<ForecastOptions>().Bind(...).Validate(...).ValidateOnStart()`. The rule is `MaxAgeMinutes > 0 && FirstHour >= 0 && FirstHour < LastHour && LastHour <= 23`, with the message "Forecast:MaxAgeMinutes must be positive and 0 <= FirstHour < LastHour <= 23.", as `AddPlanSetupRateLimit` does.
  - In `Api/appsettings.json`, add `"Forecast": { "MaxAgeMinutes": 30, "FirstHour": 6, "LastHour": 22 }`. Do not touch `appsettings.Development.json`.
  - Register `AddHttpClient<IForecastClient, OpenMeteoForecastClient>` with `BaseAddress` and `Timeout`, and `.RemoveAllLoggers()` with the same reason as the geocoding client.
  - Add `UnitTests/ForecastOptionsTests.cs` that runs the validation rule on the defaults (valid) and on `MaxAgeMinutes = 0`, `FirstHour = 22, LastHour = 22`, `FirstHour = -1` and `LastHour = 24` (each invalid). Extract the rule as `public static bool IsValid(ForecastOptions options)` on `ForecastOptions` so the test and `Program.cs` use the same code.

### Backend: planning hours and rules

- [X] T007 [P] Create the planning hour records and builder in `Api/Services/` (`data-model.md`, research sections 2, 3 and 5):
  - `PlanningHour.cs`: `record PlanningHour(TimeOnly Start, TimeOnly End, decimal? TemperatureC, decimal? RainMmPerHour, decimal? WindMs, bool Daylight)`.
  - `PlanningDay.cs`: `record PlanningDay(DateOnly Date, TimeOnly Sunrise, TimeOnly Sunset, IReadOnlyList<PlanningHour> Hours)`.
  - `PlanningDays.cs`, a static class with `Build(HourlyForecast forecast, IReadOnlyList<DateOnly> dates, DateTimeOffset now, ForecastOptions options)`. For each date, in date order:
    - hours start from `FirstHour` to `LastHour − 1`, built as Lithuanian local times and converted to instants with `TimeZoneInfo` (`ForecastPeriod.TimeZoneId`);
    - an hour whose start instant is at or before `now` is left out;
    - temperature and wind come from the entry whose `Time` equals the start instant, and rain from the entry whose `Time` is one hour later;
    - a missing entry or value is `null`;
    - each value becomes `Math.Round((decimal)value, 1, MidpointRounding.AwayFromZero)`;
    - `Daylight` is true when start ≥ sunrise and end ≤ sunset, comparing exact instants;
    - `Sunrise` and `Sunset` are the Lithuanian local times rounded down to the minute.
  - A date without a daylight entry cannot happen after T004; throw `InvalidOperationException` if it does.
- [X] T008 Add `UnitTests/PlanningDaysTests.cs` with a hand-built `HourlyForecast`. Cover:
  - 16 hours 06:00–21:00 per date with the default options, and 3 hours with `FirstHour = 8, LastHour = 11`;
  - two non-consecutive dates in order;
  - with `now` at 14:20 today, the first hour is 15:00; at 14:00 exactly, 14:00 is left out; at 21:30, the list is empty; another date is not shortened;
  - rain taken from the next hour's entry, and temperature and wind from the start;
  - a missing entry and a `null` value give `null`;
  - 15.04 becomes 15.0, 15.05 becomes 15.1, and -0.05 becomes -0.1;
  - with sunrise 07:42, the 07:00 hour is not daylight and 08:00 is; with sunset 16:20, the 15:00 hour is daylight and 16:00 is not; a sunset exactly at 16:00 keeps 15:00 as daylight;
  - `Sunrise` and `Sunset` are shown as 07:42 and 16:20;
  - 2027-03-28 and 2027-10-31 (clock changes) each have 16 hours with the right instants.
- [X] T009 [P] Create `Api/Services/HourSuitability.cs` (`record HourSuitability(TimeOnly Start, IReadOnlyList<string> Reasons)` with `bool Suitable => Reasons.Count == 0`) and `Api/Services/HourSuitabilityRules.cs`, a static class with `IReadOnlyList<string> Check(PlanningHour hour, CheckedPlanActivity activity)` (research section 6, `data-model.md` HourSuitabilityRules).
  - Reason texts as constants or format methods, exactly: `"Too cold: {t} °C, minimum {min} °C"`, `"Too warm: {t} °C, maximum {max} °C"`, `"Too much rain: {r} mm/h, maximum {max} mm/h"`, `"Too windy: {w} m/s, maximum {max} m/s"`, `"Outside daylight"`, `"No forecast for this hour"`.
  - Numbers are formatted with `"0.0"` and `CultureInfo.InvariantCulture`.
  - Order:
    - for Outdoor with all three values present, rows 1 to 4;
    - then row 5 when `RequiresDaylight` and not `Daylight`;
    - then row 6 for Outdoor when any value is `null`, instead of rows 1 to 4.
  - An Indoor activity gets only row 5. Comparisons use `<` minimum and `>` maximum, so a value equal to its limit passes.
- [X] T010 Add `UnitTests/HourSuitabilityRulesTests.cs`, a table-driven test of every row in `data-model.md` (HourSuitabilityRules). Cover:
  - each limit exactly at (passes), 0.1 inside (passes) and 0.1 outside (fails with the exact text), for minimum and maximum temperature, rain and wind;
  - rain limit 0 with 0.0 (passes) and 0.1 (fails);
  - several reasons together in the documented order;
  - a missing value giving only "No forecast for this hour" (plus "Outside daylight" first when relevant);
  - Indoor with missing values and bad weather is suitable without daylight, and gets only "Outside daylight" with daylight;
  - negative temperatures formatted as "-3.0".
- [X] T011 [P] Create the period and activity models in `Api/Services/`:
  - `SuitablePeriod.cs`: `record SuitablePeriod(TimeOnly Start, TimeOnly End, int LengthHours, bool ShorterThanDuration)`.
  - `SuitablePeriods.cs`, a static class with `From(IReadOnlyList<HourSuitability> hours, decimal durationHours)`: runs of suitable hours where one's start is the previous one's start + 1 h, with `ShorterThanDuration = LengthHours < durationHours`.
  - `ActivityDayForecast.cs`: `record ActivityDayForecast(DateOnly Date, IReadOnlyList<SuitablePeriod> Periods, IReadOnlyList<HourSuitability> Hours)`.
  - `ActivityForecast.cs`: `record ActivityForecast(bool WeatherIndependent, int SuitableHours, int DatesWithSuitableHours, bool HasLongEnoughPeriod, IReadOnlyList<ActivityDayForecast> Days)`.
  - `ActivityForecasts.cs`, a static class with `For(CheckedPlanActivity activity, IReadOnlyList<PlanningDay> days)` (research section 7). `WeatherIndependent` is `Type == Indoor && !RequiresDaylight`.
- [X] T012 Add `UnitTests/SuitablePeriodsTests.cs` and `UnitTests/ActivityForecastsTests.cs`. Cover:
  - 10:00–14:00 suitable, a gap, and 16:00 suitable give two periods of 4 and 1 h;
  - an empty or all-unsuitable day gives none;
  - with duration 2 h, a 1 h period is shorter, and 2 h and 3 h periods are not;
  - with duration 1.5 h, a 1 h period is shorter and a 2 h period is not;
  - the counts over two dates;
  - `HasLongEnoughPeriod` false when every period is shorter, and false when there are no periods;
  - `WeatherIndependent` only for Indoor without daylight;
  - a day with no hours (late today) counts as a date without suitable hours.

### Backend: test fakes

- [X] T013 Add the forecast fakes and the test-controlled clock:
  - `IntegrationTests/FakeForecastClient.cs`, following `FakeGeocodingClient.cs`:
    - scripted answers per `(latitude, longitude)`;
    - `ScriptFailure(latitude, longitude, FailureKind)`;
    - a `Calls` counter;
    - a static `Fill(DateOnly firstDate, int days, double temperatureC, double precipitationMm, double windSpeedMs, TimeOnly sunrise, TimeOnly sunset)` that builds a whole period of hourly values in Lithuanian time, plus a way to change single hours;
    - anything not scripted throws `ExternalServiceException(ExternalService.Forecast, FailureKind.InvalidResponse)`.
  - In `IntegrationTests/PostgreSqlApiFactory.cs`, expose `Forecast` and replace `IForecastClient` with it, next to `Geocoding`.
  - Comment that the API caches forecasts per location id and day, so every test uses its own place id and position.
  - `UnitTests/RecordingForecastClient.cs` with a settable answer or exception and a list of calls, following `RecordingGeocodingClient.cs`.
  - Give the forecast services one test-controlled clock (research section 3, `data-model.md` ForecastPeriod):
    - In `Api/Services/ForecastPeriod.cs`, add `public DateTimeOffset GetNow()`, the injected `TimeProvider`'s current time converted to Lithuanian time, and make `GetCurrent()` use it.
    - Extend `UnitTests/ForecastPeriodTests.cs`: `GetNow()` returns the fixed clock's instant with the Lithuanian offset (+02:00 in winter, +03:00 in summer).
    - `PostgreSqlApiFactory` already registers `new ForecastPeriod(Clock)`, so the forecast services follow `Clock`. Do **not** replace `TimeProvider` for the whole test host: the sign-in cookies would then expire when a test moves `Clock` forward.
    - From here on, no forecast class injects `TimeProvider` directly; they read the time only through `ForecastPeriod` (constitution III).

### Frontend

- [X] T014 [P] Create `frontend/src/types/planForecast.ts` with `ForecastHour`, `ForecastDay`, `SuitablePeriod`, `HourSuitability`, `ActivityDayForecast`, `ActivityForecast`, `PlanForecast` and `PlanForecastRequest` exactly as in `data-model.md` (Frontend types). Import `PlanSetupCheckRequest` from `types/planSetup.ts` and `PlanActivityRequest` from `types/planActivity.ts`.
- [X] T015 [P] Create the wording helpers with tests (`data-model.md`, Helpers):
  - In `frontend/src/helpers/formatPlanDate.ts`, add `formatPlanDateLong(isoDate)`: `"2026-11-15"` → `"Sunday 15 November 2026"`, joined with single spaces like `formatPlanDate`, `timeZone: "UTC"`. Extend `frontend/src/tests/formatPlanDate.test.ts`.
  - `frontend/src/helpers/suitablePeriodText.ts`: `suitablePeriodText(period, durationHours)` → `"★ Suitable 10:00–14:00 (4 h)"` or `"★ Suitable 10:00–11:00 (1 h), shorter than this activity's 2 h"`. Use the en dash and format the duration with `String(durationHours)`, so 1.5 shows as "1.5 h".
  - `frontend/src/helpers/forecastSummaryText.ts`: `forecastSummaryText(forecast, totalDates, durationHours)` returns:
    - `"Suitable hours: <n> on <d> of <total> dates."`;
    - the same plus `" No period is long enough for this activity's <duration> h."` when `!hasLongEnoughPeriod`;
    - `"No suitable hours on any of your dates. Try other dates or change this activity's limits."` when `suitableHours === 0`.
  - Use "date" when `totalDates` is 1 ("Suitable hours: 3 on 1 of 1 date.").
  - Add `frontend/src/tests/suitablePeriodText.test.ts` and `frontend/src/tests/forecastSummaryText.test.ts` covering each wording.

**Checkpoint**: The client, rules, periods, counts, options, fakes, types and wording exist and are tested. `OpenMeteoGeocodingClient` behaves as before.

---

## Phase 3: User Story 1 - See which hours suit each activity (Priority: P1) 🎯 MVP

**Goal**: Step 3 gets the forecast for the checked plan and shows, under each activity, a summary line and each date's sunrise, sunset and suitable periods (or the indoor message).

**Independent Test**: With a checked setup of one date and checked activities Kayaking (8 m/s, 0.5 mm/h, 15 to 35 °C, daylight) and Museum (Indoor, no daylight), and a fake forecast, open step 3. Kayaking lists exactly the hours that meet all its limits in daylight, and Museum says every hour is suitable.

### Tests for User Story 1 ⚠️

- [X] T016 [P] [US1] Add `UnitTests/WeatherForecastServiceTests.cs` with `RecordingForecastClient`, a real `MemoryCache`, and a `ForecastPeriod` built on a `FixedTimeProvider`. Cover:
  - the client is asked for the location's position and the whole period (today to today + 6);
  - `ReceivedAt` is the clock's time;
  - a second call at +29 minutes uses the cache (one client call, same `ReceivedAt`);
  - at +30 minutes it calls again;
  - the next day it calls again;
  - another location id calls again;
  - a failure is not cached: the next call reaches the client.
- [X] T017 [P] [US1] Add `UnitTests/PlanForecastServiceTests.cs`, building `PlanSetupService` with `RecordingGeocodingClient` and `PlanActivityService` with the EF Core in-memory database (as in `PlanActivityServiceTests.cs`), plus `WeatherForecastService` with `RecordingForecastClient`. Cover the success path:
  - one `PlanningDay` per plan date;
  - one `ActivityForecast` per activity in request order;
  - the same category twice with different limits gives different results;
  - `UpdatedAt` is `ReceivedAt` in Lithuanian time.

  The error paths come in US4 (T047).
- [X] T018 [P] [US1] Add `UnitTests/PlanForecastMappingTests.cs`: the configuration is valid; `TimeOnly(7, 5)` maps to `"07:05"`; a `PlanForecast` maps every field of every response DTO, including `null` values, empty `Hours` and `Reasons`, and `DateOnly` dates.
- [X] T019 [P] [US1] Add `IntegrationTests/PlanForecastEndpointTests.cs` (collection `PostgreSqlCollection`). Use your own place id and position, scripted in `FakeGeocodingClient` and `FakeForecastClient`, your own categories with `PostgreSqlApiFactory.UniqueCategoryName`, and `Clock` set to a fixed time (it drives "now" through `ForecastPeriod`, T013). Set `Clock` back to its earlier value at the end of the test, because the collection shares it. As a Visitor, cover the `200` contract in `contracts/plan-forecast-api.md`:
  - one entry in `days` per plan date in date order, with 16 hours 06:00–21:00, `sunrise`, `sunset` and the values rounded to one decimal place;
  - with the clock at 14:20 on a plan date that is today, the first hour of that date is 15:00;
  - `activities` in request order with `weatherIndependent`, `suitableHours`, `datesWithSuitableHours`, `hasLongEnoughPeriod`, `periods` (including `shorterThanDuration`) and an `hours` entry per hour;
  - `updatedAt` is `"HH:mm"` in Lithuanian time;
  - the raw JSON uses the documented keys only.
- [X] T020 [P] [US1] Add `frontend/src/tests/planForecastApi.test.ts` (forecast part) and `frontend/src/tests/usePlanForecastStore.test.ts` (loading part), with `routeFetch` and fake timers, following `planActivitiesApi.test.ts` and `usePlanActivitiesCheckStore.test.ts`. Cover:
  - `getPlanForecast` sends `POST /api/plan-forecast` with the body from `planForecastRequest`, and maps `200` to `{ kind: "forecast" }`;
  - any other status not yet handled throws `ApiError`;
  - `planForecastRequest` builds the request from a checked setup and checked activities (location id, dates, distance, each activity's type and numbers);
  - the store goes `loading` → `loaded` with `forecast`;
  - a second `load` while loading sends no request;
  - `reset` aborts and drops a late answer.
- [X] T021 [P] [US1] Extend `frontend/src/tests/PlacesAndForecastPage.test.tsx` (forecast part), with a checked setup and checked activities and `routeFetch` answering `POST /api/plan-forecast`. Cover:
  - "Getting the forecast…" in the status region while loading, and exactly one request;
  - "Forecast updated at 14:05" after loading;
  - each activity is a region named after its shown name (repeated categories as "Cycling 1" and "Cycling 2") with its settings and its forecast area;
  - the summary line in its three wordings;
  - each date as a heading with the long date, "Sunrise 07:46 · Sunset 16:15", and its periods with and without "shorter than this activity's 2 h";
  - "✗ No suitable hours on this date." for a date without periods, and "No hours left to plan today." for a date with no hours;
  - an Indoor activity without daylight shows only "Weather does not affect this indoor activity. Every hour from 06:00 to 22:00 is suitable.";
  - the existing tests (title, progress, setup summary, activity settings, Back, redirects) still pass.
  - Done (2026-11-10): the shared answer `forecastRoutes` in `frontend/src/tests/forecastFixtures.ts` was added to the route stubs of six older test files that pass through step 3 (`ActivitySelectionPage`, `keyboard`, `responsive`, `accessibility`, `planCreatorOnly`, `layout`). Three of their tests counted every `POST` as an activity check, so they now count only `/api/plan-activities/check`. No assertion was removed or weakened.

### Implementation for User Story 1

- [X] T022 [US1] Create `Api/Services/ReceivedForecast.cs` (`record ReceivedForecast(HourlyForecast Data, DateTimeOffset ReceivedAt)`) and `Api/Services/WeatherForecastService.cs` (`IForecastClient`, `IMemoryCache`, `ForecastPeriod`, `IOptions<ForecastOptions>`, and no `TimeProvider`) with `GetAsync(PlaceLocation location, CancellationToken)` (research section 4).
  - The key is `forecast:<location.Id>:<firstDate:yyyy-MM-dd>`.
  - `ReceivedAt` is `ForecastPeriod.GetNow()`, and a cached entry is used only when `ForecastPeriod.GetNow() − ReceivedAt < MaxAgeMinutes`.
  - Otherwise it calls the client for `(location.Latitude, location.Longitude, firstDate, lastDate)` and stores the answer with `AbsoluteExpirationRelativeToNow = MaxAgeMinutes`.
  - Failures pass through and are not cached.
  - Register it with `AddScoped<WeatherForecastService>()` in `Api/Program.cs`.
- [X] T023 [US1] Create `Api/DTOs/Requests/PlanForecastRequest.cs` (`record PlanForecastRequest(PlanSetupCheckRequest? Setup, List<PlanActivityRequest>? Activities)`, with a comment that it reuses the two Continue shapes, research section 8). Also create `Api/Services/PlanForecast.cs` (`record PlanForecast(TimeOnly UpdatedAt, IReadOnlyList<PlanningDay> Days, IReadOnlyList<ActivityForecast> Activities)`) and `Api/Services/PlanForecastResult.cs`, following `PlanActivitiesResult.cs`, with `Success(PlanForecast)` and `Invalid(errors)`.
- [X] T024 [US1] Create `Api/Services/PlanForecastService.cs` (`PlanSetupService`, `PlanActivityService`, `WeatherForecastService`, `ForecastPeriod`, `IOptions<ForecastOptions>`, and no `TimeProvider`; "now" for `PlanningDays.Build` is `ForecastPeriod.GetNow()`) with `GetAsync(PlanForecastRequest, CancellationToken)`, following the four steps in `data-model.md` (PlanForecastService):
  1. a missing `Setup` gives `Invalid([("setup", "The request is invalid.")])`;
  2. setup errors are returned with every key prefixed `setup.`, and nothing else runs;
  3. activity errors are returned with their keys unchanged, and the forecast is not requested;
  4. otherwise get the forecast, `PlanningDays.Build`, and `ActivityForecasts.For` for each checked activity, with `UpdatedAt` = `ReceivedAt` in Lithuanian time to the minute.

  Register it with `AddScoped<PlanForecastService>()`. Keep the class under 200 lines.
- [X] T025 [P] [US1] Create the response DTOs in `Api/DTOs/Responses/` as in `contracts/plan-forecast-api.md`:
  - `PlanForecastResponse(string UpdatedAt, IReadOnlyList<ForecastDayResponse> Days, IReadOnlyList<ActivityForecastResponse> Activities)`;
  - `ForecastDayResponse(DateOnly Date, string Sunrise, string Sunset, IReadOnlyList<ForecastHourResponse> Hours)`;
  - `ForecastHourResponse(string Start, string End, decimal? TemperatureC, decimal? RainMmPerHour, decimal? WindMs, bool Daylight)`;
  - `ActivityForecastResponse(bool WeatherIndependent, int SuitableHours, int DatesWithSuitableHours, bool HasLongEnoughPeriod, IReadOnlyList<ActivityDayForecastResponse> Days)`;
  - `ActivityDayForecastResponse(DateOnly Date, IReadOnlyList<SuitablePeriodResponse> Periods, IReadOnlyList<HourSuitabilityResponse> Hours)`;
  - `SuitablePeriodResponse(string Start, string End, int LengthHours, bool ShorterThanDuration)`;
  - `HourSuitabilityResponse(string Start, bool Suitable, IReadOnlyList<string> Reasons)`.
- [X] T026 [US1] Create `Api/Mapping/PlanForecastMappingProfile.cs`: every service record to its response, with `TimeOnly` to `string` as `time.ToString("HH:mm", CultureInfo.InvariantCulture)` (one `CreateMap<TimeOnly, string>().ConvertUsing(...)`), following `PlanActivityMappingProfile`. No rules.
- [X] T027 [US1] Create `Api/Controllers/PlanForecastController.cs`:
  - attributes `[ApiController]`, `[Route("api/plan-forecast")]`, `[Authorize(Policy = AuthorizationPolicies.PlanCreator)]`, `[EnableRateLimiting(RateLimitPolicies.PlanSetup)]` and `[ProducesResponseType(StatusCodes.Status403Forbidden)]`, with a comment on the shared limit (research section 10);
  - one `[HttpPost]` that returns `200` with `mapper.Map<PlanForecastResponse>(result.Forecast)`, or `400` `ValidationProblemDetails` (title "One or more request fields are invalid.", keys in result order) as `PlanActivitiesController.Check` does;
  - `ProducesResponseType` for `200`, `400`, `429` and `503`.

  In `Api/RateLimiting/RateLimitPolicies.cs`, change the `PlanSetup` comment to "Location searches, plan setup checks and forecast requests together".
- [X] T028 [P] [US1] Create `frontend/src/helpers/planForecastRequest.ts`: `planForecastRequest(setup: CheckedPlanSetup, activities: CheckedPlanActivity[]): PlanForecastRequest`, with `locationId` from `setup.location.id`, the checked dates and distance, and each activity's `categoryId`, `type`, `durationHours`, `requiresDaylight` and four limits. Add `frontend/src/tests/planForecastRequest.test.ts`.
- [X] T029 [US1] Create `frontend/src/api/planForecastApi.ts` with `getPlanForecast(request, signal)`: `200` gives `{ kind: "forecast"; forecast }`, and every other status throws `ApiError(status)` for now (US3 and US4 add the other kinds). Follow `planActivitiesApi.ts`.
- [X] T030 [US1] Create `frontend/src/stores/usePlanForecastStore.ts` (not persisted, `data-model.md` Plan forecast store), following `usePlanActivitiesCheckStore.ts`.
  - It holds `status`, `forecast`, `controller` and the last setup and activities.
  - `load(setup, activities)` is ignored while `loading`.
  - `reset()` aborts the pending request, drops its answer and returns to the initial state.
  - For now a thrown error sets `serverError`.
  - Export the initial state and reset it in `frontend/src/tests/setup.ts`.
- [X] T031 [P] [US1] Create `frontend/src/components/planForecastStatus.tsx`: one `<div role="status">` that shows "Getting the forecast…" while loading and "Forecast updated at <updatedAt>" when loaded. US3 adds the errors.
- [X] T032 [US1] Create `frontend/src/components/forecastDateEntry.tsx` and `frontend/src/components/activityForecast.tsx`, each under about 200 lines.
  - **`ForecastDateEntry`** gets one `ForecastDay`, the matching `ActivityDayForecast` and the activity's duration. It renders:
    - `<h3>` with `formatPlanDateLong(date)`;
    - "Sunrise HH:MM · Sunset HH:MM";
    - then either "No hours left to plan today." (no hours), a list of `suitablePeriodText` items, or "✗ No suitable hours on this date.".
  - **`ActivityForecast`** gets the `ActivityForecast`, the plan's `days` and the checked activity. It renders either the indoor message (when `weatherIndependent`) or `forecastSummaryText`, followed by one `ForecastDateEntry` per date.
- [X] T033 [US1] Change `frontend/src/components/planActivitiesSummary.tsx`:
  - each activity becomes `<section aria-labelledby="forecast-activity-<id>">` with `<h2 id="forecast-activity-<id>">` holding the shown name from `planActivityNames`, and its settings text as now;
  - add an optional `forecast?: PlanForecast` prop; when present, render `<ActivityForecast>` under the settings for `forecast.activities[index]` with `forecast.days`.

  Keep the existing text so the feature 005 tests still pass, or update them only where the `<strong>` became an `<h2>`.
- [X] T034 [US1] Change `frontend/src/pages/PlacesAndForecastPage.tsx`:
  - keep the title, `<h1>`, `PlanProgress current={3}`, the two redirects in their order, `PlanSetupSummary` and Back;
  - when both are checked, call `usePlanForecastStore.getState().load(setup, activities)` in an effect on mount and `reset()` on unmount;
  - render `PlanForecastStatus` above the activities, and pass `forecast` to `PlanActivitiesSummary` only when the status is `loaded`;
  - update the top comment. Keep it under about 200 lines.

**Checkpoint**: A visitor sees, for each activity and date, the suitable periods worked out on the server from a fake forecast.

---

## Phase 4: User Story 2 - Understand why an hour is unsuitable (Priority: P1)

**Goal**: Each date entry can show the hour-by-hour table with values, daylight, suitability and every reason.

**Independent Test**: With a fake forecast where 12:00 has 9 m/s wind and 1.2 mm/h rain, open Kayaking's details for that date and check that 12:00 shows "✗ Unsuitable" with both reasons.

### Tests for User Story 2 ⚠️

- [ ] T035 [P] [US2] Extend `IntegrationTests/PlanForecastEndpointTests.cs` (reasons part). Script single hours in `FakeForecastClient` and check the `reasons` of a Kayaking activity:
  - 12:00 with 9.0 m/s and 1.2 mm/h gives "Too much rain: 1.2 mm/h, maximum 0.5 mm/h" and "Too windy: 9.0 m/s, maximum 8.0 m/s" in that order;
  - 4.2 °C gives "Too cold: 4.2 °C, minimum 15.0 °C";
  - an hour before sunrise gives "Outside daylight";
  - a `null` value gives "No forecast for this hour" and `null` in `days[i].hours[j]`;
  - a value exactly at each limit is suitable.
- [ ] T036 [P] [US2] Extend `frontend/src/tests/PlacesAndForecastPage.test.tsx` (hours part). Cover:
  - each date has a button "Show hours for Saturday 14 November 2026" whose accessible name is the visible text followed by the activity ("Show hours for Saturday 14 November 2026, Kayaking") and whose `aria-expanded` is `false`;
  - selecting it shows a table with a caption and the column headers Time, Temperature, Rain, Wind, Daylight and Suitability, the button text changes to "Hide hours for …", and `aria-expanded` becomes `true`;
  - each row shows "12:00–13:00", "16.4 °C", "1.2 mm/h", "9.0 m/s", "Yes" or "No", and "★ Suitable" or "✗ Unsuitable" followed by each reason;
  - a `null` value shows "No data";
  - selecting it again hides the table;
  - two activities' tables open independently.

### Implementation for User Story 2

- [ ] T037 [US2] Create `frontend/src/components/forecastHoursTable.tsx`. It gets the `ForecastHour[]`, the matching `HourSuitability[]`, the activity's shown name and the long date.
  - It renders `<table>` with `<caption>` "Hours for <name> on <date>" and `<th scope="col">` for Time, Temperature, Rain, Wind, Daylight and Suitability.
  - Each row has:
    - "HH:MM–HH:MM";
    - values with one decimal place and their unit, or "No data";
    - "Yes" or "No";
    - "★ Suitable" or "✗ Unsuitable" with the reasons as a list.
  - Each cell starts with `<span className="cell-label">Label: </span>` for the phone card layout (US6 styles it).
  - Values are shown with `toFixed(1)`; that is display only, the server already rounded them.
- [ ] T038 [US2] In `frontend/src/components/forecastDateEntry.tsx`, add the disclosure:
  - a `<button type="button">` with `aria-expanded`, `aria-controls` and visible text "Show hours for <date>" (or "Hide hours for <date>"), and `aria-label` that same text followed by ", <name>" (for example "Show hours for Saturday 14 November 2026, Kayaking"), so the accessible name starts with the visible text (spec FR-023);
  - local `useState` for open, closed at first;
  - `ForecastHoursTable` in an element with the controlled id, rendered only when open.

  Not shown for a date with no hours.

**Checkpoint**: Every hour's values and reasons can be read.

---

## Phase 5: User Story 3 - Know when the weather service is unavailable (Priority: P1)

**Goal**: Weather service failures, other failures, timeouts and the shared request limit each show their message with Retry and no forecast data; each weather failure is recorded once.

**Independent Test**: Make the fake weather service fail, open step 3, and check that the error and "Retry" are shown with no hours, then make it answer and select "Retry".

### Tests for User Story 3 ⚠️

- [ ] T039 [P] [US3] Extend `UnitTests/ApiExceptionHandlerTests.cs`. Cover:
  - `ExternalServiceException(Forecast, …)` gives `503`, title "Service unavailable.", detail "The weather service is unavailable. No forecast is shown." and the extension `service` = `"forecast"`;
  - `LocationSearch` keeps "Location search is unavailable. Try again later." and adds `service` = `"locationSearch"`;
  - other exceptions are unchanged.
- [ ] T040 [P] [US3] Add `IntegrationTests/PlanForecastFailureTests.cs` (own place ids). Cover:
  - each `FailureKind` scripted in `FakeForecastClient` gives `503` with `service: "forecast"` and the weather detail;
  - a scripted geocoding `GetAsync` failure for an uncached id gives `503` with `service: "locationSearch"`, and the fake forecast client is not called;
  - after a forecast failure, the next request calls the fake client again (not cached).

  Failure logging is tested in T005 for the real client. The fake throws without logging, so do not test logging here.
- [ ] T041 [P] [US3] Extend `IntegrationTests/PlanSetupRateLimitTests.cs`. Its tests build their own host through `CreateHost(geocoding, permitLimit: "3")`, which today replaces only `IGeocodingClient`.
  - Give `CreateHost` a `FakeForecastClient` too: an optional parameter, with a new one when it is not passed. Its host must never reach the live weather service.
  - Add a `ForecastAsync(client)` helper that posts a valid body (a place scripted in that host's fakes and a valid activity), next to `SearchAsync` and `CheckAsync`.
  - Cover, with a limit of 3:
    - a search, a check and a forecast request are allowed, and the next forecast request is refused with `429`, `Retry-After` and the contract body;
    - three forecast requests use up the limit, and the next search is refused;
    - the refused forecast request reaches neither fake client (`GetCalls` and `Calls` do not change).
  - The existing tests must pass unchanged.
- [ ] T042 [P] [US3] Extend `frontend/src/tests/planForecastApi.test.ts` and `frontend/src/tests/usePlanForecastStore.test.ts` (errors part). Cover:
  - `503` with `service: "forecast"` maps to `weatherUnavailable`;
  - `503` with `service: "locationSearch"`, `500` and a `503` without a body throw `ApiError`;
  - `429` maps to `tooManyRequests`;
  - the store sets `weatherUnavailable`, `tooManyRequests` and `serverError` (`500`, a network error, and no answer after 10 s but not before) and clears `forecast` in each;
  - `retry()` sends the same request again;
  - an answer arriving after `reset()` is dropped.
- [ ] T043 [P] [US3] Extend `frontend/src/tests/PlacesAndForecastPage.test.tsx` (errors part). Cover:
  - "Error: The weather service is unavailable. No forecast is shown." with Retry and no hours, periods or "Forecast updated" text, while the setup summary, the activities' settings and Back stay;
  - "Error: Too many requests. Wait a minute and try again." with Retry;
  - "Error: Something went wrong. Try again." with Retry for a `500`;
  - Retry shows "Getting the forecast…" and then the forecast;
  - leaving the page while loading and coming back sends a new request, and the old answer is not shown.

### Implementation for User Story 3

- [ ] T044 [US3] In `Api/Errors/ApiExceptionHandler.cs`, choose the `503` detail by `ExternalServiceException.Service` (`Forecast`: "The weather service is unavailable. No forecast is shown."; `LocationSearch`: the existing text). Add `problem.Extensions["service"]` = `"forecast"` or `"locationSearch"`. Update the class comment. The client still logs; the handler does not log again.
- [ ] T045 [US3] In `frontend/src/api/planForecastApi.ts`, add `{ kind: "weatherUnavailable" }` for `503` when the body's `service` is `"forecast"`, and `{ kind: "tooManyRequests" }` for `429`. In `frontend/src/stores/usePlanForecastStore.ts`:
  - add the 10-second timeout with an `AbortController`;
  - map the outcomes to `weatherUnavailable`, `tooManyRequests` and `serverError` (thrown errors and the timeout), clearing `forecast`;
  - add `retry()`.
- [ ] T046 [US3] In `frontend/src/components/planForecastStatus.tsx`, show the three error messages with "Error: " (via `formatErrorMessage` if it fits) and a "Retry" button that calls `usePlanForecastStore.getState().retry()`. Keep everything in the one status region so it is announced without moving focus.

**Checkpoint**: No failure ever shows forecast data, and every failure offers Retry.

---

## Phase 6: User Story 4 - The forecast matches the checked plan (Priority: P1)

**Goal**: The server re-checks the setup and activities before the weather service is called. An out-of-date plan sends the user back to the right step with a notice that stays until the next successful Continue.

**Independent Test**: Send a forecast request directly to the server with a date in the past, an unknown location id, and an activity with a wind limit of 31. Check that each is refused and the weather service is not contacted.

### Tests for User Story 4 ⚠️

- [ ] T047 [P] [US4] Extend `UnitTests/PlanForecastServiceTests.cs` (error paths). Cover:
  - a missing `Setup` gives only `setup`;
  - a past date gives `setup.dates[0]` and runs no activity check (pass a disposed context: it must not throw) and no forecast call;
  - an unknown location gives `setup.locationId`;
  - a wind limit of 31 gives `activities[0].maxWindMs`, and an unknown category gives `activities[0]`, with no forecast call;
  - keys keep the order of the underlying checks.
- [ ] T048 [P] [US4] Extend `IntegrationTests/PlanForecastEndpointTests.cs` (`400` part). Cover:
  - `setup.dates[0]` "Dates cannot be in the past." after moving `Clock` one day forward;
  - `setup.locationId` for an id the fake geocoding client does not know;
  - `setup` for a body without `setup`;
  - `activities[0].maxWindMs` for 31;
  - `activities[0]` for a new `Guid`;
  - `activities` for an empty list;
  - `request` for a string where a number belongs;
  - in every case `FakeForecastClient.Calls` does not change.
- [ ] T049 [P] [US4] Extend `frontend/src/tests/usePlanSetupStore.test.ts` and `frontend/src/tests/usePlanActivitiesStore.test.ts`. Cover:
  - `markOutdated()` sets `checked` to `null` and `recheckNotice` to `true`;
  - `setChecked` sets it back to `false`;
  - `clear` resets it;
  - `add`, `remove`, `update` and the setup changes leave it unchanged;
  - it is written to `sessionStorage` and read back after `persist.rehydrate()`;
  - a stored value without the field gets `false`.
- [ ] T050 [P] [US4] Extend `frontend/src/tests/planForecastApi.test.ts`, `frontend/src/tests/usePlanForecastStore.test.ts` and `frontend/src/tests/PlacesAndForecastPage.test.tsx` (out-of-date part). Cover:
  - `400` with a `setup.dates[0]` key maps to `setupOutdated`;
  - `400` with an `activities[0]` key maps to `activitiesOutdated`;
  - `400` with only `request` throws `ApiError`;
  - the store calls `markOutdated()` on the right store;
  - on the page, `setupOutdated` leads to `/plan/setup` showing "Your plan setup needs to be checked again. Select Continue.";
  - on the page, `activitiesOutdated` leads to `/plan/activities` showing "Your activities need to be checked again. Select Continue.";
  - `403` refreshes the current user.
- [ ] T051 [P] [US4] Extend `frontend/src/tests/PlanSetupPage.test.tsx` and `frontend/src/tests/ActivitySelectionPage.test.tsx` (notice part). Cover:
  - the notice is shown in a status region at the top while `recheckNotice` is true;
  - it is still shown after re-rendering from `sessionStorage`;
  - it is gone after a successful Continue, and stays after a failed one;
  - it is not shown when the page is opened without `recheckNotice`.

### Implementation for User Story 4

- [ ] T052 [US4] In `frontend/src/stores/usePlanSetupStore.ts` and `frontend/src/stores/usePlanActivitiesStore.ts`:
  - add `recheckNotice: boolean` (initial `false`) to the state, the initial state and `partialize`;
  - add `markOutdated: () => set({ checked: null, recheckNotice: true })`;
  - make `setChecked` also set `recheckNotice: false`.
  - Keep `version: 1`, with a comment that `persist` merges the stored value over the initial state, so older sessions get `false` (research section 12).
- [ ] T053 [US4] In `frontend/src/api/planForecastApi.ts`, read a `400` body: any key starting with `setup` gives `{ kind: "setupOutdated" }`; otherwise any key starting with `activities` gives `{ kind: "activitiesOutdated" }`; otherwise throw `ApiError(400)`. `403` gives `{ kind: "forbidden" }`. In `frontend/src/stores/usePlanForecastStore.ts`:
  - set `setupOutdated` and call `usePlanSetupStore.getState().markOutdated()`;
  - set `activitiesOutdated` and call `usePlanActivitiesStore.getState().markOutdated()`;
  - on `forbidden`, call `useCurrentUserStore.getState().refresh()` and return to `idle`, as the check stores do.
- [ ] T054 [US4] Create `frontend/src/components/recheckNotice.tsx` (`<p role="status" className="recheck-notice">` with the given text) and use it:
  - `frontend/src/components/planSetupForm.tsx` or `frontend/src/pages/PlanSetupPage.tsx` (whichever keeps the notice above the form fields): "Your plan setup needs to be checked again. Select Continue." while `usePlanSetupStore` `recheckNotice` is true;
  - `frontend/src/pages/ActivitySelectionPage.tsx`: "Your activities need to be checked again. Select Continue." while `usePlanActivitiesStore` `recheckNotice` is true.

  The existing guards already redirect once `checked` is `null`. Check that the order of the redirects in `PlacesAndForecastPage.tsx` still sends a setup problem to step 1.

**Checkpoint**: Out-of-date plans are caught on the server and explained to the user.

---

## Phase 7: User Story 5 - Only visitors and active registered users can get the forecast (Priority: P1)

**Goal**: The endpoint and step 3 follow the plan access rule, and refused callers never reach the external services.

**Independent Test**: Request the forecast for a valid plan as each caller type; only a Visitor and an Active Registered User get it.

### Tests for User Story 5 ⚠️

- [ ] T055 [P] [US5] Add `IntegrationTests/PlanForecastAuthorizationTests.cs`, following `PlanActivitiesAuthorizationTests.cs`. Cover every row of the authorization table in `contracts/plan-forecast-api.md` with a valid body:
  - a Visitor and an Active Registered User get `200`;
  - a Suspended Registered User, an Active and a Suspended Administrator, and a cookie whose account was deleted get `403`;
  - for every `403`, neither `FakeGeocodingClient.GetCalls` nor `FakeForecastClient.Calls` changes.
- [ ] T056 [P] [US5] Check that `frontend/src/tests/planCreatorOnly.test.tsx` still covers `/plan/places` for an Active Administrator (Access denied) and a Suspended user (Account suspended), and that no forecast request is sent for them. Extend it if not.

### Implementation for User Story 5

- [ ] T057 [US5] Make T055 and T056 pass. The policy is already on `PlanForecastController` (T027), the rate limiter runs before authorization, and the route is inside `PlanCreatorOnly`; fix only what the tests show.

**Checkpoint**: Access is enforced on the server and shown correctly in the browser.

---

## Phase 8: User Story 6 - Read the forecast with keyboard, screen reader and on a phone (Priority: P2)

**Goal**: The forecast and the hourly details work with the keyboard and a screen reader, and on a 320 px screen as cards.

**Independent Test**: At 320 px width, using only the keyboard, open and close the hourly details of two activities and read every hour's suitability, without horizontal scrolling.

### Tests for User Story 6 ⚠️

- [ ] T058 [P] [US6] Extend `frontend/src/tests/keyboard.test.tsx`. Check the tab order on step 3: skip link, navigation, progress links, then per activity each "Show hours" button in date order, then Back. Also check that Enter and Space open and close the hours, and that Retry is reachable in the error state.
- [ ] T059 [P] [US6] Extend `frontend/src/tests/accessibility.test.tsx` and `frontend/src/tests/layout.test.tsx` for Places and forecast. Cover:
  - one `<h1>`, then `<h2>` per activity and `<h3>` per date;
  - each activity is a region named after it;
  - the title and skip link;
  - the loading, error and "Forecast updated" messages are in one live region;
  - the tables have captions and column headers;
  - suitability is always ★ or ✗ with words;
  - the two notices on steps 1 and 2 are in status regions.
- [ ] T060 [P] [US6] Extend `frontend/src/tests/responsive.test.tsx`. Check that:
  - below 40em, each hours table row is displayed as a card (block layout), the `.cell-label` text is visible, the header row is visually hidden but still in the table, buttons are full width with 44 × 44 px targets, and no element is wider than 320 px;
  - from 40em it is a normal table with the labels hidden.

### Implementation for User Story 6

- [ ] T061 [US6] In `frontend/src/styles.css`, add the Places and forecast styles, reusing the existing breakpoint, button, banner and visually-hidden rules instead of copying them:
  - spacing for the activity sections, date entries and period lists;
  - `.recheck-notice` styled like a banner, with text, not colour alone;
  - the hours table with header cells and `.cell-label` visually hidden from 40em;
  - below 40em, `table`, `tbody`, `tr` and `td` as blocks, each row a card with a border, the `thead` visually hidden, and `.cell-label` shown, so each cell reads "Label: value";
  - long reasons wrap, with no horizontal scrolling at 320 px.

**Checkpoint**: All stories work for keyboard, screen reader and phone users.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T062 [P] Update `README.md` with a "Places and forecast" section:
  - the forecast on step 3 for the plan's location;
  - the 06:00–22:00 planning hours;
  - suitable periods, the hourly details and reasons;
  - the 30-minute reuse;
  - the `Forecast` settings (`MaxAgeMinutes`, `FirstHour`, `LastHour`) and that forecast requests share the `RateLimiting:PlanSetup` limit;
  - that the weather service is Open-Meteo and needs internet access when the API runs;
  - the "checked again" notices.

  Add to the status line that feature 006 is implemented. No migration step is needed.
- [ ] T063 [P] Update `docs/ux-design.md`:
  - set the Places and Forecast Loading state to "Getting the forecast…" (feature 007 makes it "Getting the forecast and nearby places…");
  - add the states "Forecast updated at HH:MM", "✗ No suitable hours on this date.", "No hours left to plan today.", the indoor message and the weather service error;
  - add the Plan Setup and Activity Selection notices "Your plan setup needs to be checked again. Select Continue." and "Your activities need to be checked again. Select Continue.";
  - check that the traceability rows for Places and Forecast list FR-009 and FR-011 to FR-015 as in `docs/architecture.md`, and fix any difference (constitution VI).
- [ ] T064 [P] In `docs/architecture.md`, add the forecast client and its 30-minute cache to the `Clients/` and caching rows, and the `service` field to the `Errors/` row.
- [ ] T065 [P] Check sizes (constitution I):
  - every new or changed C# class is under 200 lines, especially `OpenMeteoForecastClient.cs`, `PlanningDays.cs`, `HourSuitabilityRules.cs`, `PlanForecastService.cs` and `ExternalServiceJson.cs`;
  - every new or changed React page or component is under about 200 lines, especially `PlacesAndForecastPage.tsx`, `forecastDateEntry.tsx` and `forecastHoursTable.tsx`.

  Split by responsibility if not.
- [ ] T066 Run `dotnet format .\SpekLaiku.slnx --verify-no-changes`, `dotnet build .\SpekLaiku.slnx` and `dotnet test .\SpekLaiku.slnx` from the repository root. Run `npm run lint`, `npm run format:check`, `npm test` and `npm run build` from `frontend/`; run the frontend tests on their own, not at the same time as the backend tests. Fix any failure without weakening tests or checks.
- [ ] T067 Review `git diff main...HEAD`. Check that:
  - there are no unintended files (no `bin/`, `obj/`, `node_modules/`, local settings or debug code);
  - there is no migration and no new package;
  - `appsettings.Development.json` is unchanged;
  - no test calls a live Open-Meteo address.

  Then list the quickstart Manual Validation steps for the user to run before the Pull Request.
- [ ] T068 Run a separate AI-assisted review of the branch (for example `/code-review` and `/security-review`) and apply or reject each finding with a short reason. Then prepare the Pull Request description for the user (constitution V, VII and Quality Gates). It must include:
  - a link to `specs/006-hourly-forecast/spec.md` and a summary of the change;
  - the tests and checks run (T066 and the manual quickstart steps), and "no migration";
  - screenshots of Places and forecast (desktop and 320 px) with suitable periods, an open hours table, the weather service error, and a "checked again" notice;
  - the review tool, important findings, changes made and findings not applied.

  The user opens and merges the Pull Request.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories. Inside it:
  - T002 before T004; T003 before T004, T007 and T013; T004 before T005;
  - T006 before T007 (`ForecastOptions`); T007 before T008, T009 and T011;
  - T009 before T010 and T011; T011 before T012;
  - T014 before T015.
- **US1 (Phase 3)**:
  - Depends on Foundational.
  - T022 and T023 before T024; T024, T025 and T026 before T027.
  - T028 before T029; T029 before T030; T030 and T031 before T034; T032 before T033; T033 before T034.
- **US2 (Phase 4)**: Depends on US1 (the date entries). T037 before T038.
- **US3 (Phase 5)**: Depends on US1 (the endpoint, store and status component). It can run alongside US2: T044 to T046 touch different files from T037 and T038.
- **US4 (Phase 6)**:
  - Depends on US1. T052 before T053 and T054.
  - It touches `planForecastApi.ts` and `usePlanForecastStore.ts` after US3; if both run together, do T045 before T053.
- **US5 (Phase 7)**: Depends on US1 (the endpoint).
- **US6 (Phase 8)**: Depends on US1 to US4 (the tests check the final pages).
- **Polish (Phase 9)**: Depends on all stories.

### Within Each User Story

- Tests are written first and must fail before the implementation tasks.
- Backend: models → service → mapping → controller.
- Frontend: helper → API → store → component → page.

### Parallel Opportunities

- Foundational: T003, T006 (after T003's records exist), T014 and T015 touch different files. After T007, T009 and T011 can run in parallel.
- US1: T016 to T021 (tests) in parallel; T025, T028 and T031 alongside the services.
- US2: T035 and T036 in parallel.
- US3: T039 to T043 (tests) in parallel; T044 alongside T045.
- US4: T047 to T051 (tests) in parallel.
- US5: T055 and T056 in parallel.
- US6: T058 to T060 in parallel.
- Polish: T062 to T065 in parallel; then T066, T067 and T068 in order.

---

## Parallel Example: User Story 1

```text
# All tests for User Story 1 together:
Task: "T016 WeatherForecastServiceTests in backend/tests/SpekLaiku.UnitTests/WeatherForecastServiceTests.cs"
Task: "T017 PlanForecastServiceTests in backend/tests/SpekLaiku.UnitTests/PlanForecastServiceTests.cs"
Task: "T018 PlanForecastMappingTests in backend/tests/SpekLaiku.UnitTests/PlanForecastMappingTests.cs"
Task: "T019 PlanForecastEndpointTests in backend/tests/SpekLaiku.IntegrationTests/PlanForecastEndpointTests.cs"
Task: "T020 planForecastApi and usePlanForecastStore tests in frontend/src/tests/"
Task: "T021 PlacesAndForecastPage forecast tests in frontend/src/tests/PlacesAndForecastPage.test.tsx"

# Independent pieces together:
Task: "T025 response DTOs in backend/src/SpekLaiku.Api/DTOs/Responses/"
Task: "T028 planForecastRequest in frontend/src/helpers/planForecastRequest.ts"
Task: "T031 PlanForecastStatus in frontend/src/components/planForecastStatus.tsx"
```

## Parallel Example: User Story 3

```text
Task: "T039 ApiExceptionHandlerTests in backend/tests/SpekLaiku.UnitTests/ApiExceptionHandlerTests.cs"
Task: "T040 PlanForecastFailureTests in backend/tests/SpekLaiku.IntegrationTests/PlanForecastFailureTests.cs"
Task: "T041 shared limit in backend/tests/SpekLaiku.IntegrationTests/PlanSetupRateLimitTests.cs"
Task: "T042 planForecastApi and usePlanForecastStore error tests in frontend/src/tests/"
Task: "T043 PlacesAndForecastPage error tests in frontend/src/tests/PlacesAndForecastPage.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2. The client, rules, periods, options, fakes, types and wording are in place and tested.
2. Complete Phase 3 (US1): step 3 shows suitable periods per activity and date from the forecast.
3. **STOP and VALIDATE** with the US1 independent test, then review the diff.

### Incremental Delivery

1. US1 → suitable hours per activity (MVP).
2. US2 → hourly details and reasons.
3. US3 → service failures, timeouts and the shared request limit.
4. US4 → server re-checks and "checked again" notices.
5. US5 → access on the endpoint and step 3.
6. US6 → keyboard, screen reader and 320 px cards.
7. Polish → documentation, size check, full checks, diff review, AI review and Pull Request description.

Implement one phase at a time and stop after each phase for a diff review. Commit only when asked, with Conventional Commit messages such as `feat(hourly-forecast): add forecast suitability rules`.

---

## Notes

- [P] tasks touch different files and do not depend on unfinished tasks.
- No migration and no new package. The only new external call is the Open-Meteo forecast API, always faked in tests.
- The API caches forecasts per location id and day, and locations per id, in a cache shared by the integration test collection. Each test uses its own place id and position.
- Every hour rule and reason text is on the server. The browser only words the counts and flags and shows the server's texts.
- API messages have no "Error: " prefix; the frontend adds it.
