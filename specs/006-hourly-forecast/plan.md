# Implementation Plan: 006-hourly-forecast

**Branch**: `006-hourly-forecast` | **Date**: 2026-11-10 | **Spec**: [specs/006-hourly-forecast/spec.md](spec.md)

**Input**: Feature specification from `/specs/006-hourly-forecast/spec.md`

## Summary

On step 3, "Places and forecast", show for each of the plan's activities which hours on each plan date suit it. The hours come from the hourly forecast for the plan's location. For every unsuitable hour the page gives the reason in words, and it handles the weather service being unavailable without showing any guessed data.

**Backend**:
- A new `POST /api/plan-forecast` with the feature 004 `PlanCreator` policy and the shared `PlanSetup` request limit.
- `PlanForecastService` checks the setup and the activities again with the existing feature 004 and 005 services. It then gets the forecast for the location's position, which comes from the location search service (research section 8).
  - The forecast comes from `WeatherForecastService`, which caches it for up to 30 minutes per location and day (research section 4).
  - `PlanningDays` builds the 06:00–22:00 hours per plan date (research sections 2, 3 and 5).
  - `HourSuitabilityRules`, `SuitablePeriods` and `ActivityForecasts` judge every hour and build the suitable periods and counts (research sections 6 and 7).
- A new `OpenMeteoForecastClient` shares its HTTP error handling with the geocoding client (research section 11).
- `ApiExceptionHandler` tells the two services apart in its `503` answer.

**Frontend**:
- Step 3 grows from feature 005's first version: each activity becomes a section with a summary line, one entry per date (sunrise, sunset, suitable periods) and a "Show hours" table that becomes cards on phones.
- A forecast store handles loading, the three error states with Retry, the 10-second timeout and late answers.
- When the server finds the plan out of date, the setup or activities store is marked, and steps 1 and 2 show a "checked again" notice until the next successful Continue (research section 12).

No database change, no migration and no new package.

## Technical Context

**Language/Version**: C# on .NET 10 (ASP.NET Core Web API); TypeScript with React 19, built with Vite. Unchanged.

**Primary Dependencies**: Existing only.
- Backend: ASP.NET Core (with the built-in rate limiting middleware), EF Core with Npgsql, AutoMapper, `IHttpClientFactory`, `IMemoryCache`, `TimeProvider`.
- Frontend: React, React Router, Zustand (with `persist`).
- Tests: xUnit, EF Core in-memory provider (unit), `Microsoft.AspNetCore.Mvc.Testing` with Testcontainers PostgreSQL (integration), Vitest, React Testing Library, user-event.

**No new NuGet or npm package** (research section 14).

**External services**:
- Open-Meteo forecast API (new): one request per location and forecast period, at most every 30 minutes per location (research sections 1 and 4).
- Open-Meteo geocoding API (existing): the location lookup in the setup check, normally answered from the one-hour location cache.

Tests use `FakeForecastClient` and the existing `FakeGeocodingClient`, never the live services.

**Authorization**: `[Authorize(Policy = AuthorizationPolicies.PlanCreator)]` on `PlanForecastController` (anonymous or Active Registered User; others get `403`). `[EnableRateLimiting(RateLimitPolicies.PlanSetup)]` shares the 30-per-minute limit with location searches and plan setup checks (research section 10). In the browser, `/plan/places` is already inside `PlanCreatorOnly`.

**Backend structure** (`backend/src/SpekLaiku.Api/`):
- `Clients/ExternalService.cs` (changed): adds `Forecast`.
- `Clients/ExternalServiceJson.cs` (new, internal static): `GetAsync<T>(HttpClient, path, ExternalService, ILogger, badRequestMeansNotFound, cancellationToken)`. This is the timeout, network, status and JSON handling moved from `OpenMeteoGeocodingClient`, with one warning per failure naming only the service, kind and status code.
- `Clients/OpenMeteoGeocodingClient.cs` (changed): uses `ExternalServiceJson`; its behaviour and log text stay the same.
- `Clients/IForecastClient.cs`, `HourlyForecast.cs` (with `ForecastHourValues` and `ForecastDaylight`), `OpenMeteoForecastClient.cs` and `OpenMeteoForecastResponse.cs` (new): research sections 1 and 11, `data-model.md` (Client models). Base address `https://api.open-meteo.com/`, timeout 4 seconds.
- `Services/ForecastPeriod.cs` (changed): adds `GetNow()`, the current time in Lithuania. The forecast services read the time only through it, so they follow the integration tests' clock (research section 3).
- `Services/ForecastOptions.cs` (new): section `Forecast`, validated at start (research section 9).
- `Services/WeatherForecastService.cs` and `ReceivedForecast.cs` (new): the cached forecast for a location (research section 4).
- `Services/PlanningHour.cs`, `PlanningDay.cs` and `PlanningDays.cs` (new): the planning hours per date.
- `Services/HourSuitabilityRules.cs`, `HourSuitability.cs`, `SuitablePeriod.cs`, `SuitablePeriods.cs`, `ActivityDayForecast.cs`, `ActivityForecast.cs` and `ActivityForecasts.cs` (new): the rules, periods and counts.
- `Services/PlanForecast.cs`, `PlanForecastResult.cs` and `PlanForecastService.cs` (new): the order of checks and the error key prefixes (`data-model.md`).
- `DTOs/Requests/PlanForecastRequest.cs` (new): `PlanSetupCheckRequest? Setup`, `List<PlanActivityRequest>? Activities`.
- `DTOs/Responses/PlanForecastResponse.cs`, `ForecastDayResponse.cs`, `ForecastHourResponse.cs`, `ActivityForecastResponse.cs`, `ActivityDayForecastResponse.cs`, `SuitablePeriodResponse.cs` and `HourSuitabilityResponse.cs` (new): as in `contracts/plan-forecast-api.md`.
- `Mapping/PlanForecastMappingProfile.cs` (new): the service models to the responses, with `TimeOnly` written as `"HH:mm"` (invariant culture). No rules.
- `Controllers/PlanForecastController.cs` (new): `[Route("api/plan-forecast")]`, one `POST` that returns `200`, or `400` `ValidationProblemDetails` with keys in the service's order (the same as the existing check controllers).
- `Errors/ApiExceptionHandler.cs` (changed): the `503` detail chosen by `ExternalServiceException.Service`, plus a `service` extension (`"forecast"` or `"locationSearch"`).
- `RateLimiting/RateLimitPolicies.cs` (changed): the `PlanSetup` comment names forecast requests too.
- `Program.cs` (changed): `AddOptions<ForecastOptions>()` with validation, `AddHttpClient<IForecastClient, OpenMeteoForecastClient>` with the base address and timeout and `.RemoveAllLoggers()`, and `AddScoped` for `WeatherForecastService` and `PlanForecastService`.
- `appsettings.json` (changed): `"Forecast": { "MaxAgeMinutes": 30, "FirstHour": 6, "LastHour": 22 }`.

**Error responses**: `400` `ValidationProblemDetails`, `403` from the policy, `429` from the rate limiter, `503` with `service` from `ApiExceptionHandler`, and `500` for anything else.

**Frontend structure** (`frontend/src/`):
- `types/planForecast.ts` (new): `data-model.md` (Frontend types).
- `api/planForecastApi.ts` (new): `getPlanForecast(request, signal)` returns `{ kind: "forecast"; forecast } | { kind: "setupOutdated" } | { kind: "activitiesOutdated" } | { kind: "forbidden" } | { kind: "tooManyRequests" } | { kind: "weatherUnavailable" }`. Any other answer, including `400` with only `request` and a `503` from another service, throws `ApiError`; network and abort errors pass through. Follows `planActivitiesApi.ts`.
- `helpers/planForecastRequest.ts`, `forecastSummaryText.ts` and `suitablePeriodText.ts` (new), and `formatPlanDateLong` added to `helpers/formatPlanDate.ts` (`data-model.md`, Helpers).
- `stores/usePlanForecastStore.ts` (new, not persisted): `data-model.md` and research section 12.
- `stores/usePlanSetupStore.ts` and `usePlanActivitiesStore.ts` (changed): `recheckNotice` and `markOutdated()`. `setChecked` and `clear` reset the notice.
- `pages/PlacesAndForecastPage.tsx` (changed):
  - Keeps the heading, progress at step 3, the redirects and Back.
  - On mount it loads the forecast from the checked setup and activities; on unmount it resets the forecast store.
  - It renders `PlanForecastStatus`, the setup summary and `PlanActivitiesSummary` with the forecast.
  - The redirect for the setup comes before the one for the activities, as now.
- `components/planForecastStatus.tsx` (new): one `role="status"` region with "Getting the forecast…", "Forecast updated at HH:MM", or the error message with Retry.
- `components/planActivitiesSummary.tsx` (changed): each activity becomes a `<section aria-labelledby>` with an `h2` name. An optional `forecast` prop adds an `ActivityForecast` under the settings, matched by position.
- `components/activityForecast.tsx` (new): the summary line or the indoor message, then one `ForecastDateEntry` per date.
- `components/forecastDateEntry.tsx` (new): the `h3` long date, sunrise and sunset, the periods or "✗ No suitable hours on this date." or "No hours left to plan today.", and the Show/Hide button with `aria-expanded` and `aria-controls`.
- `components/forecastHoursTable.tsx` (new): a `<table>` with a caption and the columns Time, Temperature, Rain, Wind, Daylight and Suitability. Each cell has a label that is visually hidden on desktop and shown in the phone card layout.
- `components/recheckNotice.tsx` (new): the notice paragraph for steps 1 and 2, in a status region.
- `pages/PlanSetupPage.tsx` and `pages/ActivitySelectionPage.tsx` (changed): show `RecheckNotice` above the form while their store's `recheckNotice` is true.
- `styles.css` (changed):
  - The forecast area, periods and notice.
  - The hours table as cards below the existing 40em breakpoint, with no horizontal scrolling.
  - Reuses the existing button and breakpoint rules.
- `tests/setup.ts` (changed): resets the forecast store.

**Origins and CSRF**: Unchanged. The new `POST` changes no stored state and accepts JSON only.

**Storage**: None on the server except the in-memory cache (research section 4). The browser keeps only the two new `recheckNotice` flags in the existing `sessionStorage` stores. The forecast itself is never kept (spec FR-025). **No migration.**

**Testing**:
- **Backend unit tests**:
  - `HourSuitabilityRules`, `PlanningDays`, `SuitablePeriods` and `ActivityForecasts`: every rule and boundary, with fixed forecasts and a `FixedTimeProvider`.
  - `WeatherForecastService`: the cache key and the 30-minute age.
  - `PlanForecastService`: the order of checks and the key prefixes, with fake clients.
  - `OpenMeteoForecastClient`: with `FakeHttpMessageHandler`.
  - `OpenMeteoGeocodingClient` and `ApiExceptionHandler`: the existing tests, plus `service`.
  - `ForecastOptions` validation and the mapping profile.
- **Backend integration tests**:
  - the authorization table;
  - the shared request limit;
  - the `200`, `400` and `503` contracts;
  - failure logging;
  - freshness, against PostgreSQL with `FakeForecastClient` registered in `PostgreSqlApiFactory` next to `FakeGeocodingClient`.
- **Frontend tests**: the list in `quickstart.md`, with faked `fetch` and fake timers for the timeout.

**Target Platform**: Web application, the same browsers and server as before.

**Project Type**: Full-stack web application.

**Performance Goals**:
- SC-001: suitable hours for 7 dates and 10 activities within 5 seconds.
- The server work is at most 7 × 16 hours × 10 activities = 1,120 rule checks, which is negligible. The time is the weather call (at most 4 s, usually cached) and the location lookup (cached).
- The response is at most a few hundred kilobytes.

**Constraints**:
- Server-side authorization, validation and suitability rules; the page holds no rule.
- No invented or outdated data (NFR-007, constitution External data).
- No coordinates, dates or identities in logs.
- Accessibility and a 320 px layout.
- Every new C# class under 200 lines, and React files under about 200 lines.

**Scale/Scope**:
- One endpoint, one external client, about 15 small backend classes, 7 response DTOs.
- One page changed, two pages given a notice, five new components and one changed, one new store and two changed, and four helpers.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **PASS (I Code quality)**:
  - Each rule exists once: the setup and activity rules are reused through their services, the hour rules are in `HourSuitabilityRules`, and the periods and counts are in `SuitablePeriods` and `ActivityForecasts`.
  - The planning window and the maximum age are in `ForecastOptions`.
  - The HTTP error handling shared by both Open-Meteo clients moves to `ExternalServiceJson` instead of being copied.
  - The page only words server values; the wordings live in small helpers.
  - No Manager, Helper or Utils names. Each class has one responsibility and stays well under 200 lines.
- **PASS (II Architecture)**:
  - The controller only binds, calls `PlanForecastService` and maps.
  - The rules are in services.
  - The weather service is called only through `IForecastClient`.
  - Responses are DTOs mapped by AutoMapper with no rules in the profile; no entity is involved.
  - No schema change, so no migration.
  - Frontend calls go only through `api/planForecastApi.ts`.
- **PASS (III Testing)**:
  - Unit and integration tests for every rule, boundary and status; frontend tests for loading, success, empty ("No hours left", "No suitable hours"), error and out-of-date states.
  - The endpoint has an authorization test for every caller type.
  - "One user cannot change another user's data" does not apply: nothing is stored.
  - The weather and location services are always fakes. The backend reads the time only through `ForecastPeriod`, which the tests build on a `FixedTimeProvider`; the frontend uses fake timers.
- **PASS (IV Security)**:
  - Authorization is enforced on the server by the existing policy.
  - All input is validated again on the server, and the position comes only from the location search service by id.
  - The count checks of the existing services run before any lookup, and the shared request limit runs before authorization. One address cannot use the endpoint to flood either public service (OWASP unrestricted resource consumption).
  - No secrets. Logs hold only the service, kind and status.
  - Failures are handled centrally, with no details in the answer.
- **PASS (V Version control)**: Work is on `006-hourly-forecast`, created from an updated `main` after 005 was merged. Its first commit records feature 005's T060 tick that was left uncommitted.
- **PASS (VI Documentation)**: During implementation:
  - The README gets a Places and forecast section, including the `Forecast` settings.
  - `docs/ux-design.md` gets these Places and Forecast states: "Getting the forecast…" until feature 007 adds places, "Forecast updated at", "No hours left to plan today." and the indoor message. It also gets the two "checked again" notices.
  - `docs/architecture.md` adds the forecast client to the `Clients/` row.
- **PASS (VII AI use)**: The spec, the five clarifications and this plan exist before implementation.
- **PASS (VIII Simplicity)**:
  - No new package, folder or table; the existing cache, rate limiting policy and check services are reused.
  - The forecast is requested once per location and day, not per activity or date.
  - The planning window removes the need for any clock-change handling.

**Post-design re-check**: PASS. The data model, contract and quickstart add no layer, package, migration or violation. The geocoding client refactor keeps its behaviour and tests, and the `503` answers only gain a field.

## Project Structure

### Documentation (this feature)

```text
specs/006-hourly-forecast/
├── spec.md              # Feature specification (with Clarifications)
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1: client and service models, rules, frontend state
├── quickstart.md        # Phase 1: automated and manual validation
├── contracts/
│   └── plan-forecast-api.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
backend/
├── src/SpekLaiku.Api/
│   ├── Clients/ExternalService.cs                        (changed)
│   ├── Clients/ExternalServiceJson.cs                    (new)
│   ├── Clients/OpenMeteoGeocodingClient.cs               (changed)
│   ├── Clients/IForecastClient.cs                        (new)
│   ├── Clients/HourlyForecast.cs                           (new)
│   ├── Clients/OpenMeteoForecastClient.cs                (new)
│   ├── Clients/OpenMeteoForecastResponse.cs              (new)
│   ├── Controllers/PlanForecastController.cs             (new)
│   ├── DTOs/Requests/PlanForecastRequest.cs              (new)
│   ├── DTOs/Responses/PlanForecastResponse.cs            (new)
│   ├── DTOs/Responses/ForecastDayResponse.cs             (new)
│   ├── DTOs/Responses/ForecastHourResponse.cs            (new)
│   ├── DTOs/Responses/ActivityForecastResponse.cs        (new)
│   ├── DTOs/Responses/ActivityDayForecastResponse.cs     (new)
│   ├── DTOs/Responses/SuitablePeriodResponse.cs          (new)
│   ├── DTOs/Responses/HourSuitabilityResponse.cs         (new)
│   ├── Errors/ApiExceptionHandler.cs                     (changed)
│   ├── Mapping/PlanForecastMappingProfile.cs             (new)
│   ├── RateLimiting/RateLimitPolicies.cs                 (changed, comment only)
│   ├── Services/ForecastPeriod.cs                        (changed)
│   ├── Services/ForecastOptions.cs                       (new)
│   ├── Services/WeatherForecastService.cs                (new)
│   ├── Services/ReceivedForecast.cs                      (new)
│   ├── Services/PlanningHour.cs                          (new)
│   ├── Services/PlanningDay.cs                           (new)
│   ├── Services/PlanningDays.cs                          (new)
│   ├── Services/HourSuitabilityRules.cs                  (new)
│   ├── Services/HourSuitability.cs                       (new)
│   ├── Services/SuitablePeriod.cs                        (new)
│   ├── Services/SuitablePeriods.cs                       (new)
│   ├── Services/ActivityDayForecast.cs                   (new)
│   ├── Services/ActivityForecast.cs                      (new)
│   ├── Services/ActivityForecasts.cs                     (new)
│   ├── Services/PlanForecast.cs                          (new)
│   ├── Services/PlanForecastResult.cs                    (new)
│   ├── Services/PlanForecastService.cs                   (new)
│   ├── Program.cs                                        (changed)
│   └── appsettings.json                                  (changed)
└── tests/
    ├── SpekLaiku.UnitTests/HourSuitabilityRulesTests.cs          (new)
    ├── SpekLaiku.UnitTests/PlanningDaysTests.cs                  (new)
    ├── SpekLaiku.UnitTests/SuitablePeriodsTests.cs               (new)
    ├── SpekLaiku.UnitTests/ActivityForecastsTests.cs             (new)
    ├── SpekLaiku.UnitTests/WeatherForecastServiceTests.cs        (new)
    ├── SpekLaiku.UnitTests/PlanForecastServiceTests.cs           (new)
    ├── SpekLaiku.UnitTests/OpenMeteoForecastClientTests.cs       (new)
    ├── SpekLaiku.UnitTests/ForecastOptionsTests.cs               (new)
    ├── SpekLaiku.UnitTests/PlanForecastMappingTests.cs           (new)
    ├── SpekLaiku.UnitTests/RecordingForecastClient.cs            (new)
    ├── SpekLaiku.UnitTests/ApiExceptionHandlerTests.cs           (changed)
    ├── SpekLaiku.IntegrationTests/FakeForecastClient.cs          (new)
    ├── SpekLaiku.IntegrationTests/PostgreSqlApiFactory.cs        (changed)
    ├── SpekLaiku.IntegrationTests/PlanForecastEndpointTests.cs       (new)
    ├── SpekLaiku.IntegrationTests/PlanForecastAuthorizationTests.cs  (new)
    ├── SpekLaiku.IntegrationTests/PlanForecastFailureTests.cs        (new)
    └── SpekLaiku.IntegrationTests/PlanSetupRateLimitTests.cs     (changed: forecast requests count too)

frontend/src/
├── api/planForecastApi.ts                  (new)
├── types/planForecast.ts                   (new)
├── helpers/planForecastRequest.ts          (new)
├── helpers/forecastSummaryText.ts          (new)
├── helpers/suitablePeriodText.ts           (new)
├── helpers/formatPlanDate.ts               (changed)
├── stores/usePlanForecastStore.ts          (new)
├── stores/usePlanSetupStore.ts             (changed)
├── stores/usePlanActivitiesStore.ts        (changed)
├── pages/PlacesAndForecastPage.tsx         (changed)
├── pages/PlanSetupPage.tsx                 (changed)
├── pages/ActivitySelectionPage.tsx         (changed)
├── components/planForecastStatus.tsx       (new)
├── components/planActivitiesSummary.tsx    (changed)
├── components/activityForecast.tsx         (new)
├── components/forecastDateEntry.tsx        (new)
├── components/forecastHoursTable.tsx       (new)
├── components/recheckNotice.tsx            (new)
├── styles.css                              (changed)
└── tests/                                  (new and extended test files, see quickstart.md)
```

**Structure Decision**: The existing web application layout (`backend/` and `frontend/`), as described in `docs/architecture.md`. No new folders.

## Complexity Tracking

No constitution violations to justify.
