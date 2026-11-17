# Tasks: Travel Distance Check

**Input**: Design documents from `specs/009-travel-distance/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/plan-schedule-api.md ✓, quickstart.md ✓

**Tests**: Required. Constitution III makes automated backend and frontend tests mandatory for every feature, so each story phase includes its tests.

**Organization**: Phase 1 is setup and Phase 2 is the shared foundation (new response shape, no behaviour yet). Phases 3 to 6 are one phase per user story, in priority order. Phase 7 is polish. Each phase ends at a reviewable checkpoint. Stop after each phase for a diff review; commit and push only on request.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on other incomplete tasks in this phase)
- **[Story]**: Which user story this task belongs to ([US1] to [US4])

## Shared test data note

Since feature 008, each activity takes its whole suitable period, so two activities only share a date when their periods do not overlap. Backend tests that need two or more activities on one date:

- **Unit tests**: build the `ScheduledActivity` list directly (the time slots are given).
- **Integration tests**: split the day with `FakeForecastClient.WithHour(...)`. For example, on one date set wind 12 m/s at 11:00. Two outdoor activities with a maximum wind of 6 m/s and a duration of 2 h then get the periods before and after 11:00.

Place positions come from `FakeMapPlacesClient.Element(...)` with explicit latitude and longitude, so distances are known in advance.

---

## Phase 1: Setup

**Purpose**: Branch ready, baseline green.

- [x] T001 Confirm the branch `009-travel-distance` (already created) is based on the current `origin/main` (`git fetch` then `git log origin/main..HEAD` and `git log HEAD..origin/main` show only this feature's spec files and no missing commits)
- [x] T002 Run `dotnet build` and `dotnet test` from `backend/`, and `npm run lint`, `npm test` and `npm run build` from `frontend/`; confirm all pass before changing any code (re-run `npm test` once if the first run fails with "Failed to start forks worker")

**Checkpoint**: Branch is current, all checks green.

---

## Phase 2: Foundational (response shape, no travel behaviour yet)

**Purpose**: The new records, DTOs, mapping and frontend types, so every later phase only adds behaviour. After this phase the endpoint returns `"travel": null` for every scheduled activity and `"travel": { "maxDistanceKm": <setup value>, "tripsOverLimit": 0 }` for the schedule.

**⚠️ CRITICAL**: No user story work starts until this phase is complete and all tests pass.

- [x] T003 [P] Add `public static decimal RoundToTenth(double km) => Math.Round((decimal)km, 1, MidpointRounding.AwayFromZero);` to `backend/src/SpekLaiku.Api/Services/GeoDistance.cs`, with an XML doc comment saying it is the one rounding for place and trip distances (research section 3)
- [x] T004 [P] Add `TravelLeg` record in `backend/src/SpekLaiku.Api/Services/TravelLeg.cs`: `public sealed record TravelLeg(string FromPlaceName, decimal DistanceKm, bool OverLimit);`. The doc comment states: "`DistanceKm` is the straight-line distance between the two chosen places, `GeoDistance.RoundToTenth`; `OverLimit` is `DistanceKm > MaxDistanceKm` of the plan (strictly greater; spec FR-002)."
- [x] T005 [P] Add `TravelSummary` record in `backend/src/SpekLaiku.Api/Services/TravelSummary.cs`: `public sealed record TravelSummary(int MaxDistanceKm, int TripsOverLimit);`. The doc comment states: "`MaxDistanceKm` is the checked setup's `MaxTravelDistanceKm`, 1 to 200, 30 when none was sent (spec FR-003)."
- [x] T006 Replace the inline rounding in `backend/src/SpekLaiku.Api/Services/NearbyPlaceRules.cs` (`Math.Round((decimal)distance, 1, MidpointRounding.AwayFromZero)`) with `GeoDistance.RoundToTenth(distance)`; no behaviour change (depends on T003)
- [x] T007 Change `backend/src/SpekLaiku.Api/Services/ScheduledActivity.cs` to `ScheduledActivity(Guid CategoryId, string ActivityName, DateOnly Date, TimeOnly StartTime, TimeOnly EndTime, NearbyPlace Place, WeatherSnapshot Weather, TravelLeg? Travel = null)`. Update the doc comment: "`CategoryId` is only used to find the category's listed places and is never sent to the browser; `Travel` is `null` for the first scheduled activity of its date" (depends on T004)
- [x] T008 Pass `activity.CategoryId` as the first argument when `PlanScheduler.Assign` creates a `ScheduledActivity` in `backend/src/SpekLaiku.Api/Services/PlanScheduler.cs`; no other change to the algorithm (depends on T007)
- [x] T009 Add `TravelSummary Travel` as the last parameter of `PlanSchedule` in `backend/src/SpekLaiku.Api/Services/PlanSchedule.cs`, and in `backend/src/SpekLaiku.Api/Services/PlanScheduleService.cs` build it for now as `new PlanSchedule(scheduled, unscheduled, new TravelSummary(plan.Setup.MaxTravelDistanceKm, 0))` (replaced in T018) (depends on T005, T008)
- [x] T010 [P] Add `TravelLegResponse` (`string FromPlaceName`, `decimal DistanceKm`, `bool OverLimit`) in `backend/src/SpekLaiku.Api/DTOs/Responses/TravelLegResponse.cs`, and `TravelSummaryResponse` (`int MaxDistanceKm`, `int TripsOverLimit`) in `backend/src/SpekLaiku.Api/DTOs/Responses/TravelSummaryResponse.cs`
- [x] T011 Add `TravelLegResponse? Travel` as the last field of `backend/src/SpekLaiku.Api/DTOs/Responses/ScheduledActivityResponse.cs` (no `CategoryId`), and `TravelSummaryResponse Travel` as the last field of `backend/src/SpekLaiku.Api/DTOs/Responses/PlanScheduleResponse.cs` (depends on T010)
- [x] T012 Add `CreateMap<TravelLeg, TravelLegResponse>();` and `CreateMap<TravelSummary, TravelSummaryResponse>();` to `backend/src/SpekLaiku.Api/Mapping/PlanScheduleMappingProfile.cs`; no business rules in the profile (depends on T004, T005, T011)
- [x] T013 Update the backend tests for the new constructors and fields: in `backend/tests/SpekLaiku.UnitTests/PlanScheduleMappingTests.cs` pass a `CategoryId` and a `TravelSummary`, and add tests that (a) `Travel = null` maps to `Travel = null`, (b) a `TravelLeg("Place A", 4.2m, false)` maps all three fields, (c) `TravelSummary(30, 2)` maps both fields, and (d) the configuration is still valid with `CategoryId` unmapped. In `backend/tests/SpekLaiku.UnitTests/GeoDistanceTests.cs` add `RoundToTenth` tests (`30.04 → 30.0`, `30.05 → 30.1`, `0.0 → 0.0`). In `backend/tests/SpekLaiku.UnitTests/PlanSchedulerTests.cs` assert that a scheduled activity carries its activity's `CategoryId` and has `Travel == null` (depends on T006 to T012)
- [x] T014 [P] Add to `frontend/src/types/planSchedule.ts`: `export interface TravelLeg { fromPlaceName: string; distanceKm: number; overLimit: boolean }` and `export interface TravelSummary { maxDistanceKm: number; tripsOverLimit: number }`; add `travel: TravelLeg | null` to `ScheduledActivity` and `travel: TravelSummary` to `PlanSchedule`. Update the header comment to mention the travel fields (contracts/plan-schedule-api.md)
- [x] T015 Update every schedule fixture in the frontend tests so it matches the new types (`travel: null` on each scheduled activity, `travel: { maxDistanceKm: 30, tripsOverLimit: 0 }` on each schedule) in `frontend/src/tests/planScheduleApi.test.ts`, `frontend/src/tests/usePlanScheduleStore.test.ts`, `frontend/src/tests/ScheduleOverviewPage.test.tsx`, `frontend/src/tests/accessibility.test.tsx`, `frontend/src/tests/keyboard.test.tsx`, `frontend/src/tests/layout.test.tsx`, `frontend/src/tests/responsive.test.tsx`, `frontend/src/tests/planCreatorOnly.test.tsx` and `frontend/src/tests/PlacesAndForecastPage.test.tsx` (depends on T014)
- [x] T016 Run `dotnet build SpekLaiku.slnx`, `dotnet test SpekLaiku.slnx` and `dotnet format SpekLaiku.slnx --verify-no-changes` from the repository root (the solution file is there, as in CI), and `npm run lint`, `npm test` and `npm run build` from `frontend/`; all pass, and the existing `PlanScheduleAuthorizationTests` and `PlanScheduleFailureTests` are green unchanged. In `PlanScheduleEndpointTests`, only `ValidPlan_ReturnsTheContractBody` changes: it pins the exact response keys, so it now expects `travel` on the schedule and on each entry (`null` here) and checks the summary `{ maxDistanceKm: 30, tripsOverLimit: 0 }`

**Checkpoint**: The response has the travel fields (all `null` / `0`). Every existing test is green. No behaviour change visible to the user.

---

## Phase 3: User Story 1 - See how far I travel between activities (Priority: P1) 🎯 MVP

**Goal**: Each scheduled activity after the first on its date carries its trip from the previous activity's place, and the Schedule Overview shows "Travel: Start of the day" or "Travel: <d.d> km from <previous place name>". In this phase every activity still uses its nearest place (the place choice is US2).

**Independent Test**: Generate a schedule with three activities at three different places on one date. The first shows "Travel: Start of the day"; the second and third show their distance from the previous place in km with one decimal.

### Tests for User Story 1

- [x] T017 [P] [US1] Add `backend/tests/SpekLaiku.UnitTests/TravelDistanceRulesTests.cs` (class doc comment: "Travel distance between consecutive activities (spec FR-001 to FR-003, SC-001, SC-003, research sections 2 to 5)"), with scheduled activities built directly and places at fixed coordinates. Cover:
  - (a) the first activity of a date has `Travel == null`;
  - (b) the second activity's `Travel.FromPlaceName` is the first activity's place name and `DistanceKm == GeoDistance.RoundToTenth(GeoDistance.Kilometres(...))` between the two place positions;
  - (c) activities are taken in `StartTime` order, not list order (pass them out of order);
  - (d) two dates: the first activity of the second date has `Travel == null` (dates are never consecutive);
  - (e) the same place twice gives `DistanceKm == 0.0m` and `OverLimit == false`;
  - (f) the result is in chronological order (date, then start time);
  - (g) `Date`, `StartTime`, `EndTime` and `Weather` are unchanged for every activity (spec FR-009);
  - (h) `Summary.MaxDistanceKm` equals the given maximum;
  - (i) an empty list gives an empty list and `TripsOverLimit == 0`.

  Each category has a single listed place in these tests, so the place choice (US2) is not involved.

### Implementation for User Story 1

- [x] T018 [US1] Create static `TravelDistanceRules` in `backend/src/SpekLaiku.Api/Services/TravelDistanceRules.cs` with `public static (IReadOnlyList<ScheduledActivity> Scheduled, TravelSummary Summary) Apply(IReadOnlyList<ScheduledActivity> scheduled, IReadOnlyList<CategoryPlaces> categoryPlaces, int maxDistanceKm)`. Behaviour (data-model.md, "TravelDistanceRules"):
  - group by `Date` ascending, and order by `StartTime` within a date;
  - the first activity of a date keeps its place and gets `Travel = null`;
  - each later activity keeps its current `Place` for now (the choice is added in T023) and gets `Travel = new TravelLeg(previous.Place.Name, rounded, rounded > maxDistanceKm)`, where `rounded = GeoDistance.RoundToTenth(GeoDistance.Kilometres(previous.Place.Latitude, previous.Place.Longitude, place.Latitude, place.Longitude))`;
  - the summary is `new TravelSummary(maxDistanceKm, count of Travel?.OverLimit == true)`.

  Use `with` expressions; do not create new time slots. Keep the class under about 80 lines with a doc comment that references spec FR-001 to FR-005 (depends on T017)
- [x] T019 [US1] In `backend/src/SpekLaiku.Api/Services/PlanScheduleService.cs`, after `PlanScheduler.Assign`, call `TravelDistanceRules.Apply(scheduled, categoryPlaces, plan.Setup.MaxTravelDistanceKm)` and return `new PlanSchedule(travelScheduled, unscheduled, summary)`. This replaces the placeholder summary from T009. Update the class doc comment (depends on T018)
- [x] T020 [US1] Create `backend/tests/SpekLaiku.IntegrationTests/PlanScheduleTravelTests.cs` for the travel endpoint tests, using the same test collection, fixture and helpers as `PlanScheduleEndpointTests.cs`, which is already 223 lines (only its contract-keys test was updated in T016). Give each test its own location id and position, following the existing pattern. Add:
  - a test where two outdoor activities of different categories share one date by splitting the day with `FakeForecastClient.WithHour` (wind 12 m/s at 11:00, both activities with max wind 6 m/s and 2 h duration), with places at known positions about 2 km apart and `maxTravelDistanceKm = 30`. Assert the earlier entry has `"travel": null`; the later entry has `travel.fromPlaceName` equal to the earlier entry's `place.name`, `travel.distanceKm` equal to the expected rounded distance, and `travel.overLimit` `false`; and the top-level `travel` is `{ "maxDistanceKm": 30, "tripsOverLimit": 0 }`;
  - a test that an activity alone on its date has `"travel": null`;
  - a test that a setup sent with `maxTravelDistanceKm: null` gives `"travel": { "maxDistanceKm": 30, … }` (spec FR-003, Edge Case "default of 30 km").

  (depends on T019)
- [x] T021 [P] [US1] Add `travelText(travel: TravelLeg | null): string` (implemented without the `maxDistanceKm` parameter, which would be unused until the over-limit wording and fail the lint rule for unused arguments; T028 adds it) to `frontend/src/helpers/scheduleText.ts`: `null` → `"Travel: Start of the day"`; otherwise `` `Travel: ${travel.distanceKm.toFixed(1)} km from ${travel.fromPlaceName}` `` (the over-limit wording is added in T028). Add `frontend/src/tests/scheduleText.test.ts` covering `null`, `4.2`, `0` (→ `"0.0 km"`) and a whole number such as `12` (→ `"12.0 km"`)
- [x] T022 [US1] Extract the per-date `<section>` (heading and `<ul>` of entries) from `frontend/src/pages/ScheduleOverviewPage.tsx` into a new `frontend/src/components/scheduledDaySection.tsx` exporting `ScheduledDaySection({ date, activities })` (T029 adds `maxDistanceKm` together with the over-limit wording). Add a `<span>{travelText(activity.travel)}</span>` after the weather span in each `<li>`. Keep the existing markup, `aria-label`s and keys. In `frontend/src/tests/ScheduleOverviewPage.test.tsx`, add tests that the first entry of a date shows "Travel: Start of the day" and a later entry shows "Travel: 4.2 km from Place A" (depends on T021)

**Checkpoint**: Backend and frontend tests pass. Trips and distances are visible on the Schedule Overview.

---

## Phase 4: User Story 2 - Keep the schedule within my maximum travel distance (Priority: P1)

**Goal**: An activity whose nearest place is too far from the previous activity's place uses the first of its listed places within the maximum. When none fits, it keeps its nearest place and the trip is flagged (clarification Q1).

**Independent Test**: With a 10 km maximum and two activities on one date, where the second activity's nearest place is 18 km from the first activity's place and its third listed place is 6 km away, the second activity uses the third place and its trip is not over the limit.

### Tests for User Story 2

- [x] T023 [P] [US2] Add to `backend/tests/SpekLaiku.UnitTests/TravelDistanceRulesTests.cs` (categories with several listed places, in nearest-to-plan-location order):
  - (a) nearest place within the maximum → nearest place used;
  - (b) nearest place too far, third place within → third place used and `OverLimit == false`;
  - (c) second and third both within → the second (first fitting in list order) is used;
  - (d) no listed place within → `places[0]` used, `OverLimit == true`, and `DistanceKm` is the distance to `places[0]`;
  - (e) the chosen alternative place becomes the previous place: a third activity's `FromPlaceName` and distance use it;
  - (f) the first activity of a date always uses `places[0]`, because it has no previous place to compare with;
  - (g) SC-002: across several fixed fixtures, whenever any listed place is within the maximum, `OverLimit` is `false`;
  - (h) every chosen place is one of its category's listed places.

### Implementation for User Story 2

- [x] T024 [US2] Extend `TravelDistanceRules.Apply` in `backend/src/SpekLaiku.Api/Services/TravelDistanceRules.cs`. For each activity after the first on a date:
  - look up its candidates with `categoryPlaces.First(cp => cp.CategoryId == activity.CategoryId).Places`;
  - pick the first candidate whose rounded distance from `previous.Place` is `<= maxDistanceKm`, otherwise `candidates[0]`;
  - set `Place` to the picked place, and build `Travel` from the distance to the picked place;
  - the picked place becomes `previous`.

  The first activity of a date uses `candidates[0]`. Extract a private `ChoosePlace(...)` method to keep `Apply` short; the class stays under 200 lines (depends on T023)
- [x] T025 [US2] Add to `backend/tests/SpekLaiku.IntegrationTests/PlanScheduleTravelTests.cs`: the same split-day setup with `maxTravelDistanceKm = 3`, where the second activity's category has two places, the nearest about 5 km from the first activity's place and the other about 1 km from it. Assert the second entry's `place.name` is the farther-from-location place, its `travel.overLimit` is `false`, and `tripsOverLimit` is `0` (depends on T024)

**Checkpoint**: Backend tests pass. Activities switch to a fitting listed place when one exists; times never change.

---

## Phase 5: User Story 3 - Know when the plan goes over my maximum travel distance (Priority: P1)

**Goal**: A trip still over the maximum is marked on its entry, and the top of the Schedule Overview says whether all trips are within the limit or how many are not.

**Independent Test**: With a 5 km maximum and two activities on one date whose listed places are all more than 5 km apart, the summary says one trip is longer than the limit, and the second entry shows "Travel: ✗ <d.d> km from <place>, more than your 5 km limit".

### Tests for User Story 3

- [x] T026 [P] [US3] Add boundary tests to `backend/tests/SpekLaiku.UnitTests/TravelDistanceRulesTests.cs`:
  - (a) a trip that rounds to exactly the maximum (for example 30.0 against 30) is not flagged;
  - (b) a trip that rounds to 30.1 against 30 is flagged;
  - (c) a raw 30.04 km trip shows `30.0` and is not flagged (rounded value compared, research section 3);
  - (d) `TripsOverLimit` counts exactly the flagged trips across several dates.
- [x] T027 [P] [US3] Add to `backend/tests/SpekLaiku.IntegrationTests/PlanScheduleTravelTests.cs`: the split-day setup with `maxTravelDistanceKm = 1`, where every listed place of the second activity is more than 1 km from the first activity's place. Assert the second entry has `travel.overLimit: true` and uses its nearest place, it is in `scheduled` (not `unscheduled`), no new `reason` value appears, and the top-level `travel.tripsOverLimit` is `1`

### Implementation for User Story 3

- [x] T028 [US3] In `frontend/src/helpers/scheduleText.ts`:
  - extend `travelText` so `overLimit === true` gives `` `Travel: ✗ ${distance} km from ${fromPlaceName}, more than your ${maxDistanceKm} km limit` ``;
  - add `travelSummaryText(scheduled: ScheduledActivity[], summary: TravelSummary): string | null`, which returns `null` when no scheduled activity has `travel !== null`, `"✓ All trips within your N km limit."` when `tripsOverLimit === 0`, `"✗ 1 trip longer than your N km limit."` when it is 1, and `"✗ n trips longer than your N km limit."` otherwise (data-model.md, "Display Rules").

  Add the matching cases to `frontend/src/tests/scheduleText.test.ts`
- [x] T029 [US3] In `frontend/src/pages/ScheduleOverviewPage.tsx`, replace the single `<p role="status">✓ All activities scheduled.</p>` with one `<div role="status">` containing that line (only when `unscheduled.length === 0`) and the `travelSummaryText` line (only when not `null`), each in its own `<p>`. Render the `<div>` only when it has at least one line, so there is one status region. Keep the page under about 200 lines (depends on T028)
- [x] T030 [US3] Add to `frontend/src/tests/ScheduleOverviewPage.test.tsx`:
  - an over-limit entry shows "Travel: ✗ 42.0 km from Place A, more than your 30 km limit";
  - the status area shows "✗ 1 trip longer than your 30 km limit." and "✗ 2 trips longer…" for two;
  - "✓ All trips within your 30 km limit." when no trip is over;
  - no travel summary when every date has one activity;
  - no travel summary in the all-unscheduled view;
  - "✓ All activities scheduled." and the travel summary appear together in the same status element.

  Adjust existing assertions that used `getByRole("status")` text if needed, without weakening them (depends on T029)

**Checkpoint**: Backend and frontend tests pass. Over-limit trips and the plan-level summary are visible.

---

## Phase 6: User Story 4 - Use the travel information on a phone and with assistive technology (Priority: P2)

**Goal**: Travel text and the summary are readable at 320 px, by keyboard and by screen reader, and never rely on colour alone.

**Independent Test**: At 320 px with a screen reader, a schedule with one over-limit trip announces the summary and the flagged entry's travel text, with no horizontal scrolling.

- [x] T031 [P] [US4] Update `frontend/src/tests/accessibility.test.tsx`: with a schedule fixture that has a trip, check that each entry's text includes "Travel:" after the place and weather, the over-limit text contains "✗" and the words "more than your", and the travel summary is inside the single `role="status"` element in `<main>` (the layout has its own app-wide status region outside it) (spec US4 scenarios 2 and 3, FR-012)
- [x] T032 [P] [US4] Update `frontend/src/tests/responsive.test.tsx`: at 320 px the Schedule Overview with a long place name in the travel text has no horizontal overflow (spec SC-006); add a CSS rule only if the test shows overflow (for example `overflow-wrap: anywhere` on the entry), in the existing stylesheet the page already uses
- [x] T033 [P] [US4] Update `frontend/src/tests/keyboard.test.tsx`: with travel information present, Back and Retry are still reachable by Tab in page order (no new focusable elements were added)

**Checkpoint**: `npm test` passes; accessibility, responsive and keyboard checks cover the travel information.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, full verification, review. No new behaviour.

- [x] T034 [P] Update `README.md`:
  - add a "Schedule overview" section after "Places and forecast", covering: **Generate schedule**; dates in order; each entry's time, place, weather and "Travel:"; the "Could not be scheduled" reasons; the travel check (straight-line distance between consecutive activities on the same date, another listed place used when the nearest is too far, ✗ flag and summary, maximum set on Plan Setup); and that travel time is not considered;
  - replace "Places are only shown here; the schedule (a later feature) chooses one per activity." in "Places and forecast" with a sentence pointing to the new section.
- [x] T035 [P] Check `docs/ux-design.md` and `docs/architecture.md` for statements that contradict the implemented behaviour (Travel shown as a "Travel:" part of each list entry, not a table column; travel time not handled by feature 009). Correct only what is now wrong, and list any open decision (the roadmap row for travel time) in the PR description instead of inventing a feature number
- [x] T036 Run all checks and confirm they pass: from the repository root run `dotnet build SpekLaiku.slnx`, `dotnet test SpekLaiku.slnx` and `dotnet format SpekLaiku.slnx --verify-no-changes`; from `frontend/` run `npm run lint`, `npm test` and `npm run build`
- [ ] T037 Walk through `specs/009-travel-distance/quickstart.md` Scenarios 1, 2, 4 and 5 in the running app, and record which passed and any that could not be arranged with live data (see its note on two activities per date)
  - Progress (2026-11-17): the API was run in a Linux container (README "Running the API on Windows 10"), because overpass-api.de accepts only TLS 1.3, which Windows 10 cannot use. Scenario 6 passed: during a public Overpass outage (502 "at capacity" and timeouts on overpass-api.de and its mirrors), step 3 and `/plan/schedule` showed "Error: The map data service is unavailable. No places are shown." with Retry, and the Schedule Overview did not break. Scenarios 1, 2, 4 and 5 are pending until Overpass answers again.
- [x] T038 Review `git diff main...HEAD` and confirm only the files in plan.md "Source Code" plus README, docs and spec files changed; no debug code, commented-out code or temporary files; `TravelDistanceRules`, `PlanScheduler` and `PlanScheduleService` are each under 200 lines; `ScheduleOverviewPage.tsx` and `scheduledDaySection.tsx` are each under about 200 lines
- [x] T039 Run a separate AI-assisted review of the branch (for example `/code-review`) and record the tool, the important findings, the changes made and the findings not applied (with a short reason) for the Pull Request description (constitution VII); apply accepted fixes and re-run T036

  **Result (2026-11-17)**:
  - **`/code-review` (medium, Claude Code), 7 findings, no correctness bugs:**
    - **Applied**:
      1. The place distance in a Schedule Overview entry was printed as the raw number ("Parkas (2 km)") next to a one-decimal trip ("Travel: 2.0 km …"). A shared `kmText` helper in `helpers/placeText.ts` now words both, and `placeDistanceText` uses it too ("Parkas (2.0 km)"). There is a new page test for a whole-number place distance, and `kmText` tests.
      2. The one-decimal formatting was written twice (place and trip distances): fixed by 1.
      3. `TravelDistanceRules` computed the distance to the chosen place twice. Each candidate's distance is now worked out once, and the chosen place keeps its distance.
      4. `TravelDistanceRules` searched the category list for every activity and had an unreachable fallback. The places are now looked up in a dictionary built once per call, without the fallback; a missing category would now fail loudly instead of being hidden.
    - **Not applied**:
      5. "The first activity of a date is set to its nearest place again, which the scheduler already did": kept on purpose, because data-model.md makes `TravelDistanceRules` own every place choice (first activity included), and `FirstActivityOfADate_UsesItsNearestPlace` covers it.
      6. "The response order of `scheduled` changed without the contract saying so": already documented as an order change in `contracts/plan-schedule-api.md` ("Order changed: now chronological"), and the page sorts by itself.
      7. "The page decides whether there is a travel summary from `travel === null` instead of a server field": this is wording, not a business rule (data-model.md "Display Rules"); a new response field would add contract surface for no behaviour change (constitution VIII).
  - **Re-run of T036 after the fixes**: backend 626 unit and 274 integration tests, `dotnet format` clean; frontend lint, 979 tests, build and Prettier check clean.
  - **Found while running the app (outside this feature, for separate issues):** `overpass-api.de` accepts only TLS 1.3, which Windows 10 cannot use (README note added); `OverpassQuery.TimeoutSeconds` (4 s) is tight for the public Overpass server and its address is hard-coded; a fresh package restore warns that AutoMapper 15.1.1 has two known high-severity vulnerabilities (NU1903, GHSA-6vhm-j9h7-f9gh, GHSA-gpwp-5797-mjff).
- [x] T040 Capture screenshots of the Schedule Overview for the Pull Request (constitution V, UI changes): at desktop width and at 320 px, showing a "Travel: Start of the day" entry, a trip within the limit, a "✗ … more than your N km limit" entry and the travel summary. Arrange the over-limit case as in quickstart Scenario 2. Keep the images outside the repository unless the README already stores screenshots

**Checkpoint**: All checks green, docs current, review recorded, screenshots ready. Ready for commit and Pull Request on request.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Setup): no dependencies.
- **Phase 2** (Foundational): depends on Phase 1. Blocks all story phases.
- **Phase 3** (US1): depends on Phase 2.
- **Phase 4** (US2): depends on Phase 3 (extends `TravelDistanceRules` from T018).
- **Phase 5** (US3): depends on Phase 3. The backend part (T026, T027) is meaningful after Phase 4, because the "none fits" case is defined there. Do Phase 4 first.
- **Phase 6** (US4): depends on Phases 3 and 5 (needs the travel text and summary).
- **Phase 7** (Polish): depends on all story phases.

### User Story Dependencies

- **US1 (P1)**: foundation only. It is the MVP: trips are visible.
- **US2 (P1)**: builds on US1's rule class. Testable on its own through unit tests T023 and endpoint test T025.
- **US3 (P1)**: the backend flag already exists from US1 (T018 computes `OverLimit`). US3 adds the boundary tests, the endpoint over-limit test and all the frontend flag and summary display.
- **US4 (P2)**: checks the display from US1 and US3.

### Within Each Phase

- Tests are written first and must fail for the missing behaviour before it is implemented (T017 before T018, T023 before T024, T026 and T027 before verifying the flag).
- Tasks marked **[P]** in the same phase touch different files and can be done in any order. The others follow numeric order.

### User Story Coverage

| Story | Priority | Phase | Backend tasks | Frontend tasks |
|-------|----------|-------|---------------|----------------|
| US1 See travel distances | P1 | 3 | T017–T020 | T021, T022 |
| US2 Stay within the maximum | P1 | 4 | T023–T025 | — (no display change) |
| US3 Flag over-limit trips | P1 | 5 | T026, T027 | T028–T030 |
| US4 Phone and assistive tech | P2 | 6 | — | T031–T033 |

---

## Parallel Opportunities

### Phase 2

```text
T003: GeoDistance.RoundToTenth
T004: TravelLeg.cs
T005: TravelSummary.cs
T010: TravelLegResponse.cs + TravelSummaryResponse.cs
T014: frontend types
```

Then T006 → T007 → T008 → T009 → T011 → T012 → T013, and T015 after T014; T016 last.

### Phase 3 (US1)

```text
T017: TravelDistanceRulesTests (backend)
T021: travelText + scheduleText.test.ts (frontend)
```

Then T018 → T019 → T020 (backend) and T022 (frontend).

### Phase 5 (US3)

```text
T026: boundary unit tests
T027: over-limit endpoint test
```

Then T028 → T029 → T030.

### Phase 6 (US4)

```text
T031: accessibility.test.tsx
T032: responsive.test.tsx
T033: keyboard.test.tsx
```

### Phase 7

```text
T034: README.md
T035: docs/ check
```

Then T036 → T037 → T038 → T039 → T040.

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1: Setup.
2. Phase 2: Foundational (CRITICAL; the response shape changes here).
3. Phase 3: US1. Distances are shown.
4. **Stop and validate**: run the US1 independent test and quickstart Scenario 1.

### Incremental Delivery

5. Phase 4: US2 (place choice). Validate with T023 and T025.
6. Phase 5: US3 (flag and summary). Validate with quickstart Scenario 2.
7. Phase 6: US4 (accessibility). Validate with quickstart Scenario 5.
8. Phase 7: Polish, full checks, AI review, then commit and Pull Request on request.

### Notes

- No new endpoint, controller, client, migration, NuGet or npm package (plan.md).
- Tests never call live Open-Meteo or Overpass; integration tests use `FakeForecastClient` and `FakeMapPlacesClient` (constitution III).
- No new protected operation: the existing `PlanScheduleAuthorizationTests` cover the endpoint and must stay green (plan.md Constitution Check).
- Travel time is out of scope (spec clarification Q2): no task changes a start or end time.
