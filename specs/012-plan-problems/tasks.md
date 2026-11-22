# Tasks: Plan Problem Detection

**Input**: Design documents from `specs/012-plan-problems/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/plan-check-api.md ✓, quickstart.md ✓

**Tests**: Required. Constitution III makes automated backend and frontend tests mandatory for every feature, including an authorization test for each protected operation. Each story phase includes its tests.

**Organization**:

- Phase 1 is setup.
- Phase 2 is the shared foundation:
  - the rule enum and the structured weather breaches;
  - the shared start-hour weather;
  - `ActivityIndex` in the stored schedule;
  - the result records;
  - the test helpers and the frontend types.

  After it, the app behaves exactly as before.
- Phases 3 to 9 are one phase per user story, in the spec's order:
  - US1 Problems on open (P1);
  - US2 Recalculate (P1);
  - US3 Reasons (P1);
  - US4 Forecast failure (P1);
  - US5 Past plans (P2);
  - US6 Owner only (P1);
  - US7 Keyboard, screen reader and phone (P2).
- Phase 10 is polish.

Each phase ends at a reviewable checkpoint. Stop after each phase for a diff review; commit and push only on request.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on other incomplete tasks in this phase)
- **[Story]**: Which user story this task belongs to ([US1] to [US7])

## Shared test notes

- **Shared factory**: integration tests share one `PostgreSqlApiFactory` (collection `PostgreSqlCollection.Name`), including `factory.Clock` and `factory.Forecast`. A test that moves `factory.Clock.UtcNow` must restore it in a `finally` block.
- **Saved plans for check tests** are inserted directly with `SavedPlanSeed` (T012), not generated through `/api/plan-schedule`. Each test can then build the exact schedule it needs, and Overpass is never involved (research section 16).
  - Every seeded plan uses its **own location id and its own position**. The forecast cache is keyed by location id and first date, and `FakeForecastClient` by position, so tests never see each other's forecasts.
- **The fixed clock**: use a clock two days before the plan date, as `ScheduleScenario` does: `2026-11-10T12:20:00Z` is 14:20 in Vilnius. Build the forecast with `FakeForecastClient.Fill(firstDate: 2026-11-10, days: 7, …)` and change single hours with `FakeForecastClient.WithHour`.
- **Forecast reuse**: the forecast is cached for 30 minutes per location. A test that changes the scripted forecast and checks again must move `factory.Clock` forward by 30 minutes or more, or use a new location.
- **Frontend helpers**: tests use `routeFetch`, `jsonResponse`, `signedInUser` and `renderApp` from `frontend/src/tests/renderApp.tsx`, and the fixtures in `frontend/src/tests/savedPlansFixtures.ts`.
  - `routeFetch` fails a test on any request without a handler. From Phase 3 on, every test that opens a plan page needs a `GET /api/plans/<id>/check` route (T034).
- **Vitest cold start**: the first `npm test` of a session may fail with "Failed to start forks worker". Re-run it once before investigating.

---

## Phase 1: Setup

**Purpose**: Branch ready, baseline green.

- [x] T001 Confirm that the branch `012-plan-problems` (already created) is based on the current `origin/main`:
  - Run `git fetch`, then `git log origin/main..HEAD` and `git log HEAD..origin/main`. Both should be empty.
  - Run `git status`. It should show only the untracked `specs/012-plan-problems/` folder.
- [x] T002 Run the baseline checks and confirm that all pass before changing any code. Record the test counts for comparison in T066.
  - From the repository root: `dotnet build SpekLaiku.slnx` and `dotnet test SpekLaiku.slnx`.
  - From `frontend/`: `npm run lint`, `npm test` and `npm run build`.
  - Expected from feature 011 (2026-11-19): backend 666 unit and 391 integration tests; frontend 87 files and 1240 tests. Record the actual numbers here.
  - Result (2026-11-20): backend build with 0 warnings; 666 unit and 391 integration tests. Frontend lint clean; 87 files and 1240 tests; build clean.
    - On the first run, 1 of the 391 integration tests failed. That run did not record which test, and all 391 passed when the run was repeated with no change. This is intermittent and existed before this feature; watch for it in later runs.

**Checkpoint**: Branch is current, all checks green.

---

## Phase 2: Foundational (shared rules, stored index, records, test helpers, types)

**Purpose**: Everything several stories need. There is no new endpoint and nothing visible yet.

**⚠️ CRITICAL**: No user story work starts until this phase is complete and all tests pass.

### Rules shared with feature 006 (research section 5)

- [x] T003 [P] Create `backend/src/SpekLaiku.Api/Services/PlanRule.cs`: `public enum PlanRule { Wind, Rain, Cold, Heat, NoForecast, BeforeSunrise, AfterSunset, Overlap, Travel }`, in exactly this order.
  - Doc comment: "One rule a scheduled activity can break (feature 012 spec FR-005). The order is the order problems are listed within one activity (data-model.md PlanProblem)."
- [x] T004 [P] Create `backend/src/SpekLaiku.Api/Services/LimitBreach.cs`: `public sealed record LimitBreach(PlanRule Rule, decimal Value, decimal Limit);`.
  - Doc comment: "One weather limit one planning hour breaks: the hour's rounded value and the activity's limit. Rule is Wind, Rain, Cold or Heat."
- [x] T005 Change `backend/src/SpekLaiku.Api/Services/HourSuitabilityRules.cs`:
  - Add `public static IReadOnlyList<LimitBreach> Breaches(PlanningHour hour, CheckedPlanActivity activity)`. It returns an empty list unless `activity.Type == ActivityType.Outdoor` and the hour has all three values. Otherwise it returns the breaches in the order Cold, Heat, Rain, Wind, which is the order of the existing `AddWeatherReasons`:
    - `Cold` when `temperature < MinTemperatureC`;
    - `Heat` when `temperature > MaxTemperatureC`;
    - `Rain` when `rain > MaxRainMmPerHour`;
    - `Wind` when `wind > MaxWindMs`.
    
    A missing limit is not compared. A value equal to its limit meets it.
  - Rewrite `AddWeatherReasons` to build its strings from `Breaches`, mapping each rule to the existing `TooCold`, `TooWarm`, `TooMuchRain` and `TooWindy`. Every string `Check` returns, and their order, must stay exactly as before.
  - Add tests in `backend/tests/SpekLaiku.UnitTests/HourSuitabilityRulesTests.cs`:
    - `Breaches_ForEachBrokenLimit_GivesRuleValueAndLimit`;
    - `Breaches_ValueEqualToLimit_IsNoBreach`;
    - `Breaches_IndoorActivity_IsEmpty`;
    - `Breaches_HourWithAMissingValue_IsEmpty`.
    
    All existing tests in the file must pass unchanged.
- [x] T006 Move the start-hour weather out of `PlanScheduler` (research section 7, plan "Backend changes"):
  - Create `backend/src/SpekLaiku.Api/Services/ScheduledWeather.cs`, a static class with `public static WeatherSnapshot At(bool weatherIndependent, TimeOnly start, PlanningDay day)`. Its body is exactly today's `PlanScheduler.BuildWeather`, using `start` instead of `period.Start`.
  - In `backend/src/SpekLaiku.Api/Services/ActivityForecasts.cs`, add `public static bool IsWeatherIndependent(CheckedPlanActivity activity) => activity.Type == ActivityType.Indoor && !activity.RequiresDaylight;` and use it in `For`.
  - In `backend/src/SpekLaiku.Api/Services/PlanScheduler.cs`, delete `BuildWeather` and call `ScheduledWeather.At(forecast.WeatherIndependent, best.Value.Period.Start, planningDay)`.
  - `PlanSchedulerTests` and `ActivityForecastsTests` must pass unchanged.
- [x] T007 Add the stored activity index (research section 4, data-model.md "ScheduledActivity"):
  - In `backend/src/SpekLaiku.Api/Services/ScheduledActivity.cs`, add the last parameter `int? ActivityIndex = null` after `TravelLeg? Travel = null`. Add a doc line: "The position of this entry's activity in PlanSnapshot.Activities (0-based); null in plans saved before feature 012 (research section 4). Never sent to the browser."
  - In `backend/src/SpekLaiku.Api/Services/PlanScheduler.cs`, pass `ActivityIndex: i` when creating each `ScheduledActivity`.
  - `TravelDistanceRules` creates entries with `with`, so the index is kept without a change there. Do not add the member to `ScheduledActivityResponse`.
- [x] T008 [P] Add tests in `backend/tests/SpekLaiku.UnitTests/PlanSchedulerTests.cs`:
  - `Assign_SetsEachEntrysActivityIndex_AlsoForARepeatedCategory`: two activities of the same category with different limits, both scheduled; each entry's `ActivityIndex` is its activity's position.
  - `TravelRules_KeepTheActivityIndex`: `TravelDistanceRules.Apply` returns entries with the same `ActivityIndex` values.
- [x] T009 [P] Add tests in `backend/tests/SpekLaiku.UnitTests/PlanSnapshotJsonTests.cs`:
  - `StoredScheduleWithoutActivityIndex_IsReadWithNull`: a JSON string of a snapshot written before this feature, with no `activityIndex` key, deserializes with `PlanSnapshotConversion.JsonOptions`, and the entry has `ActivityIndex == null`.
  - `ActivityIndex_RoundTripsAsActivityIndex`: the written JSON contains `"activityIndex":1`, and reading it back gives 1.
- [x] T010 [P] Add a test in `backend/tests/SpekLaiku.UnitTests/PlanScheduleMappingTests.cs`: `ScheduledActivityResponse_HasNoActivityIndex`. Serialize a mapped response with an `ActivityIndex` set, and assert that the JSON has no `activityIndex` and no `categoryId`.

### Result records (data-model.md)

- [x] T011 [P] Create the result records in `backend/src/SpekLaiku.Api/Services/`, each with a one-line doc comment that cites data-model.md:
  - `PlanProblem.cs`: `public sealed record PlanProblem(PlanRule Rule, TimeOnly? Time = null, decimal? Value = null, decimal? Limit = null, TimeOnly? SunTime = null, string? OtherActivityName = null, TimeOnly? OtherStartTime = null, TimeOnly? OtherEndTime = null, string? FromPlaceName = null);`
  - `PlanCheckEntry.cs`: `public sealed record PlanCheckEntry(DateOnly Date, TimeOnly StartTime, TimeOnly EndTime, string ActivityName, bool Past, WeatherSnapshot? Weather, IReadOnlyList<PlanProblem> Problems);`, with the rule "`Weather` is null and `Problems` is empty when `Past`".
  - `PlanCheck.cs`: `public sealed record PlanCheck(DateTime SavedAt, bool AllPast, TimeOnly? ForecastUpdatedAt, IReadOnlyList<PlanCheckEntry> Entries);`, with the invariants "Entries.Count == the saved schedule's Scheduled.Count, in the stored order; AllPast ⇔ every entry is Past ⇔ ForecastUpdatedAt is null".
  - `PlanCheckResult.cs`: a sealed record in the style of `SavedPlanLookup`, with a private constructor:
    - `PlanCheck? Check`;
    - `bool IsForbidden`;
    - `[MemberNotNullWhen(true, nameof(Check))] bool Found`;
    - static `Of(PlanCheck)`, `NotFound` and `Forbidden`.

### Test helpers

- [x] T012 [P] Integration test helpers:
  - In `backend/tests/SpekLaiku.IntegrationTests/PostgreSqlApiFactory.cs`, add `public async Task<(ApplicationUser User, HttpClient Client)> CreateSignedInUserAsync(string role = "Registered User", AccountStatus status = AccountStatus.Active)` with the body of today's `CreateSignedInClientAsync`. Make `CreateSignedInClientAsync` return `(await CreateSignedInUserAsync(role, status)).Client`.
  - Create `backend/tests/SpekLaiku.IntegrationTests/SavedPlanSeed.cs`, an `internal sealed class SavedPlanSeed(PostgreSqlApiFactory factory)` with:
    - `static PlaceLocation NewLocation()`: a unique id and a unique position, from a static counter that starts at 900000 and is advanced with `Interlocked.Increment`, so tests running at the same time never share a location. The id is the counter; the latitude is `55.0 + (counter - 900000) * 0.001` and the longitude `24.0`.
    - `static CheckedPlanActivity Outdoor(string name, Guid categoryId, decimal maxWind = 8, decimal maxRain = 1, decimal minTemperature = 0, decimal maxTemperature = 30, bool requiresDaylight = true, decimal durationHours = 2)` and `static CheckedPlanActivity Indoor(string name, Guid categoryId, bool requiresDaylight = false, decimal durationHours = 2)`.
    - `static ScheduledActivity Entry(int activityIndex, CheckedPlanActivity activity, DateOnly date, TimeOnly start, TimeOnly end, NearbyPlace? place = null, TravelLeg? travel = null)`. Weather `new WeatherSnapshot(1, 0, 1, false)`. `ActivityIndex = activityIndex`.
    - `Task<Guid> InsertAsync(string ownerId, PlaceLocation location, IReadOnlyList<DateOnly> dates, IReadOnlyList<CheckedPlanActivity> activities, IReadOnlyList<ScheduledActivity> scheduled, int maxDistanceKm = 30, string name = "Seeded plan")`. It writes a `SavedPlan` through `ApplicationDbContext` in its own scope, with:
      - `SavedAtUtc` and `CreatedAtUtc` = `2026-11-09T10:00:00Z`;
      - `LocationName` and `Dates` from the setup;
      - `GeneratedScheduleId = null`;
      - the `PlanSnapshot`, with `TravelSummary(maxDistanceKm, scheduled.Count(e => e.Travel?.OverLimit == true))`.
      
      It returns the id.
    - `Task<string> SnapshotJsonAsync(Guid id)`, which reads the stored row with `AsNoTracking` and returns `JsonSerializer.Serialize(plan.Snapshot, PlanSnapshotConversion.JsonOptions)`. It is used by the "unchanged" tests.
  - `CreateSignedInClientAsync`'s existing callers must keep compiling and passing.

### Frontend types and fixtures (contracts/plan-check-api.md)

- [x] T013 [P] Create `frontend/src/types/planCheck.ts`:
  - `PlanRule`: `"wind" | "rain" | "cold" | "heat" | "noForecast" | "beforeSunrise" | "afterSunset" | "overlap" | "travel"`.
  - `PlanProblem` with every field of the contract's problem table (`rule`, `time`, `value`, `limit`, `sunTime`, `otherActivityName`, `otherStartTime`, `otherEndTime`, `fromPlaceName`; all but `rule` are `string | null` or `number | null`).
  - `PlanCheckEntry`: `date`, `startTime`, `endTime`, `activityName`, `past`, `weather: WeatherSnapshot | null`, `problems: PlanProblem[]`.
  - `PlanCheck`: `savedAt`, `status: "checked" | "allPast"`, `forecastUpdatedAt: string | null`, `entries: PlanCheckEntry[]`.
  - A header comment says the server decides every rule and the page only words the answer (research section 11).
- [x] T014 [P] In `frontend/src/tests/savedPlansFixtures.ts`, add:
  - `export const planCheckNoProblems: PlanCheck`: `savedAt` equal to `savedPlan.savedAt`, `status: "checked"`, `forecastUpdatedAt: "14:05"`, and one entry per `savedPlan.scheduled` entry with the same date, times and name, `past: false`, the same weather and no problems.
  - `export function planCheckWith(entries: Partial<PlanCheckEntry>[]): PlanCheck`, which builds a check over the same entries with the given overrides.
  - `export function problem(rule: PlanRule, fields: Partial<PlanProblem>): PlanProblem`, with every other field `null`.
  
  Do not add the check route to `savedPlanRoutes` yet (T034 does this when the page starts calling it).
- [x] T015 Run the backend and frontend checks (`dotnet build`, `dotnet test`, `npm run lint`, `npm test`). All must pass, with only the new tests added.
  - Result (2026-11-20):
    - **Backend**: build with 0 warnings; 681 unit tests (baseline 666, +15) and 391 integration tests (unchanged); `dotnet format --verify-no-changes` clean.
    - **Frontend**: lint and Prettier clean; 87 files and 1240 tests (unchanged; T013 and T014 add only types and fixtures); build clean.
    - **No existing test or assertion changed.** `PlanScheduler.cs` shrank to 118 lines and `HourSuitabilityRules.cs` grew to 111.
    - **Intermittent failure**: in one full frontend run, `savePlanSection.test.tsx` "shows the server's message for a name that is too long" failed once. It passed in 3 separate runs of that file and in the next full run (1240 of 1240). This is a feature 010 test that the Phase 2 changes do not touch; watch for it in later runs.

**Checkpoint**: Shared pieces in place, all tests green, no visible change.

---

## Phase 3: User Story 1 - See what no longer works when I open a saved plan (Priority: P1) 🎯 MVP

**Goal**: Opening a saved plan checks it against the latest forecast. The page lists weather limit problems with their reasons and marks the entries, or says the plan still fits. The saved plan is never changed.

**Independent Test**: The spec's User Story 1 test:

1. Save Kayaking (wind ≤ 8 m/s) on Saturday 10:00–12:00 with 5 m/s wind.
2. Change Saturday 11:00 to 9 m/s and open the plan. "Wind up to 9 m/s at 11:00, more than your limit of 8 m/s." is listed and the entry is marked.
3. Change it back. "✓ No problems found. Your plan fits the current forecast." is shown.

### Backend for User Story 1

- [x] T016 [US1] Create `backend/src/SpekLaiku.Api/Services/PlanWeatherRules.cs`, a static class with `public static IReadOnlyList<PlanProblem> For(ScheduledActivity entry, CheckedPlanActivity activity, PlanningDay day)`. In this phase it returns only the weather limit problems:
  - The entry's hours are `day.Hours` with `Start >= entry.StartTime && End <= entry.EndTime`, in time order.
  - For each hour, take `HourSuitabilityRules.Breaches(hour, activity)`. For each rule keep the worst breach:
    - `Wind`, `Rain` and `Heat`: the highest `Value`;
    - `Cold`: the lowest `Value`.
    
    On a tie, keep the earlier hour, so `Time` is "the start of the first hour with the worst value" (spec FR-007).
  - Return `new PlanProblem(rule, Time: hour.Start, Value: worst, Limit: limit)` per broken rule, in `PlanRule` order (Wind, Rain, Cold, Heat).
  - Keep it under about 120 lines. Phase 5 adds `NoForecast` and daylight.
- [x] T017 [US1] Create `backend/tests/SpekLaiku.UnitTests/PlanWeatherRulesTests.cs`, with hand-built `PlanningDay` values (all hours in daylight):
  - `WindAboveLimitInOneHour_GivesWindAtThatHour` (spec example: 9.0 at 11:00, limit 8.0);
  - `WindAboveLimitInSeveralHours_GivesTheHighestAndItsFirstHour`;
  - `SameWorstValueTwice_GivesTheEarlierHour`;
  - `RainAboveLimit_GivesRain`;
  - `TemperatureBelowMinimum_GivesTheLowestAsCold`;
  - `TemperatureAboveMaximum_GivesTheHighestAsHeat`;
  - `ValuesEqualToLimits_GiveNoProblem`;
  - `SeveralRulesBroken_AreListedInRuleOrder`;
  - `HoursOutsideTheEntry_AreIgnored`;
  - `IndoorActivity_GetsNoWeatherProblem`.
- [x] T018 [US1] Create `backend/src/SpekLaiku.Api/Services/PlanCheckRules.cs`, a static class with `public static IReadOnlyList<PlanCheckEntry> Check(PlanSnapshot snapshot, IReadOnlyList<PlanningDay> days, DateTimeOffset now)`:
  - One `PlanCheckEntry` per `snapshot.Schedule.Scheduled` entry, **in the stored order**.
  - **Started** (research section 8): add `internal static DateTimeOffset StartInstant(ScheduledActivity entry)`. It builds `entry.Date.ToDateTime(entry.StartTime)` with `ForecastPeriod.Lithuania.GetUtcOffset(local)`, the same way the private `PlanningDays.LocalInstant` builds hour instants. An entry is `Past` when `StartInstant(entry) <= now`, or when `days` has no `PlanningDay` for its date. A `Past` entry gets `Weather = null` and no problems.
  - **Activity lookup** (data-model.md "Validation"): use `snapshot.Activities[entry.ActivityIndex]` when the index is not null, `0 <= index < Activities.Count`, and that activity's `CategoryId == entry.CategoryId`. Otherwise use the first activity with `CategoryId == entry.CategoryId`. If there is none, treat the entry as Indoor without limits: no weather problems, and weather from `ScheduledWeather.At(true, …)`.
  - **Checked entries**:
    - `Weather = ScheduledWeather.At(ActivityForecasts.IsWeatherIndependent(activity), entry.StartTime, day)`;
    - `Problems = PlanWeatherRules.For(entry, activity, day)`.
  - Phase 5 adds overlap and travel. Keep it under about 130 lines.
- [x] T019 [US1] Create `backend/tests/SpekLaiku.UnitTests/PlanCheckRulesTests.cs`:
  - `Entries_AreReturnedInTheStoredOrder_OnePerScheduledActivity`;
  - `CheckedEntry_GetsTheLatestWeatherAtItsStartHour`;
  - `IndoorEntryWithoutDaylight_GetsIsIndoorWeather`;
  - `WindProblem_IsReturnedOnTheEntry`;
  - `ActivityIndex_PicksTheRightLimitsForARepeatedCategory` (Cycling twice, limits 5 and 10 m/s, 7 m/s wind; only the first gets a problem);
  - `MissingActivityIndex_FallsBackToTheFirstActivityOfTheCategory`;
  - `InvalidActivityIndex_FallsBackToTheFirstActivityOfTheCategory` (out of range, and pointing at another category);
  - `EntryStartingAtNow_IsPast`;
  - `EntryStartingOneMinuteAfterNow_IsChecked`;
  - `DateMissingFromTheForecast_IsPast`.
- [x] T020 [US1] Create `backend/src/SpekLaiku.Api/Services/PlanCheckService.cs`, a sealed class with the primary constructor `(SavedPlanService savedPlanService, WeatherForecastService weatherForecastService, ForecastPeriod forecastPeriod, IOptions<ForecastOptions> options)` and the method `public async Task<PlanCheckResult> CheckAsync(string ownerId, Guid id, CancellationToken cancellationToken)`:
  1. `var lookup = await savedPlanService.GetAsync(ownerId, id, cancellationToken)`. Return `PlanCheckResult.NotFound` or `PlanCheckResult.Forbidden` before anything else.
  2. `var now = forecastPeriod.GetNow()`.
  3. Get the forecast: `var received = await weatherForecastService.GetAsync(snapshot.Setup.Location, cancellationToken)`. Exceptions are not caught; `ApiExceptionHandler` turns them into 503 or 500.
  4. The dates to build are the distinct dates of entries whose start instant is after `now` and that appear in `received.Data.Days` (research section 8). Build them with `PlanningDays.Build(received.Data, dates, now, options.Value)`.
  5. `var entries = PlanCheckRules.Check(snapshot, days, now)`.
  6. Return `PlanCheckResult.Of(new PlanCheck(plan.SavedAtUtc, AllPast: false, ForecastPeriod.ToLithuanianMinute(received.ReceivedAt), entries))`.
  
  The class comment cites spec FR-001, FR-002, FR-004, FR-012 and FR-014 and says the plan is read with `AsNoTracking` and never saved. The early return when every activity has started comes in Phase 7. Register it in `backend/src/SpekLaiku.Api/Program.cs` with `builder.Services.AddScoped<PlanCheckService>();` next to `SavedPlanEditService`.
- [x] T021 [US1] Create the response DTOs (contracts/plan-check-api.md) and the mapping:
  - `backend/src/SpekLaiku.Api/DTOs/Responses/PlanProblemResponse.cs`: `(string Rule, string? Time, decimal? Value, decimal? Limit, string? SunTime, string? OtherActivityName, string? OtherStartTime, string? OtherEndTime, string? FromPlaceName)`.
  - `PlanCheckEntryResponse.cs`: `(DateOnly Date, string StartTime, string EndTime, string ActivityName, bool Past, WeatherSnapshotResponse? Weather, IReadOnlyList<PlanProblemResponse> Problems)`.
  - `PlanCheckResponse.cs`: `(DateTimeOffset SavedAt, string Status, string? ForecastUpdatedAt, IReadOnlyList<PlanCheckEntryResponse> Entries)`.
  - `backend/src/SpekLaiku.Api/Mapping/PlanCheckMappingProfile.cs`:
    - `PlanRule` → `string` with `JsonNamingPolicy.CamelCase.ConvertName(rule.ToString())`.
    - `TimeOnly?` → `string?`: null stays null; otherwise reuse the existing `TimeOnly` → `"HH:mm"` map from `PlanForecastMappingProfile`. Do not add a second `TimeOnly` → `string` converter.
    - `PlanCheck` → `PlanCheckResponse`: `Status` is `"allPast"` when `AllPast`, else `"checked"`; `SavedAt` as UTC (`DateTime.SpecifyKind(…, Utc)`, as `SavedPlanMappingProfile.AsUtc` does).
    - The entry and problem maps. Weather uses the existing `WeatherSnapshot` → `WeatherSnapshotResponse` map.
    
    Path selections only, no rules (constitution II).
- [x] T022 [US1] Create `backend/tests/SpekLaiku.UnitTests/PlanCheckMappingTests.cs`:
  - `Configuration_IsValid` (the existing pattern with all profiles);
  - `Check_MapsToTheContractShape` (serialize with web defaults and compare keys and values with the contract example);
  - `Rules_AreCamelCase` (all nine);
  - `NullTimes_StayNull`;
  - `AllPast_MapsToStatusAllPast`;
  - `CategoryIdAndActivityIndex_AreNeverSent`.
- [x] T023 [US1] Add the endpoint to `backend/src/SpekLaiku.Api/Controllers/PlansController.cs`. Inject `PlanCheckService planCheckService` in the primary constructor.
  - The action is `[HttpGet("{id:guid}/check")]`, `[EnableRateLimiting(RateLimitPolicies.PlanSetup)]`.
  - Response types: `ProducesResponseType<PlanCheckResponse>(200)`, `ProblemDetails` 404, 429 and 503.
  - Signature: `public async Task<ActionResult<PlanCheckResponse>> Check(Guid id, CancellationToken cancellationToken)`.
  - It calls `planCheckService.CheckAsync(userManager.GetUserId(User)!, id, cancellationToken)` and returns `mapper.Map<PlanCheckResponse>(result.Check)` when found, `Forbid()` when forbidden, and else the existing `PlanNotFound()`.
  - Comment: "Checks the plan against the latest forecast and changes nothing (feature 012 spec FR-002, FR-014). Shares the plan setup request limit (FR-015); a weather failure becomes 503 in ApiExceptionHandler."
  - The file must stay under 200 lines (about 148 expected).
- [x] T024 [US1] Create `backend/tests/SpekLaiku.IntegrationTests/PlanCheckEndpointTests.cs` (collection `PostgreSqlCollection.Name`), using `SavedPlanSeed` and the clock and forecast described in "Shared test notes":
  - `WindAboveTheLimit_IsListedOnTheEntry`: the spec's independent test. Kayaking, wind ≤ 8, on 2026-11-12 10:00–12:00; 9 m/s at 11:00. 200, with `status: "checked"` and one problem `{ rule: "wind", time: "11:00", value: 9.0, limit: 8.0 }`.
  - `ForecastWithinLimits_HasNoProblems`.
  - `Body_MatchesTheContract`: every key of the contract's 200 example, `forecastUpdatedAt` equal to the clock's Lithuanian minute when the forecast was asked, and `savedAt` equal to the seeded `SavedAtUtc`.
  - `Entries_FollowTheOrderOfTheSavedSchedule`: compare with `GET /api/plans/{id}` `scheduled`.
  - `LatestWeather_IsReturnedForEachEntry`.
  
  That opening a plan with `GET /api/plans/{id}` still calls no external service is already tested by `SavedPlanDetailsEndpointTests.OpeningAPlan_CallsNeitherExternalService`. Do not repeat it here.
- [x] T025 [US1] Create `backend/tests/SpekLaiku.IntegrationTests/PlanCheckUnchangedTests.cs`, with `ChecksWithAndWithoutProblems_LeaveThePlanUnchanged`:
  - Before: read `SnapshotJsonAsync`, and `SavedAtUtc`, `CreatedAtUtc` and `Name` with `AsNoTracking`, and `GET /api/plans`.
  - Run a check with a problem, then move the clock 31 minutes, change the forecast and run a check without problems.
  - After: all of these are identical, and the plan's position in `GET /api/plans` is unchanged (spec FR-014, SC-006).
  
  Phase 6 adds the failure case.

### Frontend for User Story 1

- [x] T026 [P] [US1] Create `frontend/src/api/planCheckApi.ts` with `checkPlan(id, signal)` and `PlanCheckAnswer`, exactly as in contracts/plan-check-api.md "Browser API function":
  - 200 → `{ kind: "check", check }`; 401, 403, 404 and 429 → their kinds;
  - 503 → `weatherUnavailable` only when `failedService(response) === "forecast"` (reuse from `api/planStepAnswer.ts`);
  - anything else → `throw new ApiError(status)`;
  - `encodeURIComponent(id)` in the path.
  
  Test it in `frontend/src/tests/planCheckApi.test.ts`: each mapped status, a 503 from another service throws, a 500 throws, and the path and method.
- [x] T027 [P] [US1] Create `frontend/src/helpers/planProblemText.ts`:
  - `planProblemText(problem: PlanProblem): string`. In this phase it covers the reasons for `wind`, `rain`, `cold` and `heat`, word for word as in spec User Story 3 scenarios 1 to 3. Numbers are written as JavaScript writes them (`9`, `8.5`), as `scheduleWeatherText` does (research section 11).
  - `planCheckSummaryText(entries: PlanCheckEntry[]): string`: "<n> problem(s) in <m> of <k> scheduled activities." `n` counts problems, `m` entries with problems, and `k` entries that are not `past`. Use "problem" when n = 1 and "problems" otherwise, and "activity" when k = 1 and "activities" otherwise (spec FR-009).
  - `checkedNoteText(forecastUpdatedAt: string): string`: "Checked against the forecast updated at HH:MM."
  - `noProblemsText`: the constant "✓ No problems found. Your plan fits the current forecast."
  
  A switch on `rule` with an exhaustive `never` check. Test it in `frontend/src/tests/planProblemText.test.ts` with each text exactly as in the spec, and the summary "2 problems in 1 of 4 scheduled activities.", "1 problem in 1 of 1 scheduled activity." and a case with a past entry not counted in k.
- [x] T028 [P] [US1] In `frontend/src/stores/useSavedPlanStore.ts`, add `markGone: () => void`, which aborts any pending load and sets `{ status: "notFound", plan: null, controller: null }`. Add a test in `frontend/src/tests/useSavedPlanStore.test.ts`.
- [x] T029 [US1] Create `frontend/src/stores/usePlanCheckStore.ts`, following `useSavedPlanStore`'s abort, `startTimeout` and stale-answer pattern (data-model.md "usePlanCheckStore"):
  - State: `status` (`"idle" | "checking" | "checked" | "allPast" | "weatherUnavailable" | "tooManyRequests" | "serverError"`), `planId`, `result: PlanCheck | null`, `controller`.
  - `check(planId)`: does nothing while `status === "checking"`. Otherwise it sets `checking`, clears `result`, and calls `checkPlan`. It maps the answer:
    - `check` → `checked` or `allPast` with `result`;
    - `weatherUnavailable` and `tooManyRequests` → those statuses;
    - `notFound` → `idle` and `useSavedPlanStore.getState().markGone()`;
    - `unauthorized` and `forbidden` → `idle` and `void useCurrentUserStore.getState().refresh()`;
    - a thrown error, a network error or the timeout → `serverError`.
    
    The answer is dropped if the controller has changed.
  - `retry()` → `check(planId)` when a plan id is known.
  - `reset()` aborts and returns to the initial state.
  - Test it in `frontend/src/tests/usePlanCheckStore.test.ts`:
    - each mapping above;
    - a second `check` while checking sends one request;
    - `reset` during a request drops the late answer;
    - the 10-second timeout with fake timers gives `serverError`;
    - `retry` checks the same plan again;
    - a new check clears the previous `result`.
- [x] T030 [US1] Create `frontend/src/components/planCheckSection.tsx`:
  - `<section aria-labelledby="plan-check-heading">` with `<h2 id="plan-check-heading">Plan check</h2>`.
  - One `role="status"` element whose text follows `usePlanCheckStore`:
    - `checking` → "Checking your plan against the latest forecast…";
    - `checked` with no problems → the no-problem text;
    - `checked` with problems → the summary.
    
    Other statuses render nothing in this phase (Phases 6 and 7 add them).
  - With problems, a `<ul className="plan-problems">` follows the status element. It has one `<li>` per problem, in entry order and then problem order (which is date and start time order, research section 12). Each item is a link `<a href={`#scheduled-entry-${index}`}>`, where `index` is the entry's position, with the text "<activity>, <date> <start>–<end>: <reason>". The click handler calls `preventDefault()`, then `document.getElementById(...)?.focus()`.
  - Keep it under about 120 lines.
- [x] T031 [US1] Show the check results on the schedule entries (research section 14):
  - `frontend/src/components/scheduleView.tsx`: an optional `checks?: PlanCheckEntry[]` prop, aligned by index with `schedule.scheduled`. Keep each entry's original index when grouping by date, and pass `checks` and the indexes to `ScheduledDaySection`.
  - `frontend/src/components/scheduledDaySection.tsx`: with a check for an entry:
    - the `<li>` gets `id="scheduled-entry-<index>"` and `tabIndex={-1}`;
    - the weather span shows `scheduleWeatherText(check.weather)` when `check.weather` is not null;
    - when it has problems, it adds "✗ Problem" and a `<ul>` of `planProblemText` reasons.
    
    Without `checks`, the output is exactly as before. If the file passes about 100 lines, move the per-entry marks to `frontend/src/components/scheduledEntryCheck.tsx`.
- [x] T032 [US1] Change `frontend/src/components/savedPlanView.tsx`:
  - Render `<PlanCheckSection />` above `<ScheduleView>`.
  - The note: when `usePlanCheckStore` status is `checked`, show `checkedNoteText(result.forecastUpdatedAt)`; otherwise show the existing "This is your plan as saved on …" text (spec FR-011, FR-013).
  - Pass `checks={result.entries}` to `ScheduleView` only when the status is `checked`, `result.entries.length === plan.scheduled.length` and `result.savedAt === plan.savedAt`. Otherwise show the "as saved on" note as well.
  - Update the header comment: the page now checks the plan against the latest forecast (feature 012), while the plan itself is still shown exactly as saved.
- [x] T033 [US1] Change `frontend/src/pages/PlanDetailsPage.tsx`:
  - In the `planId` effect, call `void usePlanCheckStore.getState().check(planId)` right after `store.load(planId)`, and `usePlanCheckStore.getState().reset()` in the cleanup.
  - Add an effect: when the plan is loaded, the check status is `checked` or `allPast`, and `result.savedAt !== plan.savedAt`, call `useSavedPlanStore.getState().load(planId)` and then `usePlanCheckStore.getState().check(planId)` (research section 12).
    - Do this **at most once per page opening**: keep a `useRef(false)` flag that is set when the reload starts and reset only when `planId` changes.
    - If the second answer still differs, keep the plan as loaded and do not pass `checks` to the schedule: `savedPlanView.tsx` already shows no marks unless the entry counts match, and here it must also require `result.savedAt === plan.savedAt`. The "as saved on" note stays. This way a format difference between the two endpoints can never make the page reload forever.
  - Replace the header comment's "Recalculating comes with feature 012. Opening it never generates a schedule or calls the weather or map data services." with: opening it checks the saved plan against the latest forecast (feature 012) and never generates a schedule or changes the plan.
  - Keep the page under about 160 lines.
- [x] T034 [US1] Give every existing test that opens a plan page a check route:
  - In `frontend/src/tests/savedPlansFixtures.ts`, add ``[`GET /api/plans/${savedPlanId}/check`]: () => jsonResponse(200, planCheckNoProblems)`` to `savedPlanRoutes`.
  - Search `frontend/src/tests/` for every other ``GET /api/plans/<id>`` route that renders a plan page (for example, the copy's page in the duplicate tests in `PlanDetailsPage.test.tsx`, `keyboard.test.tsx` and `editingNotice.test.tsx`), and add a matching `/check` route that returns a no-problem check for that plan.
  - Change no assertion in this task. Run `npm test`: any test that still fails because of an unexpected request gets the route. Any other failure is investigated, not hidden.
- [x] T035 [US1] Create `frontend/src/tests/planCheckSection.test.tsx` and add US1 cases to `frontend/src/tests/PlanDetailsPage.test.tsx`:
  - The region has the heading "Plan check" and is labelled by it.
  - "Checking your plan against the latest forecast…" is in a status element while the check is pending, and the saved plan is already shown.
  - The no-problem text, and the note "Checked against the forecast updated at 14:05.".
  - With a wind problem: the summary, the list item text "Kayaking, 2026-11-21 10:00–12:00: Wind up to 9 m/s at 11:00, more than your limit of 8 m/s.", the entry's "✗ Problem" and reason, and the latest weather on the entry.
  - Selecting the problem's link moves focus to the entry `#scheduled-entry-0`.
  - A check whose `savedAt` differs loads the plan and checks it again (two `GET /api/plans/<id>` requests).
  - A check whose `savedAt` still differs after that reload causes no further request (exactly two `GET /api/plans/<id>` and two checks). The schedule shows no marks, and the "as saved on" note is shown.
  - A check answer that arrives after leaving the page changes nothing and throws nothing.
  - The Schedule Overview (`ScheduleOverviewPage.test.tsx`) passes unchanged, so it has no ids or marks.
- [x] T036 [US1] Run all backend and frontend checks. All must pass.
  - Result (2026-11-20):
    - **Backend**: build with 0 warnings; 719 unit tests (+38 since T015) and 397 integration tests (+6); `dotnet format` clean.
    - **Frontend**: lint, Prettier and type check clean; 91 files and 1286 tests (+4 files, +46 tests); build clean.
    - **Sizes**: `PlansController` 153, `PlanCheckRules` 78, `PlanWeatherRules` 47, `PlanCheckService` 48 lines; `PlanDetailsPage.tsx` 152, `scheduledDaySection.tsx` 72, `usePlanCheckStore.ts` 101 lines.
  - **Changes to existing tests (T034)**: check routes were added to the plan page tests in `PlanDetailsPage.test.tsx` and `editingNotice.test.tsx`, and to `savedPlanRoutes`. One feature 010 test, "shows the plan's name, breadcrumbs, setup, saved time and note", now leaves the check unanswered: the "as saved on" note it asserts is shown only until a check succeeds (spec FR-011, FR-013). Its assertions are unchanged.
  - **Decided while implementing**:
    - `PlanCheckSection` receives the check of the shown schedule from `SavedPlanView`, rather than reading the store's result directly. The region, the marks and the note then always agree, also when a check is of another version of the plan (research section 12).
    - `scheduledEntryId` lives in `helpers/planProblemText.ts`, because the `react-refresh/only-export-components` lint rule does not allow a component file to export a function.
    - The check test helpers (`CalmForecast`, `CheckAsync`, the plan date) are in `SavedPlanSeed.cs`, shared by the four check test classes.
    - The T035 page tests use this file's Cycling plan, so the example text is "Cycling, 2026-11-21 10:00–13:00: Wind up to 9 m/s …" instead of Kayaking.

**Checkpoint**: Opening a saved plan shows weather limit problems or "No problems found". MVP reached.

---

## Phase 4: User Story 2 - Recalculate on demand (Priority: P1)

**Goal**: **Recalculate** checks the plan again; one check at a time.

**Independent Test**:

1. Open a plan with no problem.
2. Change the forecast so one activity gets rain above its limit, and wait past the 30-minute reuse time.
3. Select **Recalculate**: the rain problem is listed.

- [x] T037 [US2] In `frontend/src/components/planDetailsActions.tsx`, add a `<button type="button" className="plan-recalculate">Recalculate</button>` between `<EditPlanButton>` and **Rename** (spec FR-017):
  - It calls `usePlanCheckStore.getState().check(plan.id)`.
  - It is `disabled` while the status is `checking`.
  - It is not rendered when the status is `allPast`.
- [x] T038 [US2] Add backend tests to `backend/tests/SpekLaiku.IntegrationTests/PlanCheckEndpointTests.cs`:
  - `SecondCheckWithin30Minutes_ReusesTheForecast`: one weather call for two checks, and the same `forecastUpdatedAt`.
  - `CheckAfter30Minutes_AsksAgainAndSeesTheNewForecast`: the spec's independent test, with rain added after the first check, the clock moved 31 minutes, and the rain problem listed with a new `forecastUpdatedAt`.
- [x] T039 [US2] Add tests to `frontend/src/tests/PlanDetailsPage.test.tsx`:
  - The actions in order: Edit plan, Recalculate, Rename, Duplicate, Delete (`getAllByRole("button")` in the actions paragraph).
  - Selecting **Recalculate** sends a second check, announces the loading text, and the new result replaces the old one.
  - **Recalculate** is disabled while checking, and two quick selections send one request.
  - Change the feature 010 test "offers no save or recalculate action and generates nothing": it now asserts that there is no **Save plan** and that nothing is generated. **Recalculate** is now offered on purpose (spec FR-017). Record this change for T066.
  - Update the feature 011 test "offers Edit plan first among the plan's actions" only if it asserts the full list; Edit plan must still be first.
- [x] T040 [US2] Run all checks.
  - Result (2026-11-20):
    - **Backend**: build with 0 warnings; 719 unit and 399 integration tests (+2); `dotnet format` clean.
    - **Frontend**: lint and type check clean; 91 files and 1290 tests (+4); build clean.
  - **Changed existing tests**, both because **Recalculate** is added on purpose (spec FR-017):
    - The feature 010 test "offers no save or recalculate action and generates nothing" is now "offers no save action and generates nothing". It no longer asserts that Recalculate is absent; its other assertions are unchanged.
    - The feature 011 test "offers Edit plan first among the plan's actions" asserts the full list of actions, which now includes Recalculate after Edit plan. Edit plan is still first.
  - **Decided while implementing**: Recalculate uses the real `disabled` attribute while checking, as Duplicate, Delete and Save already do. A disabled button loses keyboard focus, so focus returns to Recalculate when the check it started has ended (tested), in the same way Rename gets focus back when its form closes.

**Checkpoint**: Recalculate works and cannot run twice at once.

---

## Phase 5: User Story 3 - Know the reason for each problem (Priority: P1)

**Goal**: Every rule of FR-005 gives its reason: missing forecast, daylight, overlap and travel join the weather limits.

**Independent Test**: With fake forecasts, make one activity break each rule in turn (wind, rain, too cold, too warm, missing hour, before sunrise, after sunset, an overlap and a trip over the maximum). Each reason text of spec User Story 3 is shown.

### Backend for User Story 3

- [x] T041 [US3] Extend `backend/src/SpekLaiku.Api/Services/PlanWeatherRules.cs`:
  - **NoForecast**: for an Outdoor activity, the first entry hour with any null value gives `PlanProblem(NoForecast, Time: hour.Start)`. An hour of the entry that is missing from `day.Hours` counts as missing too, with `Time` set to that hour's start.
  - **Daylight**: when `activity.RequiresDaylight`:
    - if the entry's first hour has `Daylight == false`, add `PlanProblem(BeforeSunrise, Time: entry.StartTime, SunTime: day.Sunrise)`;
    - if its last hour has `Daylight == false`, add `PlanProblem(AfterSunset, Time: entry.EndTime, SunTime: day.Sunset)`.
    
    Both can occur (research section 6).
  - Return everything in `PlanRule` order.
- [x] T042 [US3] Add tests to `backend/tests/SpekLaiku.UnitTests/PlanWeatherRulesTests.cs`:
  - `MissingValue_GivesNoForecastAtTheFirstSuchHour`;
  - `MissingHour_GivesNoForecast`;
  - `IndoorWithMissingValues_GetsNoNoForecast`;
  - `StartBeforeSunrise_GivesBeforeSunriseWithBothTimes`;
  - `EndAfterSunset_GivesAfterSunsetWithBothTimes`;
  - `BothEndsOutsideDaylight_GivesBoth`;
  - `IndoorRequiringDaylight_GetsDaylightProblemsOnly`;
  - `ActivityNotRequiringDaylight_GetsNoDaylightProblem`;
  - `AllRules_AreInRuleOrder`.
- [x] T043 [US3] Extend `backend/src/SpekLaiku.Api/Services/PlanCheckRules.cs` (research section 7):
  - **Overlap**: for each checked entry, every other entry on the same date (past ones included) with `start < otherEnd && otherStart < end` adds `PlanProblem(Overlap, OtherActivityName, OtherStartTime, OtherEndTime)`, ordered by the other entry's start.
  - **Travel**: a checked entry whose saved `Travel?.OverLimit == true` adds `PlanProblem(Travel, Value: Travel.DistanceKm, Limit: snapshot.Schedule.Travel.MaxDistanceKm, FromPlaceName: Travel.FromPlaceName)`.
  - Append these after the weather and daylight problems, so the order stays the `PlanRule` order.
  - Keep the file under 200 lines. If it passes about 150, move overlap and travel into `PlanScheduleRules.cs`.
- [x] T044 [US3] Add tests to `backend/tests/SpekLaiku.UnitTests/PlanCheckRulesTests.cs`:
  - `OverlappingEntries_EachGetAnOverlapWithTheOther`;
  - `TouchingEntries_DoNotOverlap` (10:00–12:00 and 12:00–14:00);
  - `EntriesOnDifferentDates_DoNotOverlap`;
  - `PastEntry_StillOverlapsACheckedOne_ButGetsNoProblemItself`;
  - `SavedTripOverTheLimit_GivesTravelWithDistancePlaceAndMaximum`;
  - `SavedTripWithinTheLimit_GivesNoProblem`;
  - `PastPreviousActivity_IsStillTheTripsStart` (the saved leg is used as is);
  - `SeveralRulesOnOneEntry_AreEachListed`.
- [x] T045 [US3] Add `RuleScenarios` to `backend/tests/SpekLaiku.IntegrationTests/PlanCheckEndpointTests.cs` (spec SC-002). One seeded plan per rule, each with its own location, through the real endpoint:
  - wind, rain, cold and heat;
  - a missing hour (`WithHour` with null values);
  - before sunrise (sunrise scripted after the start) and after sunset;
  - an overlap (two seeded entries that overlap);
  - travel over the limit (a seeded `TravelLeg(…, OverLimit: true)`).
  
  Each asserts the exact problem fields from the contract table. A plan that breaks none returns no problems.

  Also add `CategoryLimitsChangedAfterSaving_TheSavedLimitsApply` (spec Edge Cases):
  1. Seed a plan whose activity uses a real category id from the database, with a wind limit of 8.
  2. Lower the category's own `MaxWindMs` to 2 directly in `ApplicationDbContext`.
  3. Script 5 m/s wind.
  4. The check returns no wind problem.
  
  Restore the category's value in a `finally` block, because the categories are shared by the collection.

### Frontend for User Story 3

- [x] T046 [P] [US3] Complete `frontend/src/helpers/planProblemText.ts` with the reasons for `noForecast`, `beforeSunrise`, `afterSunset`, `overlap` and `travel`, word for word as in spec User Story 3 scenarios 4 to 7:
  - "No forecast for HH:MM."
  - "Starts at HH:MM, before sunrise at HH:MM."
  - "Ends at HH:MM, after sunset at HH:MM."
  - "Overlaps with <other activity> (HH:MM–HH:MM)."
  - "Travel of <distance> km from <previous place>, more than your <maximum> km limit."
  
  Add a test per text to `frontend/src/tests/planProblemText.test.ts`, and one where an entry with three reasons counts as three problems in one activity (spec Edge Cases).
- [x] T047 [US3] Add tests to `frontend/src/tests/PlanDetailsPage.test.tsx`:
  - An entry with several reasons shows each under "✗ Problem".
  - The problem list over two dates is in date and start time order.
  - A plan with an unscheduled activity: the "Could not be scheduled" list is shown exactly as saved, with no "✗ Problem" and no "Already past. Not checked." in it (spec Edge Cases).
- [x] T048 [US3] Run all checks.
  - Result (2026-11-22):
    - **Backend**: build with 0 warnings; 736 unit (+17) and 409 integration tests (+10); `dotnet format` clean.
    - **Frontend**: lint and type check clean; 91 files and 1299 tests (+9); build clean.
  - **Decided while implementing**:
    - `PlanWeatherRules` walks the entry hour by hour from its start, so an hour missing from the latest forecast is a `NoForecast` at that hour. A missing hour gives no daylight problem: there is no daylight flag to read.
    - An entry's problem list is built as weather and daylight first, then overlaps and travel, which is already the `PlanRule` order. `PlanCheckRules.cs` stays at 111 lines, so overlap and travel were not moved out.
    - The travel reason writes the distance with `kmText`, one decimal place ("Travel of 40.0 km from …"), as the schedule's travel line does (feature 009).

**Checkpoint**: Every rule is detected and worded.

---

## Phase 6: User Story 4 - Keep my saved plan when the forecast cannot be updated (Priority: P1)

**Goal**: A weather failure, a server failure or the request limit shows its error with **Retry**. The saved plan stays on screen exactly as saved.

**Independent Test**:

1. Make the fake weather service fail and open a plan. The error and **Retry** are shown, with the saved weather and the "as saved on" note and nothing listed.
2. Make the service answer and select **Retry**.

- [x] T049 [US4] Create `backend/tests/SpekLaiku.IntegrationTests/PlanCheckFailureTests.cs`:
  - `WeatherFailure_Returns503ForTheForecast`: a `[Theory]` over every `FailureKind` scripted with `factory.Forecast.ScriptFailure`. It expects 503 with `service: "forecast"` and the detail of `ApiExceptionHandler`. Logging the failure belongs to the real client and is already covered by `OpenMeteoForecastClientTests`. The check adds no logging of its own, and no user id or email is logged (spec FR-016).
  - `AfterRecovery_TheCheckSucceeds`: `ScriptRecovery`, then 200.
  - `OverTheLimit_Returns429AndDoesNotCallTheWeatherService`: build a host with a low limit as `PlanSetupRateLimitTests.CreateHost` does (copy its pattern, `permitLimit: "2"`). Two checks, then a third gives 429 with the contract body, and the host's own fake forecast client was called at most twice. Also add a `CapturingLoggerProvider` (the integration test helper of the same name) to that host's logging, Assert that no entry at `Warning` level or above was written for the refused request (spec FR-015: a refused check MUST NOT be recorded as a service failure):
  - Take the number of `Entries` before the third request.
  - After it, none of the new entries may contain `" Warning:"`, `" Error:"` or `" Critical:"`. That is the `"{category} {level}: …"` format the provider writes.
- [x] T050 [US4] Add `FailedCheck_LeavesThePlanUnchanged` to `backend/tests/SpekLaiku.IntegrationTests/PlanCheckUnchangedTests.cs`: a check that fails with 503 leaves the snapshot JSON, `SavedAtUtc`, `CreatedAtUtc` and `Name` identical (spec NFR-008, SC-003).
- [x] T051 [US4] In `frontend/src/components/planCheckSection.tsx`, render the error states (spec FR-013, FR-015):
  - `weatherUnavailable` → "Error: The forecast could not be updated. Your saved plan is unchanged.";
  - `serverError` → "Error: Something went wrong. Try again.";
  - `tooManyRequests` → "Error: Too many requests. Wait a minute and try again.".
  
  Each is in a `role="alert"` paragraph with a **Retry** button that calls `usePlanCheckStore.getState().retry()`. The status element is then empty. No problem list is shown.
- [x] T052 [US4] Add tests to `frontend/src/tests/PlanDetailsPage.test.tsx`:
  - Each of the three errors with **Retry**: the saved weather, the "This is your plan as saved on …" note, and no "✗ Problem" anywhere.
  - **Retry** after the weather error shows the result.
  - A **Recalculate** that fails after a successful check shows the saved weather and the "as saved on" note again.
- [x] T053 [US4] Run all checks.
  - Result (2026-11-22):
    - **Backend**: build with 0 warnings; 736 unit and 416 integration tests (+7); `dotnet format` clean.
    - **Frontend**: lint and type check clean; 91 files and 1304 tests (+5); build clean.
  - **Decided while implementing**:
    - The request limit test signs in on its own low-limit host. Its first check asks the weather service and the second reuses the cached answer, so the third is the refused one.
    - The error texts live in `planCheckSection.tsx`, as `placesAndForecastStatus.tsx` keeps its own, and use `formatErrorMessage` for the "Error: " prefix. The error box uses the existing `server-error` class.

**Checkpoint**: Failures never show outdated data as current, and the plan is never changed.

---

## Phase 7: User Story 5 - Plans in the past are not checked (Priority: P2)

**Goal**: Started activities are shown as "Already past. Not checked.". A plan whose activities have all started is not checked at all, and the weather service is not contacted.

**Independent Test**:

1. With a fixed clock, open a plan with entries yesterday and tomorrow. Yesterday's entries show "Already past. Not checked." and tomorrow's are checked.
2. Open a plan whose dates have all passed. "This plan's dates have passed. It is not checked against the forecast." is shown, and the weather service is not called.

- [x] T054 [US5] In `backend/src/SpekLaiku.Api/Services/PlanCheckService.cs`, after reading `now`, return early when every scheduled entry's start instant is at or before `now`. The result is `PlanCheckResult.Of(new PlanCheck(plan.SavedAtUtc, AllPast: true, ForecastUpdatedAt: null, entries))`, where `entries` comes from `PlanCheckRules.Check(snapshot, [], now)`, so every entry is `Past`. The weather service is not called (spec FR-006, SC-005). Use `PlanCheckRules.StartInstant` (T018) for "has started", so the service and the rules use the same rule.
- [x] T055 [US5] Add tests to `backend/tests/SpekLaiku.IntegrationTests/PlanCheckEndpointTests.cs`:
  - `PartlyPastPlan_ChecksOnlyTheActivitiesAhead`: the spec's independent test, with entries on 2026-11-09 and 2026-11-12 and the clock on 2026-11-10.
  - `PlanWithEveryActivityStarted_IsAllPastAndCallsNoWeatherService`: `status: "allPast"`, `forecastUpdatedAt: null`, every entry `past`, and `factory.Forecast.Calls` unchanged.
  - `ActivityThatStartedButHasNotEnded_IsPast`: the clock is inside the entry.
- [x] T056 [US5] Show past entries and past plans in the frontend:
  - `frontend/src/components/scheduledDaySection.tsx`: an entry whose check is `past` keeps its saved weather and shows the plain text "Already past. Not checked." (spec FR-010).
  - `frontend/src/components/planCheckSection.tsx`: `allPast` → "This plan's dates have passed. It is not checked against the forecast." in the status element.
  - `frontend/src/components/savedPlanView.tsx`: for `allPast`, pass `checks` too (so entries show "Already past. Not checked."), and keep the "as saved on" note, because no forecast was used.
  - The summary already leaves past entries out of k (T027).
- [x] T057 [US5] Add tests to `frontend/src/tests/PlanDetailsPage.test.tsx`:
  - A partly past plan: the past entry shows "Already past. Not checked." with its saved weather; the summary counts only the checked entries.
  - An `allPast` plan: the message, no **Recalculate**, and every entry shows "Already past. Not checked.".
- [x] T058 [US5] Run all checks.
  - Result (2026-11-22):
    - **Backend**: build with 0 warnings; 736 unit and 419 integration tests (+3); `dotnet format` clean.
    - **Frontend**: lint and type check clean; 91 files and 1306 tests (+2); build clean.
  - **Decided while implementing**:
    - `savedPlanView.tsx` now tells apart a check against a forecast (`checked`, which sets the "Checked against …" note) from the result that is shown (`shown`, which also includes `allPast`). An all-past plan therefore marks every entry as past but keeps the "as saved on" note.
    - The early return relies on data-model.md: a saved plan always has at least one scheduled entry, so an empty schedule never counts as "all past".

**Checkpoint**: Past activities and past plans are handled without a weather call.

---

## Phase 8: User Story 6 - Only the owner can check their plan (Priority: P1)

**Goal**: The server refuses everyone but the owner before any external call, and the page reacts to each refusal.

**Independent Test**: Request the check as the owner, another Active Registered User, a Visitor, an Administrator, a Suspended user, and for a deleted plan. Only the owner gets a result, and the weather service is contacted only for the owner.

- [ ] T059 [US6] Create `backend/tests/SpekLaiku.IntegrationTests/PlanCheckAuthorizationTests.cs` (constitution III). Each test seeds a plan for an owner from `CreateSignedInUserAsync`, records `factory.Forecast.Calls`, and asserts that the count is unchanged after the request:
  - `Owner_GetsTheCheck` (here the count goes up by one; the control case);
  - `Visitor_Gets401`;
  - `Administrator_Gets403`;
  - `SuspendedUser_Gets403`;
  - `AnotherRegisteredUser_Gets403WithNoPlanData`: the body contains neither the plan's name, its location name nor any activity name;
  - `UnknownPlan_Gets404WithTheMessage`: "This plan no longer exists.";
  - `DeletedPlan_Gets404`: delete it with `DELETE /api/plans/{id}` first;
  - `IdThatIsNotAGuid_Gets404`.
- [ ] T060 [US6] Add tests to `frontend/src/tests/PlanDetailsPage.test.tsx`:
  - `Recalculate` on a plan deleted elsewhere (the check answers 404) shows "This plan no longer exists." with the links to Home and My plans.
  - A check answering 401 refreshes the current user (a second `GET /api/auth/me`).
- [ ] T061 [US6] Run all checks.

**Checkpoint**: Access rules verified for the new endpoint.

---

## Phase 9: User Story 7 - Read the plan check with keyboard, screen reader and on a phone (Priority: P2)

**Goal**: The plan check is fully usable by keyboard, announced to screen readers, and fits 320 px.

**Independent Test**: At 320 px, using only the keyboard, open a plan with two problems, read the problems, follow a problem's link to its schedule entry, and select **Recalculate**, with no horizontal scrolling.

- [ ] T062 [US7] In `frontend/src/styles.css`, add a commented block "Plan check (feature 012)":
  - `.plan-problems`: a list without bullets whose items are cards with a border and padding, as the saved plan cards do on phones, with `overflow-wrap: anywhere`.
  - The "✗ Problem" reasons inside a schedule entry: a block below the entry's line that wraps.
  - `.plan-actions .plan-recalculate { flex-basis: 100%; }` below 40em, and `flex-basis: auto` inside the existing `@media (min-width: 40em)` block. The 44 px `min-height` every button has applies.
  - Reuse the existing colours. No mark relies on colour alone.
- [ ] T063 [US7] Add tests:
  - `frontend/src/tests/accessibility.test.tsx`: the plan page with problems has the labelled "Plan check" region and heading. Every problem link has an accessible name that includes the activity and the reason. The schedule entries with marks include "✗ Problem" in text.
  - `frontend/src/tests/keyboard.test.tsx`: Tab reaches each problem link in order, then Enter moves focus to `#scheduled-entry-<n>`. **Recalculate** is in the action order between Edit plan and Rename and works with Enter.
  - `frontend/src/tests/responsive.test.tsx`: at 320 px, `.plan-recalculate` gets full width and the problem cards wrap, as the existing checks for the other plan screens do.
  - Status messages: `planCheckSection.test.tsx` asserts that loading and results are in `role="status"` and errors in `role="alert"`, and that focus does not move when they appear (spec FR-018).
- [ ] T064 [US7] Run all checks.

**Checkpoint**: All stories done.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, full verification, review. No new behaviour.

- [ ] T065 [P] Update the documentation:
  - **`README.md`, "Saved plans" section**: replace "It is not recalculated and calls no weather or map service; recalculating comes with feature 012." with a **Plan check** bullet. It says:
    - opening a plan and **Recalculate** check it against the latest forecast (at most 30 minutes old);
    - the rules checked (the activity's own weather limits, a missing forecast, daylight, overlap and travel distance), each listed with its reason;
    - activities that have started are "Already past. Not checked.", and a plan in the past is not checked;
    - the saved plan is never changed;
    - a weather failure shows "Error: The forecast could not be updated. Your saved plan is unchanged." with **Retry**;
    - checks share the request limit of 30 per minute.
    
    Change the actions list to "Edit plan, Recalculate, Rename, Duplicate and Delete". Add `specs/012-plan-problems/quickstart.md` to the manual checks sentence and say that feature 012 adds no migration.
  - **`docs/ux-design.md`**:
    - Plan Details / Edit row: recalculating is now done (feature 012).
    - Plan Problems and Alternatives state table: add "Problems found" (the summary and the list), "Plan in the past" ("This plan's dates have passed. It is not checked against the forecast.") and "Too many requests". Keep "No alternative" and "Changes applied" for feature 013.
    
    Change nothing else. Check `docs/architecture.md` for statements that contradict the implementation, and correct only what is now wrong.
- [ ] T066 Run all checks and confirm they pass:
  - from the repository root: `dotnet build SpekLaiku.slnx`, `dotnet test SpekLaiku.slnx` and `dotnet format SpekLaiku.slnx --verify-no-changes`;
  - from `frontend/`: `npm run lint`, `npm test` and `npm run build`.
  
  Compare the test counts with T002. The only existing assertions allowed to change are:
  - T039: the feature 010 "offers no save or recalculate action" test, narrowed because **Recalculate** is added on purpose;
  - T034: test routes added for the check request (routes only, no assertion).
  
  List any change in the PR description (constitution III). Record the results here.
- [ ] T067 Walk through `specs/012-plan-problems/quickstart.md` Part 2, scenarios 1 to 7, in the running app (README "Run the application"). Record which passed and any that could not be done (for example, a plan could not be created because Overpass was unavailable; then use an existing or duplicated plan). Step 2's SQL changes only the local development database; ask the user before running it.
  - For spec SC-001 (result within 5 seconds), note in scenarios 1 and 3 how long the check takes from opening the plan or selecting **Recalculate** until the result is shown. Use the browser's network tab: the duration of `GET /api/plans/<id>/check`, once with a forecast that is not cached and once with a cached one. Record both times here. There is no automated load test (analysis finding C1).
- [ ] T068 Review `git diff main...HEAD` and confirm:
  - only the files in plan.md "Source Code", plus the README, docs and spec files, changed;
  - there is no debug code, commented-out code or temporary file;
  - every new or changed C# class is under 200 lines (`PlansController`, `PlanCheckRules`, `PlanWeatherRules`, `PlanCheckService`, `HourSuitabilityRules`, `PlanScheduler`);
  - `PlanDetailsPage.tsx`, `scheduledDaySection.tsx`, `planCheckSection.tsx` and `usePlanCheckStore.ts` are each under about 200 lines;
  - no migration was added, and `ScheduledActivityResponse` is unchanged.
  
  Record the result here.
- [ ] T069 Run a separate AI-assisted review of the branch: `/code-review`, and `/security-review`, because this feature adds an endpoint behind access control that calls an external service. Record:
  - the tool;
  - the important findings;
  - the changes made;
  - the findings not applied, each with a short reason.
  
  These go in the Pull Request description (constitution VII). Apply the accepted fixes and re-run T066.
- [ ] T070 Capture screenshots for the Pull Request (constitution V), at desktop width and at 320 px:
  - a plan with no problems;
  - a plan with problems and marked entries;
  - the weather error with **Retry**;
  - a past plan.
  
  Keep the images outside the repository unless the README already stores screenshots.
- [ ] T071 Prepare the Pull Request description for the user. Include:
  - a link to `specs/012-plan-problems/spec.md`;
  - a summary of the change;
  - the tests and checks run (T066, T067);
  - "no migration", and the new optional `activityIndex` in the stored snapshot JSON (research section 4);
  - the spec changes made during clarification and planning (Q1, Q2, and the focus target in User Story 7 and FR-018);
  - the changed feature 010 test (T039);
  - the screenshots;
  - the AI review record from T069.
  
  The user opens and merges the Pull Request.

**Checkpoint**: All checks green, docs current, review recorded, screenshots and PR description ready. Ready for commit and Pull Request on request.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Setup): no dependencies.
- **Phase 2** (Foundational): depends on Phase 1. Blocks all story phases.
- **Phase 3** (US1): depends on Phase 2. It creates the endpoint, service, rules, store, section and page wiring that every later story extends.
- **Phase 4** (US2): depends on Phase 3 (store and page).
- **Phase 5** (US3): depends on Phase 3 (`PlanWeatherRules`, `PlanCheckRules`, `planProblemText.ts`).
- **Phase 6** (US4): depends on Phase 3 (endpoint, store, section). T050 extends T025.
- **Phase 7** (US5): depends on Phase 3. T057 checks that **Recalculate** is hidden, so it also needs Phase 4.
- **Phase 8** (US6): depends on Phase 3 (endpoint) and Phase 4 (T060 uses **Recalculate**).
- **Phase 9** (US7): depends on Phases 3 to 7 (all visible states exist).
- **Phase 10** (Polish): depends on all story phases.

### User Story Dependencies

- **US1 (P1)**: foundation only. It is the MVP: opening a plan shows weather problems or "No problems found".
- **US2 (P1)**: adds a button over US1's store.
- **US3 (P1)**: extends US1's rule classes and text helper. It is independent of US2.
- **US4 (P1)**: error states over US1. It is independent of US2 and US3.
- **US5 (P2)**: the early return and the past texts over US1. It uses US2's button for one assertion.
- **US6 (P1)**: verifies US1's endpoint. It is placed after US5 so the authorization tests run against the finished service.
- **US7 (P2)**: cross-checks all new screens.

### Within Each Phase

- Backend records and rules come before services, services before the controller, and the controller before endpoint tests.
- Frontend types come before the API, then helpers, stores, components, the page, and page tests.
- Each phase ends with its tests green before the next phase starts.

## Parallel Opportunities

- **Phase 2**:
  - T003, T004, T011, T012, T013 and T014 touch different files.
  - T008, T009 and T010 can run in parallel after T007.
  - The backend (T003 to T012) and the frontend (T013, T014) can run side by side.
- **Phase 3**: the frontend T026, T027 and T028 can run in parallel with each other and with the whole backend part (T016 to T025).
- **Phase 5**: T046 (frontend texts) in parallel with T041 to T045 (backend).
- **Phase 6**: T049 and T050 (backend) in parallel with T051 and T052 (frontend).
- **Phase 10**: T065 is independent of the code checks.

### Parallel Example: Phase 3 (User Story 1)

```text
Task: "T016 [US1] PlanWeatherRules (weather limits) in backend/src/SpekLaiku.Api/Services/PlanWeatherRules.cs"
Task: "T026 [P] [US1] checkPlan in frontend/src/api/planCheckApi.ts with its test"
Task: "T027 [P] [US1] frontend/src/helpers/planProblemText.ts with its test"
Task: "T028 [P] [US1] markGone in frontend/src/stores/useSavedPlanStore.ts"
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 → Phase 2 (stop for review).
2. Phase 3: open a plan and see weather problems or "No problems found" (stop for review).
3. **Validate**: the spec's User Story 1 independent test passes in `PlanCheckEndpointTests`, and the plan page shows the problem, the marked entry and the "Checked against…" note.

### Incremental Delivery

1. Phase 4 (US2): Recalculate.
2. Phase 5 (US3): all reasons.
3. Phase 6 (US4): failures and the request limit.
4. Phase 7 (US5): past activities and past plans.
5. Phase 8 (US6): authorization verified.
6. Phase 9 (US7): keyboard, screen reader and phone.
7. Phase 10: docs, verification, review, PR.

Each phase is a stop point for diff review. Commits use Conventional Commit messages (for example `feat(plans): check a saved plan against the latest forecast`) and are made only when the user asks.
