# Implementation Plan: 008-generate-schedule

**Branch**: `008-generate-schedule` | **Date**: 2026-11-16 | **Spec**: [specs/008-generate-schedule/spec.md](spec.md)

**Input**: Feature specification from `/specs/008-generate-schedule/spec.md`

## Summary

A "Generate schedule" button on the "Places and forecast" step (step 3) sends the same checked plan body as the forecast and places endpoints. The server rechecks the plan, fetches the forecast and places from their caches, runs a greedy scheduling algorithm, and returns a schedule: each activity assigned to the longest available non-overlapping suitable period on its best date, together with the place and the weather at the period's start. Activities without a place or without an available slot are flagged with the reason. The result is shown on the new "Schedule Overview" page (step 4).

**Backend**:

- A new `POST /api/plan-schedule` endpoint with the `PlanCreator` policy and the shared `PlanSetup` request limit.
- `PlanScheduleService`: recheck → forecast (via `WeatherForecastService`) → place tags from DB → places (via `NearbyPlacesService`) → build `PlanningDays` → `ActivityForecasts.For` per activity → `PlanScheduler.Assign`.
- `PlanScheduler` (static, like `NearbyPlaceRules`): greedy algorithm in plan order; each activity gets the longest non-overlapping suitable period that is not `ShorterThanDuration`; ties to the earliest date; weather at the period's start hour from `PlanningDay.Hours`.
- `ApiExceptionHandler` needs no change: it already maps `ExternalService.Forecast` → `service: "forecast"` and `ExternalService.MapData` → `service: "places"`.

**Frontend**:

- A "Generate schedule" button on step 3 (enabled when both stores are `loaded` or in an error state that allows Retry; disabled while loading/retrying). Clicking it navigates to `/plan/schedule`.
- A new `usePlanScheduleStore` (not persisted, cleared on page unmount).
- A new `ScheduleOverviewPage` (step 4): starts generation on mount, shows "Generating your schedule…", then the grouped-by-date schedule table, the unscheduled list, and the Back button. The schedule store is cleared when the page unmounts.
- `PlanProgress` gains step 4.

There is no database change, no migration and no new package.

## Technical Context

**Language/Version**: C# on .NET 10 (ASP.NET Core Web API); TypeScript with React 19, built with Vite. Unchanged.

**Primary Dependencies**: Existing only.

- Backend: `PlanRecheckService`, `WeatherForecastService`, `NearbyPlacesService`, `ApplicationDbContext`, `ActivityForecasts`, `PlanningDays`, `SuitablePeriods`, `ForecastPeriod`, `IOptions<ForecastOptions>`, `IOptions<PlacesOptions>`, AutoMapper.
- Frontend: React, React Router and Zustand. Existing helpers (`checkedPlanRequest`, `startTimeout`, `formatPlanDate`, `openStreetMapLink`, `placeDistanceText`).
- Tests: xUnit, EF Core in-memory, `Microsoft.AspNetCore.Mvc.Testing` with Testcontainers PostgreSQL, Vitest, React Testing Library.

**No new NuGet or npm package** (research section 1).

**External services**: None new. The schedule endpoint reuses `WeatherForecastService` (Open-Meteo) and `NearbyPlacesService` (Overpass), both already called in features 006 and 007. The same caches, timeouts and error handling apply.

**Authorization**: `[Authorize(Policy = AuthorizationPolicies.PlanCreator)]` and `[EnableRateLimiting(RateLimitPolicies.PlanSetup)]`, identical to `PlanPlacesController` (spec FR-010, FR-012).

**Backend structure** (`backend/src/SpekLaiku.Api/`):

- **Services**:
  - `Services/UnscheduledReason.cs` (new): enum `NoPlace`, `NoSuitableTime`.
  - `Services/WeatherSnapshot.cs` (new): `record WeatherSnapshot(decimal? TemperatureC, decimal? RainMmPerHour, decimal? WindMs, bool IsIndoor)`.
  - `Services/ScheduledActivity.cs` (new): `record ScheduledActivity(Guid ActivityId, string ActivityName, DateOnly Date, TimeOnly Start, TimeOnly End, NearbyPlace Place, WeatherSnapshot Weather)`.
  - `Services/UnscheduledActivity.cs` (new): `record UnscheduledActivity(Guid ActivityId, string ActivityName, UnscheduledReason Reason)`.
  - `Services/PlanSchedule.cs` (new): `record PlanSchedule(IReadOnlyList<ScheduledActivity> Scheduled, IReadOnlyList<UnscheduledActivity> Unscheduled)`.
  - `Services/PlanScheduleResult.cs` (new): follows `PlanForecastResult`.
  - `Services/PlanScheduler.cs` (new, static): `Assign(activities, forecasts, categoryPlaces, days)` — the scheduling algorithm (research section 3). Keep under 200 lines.
  - `Services/PlanScheduleService.cs` (new): takes `PlanRecheckService`, `WeatherForecastService`, `ApplicationDbContext`, `NearbyPlacesService`, `ForecastPeriod`, `IOptions<ForecastOptions>`, `IOptions<PlacesOptions>`. Follows `PlanForecastService` and `PlanPlacesService`. Keep under 200 lines.
- **DTOs**:
  - `DTOs/Requests/PlanScheduleRequest.cs` (new): same shape as `PlanForecastRequest` and `PlanPlacesRequest`.
  - `DTOs/Responses/WeatherSnapshotResponse.cs` (new): `TemperatureC?`, `RainMmPerHour?`, `WindMs?`, `IsIndoor`.
  - `DTOs/Responses/ScheduledActivityResponse.cs` (new): `ActivityName`, `Date` (string), `StartTime` (string), `EndTime` (string), `Place` (`NearbyPlaceResponse`), `Weather` (`WeatherSnapshotResponse`).
  - `DTOs/Responses/UnscheduledActivityResponse.cs` (new): `ActivityName`, `Reason` (string camelCase).
  - `DTOs/Responses/PlanScheduleResponse.cs` (new): `Scheduled`, `Unscheduled`.
- **Mapping**:
  - `Mapping/PlanScheduleMappingProfile.cs` (new): service models to responses. `UnscheduledReason.NoPlace` → `"noPlace"`, `NoSuitableTime` → `"noSuitableTime"`. Date and times mapped to strings. `NearbyPlace` → `NearbyPlaceResponse` reused by name.
- **Controller**: `Controllers/PlanScheduleController.cs` (new), `[Route("api/plan-schedule")]`, identical structure to `PlanPlacesController`.
- **Other**:
  - `RateLimiting/RateLimitPolicies.cs` (comment only): adds "schedule requests" to the shared-limit description.
  - `Program.cs`: `AddScoped<PlanScheduleService>()`.

**Error responses** (identical to places):
- `400` `ValidationProblemDetails`;
- `403` from the policy;
- `429` from the rate limiter;
- `503` with `service: "forecast"` or `service: "places"` from `ApiExceptionHandler` (no change to the handler);
- `500` for anything else.

**Frontend structure** (`frontend/src/`):

- **Types**: `types/planSchedule.ts` (new): `WeatherSnapshot`, `ScheduledActivity`, `UnscheduledActivity`, `PlanSchedule`, `type PlanScheduleRequest = PlanForecastRequest`.
- **API**: `api/planScheduleApi.ts` (new): `getPlanSchedule(request, signal)` — `200` → `{ kind: "schedule"; schedule }`, `400` with setup/activities key → outdated, `429` → `tooManyRequests`, `503` with `service: "forecast"` → `weatherUnavailable`, `503` with `service: "places"` → `placesUnavailable`, `403` → `forbidden`; anything else throws `ApiError`. Reuses `outdatedPart` and `failedService` from `planStepAnswer.ts` (feature 007).
- **Store**: `stores/usePlanScheduleStore.ts` (new, not persisted): statuses `idle`, `loading`, `loaded`, `weatherUnavailable`, `placesUnavailable`, `tooManyRequests`, `serverError`, `setupOutdated`, `activitiesOutdated`. `generate(setup, activities)` — ignored while loading. `retry()` — reruns with `loading`. `reset()` — aborts and returns to `idle`. Cleared on page unmount via `reset()` in the page's `useEffect` cleanup (spec FR-014 clarification).
- **Helpers**: `helpers/scheduleText.ts` (new): `scheduleReasonText(reason)` → "No place found" / "No suitable time found"; `scheduleWeatherText(weather)` → "Weather does not affect this indoor activity." or the wind/rain/temp line.
- **Pages**: `pages/ScheduleOverviewPage.tsx` (new): on mount calls `scheduleStore.generate(setup, activities)`; cleanup calls `scheduleStore.reset()`. Shows loading, schedule table grouped by date (time-ordered), unscheduled section, and Back. Keep under about 200 lines; extract `scheduledDaySection.tsx` and `unscheduledSection.tsx` components if needed.
- **Changed**:
  - `pages/PlacesAndForecastPage.tsx`: "Generate schedule" button, enabled when forecast and places are both `loaded`. Navigates to `/plan/schedule` via `useNavigate`.
  - `components/planProgress.tsx`: adds step 4 "Schedule Overview" at `/plan/schedule`.
  - `App.tsx` (or router file): adds `/plan/schedule` route inside `PlanCreatorOnly`.
  - `tests/setup.ts`: resets the schedule store in `beforeEach`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality — SOLID, DRY, KISS | ✓ | `PlanScheduler` is a focused static class. The forecast/place lookup duplicates `PlanForecastService`/`PlanPlacesService` only in service calls, not in rules; the rules themselves live in their own classes. |
| I. 200-line limit | ✓ | `PlanScheduleService` and `PlanScheduler` are each kept under 200 lines (by splitting if needed). |
| II. Thin controller | ✓ | `PlanScheduleController` follows `PlanPlacesController`: one POST, map result, return. |
| II. Business rules in services | ✓ | Scheduling algorithm in `PlanScheduler` (service layer). |
| II. No custom repository | ✓ | `PlanScheduleService` uses `ApplicationDbContext` directly. |
| II. Async I/O | ✓ | Service is async; `PlanScheduler.Assign` is synchronous (CPU-only). |
| II. Response DTOs | ✓ | New response records; `NearbyPlace` (entity-layer) is not returned. |
| III. Tests | ✓ | Unit tests for `PlanScheduler`; service tests with `RecordingMapPlacesClient`; integration tests for the endpoint; frontend store and page tests. Authorization test covers every caller. |
| IV. Authorization on server | ✓ | `PlanCreator` policy on the controller. |
| IV. No secrets in logs | ✓ | Same logging policy as forecast/places (service-level only, no plan data). |
| VIII. No unnecessary packages | ✓ | No new NuGet or npm package. |
| VIII. No migration | ✓ | No schema change. |

## Project Structure

### Documentation (this feature)

```text
specs/008-generate-schedule/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── plan-schedule-api.md   # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code

```text
backend/
├── src/SpekLaiku.Api/
│   ├── Controllers/
│   │   └── PlanScheduleController.cs          (new)
│   ├── Services/
│   │   ├── UnscheduledReason.cs               (new)
│   │   ├── WeatherSnapshot.cs                 (new)
│   │   ├── ScheduledActivity.cs               (new)
│   │   ├── UnscheduledActivity.cs             (new)
│   │   ├── PlanSchedule.cs                    (new)
│   │   ├── PlanScheduleResult.cs              (new)
│   │   ├── PlanScheduler.cs                   (new)
│   │   └── PlanScheduleService.cs             (new)
│   ├── DTOs/Requests/
│   │   └── PlanScheduleRequest.cs             (new)
│   ├── DTOs/Responses/
│   │   ├── WeatherSnapshotResponse.cs         (new)
│   │   ├── ScheduledActivityResponse.cs       (new)
│   │   ├── UnscheduledActivityResponse.cs     (new)
│   │   └── PlanScheduleResponse.cs            (new)
│   ├── Mapping/
│   │   └── PlanScheduleMappingProfile.cs      (new)
│   ├── RateLimiting/
│   │   └── RateLimitPolicies.cs               (comment only)
│   └── Program.cs                             (changed: AddScoped)
└── tests/
    ├── SpekLaiku.UnitTests/
    │   ├── PlanSchedulerTests.cs              (new)
    │   └── PlanScheduleMappingTests.cs        (new)
    └── SpekLaiku.IntegrationTests/
        ├── PlanScheduleEndpointTests.cs       (new)
        ├── PlanScheduleAuthorizationTests.cs  (new)
        └── PlanScheduleFailureTests.cs        (new)

frontend/src/
├── types/
│   └── planSchedule.ts                        (new)
├── api/
│   └── planScheduleApi.ts                     (new)
├── stores/
│   └── usePlanScheduleStore.ts                (new)
├── helpers/
│   └── scheduleText.ts                        (new)
├── pages/
│   ├── PlacesAndForecastPage.tsx              (changed: button + route)
│   └── ScheduleOverviewPage.tsx               (new)
├── components/
│   ├── planProgress.tsx                       (changed: step 4)
│   └── scheduledDaySection.tsx                (new, if page exceeds ~200 lines)
└── tests/
    ├── planScheduleApi.test.ts                (new)
    ├── usePlanScheduleStore.test.ts           (new)
    ├── ScheduleOverviewPage.test.tsx          (new)
    ├── PlacesAndForecastPage.test.tsx         (changed: Generate button)
    ├── accessibility.test.tsx                 (changed: step 4 route stub)
    ├── keyboard.test.tsx                      (changed)
    ├── responsive.test.tsx                    (changed)
    ├── layout.test.tsx                        (changed)
    ├── planCreatorOnly.test.tsx               (changed: schedule endpoint)
    └── setup.ts                               (changed: reset schedule store)
```
