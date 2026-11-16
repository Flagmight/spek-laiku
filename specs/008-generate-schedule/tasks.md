# Tasks: Generate Schedule

**Input**: Design documents from `specs/008-generate-schedule/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/plan-schedule-api.md ✓, quickstart.md ✓

**Organization**: Phases 1–3 are backend; Phases 4–5 are frontend; Phases 6–7 are polish. Each phase ends at a reviewable checkpoint. Stop after completing each phase for a diff review; commit and push only on request.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on other incomplete tasks in this phase)
- **[Story]**: Which user story this task belongs to ([US1]–[US4])

---

## Phase 1: Setup

**Purpose**: Feature branch ready, project builds clean.

- [x] T001 Create git branch `008-generate-schedule` from an up-to-date `main`
- [x] T002 Run `dotnet build` from `backend/` and `npm run build` from `frontend/`; confirm both pass before writing any code

**Checkpoint**: Branch exists, build is green.

---

## Phase 2: Backend Service Layer (Foundational)

**Purpose**: All new service-layer types and the scheduling algorithm. No DTOs, no controller yet. Blocking prerequisite for every later phase.

**⚠️ CRITICAL**: No user story work starts until this phase is complete and tests pass.

- [x] T003 [P] Add `UnscheduledReason` enum (`NoPlace`, `NoSuitableTime`) in `backend/src/SpekLaiku.Api/Services/UnscheduledReason.cs`
- [x] T004 [P] Add `WeatherSnapshot` record (`decimal? TemperatureC`, `decimal? RainMmPerHour`, `decimal? WindMs`, `bool IsIndoor`) in `backend/src/SpekLaiku.Api/Services/WeatherSnapshot.cs`
- [x] T005 [P] Add `ScheduledActivity` record (`Guid ActivityId`, `string ActivityName`, `DateOnly Date`, `TimeOnly Start`, `TimeOnly End`, `NearbyPlace Place`, `WeatherSnapshot Weather`) in `backend/src/SpekLaiku.Api/Services/ScheduledActivity.cs`
- [x] T006 [P] Add `UnscheduledActivity` record (`Guid ActivityId`, `string ActivityName`, `UnscheduledReason Reason`) in `backend/src/SpekLaiku.Api/Services/UnscheduledActivity.cs`
- [x] T007 [P] Add `PlanSchedule` record (`IReadOnlyList<ScheduledActivity> Scheduled`, `IReadOnlyList<UnscheduledActivity> Unscheduled`) in `backend/src/SpekLaiku.Api/Services/PlanSchedule.cs`
- [x] T008 Add `PlanScheduleResult` record following the same shape as `PlanForecastResult` (`bool Succeeded`, `PlanSchedule? Schedule`, `IReadOnlyList<PlanRecheckError>? Errors`) in `backend/src/SpekLaiku.Api/Services/PlanScheduleResult.cs`
- [x] T009 Implement static `PlanScheduler` class in `backend/src/SpekLaiku.Api/Services/PlanScheduler.cs` — public `Assign(IReadOnlyList<CheckedPlanActivity> activities, IReadOnlyList<ActivityForecast> forecasts, IReadOnlyList<CategoryPlaces> categoryPlaces, IReadOnlyList<PlanningDay> days)` returning `(IReadOnlyList<ScheduledActivity>, IReadOnlyList<UnscheduledActivity>)`. Algorithm: greedy in plan order; each activity gets the longest non-overlapping `SuitablePeriod` that is not `ShorterThanDuration`; ties broken by earliest date; `occupiedSlots` tracked per date as `List<(TimeOnly Start, TimeOnly End)>`; overlap = `period.Start < slot.End && slot.Start < period.End`; weather from `PlanningDay.Hours.FirstOrDefault(h => h.Start == period.Start)`; `IsIndoor = forecast.NotAffectedByWeather`. See `research.md` section 3 for full pseudocode. Keep class under 200 lines.
- [x] T010 Implement `PlanScheduleService` in `backend/src/SpekLaiku.Api/Services/PlanScheduleService.cs` — constructor takes `PlanRecheckService`, `WeatherForecastService`, `ApplicationDbContext`, `NearbyPlacesService`, `ForecastPeriod`, `IOptions<ForecastOptions>`, `IOptions<PlacesOptions>`. Public `GetAsync(PlanScheduleRequest request, CancellationToken ct)` follows the same structure as `PlanForecastService.GetAsync`: (1) recheck via `PlanRecheckService.CheckAsync`; (2) if not `Succeeded` return failed result with errors; (3) call `WeatherForecastService.GetAsync`; (4) validate forecast date range; (5) build `PlanningDays`; (6) query DB for activity category tags (same query as `PlanPlacesService`); (7) call `NearbyPlacesService.GetAsync`; (8) call `ActivityForecasts.For` per activity; (9) call `PlanScheduler.Assign`; (10) return succeeded result. Keep under 200 lines.
- [x] T011 Add `PlanSchedulerTests` in `backend/tests/SpekLaiku.UnitTests/PlanSchedulerTests.cs` covering: (a) all activities scheduled when unique suitable periods on different dates; (b) first activity in plan order wins when two activities compete for the same slot; (c) activity assigned the longest period across dates when multiple dates available; (d) `NoPlace` returned when `CategoryPlaces` is empty; (e) `NoSuitableTime` returned when every suitable period overlaps an already-occupied slot; (f) indoor activity (`NotAffectedByWeather = true`) gets `IsIndoor: true` and null weather values; (g) SC-004: no two scheduled activities share an overlapping slot on the same date

**Checkpoint**: `dotnet test` passes. The scheduling algorithm is covered by unit tests.

---

## Phase 3: Backend Endpoint

**Purpose**: DTOs, AutoMapper profile, controller, DI registration, and all backend integration tests. The `POST /api/plan-schedule` endpoint is fully operational after this phase.

- [x] T012 [P] Add `PlanScheduleRequest` DTO (same shape as `PlanForecastRequest`: `PlanSetupCheckRequest Setup`, `IReadOnlyList<PlanActivityRequest> Activities`) in `backend/src/SpekLaiku.Api/DTOs/Requests/PlanScheduleRequest.cs`
- [x] T013 [P] Add `WeatherSnapshotResponse` DTO (`decimal? TemperatureC`, `decimal? RainMmPerHour`, `decimal? WindMs`, `bool IsIndoor`) in `backend/src/SpekLaiku.Api/DTOs/Responses/WeatherSnapshotResponse.cs`
- [x] T014 [P] Add `ScheduledActivityResponse` DTO (`string ActivityName`, `string Date`, `string StartTime`, `string EndTime`, `NearbyPlaceResponse Place`, `WeatherSnapshotResponse Weather`) in `backend/src/SpekLaiku.Api/DTOs/Responses/ScheduledActivityResponse.cs`
- [x] T015 [P] Add `UnscheduledActivityResponse` DTO (`string ActivityName`, `string Reason`) in `backend/src/SpekLaiku.Api/DTOs/Responses/UnscheduledActivityResponse.cs`
- [x] T016 [P] Add `PlanScheduleResponse` DTO (`IReadOnlyList<ScheduledActivityResponse> Scheduled`, `IReadOnlyList<UnscheduledActivityResponse> Unscheduled`) in `backend/src/SpekLaiku.Api/DTOs/Responses/PlanScheduleResponse.cs`
- [x] T017 Add `PlanScheduleMappingProfile` in `backend/src/SpekLaiku.Api/Mapping/PlanScheduleMappingProfile.cs` — maps `ScheduledActivity` → `ScheduledActivityResponse` (`.Date.ToString("yyyy-MM-dd")`, `.Start.ToString("HH:mm")`, `.End.ToString("HH:mm")`); maps `UnscheduledActivity` → `UnscheduledActivityResponse` (`UnscheduledReason.NoPlace` → `"noPlace"`, `UnscheduledReason.NoSuitableTime` → `"noSuitableTime"`); maps `WeatherSnapshot` → `WeatherSnapshotResponse` (direct property mapping); maps `NearbyPlace` → `NearbyPlaceResponse` by name (already registered from feature 007)
- [x] T018 Add `PlanScheduleController` in `backend/src/SpekLaiku.Api/Controllers/PlanScheduleController.cs` — `[ApiController]`, `[Route("api/plan-schedule")]`, `[Authorize(Policy = AuthorizationPolicies.PlanCreator)]`, `[EnableRateLimiting(RateLimitPolicies.PlanSetup)]`, one `[HttpPost]` action following `PlanPlacesController`'s shape: inject `PlanScheduleService` and `IMapper`; call `GetAsync`; if `!Succeeded` return `ValidationProblem` with the recheck errors; map result to `PlanScheduleResponse` and return `Ok`
- [x] T019 Register `PlanScheduleService` with `AddScoped<PlanScheduleService>()` in `backend/src/SpekLaiku.Api/Program.cs`; confirm `PlanScheduleMappingProfile` is included in the AutoMapper assembly scan (should be automatic if profiles are in the same assembly)
- [x] T020 Update the shared rate limit comment in `backend/src/SpekLaiku.Api/RateLimiting/RateLimitPolicies.cs` to include "schedule requests" in the description of the `PlanSetup` policy (comment-only change)
- [x] T021 Add `PlanScheduleMappingTests` in `backend/tests/SpekLaiku.UnitTests/PlanScheduleMappingTests.cs` — verify `ScheduledActivity` maps `Date` to `"yyyy-MM-dd"`, `Start`/`End` to `"HH:mm"`, `UnscheduledReason.NoPlace` → `"noPlace"`, `UnscheduledReason.NoSuitableTime` → `"noSuitableTime"`; weather snapshot properties pass through; `NearbyPlace` maps correctly
- [x] T022 [US1] Add `PlanScheduleEndpointTests` in `backend/tests/SpekLaiku.IntegrationTests/PlanScheduleEndpointTests.cs` — 200 with a fully scheduled result; 200 with a mix of scheduled and unscheduled; 200 with all activities unscheduled; scheduled activities have `date`, `startTime`, `endTime` in correct string formats; `isIndoor: true` and null weather fields for indoor activities; `isIndoor: false` and non-null weather for outdoor activities; activities appear exactly once across scheduled + unscheduled
- [x] T023 [US3] Add `PlanScheduleAuthorizationTests` in `backend/tests/SpekLaiku.IntegrationTests/PlanScheduleAuthorizationTests.cs` — Visitor → 200; Active Registered User → 200; Active Administrator → 403; Suspended Registered User → 403; unauthenticated with no session → 200 (Visitor policy allows anonymous); verify `PlanScheduleService` is not called on 403 (use a recording/spy approach consistent with existing authorization tests)
- [x] T024 [US3] Add `PlanScheduleFailureTests` in `backend/tests/SpekLaiku.IntegrationTests/PlanScheduleFailureTests.cs` — 503 with `service: "forecast"` when `WeatherForecastService` throws `ExternalServiceException(ExternalService.Forecast)`; 503 with `service: "places"` when `NearbyPlacesService` throws `ExternalServiceException(ExternalService.MapData)`; 400 `ValidationProblemDetails` for invalid request body; 400 with `"setup"` error key when plan setup has changed; 400 with `"activities"` error key when activities have changed

**Checkpoint**: `dotnet build` and `dotnet test` both pass. `POST /api/plan-schedule` works end-to-end via integration tests.

---

## Phase 4: Frontend Foundation

**Purpose**: TypeScript types, helper functions, API client and Zustand store — no page UI yet. All new frontend modules are tested in isolation.

- [x] T025 [P] Add `WeatherSnapshot`, `ScheduledActivity`, `UnscheduledActivity`, `PlanSchedule` types and `type PlanScheduleRequest = PlanForecastRequest` alias in `frontend/src/types/planSchedule.ts`. Fields must match the API contract: `date` as `string` (`"yyyy-MM-dd"`), `startTime`/`endTime` as `string` (`"HH:mm"`), `place` as `NearbyPlace` (existing type from feature 007), `reason` as `"noPlace" | "noSuitableTime"`, weather fields nullable.
- [x] T026 [P] Add `scheduleReasonText(reason: "noPlace" | "noSuitableTime"): string` and `scheduleWeatherText(weather: WeatherSnapshot): string` in `frontend/src/helpers/scheduleText.ts`. `scheduleReasonText`: `"noPlace"` → `"No place found"`, `"noSuitableTime"` → `"No suitable time found"`. `scheduleWeatherText`: `isIndoor` → `"Weather does not affect this indoor activity."`, else format wind/rain/temp values (e.g., `"3.2 m/s wind, 0.0 mm/h rain, 12.5 °C"`).
- [x] T027 Add `getPlanSchedule(request: PlanScheduleRequest, signal: AbortSignal): Promise<PlanScheduleAnswer>` in `frontend/src/api/planScheduleApi.ts`. Map responses: `200` → `{ kind: "schedule"; schedule: PlanSchedule }`; `400` with `"setup"` key → `{ kind: "setupOutdated" }`; `400` with `"activities"` key → `{ kind: "activitiesOutdated" }`; `403` → `{ kind: "forbidden" }`; `429` → `{ kind: "tooManyRequests" }`; `503` with `service: "forecast"` → `{ kind: "weatherUnavailable" }`; `503` with `service: "places"` → `{ kind: "placesUnavailable" }`; any other error or network/timeout failure → throw `ApiError`. Reuse `outdatedPart` and `failedService` helpers from `planStepAnswer.ts` for consistency with the forecast and places API clients.
- [x] T028 Add `usePlanScheduleStore` in `frontend/src/stores/usePlanScheduleStore.ts` — Zustand store (no `persist`). Status union: `"idle" | "loading" | "loaded" | "weatherUnavailable" | "placesUnavailable" | "tooManyRequests" | "serverError" | "setupOutdated" | "activitiesOutdated"`. State: `status`, `schedule: PlanSchedule | null`, `checkedPlanRequest: CheckedPlanRequest | null` (last request, for retry). Actions: `generate(setup, activities)` — no-op while `"loading"`; aborts previous request; sets `"loading"`; calls `getPlanSchedule`; updates status and schedule on result. `retry()` — calls `generate` with the last `checkedPlanRequest` (always fires even from an error state). `reset()` — aborts any in-flight request, sets `"idle"`, clears `schedule` and `checkedPlanRequest`. Follows `usePlanPlacesStore.ts` for `startTimeout`, `AbortController` and retry patterns.
- [x] T029 Add `planScheduleApi.test.ts` in `frontend/src/tests/planScheduleApi.test.ts` — covers: 200 response parsed correctly; `service: "forecast"` 503 → `weatherUnavailable`; `service: "places"` 503 → `placesUnavailable`; `"setup"` 400 → `setupOutdated`; `"activities"` 400 → `activitiesOutdated`; 403 → `forbidden`; 429 → `tooManyRequests`; network error → throws `ApiError`
- [x] T030 Add `usePlanScheduleStore.test.ts` in `frontend/src/tests/usePlanScheduleStore.test.ts` — covers: initial state is `idle`; `generate` sets `loading` then `loaded` on success; `generate` is ignored while `loading`; `retry()` re-sends the request; `reset()` aborts request and returns to `idle`; `weatherUnavailable`/`placesUnavailable`/`tooManyRequests`/`serverError` set correct status; `setupOutdated`/`activitiesOutdated` set correct status

**Checkpoint**: `npm test` passes. API client and store are verified in isolation.

---

## Phase 5: Schedule Overview Page (US1, US2, US3 frontend)

**Purpose**: The complete `ScheduleOverviewPage` — all states including loading, schedule display, unscheduled section, error states, and navigation. The "Generate schedule" button on step 3, the new `/plan/schedule` route, and the step 4 progress bar item.

- [x] T031 [P] [US1] Add step 4 "Schedule Overview" at `/plan/schedule` to `frontend/src/components/planProgress.tsx`; the step is active when the current route matches `/plan/schedule`
- [x] T032 [P] [US1] Add the `/plan/schedule` route inside the `PlanCreatorOnly` guard in the router (the same file that wraps `/plan/places` with `PlanCreatorOnly`, typically `frontend/src/App.tsx`); the route renders `ScheduleOverviewPage`
- [x] T033 [US1] Add "Generate schedule" button to `frontend/src/pages/PlacesAndForecastPage.tsx` — enabled only when `forecastStore.status === "loaded" && placesStore.status === "loaded"` (spec FR-001); on click navigates to `/plan/schedule` via `useNavigate`; button is disabled (not hidden) in all other forecast/places states
- [x] T034 [US1] [US2] [US3] Create `frontend/src/pages/ScheduleOverviewPage.tsx`: (a) on mount call `scheduleStore.generate(setup, activities)`; redirect to `/plan/setup` if no checked plan; (b) loading state: "Generating your schedule…"; (c) loaded state: "✓ All activities scheduled." banner when `unscheduled.length === 0`; activities grouped by date in ascending order, within each date sorted by `startTime`; each row shows start/end time, activity name, place name + distance, weather (use `scheduleWeatherText`); (d) unscheduled section (US2): shown when `unscheduled.length > 0`; heading "Could not be scheduled"; one row per unscheduled activity with name and `scheduleReasonText(reason)`; when ALL activities unscheduled: "No suitable time found for any activity. Change the dates or the weather limits."; (e) error states (US3): `weatherUnavailable` → "Error: The weather service is unavailable." + Retry; `placesUnavailable` → "Error: The map data service is unavailable. No places are shown." + Retry; `tooManyRequests` → "Error: Too many requests. Wait a minute and try again." + Retry; `serverError` → "Error: Something went wrong. Try again." + Retry; `setupOutdated` → redirect to `/plan/setup`; `activitiesOutdated` → redirect to `/plan/activities`; (f) Back button navigates to `/plan/places`; (g) on unmount call `scheduleStore.reset()` (spec FR-014); (h) page `<title>` is "Schedule Overview – Spėk laiku"
- [x] T035 [US1] [US2] [US3] Add `ScheduleOverviewPage.test.tsx` in `frontend/src/tests/ScheduleOverviewPage.test.tsx` covering: loading state renders "Generating your schedule…"; loaded state renders scheduled activities grouped by date in time order; weather row shows formatted weather for outdoor; weather row shows "Weather does not affect this indoor activity." for indoor; unscheduled section shown with "Could not be scheduled" heading and reason per activity; "✓ All activities scheduled." shown when no unscheduled activities; "No suitable time found for any activity…" shown when all unscheduled; `weatherUnavailable` renders error message with Retry; `placesUnavailable` renders correct message with Retry; `tooManyRequests` renders "Too many requests" with Retry; `serverError` renders generic error with Retry; Retry button calls `scheduleStore.retry()`; Back button navigates to `/plan/places`; `scheduleStore.reset()` called on unmount; redirects to `/plan/setup` when no checked plan
- [x] T036 [US1] Update `frontend/src/tests/PlacesAndForecastPage.test.tsx` — add tests: "Generate schedule" button is disabled when forecast or places status is not `"loaded"`; button is enabled when both are `"loaded"`; clicking the button navigates to `/plan/schedule`
- [x] T037 Update `frontend/src/tests/setup.ts` — reset the schedule store in `beforeEach` (same pattern as other stores)

**Checkpoint**: `npm test` passes. The complete feature is usable in the browser — generate schedule, view results, handle errors, navigate back.

---

## Phase 6: Accessibility and Responsiveness (US4)

**Purpose**: The Schedule Overview works at 320 px width, with a keyboard, and passes screen-reader announcements. Update existing test suites to cover the new page and route.

- [x] T038 [P] [US4] Update `frontend/src/tests/accessibility.test.tsx` — add Schedule Overview to the accessible-routes check; verify unscheduled reasons and weather badge text use ★/✗ symbols or words (not colour alone, spec US4 SC-4); verify each scheduled row is announced with start time, end time, activity name and place; verify unscheduled section heading is present and announced
- [x] T039 [P] [US4] Update `frontend/src/tests/keyboard.test.tsx` — add Schedule Overview; verify Back and any interactive elements (Retry buttons) are reachable by Tab in page order
- [x] T040 [P] [US4] Update `frontend/src/tests/responsive.test.tsx` — add Schedule Overview at 320 px width; verify no horizontal overflow (SC-005)

**Checkpoint**: `npm test` passes. No accessibility violations or horizontal scrolling at 320 px.

---

## Phase 7: Polish

**Purpose**: Layout tests, final validation, documentation update. No new functionality.

- [x] T041 Update `frontend/src/tests/layout.test.tsx` — add Schedule Overview to the layout check (consistent page structure, progress bar visible, Back present)
- [x] T042 Update `frontend/src/tests/planCreatorOnly.test.tsx` — add `POST /api/plan-schedule` to the list of endpoints that require the PlanCreator policy
- [x] T043 Run all checks and confirm they pass: `cd backend && dotnet build && dotnet test && dotnet format --verify-no-changes`; `cd frontend && npm run lint && npm test && npm run build`
- [x] T044 Review `git diff` and confirm only the files listed in `plan.md` Project Structure changed; remove any debug code or temporary files
- [x] T045 Update `docs/` if setup, behaviour or structure changed (e.g., add "Schedule Overview (step 4)" to the app flow description in `docs/`)

**Checkpoint**: All backend and frontend checks pass. Diff is clean. Feature is ready for commit and PR.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Setup): No dependencies — start immediately.
- **Phase 2** (Backend service layer): Depends on Phase 1. Blocks Phases 3, 4, 5.
- **Phase 3** (Backend endpoint): Depends on Phase 2.
- **Phase 4** (Frontend foundation): Depends on Phase 2 (needs service model knowledge for types). Can run in parallel with Phase 3.
- **Phase 5** (Schedule Overview page): Depends on Phases 3 and 4.
- **Phase 6** (Accessibility): Depends on Phase 5.
- **Phase 7** (Polish): Depends on Phase 6.

### Within Each Phase

- Tasks marked **[P]** in the same phase can be implemented in any order (they touch different files).
- Tasks without **[P]** must follow the numeric order within their phase.

### User Story Coverage

| Story | Priority | Covered in Phase(s) | Backend | Frontend |
|-------|----------|---------------------|---------|----------|
| US1 Generate and view schedule | P1 | 2, 3, 4, 5 | T009–T024 | T025–T036 |
| US2 Unscheduled activities | P1 | 2, 3, 5 | T009–T024 | T034, T035 |
| US3 Authorization | P1 | 3, 5 | T023, T024 | T034, T035, T042 |
| US4 Accessibility | P2 | 6 | — | T038–T040 |

---

## Parallel Opportunities

### Phase 2 — 5 tasks can start simultaneously

```
T003: UnscheduledReason.cs
T004: WeatherSnapshot.cs
T005: ScheduledActivity.cs
T006: UnscheduledActivity.cs
T007: PlanSchedule.cs
```

Then T008 → T009 → T010 → T011.

### Phase 3 — 5 DTO tasks can start simultaneously

```
T012: PlanScheduleRequest.cs
T013: WeatherSnapshotResponse.cs
T014: ScheduledActivityResponse.cs
T015: UnscheduledActivityResponse.cs
T016: PlanScheduleResponse.cs
```

Then T017 → T018 → T019 → T020 → T021 → T022 → T023 → T024.

### Phase 4 — Types and helpers in parallel

```
T025: planSchedule.ts (types)
T026: scheduleText.ts (helpers)
```

Then T027 → T028 → T029 → T030.

### Phase 5 — Route and progress bar in parallel

```
T031: planProgress.tsx (step 4)
T032: App.tsx (route)
```

Then T033 → T034 → T035 → T036 → T037.

### Phase 6 — All three test-file updates in parallel

```
T038: accessibility.test.tsx
T039: keyboard.test.tsx
T040: responsive.test.tsx
```

---

## Implementation Strategy

### MVP First (US1 — Generate and view the schedule)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Backend service layer — CRITICAL).
3. Complete Phase 3 (Backend endpoint).
4. Complete Phase 4 (Frontend foundation).
5. Complete Phase 5 (Schedule Overview page).
6. **Stop and validate**: Run quickstart.md scenarios 1 and 4; confirm SC-001 through SC-004.

### Full Delivery

6. Complete Phase 6 (Accessibility).
7. Complete Phase 7 (Polish).
8. Run full quickstart.md validation (all 8 scenarios).
9. Create PR when all checks pass.

### Notes

- Phases 3 and 4 can be worked in parallel by two developers once Phase 2 is complete.
- The backend integration tests in Phase 3 use the existing `RecordingMapPlacesClient` and `RecordingForecastClient` stubs — no new test infrastructure needed.
- `ApiExceptionHandler` requires no change (research.md section 2).
- No new database migration (plan.md Summary).
- No new NuGet or npm package (research.md section 1).
