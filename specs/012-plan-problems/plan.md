# Implementation Plan: 012-plan-problems

**Branch**: `012-plan-problems` | **Date**: 2026-11-20 | **Spec**: [specs/012-plan-problems/spec.md](spec.md)

**Input**: Feature specification from `/specs/012-plan-problems/spec.md`

## Summary

When an Active Registered User opens one of their saved plans, or selects **Recalculate**, the plan is checked against the latest forecast (project FR-033, FR-034). The page lists each problem with its reason and marks the affected schedule entries. Problems are weather above or below the activity's own limits, a missing forecast hour, outside daylight, an overlap, or a trip over the maximum distance.

- The saved plan is never changed (clarification Q1).
- Activities that have started are not checked.
- When the weather service fails, the saved plan stays on screen as saved, with the error and **Retry**.
- Only saved plans are checked (clarification Q2).

**Backend**:

- One new endpoint on the existing `PlansController`: `GET /api/plans/{id}/check`.
  - It sits under the controller's `ActiveRegisteredUser` policy and the shared `PlanSetup` request limit.
- A new `PlanCheckService`:
  - It reads the plan through `SavedPlanService.GetAsync`, which is read-only and has the owner check.
  - It returns early when every activity has started.
  - Otherwise it gets the forecast through the existing `WeatherForecastService` cache and builds the planning hours with `PlanningDays`.
- Two new pure rule classes, `PlanCheckRules` and `PlanWeatherRules`.
  - The weather comparisons come from `HourSuitabilityRules`, which gains a structured `Breaches` method, so each comparison exists once.
  - Overlap and travel are read from the saved schedule.
- Failures use the existing 503/500 handling and failure log.
- `ScheduledActivity` gains an optional `ActivityIndex` in the stored JSON. A repeated category can then be matched to its own limits. No migration is needed (research section 4).

**Frontend**:

- A `planCheckApi.ts` function and a `usePlanCheckStore`.
- The plan page:
  - It starts the check together with loading the plan.
  - It shows a "Plan check" region (`planCheckSection.tsx`) above the schedule.
  - It adds **Recalculate** to the actions.
  - It passes per-entry results to the shared schedule view. That view then shows the latest weather, "✗ Problem" with reasons, or "Already past. Not checked.", and the note changes to "Checked against the forecast updated at HH:MM.".
- One helper words every reason (`planProblemText.ts`).

## Technical Context

**Language/Version**: C# on .NET 10 (ASP.NET Core Web API); TypeScript with React 19, built with Vite. Unchanged.

**Primary Dependencies**: Existing only (research section 1).

- Backend: EF Core 10 with Npgsql, ASP.NET Core Identity, AutoMapper, `TimeProvider`, `IMemoryCache`, the built-in rate limiter.
- Frontend: React, React Router, Zustand.
- Tests: xUnit, `Microsoft.AspNetCore.Mvc.Testing` with Testcontainers PostgreSQL (`PostgreSqlApiFactory`), `FakeForecastClient`, `FixedTimeProvider`, `TestSignInStartupFilter`, `CapturingLoggerProvider`; Vitest and React Testing Library.

**No new NuGet or npm package.**

**Storage**: PostgreSQL, unchanged schema, **no migration**.

- One optional member, `activityIndex`, is added inside the existing `SavedPlans.Snapshot` and `GeneratedSchedules.Snapshot` JSON (`jsonb`). Stored plans without it stay readable (data-model.md).
- The check result is never stored, on the server or in the browser.

**Testing**:

- **Backend unit tests** (`backend/tests/SpekLaiku.UnitTests/`):
  - `PlanWeatherRulesTests` (new):
    - Wind, rain, cold and heat, each with the worst value and the first hour that has it.
    - A value equal to the limit is not a problem.
    - A missing value gives `noForecast` at the first such hour.
    - Indoor activities get no weather problems.
    - Daylight: before sunrise, after sunset, and both; an Indoor activity that requires daylight; an activity that does not require daylight.
    - The order of the problems.
  - `PlanCheckRulesTests` (new):
    - Started (at and before now) gives `past`. An entry starting one minute later is checked.
    - A date missing from the forecast gives `past`.
    - Overlap on the same date, listed on both entries; none across dates; a past entry still overlaps a checked one.
    - A saved over-limit trip gives `travel`; a past previous activity is still the previous place.
    - `ActivityIndex` picks the right limits for a repeated category. A missing or invalid index falls back to the first activity of the category.
    - Latest weather at the start hour; `isIndoor` for Indoor activities without daylight.
  - `HourSuitabilityRulesTests` (changed): `Breaches` returns rule, value and limit. The feature 006 texts are unchanged.
  - `PlanSchedulerTests` (changed): `ActivityIndex` is set, also with a repeated category, and kept by `TravelDistanceRules`.
  - `PlanSnapshotJsonTests` (changed): stored JSON without `activityIndex` is read as `null`; with it, it round-trips.
  - `PlanCheckMappingTests` (new): the contract shape, camelCase rule names, `HH:mm` times, `"checked"` and `"allPast"`. `CategoryId` and `ActivityIndex` are never sent. The AutoMapper configuration is valid.
  - `PlanScheduleMappingTests` (changed): `ScheduledActivityResponse` still has no index.
- **Backend integration tests** (`backend/tests/SpekLaiku.IntegrationTests/`). These use real PostgreSQL, a fixed clock and a scripted `FakeForecastClient`. Saved plans are inserted directly with a hand-built snapshot (research section 16) through a new test helper, `SavedPlanSeed`.
  - `PlanCheckEndpointTests` (new):
    - The contract body with problems (wind breaks after a forecast change, spec User Story 1 independent test) and with none.
    - `forecastUpdatedAt` is the time the forecast was received; a second check within 30 minutes reuses it (one weather call). After 30 minutes the forecast is asked again (spec User Story 2 independent test).
    - A partly past plan (spec User Story 5 independent test).
    - `allPast` with no weather call.
    - The entry order equals `GET /api/plans/{id}` `scheduled`.
    - `savedAt` is returned.
  - `PlanCheckFailureTests` (new):
    - Each `FailureKind` gives 503 `service: "forecast"`. The failure log (kind and time, no user) is written by the real client and already covered by `OpenMeteoForecastClientTests`; the check adds no logging of its own.
    - After 30 permitted requests the next is 429 with the detail, the weather service is not called, and nothing is logged as a failure.
  - `PlanCheckAuthorizationTests` (new): Visitor 401, Administrator 403, Suspended 403, another user 403 with no plan data in the body, unknown id 404 with "This plan no longer exists.", and a non-GUID id 404. For each, `FakeForecastClient.Calls` is unchanged (spec SC-005). This covers constitution III's authorization test.
  - `PlanCheckUnchangedTests` (new): after three checks (with problems, with none, and with a weather failure) the row's `Snapshot` JSON, `SavedAtUtc`, `CreatedAtUtc`, `Name` and the My plans order are unchanged (spec FR-014, SC-006).
  - `SavedPlanDetailsEndpointTests` (unchanged): `OpeningAPlan_CallsNeitherExternalService` stays green, so `GET /api/plans/{id}` still calls nothing.
  - `PlanScheduleEndpointTests`, `SavePlanEndpointTests`, `ReplacePlanEndpointTests` and `DuplicatePlanEndpointTests` stay green with the new JSON member.
- **Frontend tests** (`frontend/src/tests/`):
  - `planCheckApi.test.ts` (new): 200 `checked` and `allPast`, 401, 403, 404, 429, 503 forecast; 503 with another service and 500 throw.
  - `planProblemText.test.ts` (new):
    - Every reason of spec User Story 3, word for word.
    - The summary for 1 and several problems and activities ("1 problem in 1 of 4 scheduled activities.", "2 problems in 1 of 4 scheduled activities.").
    - The problem list order.
  - `usePlanCheckStore.test.ts` (new):
    - `check` sets `checking`, then `checked` or `allPast`.
    - Each error status; `retry`.
    - A second `check` while checking sends nothing.
    - `reset` aborts, and a late answer is dropped.
    - The 10-second timeout gives `serverError`.
    - 404 calls `markGone`; 401 and 403 refresh the current user.
  - `planCheckSection.test.tsx` (new):
    - A labelled region with the heading "Plan check".
    - Each message in a status region.
    - Problems as a list in date and start order, each with a link that moves focus to its schedule entry.
    - **Retry** on errors.
  - `PlanDetailsPage.test.tsx` (changed):
    - The actions in order (Edit plan, Recalculate, Rename, Duplicate, Delete).
    - The check starts on open and on **Recalculate**; **Recalculate** is disabled while checking and absent for `allPast`.
    - Marks, reasons, "Already past. Not checked." and the latest weather on the entries.
    - The note after a check and after a failure.
    - A different `savedAt` loads the plan again.
    - A 404 from the check shows "This plan no longer exists.".
    - Leaving the page ignores a late answer.
  - `ScheduleOverviewPage.test.tsx` (unchanged): no marks, ids or focus targets without check results.
  - `accessibility.test.tsx`, `keyboard.test.tsx`, `responsive.test.tsx` (changed): the new region, links and button are labelled and reachable by keyboard; no horizontal scrolling at 320 px; **Recalculate** full width.
  - `savedPlansFixtures.ts` (changed): check result fixtures next to the plan fixtures.

**Target Platform**: Unchanged (ASP.NET Core API in a Linux container; current desktop and mobile browsers, 320 px and wider).

**Project Type**: Web application (backend API and frontend single-page app).

**Performance Goals**:

- The check result within 5 seconds in 95% of attempts when the weather service answers normally (spec SC-001).
- The check is one indexed read, at most one weather call (none when cached within 30 minutes or when all activities have started), and in-memory rules over at most 10 entries × 16 hours.
- The page shows the saved plan at once, because the plan is loaded in parallel with the check (research section 13).

**Constraints**:

- Production C# classes stay under 200 lines:
  - `PlansController.cs` (131 lines) grows to about 148.
  - `PlanCheckService.cs` is planned at about 80 lines, `PlanCheckRules.cs` at about 130, `PlanWeatherRules.cs` at about 120 and `PlanCheckMappingProfile.cs` at about 40.
  - `HourSuitabilityRules.cs` (84) grows to about 105, and `PlanScheduler.cs` (128) stays about the same when `BuildWeather` moves out to `ScheduledWeather.cs`.
- Frontend files stay below about 200 lines:
  - `PlanDetailsPage.tsx` (128) grows to about 150.
  - `scheduledDaySection.tsx` (40) grows to about 85. If it passes 100, the check marks of one entry move to `components/scheduledEntryCheck.tsx`.
  - `savedPlansApi.ts` (270) is not changed; the check gets its own `planCheckApi.ts`.
- The saved plan is never written by the check (spec FR-014).
- No call to the location search or map data services (spec Assumptions).

**Scale/Scope**:

- A plan has at most 7 dates and 10 activities (features 004 and 005).
- One new endpoint. One JSON member. One new region and one new action on one page.

**Authorization** (research sections 2 and 3):

- The existing `ActiveRegisteredUser` policy on `PlansController`.
- The owner check of `SavedPlanService.GetAsync`, run before anything else in `PlanCheckService`.
- The rate limiter runs before authorization (Program.cs), so a refused request reaches neither the account lookup nor the weather service.

**Backend changes** (`backend/src/SpekLaiku.Api/`):

- **Services**:
  - New:
    - `Services/PlanCheckService.cs`: `CheckAsync(ownerId, id, cancellationToken)` → `PlanCheckResult`.
    - `Services/PlanCheckRules.cs`: per entry, past or checked; overlap; travel; calls `PlanWeatherRules`; the `ActivityIndex` lookup with the fallback.
    - `Services/PlanWeatherRules.cs`: the weather and daylight problems of one entry over its planning hours.
    - `Services/ScheduledWeather.cs`: the weather at a slot's start hour, moved from `PlanScheduler.BuildWeather` so the scheduler and the check share it.
    - Records: `Services/PlanCheck.cs`, `Services/PlanCheckEntry.cs`, `Services/PlanProblem.cs`, `Services/PlanRule.cs` (enum), `Services/LimitBreach.cs`, `Services/PlanCheckResult.cs`.
  - Changed:
    - `Services/HourSuitabilityRules.cs`: the new `Breaches`; `Check` builds its strings from it.
    - `Services/ActivityForecasts.cs`: the "weather independent" test (Indoor and not requiring daylight) becomes a public static `IsWeatherIndependent(activity)`, used by the forecast and the check.
    - `Services/ScheduledActivity.cs`: `int? ActivityIndex = null`, with the storage remark.
    - `Services/PlanScheduler.cs`: sets `ActivityIndex` and uses `ScheduledWeather.At`.
- **Controllers**: `Controllers/PlansController.cs` (changed): `Check(Guid id)` with `[HttpGet("{id:guid}/check")]`, `[EnableRateLimiting(RateLimitPolicies.PlanSetup)]` and the 200/403/404/429/503 response types. It maps the result with the existing `PlanNotFound()` and `Forbid()`.
- **DTOs** (new): `DTOs/Responses/PlanCheckResponse.cs`, `DTOs/Responses/PlanCheckEntryResponse.cs`, `DTOs/Responses/PlanProblemResponse.cs`. Weather reuses `WeatherSnapshotResponse`.
- **Mapping**: `Mapping/PlanCheckMappingProfile.cs` (new). It maps `PlanRule` → camelCase string and `AllPast` → `status`, and reuses the `TimeOnly` → `"HH:mm"` and `WeatherSnapshot` maps.
- **Program.cs** (changed): registers `PlanCheckService`.
- **Not changed**: entities, `ApplicationDbContext`, configurations, migrations, clients, `WeatherForecastService`, `PlanningDays`, `TravelDistanceRules`, rate limiting, `ApiExceptionHandler`, the authorization policies, and every existing endpoint's request and response.

**Frontend changes** (`frontend/src/`):

- **Types**: `types/planCheck.ts` (new): `PlanCheck`, `PlanCheckEntry`, and `PlanProblem` as a union keyed by `rule`.
- **API**: `api/planCheckApi.ts` (new): `checkPlan(id, signal)` (contracts/plan-check-api.md).
- **Stores**:
  - `stores/usePlanCheckStore.ts` (new).
  - `stores/useSavedPlanStore.ts` (changed): `markGone()`.
- **Helpers**: `helpers/planProblemText.ts` (new): the reason of each rule, the summary, the "updated at" note and the problem list order.
- **Components**:
  - `components/planCheckSection.tsx` (new): the "Plan check" region.
  - Changed:
    - `components/planDetailsActions.tsx`: **Recalculate** between **Edit plan** and **Rename**, disabled while checking, hidden for `allPast`.
    - `components/savedPlanView.tsx`: shows the section and the note that matches the check state, and passes the check entries to the schedule.
    - `components/scheduleView.tsx`: an optional `checks` value, passed on per date.
    - `components/scheduledDaySection.tsx`: with `checks`, each entry gets its id and `tabIndex={-1}`, shows the latest weather, and shows "✗ Problem" with its reasons or "Already past. Not checked.".
- **Pages**: `pages/PlanDetailsPage.tsx` (changed):
  - Starts `load` and `check` together.
  - Resets the check store on leaving.
  - Loads the plan again when `savedAt` differs.
  - Updates the header comment (feature 010's "never calls the weather service" no longer holds for the page; it still holds for `GET /api/plans/{id}`).
- **Styles**: `styles.css` (changed): the problem cards, the "✗ Problem" reasons in entries, and `.plan-recalculate` full width below 40em.

**Documentation**:

- `README.md`: the "Saved plans" section says the plan page checks the plan against the latest forecast, describes **Recalculate**, the problem reasons, the failure message and the past-plan message, and links `specs/012-plan-problems/quickstart.md`. The sentence "It is not recalculated and calls no weather or map service; recalculating comes with feature 012" is replaced.
- `docs/ux-design.md`:
  - The Plan Details / Edit row says recalculating is done (feature 012).
  - The Plan Problems and Alternatives states gain "Problems found" (summary and list), "Plan in the past" and "Too many requests". Alternatives stay with feature 013.
- The spec was changed during planning: User Story 7 scenario 2 and FR-018 now say focus moves to "that schedule entry" instead of "that entry's heading" (research section 14).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID, DRY, KISS, YAGNI | ✓ | The weather comparison is shared through `HourSuitabilityRules.Breaches`; the start-hour weather through `ScheduledWeather`; the weather-independent test through `ActivityForecasts.IsWeatherIndependent`; the owner check through `SavedPlanService.GetAsync`; the forecast and its cache through `WeatherForecastService` (research sections 3, 5, 9). No stored results, notifications or problem marks on My plans (spec Assumptions). |
| I. 200-line limit / ~200 for components | ✓ | The rules are split into `PlanCheckRules` and `PlanWeatherRules`. `planCheckApi.ts` is a separate file because `savedPlansApi.ts` is already 270 lines (it is an API module, not a class, but it is kept from growing). A fallback split is named for `scheduledDaySection.tsx`. |
| I. Naming | ✓ | `PlanCheckService`, `PlanCheckRules`, `PlanWeatherRules`, `ScheduledWeather` and `LimitBreach` each name one responsibility. Files follow the React naming rules. |
| II. Thin controllers | ✓ | `Check` calls one service method and maps three outcomes, using the existing 404 helper. |
| II. Business rules in services | ✓ | Started or not, every rule, the worst value and its hour, and the forecast's age are all decided in `Services/`. The browser only words and counts the answer (research section 11). |
| II. DbContext directly, no repository | ✓ | The plan is read through `SavedPlanService`, which uses `ApplicationDbContext`. |
| II. External calls through clients | ✓ | Only `IForecastClient`, through `WeatherForecastService`. The browser calls only the API. |
| II. Async I/O | ✓ | The database read and the weather call are async. The rules are pure, in-memory code. |
| II. DTOs, AutoMapper without rules | ✓ | The new response records are mapped from the result records. The mapping only renames (`AllPast` → `status`) and formats. `CategoryId` and `ActivityIndex` have no destination member. |
| II. Migrations | ✓ | No schema change, so no migration. The JSON member is additive and optional (data-model.md), and existing migrations are untouched. |
| III. Tests, deterministic, fakes | ✓ | `FixedTimeProvider` controls "now" and the forecast age. `FakeForecastClient` is scripted per position. Overpass and geocoding are not involved. Plans are seeded directly. |
| III. Authorization test per protected operation | ✓ | `PlanCheckAuthorizationTests` covers Visitor, Administrator, Suspended, another user and an unknown id, and that the weather service is not called for any of them. |
| III. Loading, success, empty, validation-error, server-error states | ✓ | Loading ("Checking…"), success with problems, empty ("No problems found"), the past plan, the weather error, too many requests and the general error are all tested. There is no user input, so there is no validation state. |
| IV. Identity, server-side authorization, validation | ✓ | The owner is checked on the server. The request has no body, so nothing from the browser feeds the rules (spec FR-004). |
| IV. Central error handling, no details leaked | ✓ | 503 and 500 come from `ApiExceptionHandler`. A 403 never carries plan data. |
| IV. Logging | ✓ | Only the existing client failure log (kind and time). No plan, user or position is logged. |
| IV. OWASP | ✓ | Broken access control: an owner check before any work, with tests. Injection: an id from the route (GUID constraint) and EF Core parameters. Resource exhaustion: the shared request limit and the forecast cache. CSRF: `GET` changes nothing. |
| V. Version control | ✓ | Feature branch `012-plan-problems` from an updated `main` (after PRs #15 and #16). |
| VI. Documentation | ✓ | README and `docs/ux-design.md` updates are planned. The spec was aligned during planning. |
| VII. AI-assisted development | ✓ | Spec, clarification and plan are done before any implementation. |
| VIII. Simplicity, no new dependency | ✓ | No package, table, background job or stored result. One endpoint. |
| External data constraint | ✓ | A failed forecast shows the error and the saved plan labelled "as saved on <date>", never presented as current (NFR-007). The forecast used is at most 30 minutes old. |
| Accessibility constraint | ✓ | A labelled region with a heading; announced status messages without moving focus; "✗" with words; links that move focus to the entry; a full-width 44 px button on phones. |

**Gate result**: PASS. No violations, so Complexity Tracking is empty.

**Post-design re-check**: PASS. The Phase 1 artifacts add nothing that conflicts with the table above. Two deliberate trade-offs are recorded, not violations:

1. The stored `ScheduledActivity` gains `ActivityIndex`. A plan saved before this feature that repeats a category with different limits is checked against the first copy's limits until it is saved again (research section 4).
2. The focus target of a problem's link is the schedule entry itself, not a heading, so the shared schedule layout of features 008 to 011 does not change. The spec was updated (research section 14).

## Project Structure

### Documentation (this feature)

```text
specs/012-plan-problems/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── plan-check-api.md  # Phase 1 output (GET /api/plans/{id}/check)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code

```text
backend/
├── src/SpekLaiku.Api/
│   ├── Controllers/
│   │   └── PlansController.cs                  (changed: Check)
│   ├── DTOs/Responses/
│   │   ├── PlanCheckResponse.cs                (new)
│   │   ├── PlanCheckEntryResponse.cs           (new)
│   │   └── PlanProblemResponse.cs              (new)
│   ├── Mapping/
│   │   └── PlanCheckMappingProfile.cs          (new)
│   ├── Services/
│   │   ├── PlanCheckService.cs                 (new)
│   │   ├── PlanCheckRules.cs                   (new)
│   │   ├── PlanWeatherRules.cs                 (new)
│   │   ├── ScheduledWeather.cs                 (new, moved from PlanScheduler)
│   │   ├── PlanCheck.cs, PlanCheckEntry.cs, PlanProblem.cs,
│   │   │   PlanRule.cs, LimitBreach.cs, PlanCheckResult.cs (new)
│   │   ├── HourSuitabilityRules.cs             (changed: Breaches)
│   │   ├── ActivityForecasts.cs                (changed: IsWeatherIndependent)
│   │   ├── ScheduledActivity.cs                (changed: ActivityIndex)
│   │   └── PlanScheduler.cs                    (changed)
│   └── Program.cs                              (changed)
└── tests/
    ├── SpekLaiku.UnitTests/
    │   ├── PlanWeatherRulesTests.cs            (new)
    │   ├── PlanCheckRulesTests.cs              (new)
    │   ├── PlanCheckMappingTests.cs            (new)
    │   ├── HourSuitabilityRulesTests.cs        (changed)
    │   ├── PlanSchedulerTests.cs               (changed)
    │   ├── PlanSnapshotJsonTests.cs            (changed)
    │   └── PlanScheduleMappingTests.cs         (changed)
    └── SpekLaiku.IntegrationTests/
        ├── SavedPlanSeed.cs                    (new test helper)
        ├── PostgreSqlApiFactory.cs             (changed: CreateSignedInUserAsync)
        ├── PlanCheckEndpointTests.cs           (new)
        ├── PlanCheckFailureTests.cs            (new)
        ├── PlanCheckAuthorizationTests.cs      (new)
        └── PlanCheckUnchangedTests.cs          (new)

frontend/src/
├── types/        planCheck.ts (new)
├── api/          planCheckApi.ts (new)
├── stores/       usePlanCheckStore.ts (new); useSavedPlanStore.ts (changed: markGone)
├── helpers/      planProblemText.ts (new)
├── components/   planCheckSection.tsx (new); planDetailsActions.tsx, savedPlanView.tsx,
│                 scheduleView.tsx, scheduledDaySection.tsx (changed)
├── pages/        PlanDetailsPage.tsx (changed)
├── styles.css    (changed)
└── tests/        see "Testing" above

README.md                                       (changed: plan check in "Saved plans")
docs/ux-design.md                               (changed: feature 012 notes and states)
```

**Structure Decision**: The existing web application layout (`backend/` and `frontend/`), as documented in `docs/architecture.md` and `AGENTS.md`.

- The new service follows `PlanForecastService`: it reads the inputs, gets the cached forecast, builds `PlanningDays` and applies pure rules.
- The new result record follows `SavedPlanLookup`.
- The new store follows `useSavedPlanStore`.
- The schedule view stays shared between the Schedule Overview and the plan page (feature 010 research section 12), with optional check results.

## Complexity Tracking

No constitution violations. Nothing to justify.
