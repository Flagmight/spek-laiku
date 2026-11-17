# Implementation Plan: 009-travel-distance

**Branch**: `009-travel-distance` | **Date**: 2026-11-17 | **Spec**: [specs/009-travel-distance/spec.md](spec.md)

**Input**: Feature specification from `/specs/009-travel-distance/spec.md`

## Summary

The existing schedule generation (`POST /api/plan-schedule`, feature 008) gets a second pass that checks the travel distance between consecutive activities on the same date against the plan's maximum travel distance (project FR-035). After `PlanScheduler` has fixed every time slot, a new static `TravelDistanceRules` walks each date in start-time order:

- The first activity keeps its nearest place.
- Each later activity takes the first of its listed places within the maximum from the previous activity's place. If none fits, it keeps its nearest place and the trip is flagged.

Each scheduled activity now returns its trip (`travel`: from-place name, distance to 0.1 km, over-limit flag), and the schedule returns a travel summary (`maxDistanceKm`, `tripsOverLimit`).

On the Schedule Overview, each entry shows "Travel: …", and the top shows "✓ All trips within your N km limit." or "✗ n trip(s) longer than your N km limit.".

There is no new endpoint, no new external service, no database change, no migration and no new package. Travel time is out of scope (spec clarification Q2).

**Backend**:

- `TravelLeg` and `TravelSummary` records.
- `ScheduledActivity` gains `CategoryId` and `Travel`. `PlanSchedule` gains `Travel`.
- `TravelDistanceRules.Apply(scheduled, categoryPlaces, maxDistanceKm)`, called by `PlanScheduleService` right after `PlanScheduler.Assign`.
- `GeoDistance.RoundToTenth`, shared with `NearbyPlaceRules`.
- Two new response DTOs, two fields on existing DTOs, and two maps in `PlanScheduleMappingProfile`.

**Frontend**:

- `TravelLeg` and `TravelSummary` types.
- `travelText` and `travelSummaryText` helpers.
- The per-date list is extracted into `components/scheduledDaySection.tsx` with the new "Travel:" part.
- The page's summaries go into one status area.

## Technical Context

**Language/Version**: C# on .NET 10 (ASP.NET Core Web API); TypeScript with React 19, built with Vite. Unchanged.

**Primary Dependencies**: Existing only (research section 1).

- Backend: `PlanScheduleService`, `PlanScheduler`, `GeoDistance`, `NearbyPlaceRules`, `CategoryPlaces`, `CheckedPlanSetup.MaxTravelDistanceKm`, AutoMapper.
- Frontend: React, React Router, Zustand. Existing `scheduleText.ts` and `usePlanScheduleStore`.
- Tests: xUnit, `Microsoft.AspNetCore.Mvc.Testing` with Testcontainers PostgreSQL, `FakeMapPlacesClient` and the fake forecast client (integration), Vitest and React Testing Library.

**No new NuGet or npm package.**

**Storage**: None. The trip and summary exist only in the response and the non-persisted schedule store (spec FR-011). No migration.

**Testing**:

- Backend unit tests:
  - `TravelDistanceRulesTests` (new): every rule in data-model.md.
  - `GeoDistanceTests` (extended): `RoundToTenth`.
  - `PlanScheduleMappingTests` (extended): travel fields, `null` travel, `CategoryId` not exposed.
- Backend integration tests:
  - `PlanScheduleTravelTests` (new, next to `PlanScheduleEndpointTests`, which is already 223 lines; there only the contract-keys test `ValidPlan_ReturnsTheContractBody` is updated for the new `travel` fields): fake places at known positions, the day split by a windy hour so that two activities share a date, a small maximum, the default of 30, and the JSON `travel` fields and summary checked.
  - The existing `PlanScheduleAuthorizationTests` and `PlanScheduleFailureTests` must stay green unchanged. There is no new protected operation, so no new authorization test is required; the endpoint's existing authorization test covers it.
- Frontend tests:
  - Helper tests for `travelText` and `travelSummaryText`.
  - `ScheduleOverviewPage` tests for the travel lines, the flag, the summaries and no summary when there are no trips.
  - Schedule fixtures in the API, store, accessibility, keyboard, layout, responsive and route tests gain `travel`.

**Target Platform**: Unchanged (ASP.NET Core API in a Linux container; current desktop and mobile browsers, 320 px and wider).

**Project Type**: Web application (backend API and frontend single-page app).

**Performance Goals**: The schedule, including travel, still appears within 5 seconds with cached data (spec SC-004). The extra pass is at most 7 dates × a few activities × 5 candidate places of haversine work, which is negligible.

**Constraints**:

- Time slots must not change (spec FR-009).
- No new endpoint or external call (spec FR-010).
- Production C# classes stay under 200 lines. `PlanScheduler` grows by one argument only; `TravelDistanceRules` is expected to stay under about 80 lines.
- `ScheduleOverviewPage.tsx` is 196 lines today, so the per-date section is extracted (research section 9).

**Scale/Scope**: At most 7 dates and the activity limit from feature 005 per plan. One endpoint response, one page.

**Authorization**: Unchanged. `[Authorize(Policy = AuthorizationPolicies.PlanCreator)]` and `[EnableRateLimiting(RateLimitPolicies.PlanSetup)]` on `PlanScheduleController` (research section 8).

**Backend changes** (`backend/src/SpekLaiku.Api/`):

- **Services**:
  - `Services/TravelLeg.cs` (new): `record TravelLeg(string FromPlaceName, decimal DistanceKm, bool OverLimit)`.
  - `Services/TravelSummary.cs` (new): `record TravelSummary(int MaxDistanceKm, int TripsOverLimit)`.
  - `Services/TravelDistanceRules.cs` (new, static): `Apply(...)` as in data-model.md (research sections 4 and 5).
  - `Services/ScheduledActivity.cs` (changed): `Guid CategoryId` first, `TravelLeg? Travel = null` last.
  - `Services/PlanSchedule.cs` (changed): adds `TravelSummary Travel`.
  - `Services/PlanScheduler.cs` (changed): passes `activity.CategoryId` to `ScheduledActivity`. No behaviour change.
  - `Services/PlanScheduleService.cs` (changed): calls `TravelDistanceRules.Apply(scheduled, categoryPlaces, plan.Setup.MaxTravelDistanceKm)` and builds `PlanSchedule` with the summary.
  - `Services/GeoDistance.cs` (changed): adds `RoundToTenth(double km)`.
  - `Services/NearbyPlaceRules.cs` (changed): uses `GeoDistance.RoundToTenth` instead of its own rounding. Same result.
- **DTOs**:
  - `DTOs/Responses/TravelLegResponse.cs` (new).
  - `DTOs/Responses/TravelSummaryResponse.cs` (new).
  - `DTOs/Responses/ScheduledActivityResponse.cs` (changed): `TravelLegResponse? Travel`.
  - `DTOs/Responses/PlanScheduleResponse.cs` (changed): `TravelSummaryResponse Travel`.
- **Mapping**: `Mapping/PlanScheduleMappingProfile.cs` (changed): `TravelLeg → TravelLegResponse`, `TravelSummary → TravelSummaryResponse`.
- **Not changed**: controllers, `Program.cs`, rate limiting, `ApiExceptionHandler`, clients, entities, `Data/`, `Migrations/`.

**Frontend changes** (`frontend/src/`):

- **Types**: `types/planSchedule.ts`: `TravelLeg`, `TravelSummary`; `ScheduledActivity.travel`, `PlanSchedule.travel`.
- **Helpers**: `helpers/scheduleText.ts`: `travelText(travel, maxDistanceKm)` and `travelSummaryText(summary)`, which returns `null` when there is no trip. The wording is in data-model.md, "Display Rules".
- **Components**: `components/scheduledDaySection.tsx` (new): one date's heading and list, moved from the page, with the "Travel:" part added after the weather in each entry.
- **Pages**: `pages/ScheduleOverviewPage.tsx` (changed): uses `ScheduledDaySection`. Puts "✓ All activities scheduled." and the travel summary in one `role="status"` container.
- **API and store**: `api/planScheduleApi.ts` and `stores/usePlanScheduleStore.ts` need no logic change. The new fields pass through.

**Documentation**:

- `README.md`: add a "Schedule overview" section (generation, unscheduled reasons, and the travel distance check with its maximum). Replace the outdated line in "Places and forecast" that says the schedule is "a later feature".
- `specs/008-generate-schedule/spec.md`: the travel-time note was already corrected during `/speckit-specify`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID, DRY, KISS, YAGNI | ✓ | One new rule class with one responsibility. Rounding is shared through `GeoDistance.RoundToTenth` instead of copied. Greedy choice, no optimisation search (research section 5). |
| I. 200-line limit / ~200 for components | ✓ | `TravelDistanceRules` is small. `PlanScheduler` (127) and `PlanScheduleService` (62) grow by a few lines. `ScheduleOverviewPage.tsx` (196) shrinks by extracting `scheduledDaySection.tsx`. |
| I. Naming | ✓ | `TravelDistanceRules` follows `NearbyPlaceRules` and `HourSuitabilityRules`. The component file is camelCase. |
| II. Thin controllers | ✓ | No controller change. |
| II. Business rules in services | ✓ | Place choice, rounding and the over-limit decision are all in `Services/`. The frontend only words server values (research section 7). |
| II. No repository layer, async I/O | ✓ | No new data access. The new pass is CPU-only and synchronous inside the existing async service. |
| II. Response DTOs and AutoMapper without rules | ✓ | New response records. `CategoryId` is not exposed. The mapping is by name only. |
| II. Migrations | ✓ | No schema change. |
| III. Tests, deterministic, fakes for external services | ✓ | Unit tests use fixed coordinates. Integration tests use `FakeMapPlacesClient` and the fake forecast client, never live Open-Meteo or Overpass. |
| III. Authorization test per protected operation | ✓ | No new operation. The existing `PlanScheduleAuthorizationTests` still cover the endpoint and must pass. |
| III. Loading, success, empty, validation-error, server-error states | ✓ | Existing states are unchanged. The new "no trips" (no summary) and "over limit" displays are tested. |
| IV. Server-side authorization and validation | ✓ | Unchanged policy. The maximum comes from the server-checked setup, not from a new client value (spec FR-003). |
| VI. Documentation | ✓ | README section planned. Spec aligned with the real page layout. |
| VIII. Simplicity, no new dependency | ✓ | No package, no new service, no new endpoint. |
| Accessibility constraint | ✓ | "Travel:" label, ✗ plus words, one status region, wraps at 320 px. |

**Gate result**: PASS. No violations, so Complexity Tracking is empty.

**Post-design re-check**: PASS. Phase 1 adds nothing that conflicts with the table above. The response change only adds fields, apart from the documented order change in `scheduled`, which the page does not depend on (see contracts/plan-schedule-api.md).

## Project Structure

### Documentation (this feature)

```text
specs/009-travel-distance/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── plan-schedule-api.md   # Phase 1 output (change to the 008 contract)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code

```text
backend/
├── src/SpekLaiku.Api/
│   ├── Services/
│   │   ├── TravelLeg.cs                       (new)
│   │   ├── TravelSummary.cs                   (new)
│   │   ├── TravelDistanceRules.cs             (new)
│   │   ├── ScheduledActivity.cs               (changed: CategoryId, Travel)
│   │   ├── PlanSchedule.cs                    (changed: Travel)
│   │   ├── PlanScheduler.cs                   (changed: passes CategoryId)
│   │   ├── PlanScheduleService.cs             (changed: calls TravelDistanceRules)
│   │   ├── GeoDistance.cs                     (changed: RoundToTenth)
│   │   └── NearbyPlaceRules.cs                (changed: uses RoundToTenth)
│   ├── DTOs/Responses/
│   │   ├── TravelLegResponse.cs               (new)
│   │   ├── TravelSummaryResponse.cs           (new)
│   │   ├── ScheduledActivityResponse.cs       (changed)
│   │   └── PlanScheduleResponse.cs            (changed)
│   └── Mapping/
│       └── PlanScheduleMappingProfile.cs      (changed)
└── tests/
    ├── SpekLaiku.UnitTests/
    │   ├── TravelDistanceRulesTests.cs        (new)
    │   ├── GeoDistanceTests.cs                (changed)
    │   ├── PlanSchedulerTests.cs              (changed: CategoryId only)
    │   └── PlanScheduleMappingTests.cs        (changed)
    └── SpekLaiku.IntegrationTests/
        └── PlanScheduleTravelTests.cs         (new: travel endpoint scenarios)

frontend/src/
├── types/
│   └── planSchedule.ts                        (changed)
├── helpers/
│   └── scheduleText.ts                        (changed: travelText, travelSummaryText)
├── components/
│   └── scheduledDaySection.tsx                (new, extracted from the page)
├── pages/
│   └── ScheduleOverviewPage.tsx               (changed)
└── tests/
    ├── scheduleText.test.ts                   (new)
    ├── ScheduleOverviewPage.test.tsx          (changed)
    ├── planScheduleApi.test.ts                (changed: fixtures)
    ├── usePlanScheduleStore.test.ts           (changed: fixtures)
    ├── accessibility.test.tsx                 (changed: fixtures, travel text)
    ├── keyboard.test.tsx                      (changed: fixtures)
    ├── layout.test.tsx                        (changed: fixtures)
    ├── responsive.test.tsx                    (changed: fixtures, 320 px travel line)
    ├── planCreatorOnly.test.tsx               (changed: fixtures)
    └── PlacesAndForecastPage.test.tsx         (changed: fixtures)

README.md                                      (changed: Schedule overview section)
```

**Structure Decision**: The existing web application layout (`backend/` and `frontend/`) as documented in `docs/architecture.md` and `AGENTS.md`. The new rule class sits next to the other `*Rules` classes in `Services/`. The extracted component goes in `components/`, as the constitution requires for reusable interface parts.

## Complexity Tracking

No constitution violations. Nothing to justify.
