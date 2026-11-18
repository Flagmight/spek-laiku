# Tasks: Save and View Plans

**Input**: Design documents from `specs/010-save-view-plans/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/plans-api.md ✓, contracts/plan-schedule-api.md ✓, quickstart.md ✓

**Tests**: Required. Constitution III makes automated backend and frontend tests mandatory for every feature, including an authorization test for each protected operation. Each story phase includes its tests.

**Organization**:

- Phase 1 is setup.
- Phase 2 is the shared foundation: the authorization policy, the two tables and the migration, the snapshot, and remembering generated schedules. After it, the app behaves exactly as before, except that the schedule response carries `generatedScheduleId`.
- Phases 3 to 9 are one phase per user story, in priority order.
- Phase 10 is polish.

Each phase ends at a reviewable checkpoint. Stop after each phase for a diff review; commit and push only on request.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on other incomplete tasks in this phase)
- **[Story]**: Which user story this task belongs to ([US1] to [US7])

## Shared test notes

- Integration tests share one `PostgreSqlApiFactory` (collection `PostgreSqlCollection.Name`), and that includes `factory.Clock`. A test that moves `factory.Clock.UtcNow` must restore it in a `finally` block.
- Each test creates its own users with `factory.CreateSignedInClientAsync(role, status)` or `factory.CreateUserAsync()`, so tests never see each other's plans.
- To get a `generatedScheduleId` in an integration test, call `POST /api/plan-schedule` with the same scripted place, forecast and places that `PlanScheduleEndpointTests` uses. One indoor activity (Heritage site) is always scheduled. For "nothing scheduled", use an outdoor activity with limits the fake forecast never meets.
- Frontend: the Vitest cold start may fail the first `npm test` of a session with "Failed to start forks worker". Re-run it once before investigating.

---

## Phase 1: Setup

**Purpose**: Branch ready, baseline green.

- [x] T001 Confirm the branch `010-save-view-plans` (already created) is based on the current `origin/main`. Run `git fetch`, then `git log origin/main..HEAD` and `git log HEAD..origin/main`: they should show only this feature's spec files and no missing commits.
- [x] T002 Run `dotnet build SpekLaiku.slnx` and `dotnet test SpekLaiku.slnx` from the repository root, and `npm run lint`, `npm test` and `npm run build` from `frontend/`. Confirm all pass before changing any code. Record the test counts for comparison in T075.
  - Baseline (2026-11-18): backend 626 unit and 274 integration tests; frontend 70 files and 979 tests (after one re-run for the known "Failed to start forks worker" cold start); lint and build clean.

**Checkpoint**: Branch is current, all checks green.

---

## Phase 2: Foundational (policy, storage, snapshot, generated schedule id)

**Purpose**: Everything every story needs: the `ActiveRegisteredUser` policy, the `SavedPlans` and `GeneratedSchedules` tables, the `PlanSnapshot` JSON format, and the schedule response's `generatedScheduleId`. There are no new endpoints or pages yet.

**⚠️ CRITICAL**: No user story work starts until this phase is complete and all tests pass.

### Authorization policy

- [x] T003 [P] Add `ActiveRegisteredUserRequirement : IAuthorizationRequirement` in `backend/src/SpekLaiku.Api/Authorization/ActiveRegisteredUserRequirement.cs`, following `PlanCreatorRequirement.cs`.
- [x] T004 Add `ActiveRegisteredUserHandler : AuthorizationHandler<ActiveRegisteredUserRequirement>` in `backend/src/SpekLaiku.Api/Authorization/ActiveRegisteredUserHandler.cs`.
  - It reads the account with `UserManager<ApplicationUser>.GetUserAsync(context.User)` on every request.
  - It succeeds only for `user is { Role: PlanCreatorHandler.RegisteredUserRole, AccountStatus: AccountStatus.Active }`.
  - It does not succeed for a Visitor; `RequireAuthenticatedUser` in the policy already gives 401.
  - Doc comment: spec FR-012, research section 7. (depends on T003)
- [x] T005 Add `public const string ActiveRegisteredUser = "ActiveRegisteredUser";` with a doc comment ("A signed-in account with the Registered User role and Active status; the owner of saved plans (feature 010 spec FR-012).") in `backend/src/SpekLaiku.Api/Authorization/AuthorizationPolicies.cs`. In `backend/src/SpekLaiku.Api/Program.cs`:
  - add `.AddPolicy(AuthorizationPolicies.ActiveRegisteredUser, policy => policy.RequireAuthenticatedUser().AddRequirements(new ActiveRegisteredUserRequirement()))` to the authorization builder;
  - register `builder.Services.AddScoped<IAuthorizationHandler, ActiveRegisteredUserHandler>();`. (depends on T004)
- [x] T006 [P] Add `backend/tests/SpekLaiku.UnitTests/ActiveRegisteredUserHandlerTests.cs`, following `PlanCreatorHandlerTests.cs`. Cover:
  - Active Registered User succeeds;
  - Suspended Registered User fails;
  - Active Administrator fails;
  - Suspended Administrator fails;
  - a signed-in principal whose account no longer exists fails;
  - an unauthenticated principal fails. (depends on T004)

### Snapshot and storage

- [x] T007 [P] Add `public sealed record PlanSnapshot(CheckedPlanSetup Setup, IReadOnlyList<CheckedPlanActivity> Activities, PlanSchedule Schedule);` in `backend/src/SpekLaiku.Api/Services/PlanSnapshot.cs`. Doc comment: "What a generated schedule and a saved plan store as JSON: the checked setup, the checked activities and the full schedule (feature 010 spec FR-003, research section 4). The records it contains are a storage format: renaming one of their members makes stored plans unreadable unless a data migration is added."
- [x] T008 [P] Add one line to the doc comment of each stored record, stating that it is "Stored as JSON in saved plans (feature 010 research section 4); do not rename members without a data migration." The records are in `backend/src/SpekLaiku.Api/Services/`: `CheckedPlanSetup.cs`, `CheckedPlanActivity.cs`, `PlaceLocation.cs`, `PlanSchedule.cs`, `ScheduledActivity.cs`, `UnscheduledActivity.cs`, `NearbyPlace.cs`, `WeatherSnapshot.cs`, `TravelLeg.cs` and `TravelSummary.cs`. No code change.
- [x] T009 Add `backend/src/SpekLaiku.Api/Data/PlanSnapshotConversion.cs`, a static class with:
  - `public static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };`
  - `public static ValueConverter<PlanSnapshot, string> Converter` (serialize and deserialize with `JsonOptions`);
  - `public static ValueComparer<PlanSnapshot> Comparer`, which compares the serialised strings and gets a hash code from the serialised string. (depends on T007)
- [x] T010 [P] Add `backend/tests/SpekLaiku.UnitTests/PlanSnapshotJsonTests.cs`, which builds a full `PlanSnapshot` with:
  - one Outdoor and one Indoor activity with all limits;
  - two dates;
  - one scheduled activity with `Travel = null` and one with a `TravelLeg`;
  - an indoor `WeatherSnapshot` with `null` values;
  - both `UnscheduledReason` values;
  - a `TravelSummary`.

  It writes the snapshot with `PlanSnapshotConversion.JsonOptions` and reads it back. Assert:
  - every member is equal (compare record by record, and lists element by element, since lists are not compared by value);
  - the JSON contains `"type":"Outdoor"` and the `UnscheduledReason` names, not numbers. (depends on T009)
- [x] T011 [P] Add the `SavedPlan` entity in `backend/src/SpekLaiku.Api/Entities/SavedPlan.cs`, with properties exactly as in data-model.md:
  - `Guid Id`;
  - `string OwnerId`;
  - `string Name` ("Trimmed, 1 to 80 characters, not unique");
  - `DateTime SavedAtUtc`;
  - `string LocationName`;
  - `List<DateOnly> Dates`;
  - `Guid? GeneratedScheduleId`;
  - `PlanSnapshot Snapshot`.
- [x] T012 [P] Add the `GeneratedSchedule` entity in `backend/src/SpekLaiku.Api/Entities/GeneratedSchedule.cs`: `Guid Id`, `DateTime CreatedAtUtc`, `DateTime ExpiresAtUtc` and `PlanSnapshot Snapshot`.
- [x] T013 Add `backend/src/SpekLaiku.Api/Data/SavedPlanConfiguration.cs`, following `ActivityCategoryConfiguration.cs`:
  - `ToTable("SavedPlans")`; key `Id` with `ValueGeneratedNever()`.
  - `OwnerId` is required, with `HasOne<ApplicationUser>().WithMany().HasForeignKey(plan => plan.OwnerId).OnDelete(DeleteBehavior.Cascade)`.
  - `Name` has `HasColumnType("varchar(80)").IsRequired()`. `LocationName` has `HasColumnType("varchar(200)").IsRequired()`. `Dates` is required (Npgsql maps it to `date[]`).
  - `Snapshot` uses `.HasConversion(PlanSnapshotConversion.Converter, PlanSnapshotConversion.Comparer).HasColumnType("jsonb").IsRequired()`.
  - Index `IX_SavedPlans_OwnerId_SavedAtUtc` on (`OwnerId`, `SavedAtUtc`) with `IsDescending(false, true)`.
  - Unique index `IX_SavedPlans_GeneratedScheduleId` on `GeneratedScheduleId`.

  (depends on T009, T011)
- [x] T014 Add `backend/src/SpekLaiku.Api/Data/GeneratedScheduleConfiguration.cs`:
  - `ToTable("GeneratedSchedules")`; key `Id` with `ValueGeneratedNever()`;
  - `Snapshot` as in T013;
  - index `IX_GeneratedSchedules_ExpiresAtUtc` on `ExpiresAtUtc`. (depends on T009, T012)
- [x] T015 In `backend/src/SpekLaiku.Api/Data/ApplicationDbContext.cs`:
  - add `public DbSet<SavedPlan> SavedPlans => Set<SavedPlan>();` and `public DbSet<GeneratedSchedule> GeneratedSchedules => Set<GeneratedSchedule>();`;
  - apply the two configurations in `OnModelCreating` after `ActivityCategoryConfiguration`. (depends on T013, T014)
- [x] T016 From `backend/` run `dotnet ef migrations add AddSavedPlans --project src/SpekLaiku.Api`. Review the generated `backend/src/SpekLaiku.Api/Migrations/<timestamp>_AddSavedPlans.cs`. It should contain:
  - the two tables;
  - `jsonb` and `date[]` columns;
  - the cascade foreign key to `AspNetUsers`;
  - the three indexes;
  - nothing else (in particular no change to `ActivityCategories` or Identity tables).

  Do not edit the `.Designer.cs` file. (depends on T015)
- [x] T017 Extend `backend/tests/SpekLaiku.IntegrationTests/DatabaseSchemaTests.cs`. Assert that:
  - `SavedPlans` and `GeneratedSchedules` exist;
  - `SavedPlans.Snapshot` and `GeneratedSchedules.Snapshot` are `jsonb`, `SavedPlans.Dates` is `date[]` and `SavedPlans.Name` is `character varying(80)`;
  - `IX_SavedPlans_GeneratedScheduleId` is unique;
  - deleting a user deletes their saved plans (cascade). (depends on T016)

### Remembering generated schedules

- [x] T018 Add `GeneratedScheduleService(ApplicationDbContext context, TimeProvider timeProvider)` in `backend/src/SpekLaiku.Api/Services/GeneratedScheduleService.cs`, with `public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(30);` and two methods:
  - `Task<Guid> RememberAsync(PlanSnapshot snapshot, CancellationToken)`:
    1. `now = timeProvider.GetUtcNow().UtcDateTime`;
    2. `await context.GeneratedSchedules.Where(s => s.ExpiresAtUtc <= now).ExecuteDeleteAsync(ct)`;
    3. add a `GeneratedSchedule { Id = Guid.NewGuid(), CreatedAtUtc = now, ExpiresAtUtc = now + Lifetime, Snapshot = snapshot }`, save, and return the id.
  - `Task<PlanSnapshot?> FindAsync(Guid id, CancellationToken)`: `AsNoTracking`; returns the snapshot only when a row with this id exists and `now < ExpiresAtUtc`, otherwise `null`.

  The doc comment names spec FR-004 and research sections 2 and 3, and says why `Guid.NewGuid()` and not version 7. Register it as scoped in `Program.cs`. (depends on T015)
- [x] T019 In `backend/src/SpekLaiku.Api/Services/PlanScheduleResult.cs`, add `public Guid? GeneratedScheduleId { get; private init; }` and change `Success` to `Success(PlanSchedule schedule, Guid? generatedScheduleId)`. In `backend/src/SpekLaiku.Api/Services/PlanScheduleService.cs`:
  - inject `GeneratedScheduleService`;
  - after building the `PlanSchedule`, call `RememberAsync(new PlanSnapshot(plan.Setup, plan.Activities, schedule), ct)` only when `schedule.Scheduled.Count > 0`, otherwise use `null`;
  - return `Success(schedule, id)`.

  Update the class doc comment with one sentence about it. The class must stay under 200 lines. (depends on T018)
- [x] T020 Add `Guid? GeneratedScheduleId` as the **first** field of `backend/src/SpekLaiku.Api/DTOs/Responses/PlanScheduleResponse.cs`. In `backend/src/SpekLaiku.Api/Controllers/PlanScheduleController.cs`, map the schedule as now and set the id with `mapper.Map<PlanScheduleResponse>(result.Schedule) with { GeneratedScheduleId = result.GeneratedScheduleId }`. Keep the profile free of rules. `PlanScheduleResponse` is a positional record, which AutoMapper fills through its constructor, and `PlanSchedule` has no `GeneratedScheduleId`. So add `.ForCtorParam(nameof(PlanScheduleResponse.GeneratedScheduleId), o => o.MapFrom(_ => (Guid?)null))` to the `PlanSchedule → PlanScheduleResponse` map in `backend/src/SpekLaiku.Api/Mapping/PlanScheduleMappingProfile.cs`. `ForMember(...).Ignore()` does not cover constructor parameters, and `AssertConfigurationIsValid` would fail. (depends on T019)
- [x] T021 Update the backend tests for the new constructor and field:
  - `backend/tests/SpekLaiku.UnitTests/PlanScheduleMappingTests.cs`: the configuration is still valid, and `GeneratedScheduleId` is not set by the map.
  - `backend/tests/SpekLaiku.IntegrationTests/PlanScheduleEndpointTests.cs`: only `ValidPlan_ReturnsTheContractBody` changes. It now expects the `generatedScheduleId` key, a GUID string when something is scheduled.
  - Any unit test that calls `PlanScheduleResult.Success`.

  (depends on T020)
- [x] T022 [P] Add `backend/tests/SpekLaiku.IntegrationTests/GeneratedScheduleTests.cs`:
  - (a) a schedule with one scheduled activity returns a `generatedScheduleId`, and one `GeneratedSchedules` row with that id exists, with `ExpiresAtUtc = CreatedAtUtc + 30 min`, and a snapshot whose `Schedule.Scheduled` matches the response;
  - (b) a plan where nothing is scheduled returns `"generatedScheduleId": null` and adds no row;
  - (c) two generations return two different ids;
  - (d) with `factory.Clock` moved 31 minutes ahead, the next generation deletes the earlier row (restore the clock in `finally`);
  - (e) `GeneratedScheduleService.FindAsync` (resolved from `factory.Services` in a scope) returns the snapshot before expiry and `null` at exactly `ExpiresAtUtc`. (depends on T019)
- [x] T023 [P] Add `generatedScheduleId: string | null` as the first member of `PlanSchedule` in `frontend/src/types/planSchedule.ts`, commented "The server remembers this schedule for 30 minutes so it can be saved (feature 010 contracts/plan-schedule-api.md); null when nothing was scheduled."
- [x] T024 Add `generatedScheduleId` to every schedule fixture in the frontend tests: a fixed GUID string when something is scheduled, `null` in the all-unscheduled fixtures. Find them with a search for `tripsOverLimit` in `frontend/src/tests/`. (depends on T023)
- [x] T025 Run `dotnet build SpekLaiku.slnx`, `dotnet test SpekLaiku.slnx` and `dotnet format SpekLaiku.slnx --verify-no-changes` from the repository root, and `npm run lint`, `npm test` and `npm run build` from `frontend/`. All must pass. The existing `PlanScheduleAuthorizationTests`, `PlanScheduleFailureTests` and `PlanScheduleTravelTests` must be green unchanged.

**Checkpoint**: Migration added. The schedule response carries `generatedScheduleId`. Nothing is visible to the user yet. All tests green.

---

## Phase 3: User Story 1 - Save the schedule I generated (Priority: P1) 🎯 MVP

**Goal**: An Active Registered User saves the shown schedule under a name. Validation, idempotency, expiry and errors work as in the spec.

**Independent Test**: Log in, generate a schedule, select "Save plan", enter "Weekend in Kaunas" and save. "✓ Success: Plan saved." is shown with a link to My plans, and one `SavedPlans` row exists for the user.

### Backend for User Story 1

- [x] T026 [P] [US1] Add a static `SavedPlanValidator` in `backend/src/SpekLaiku.Api/Services/SavedPlanValidator.cs`, with:
  - `public const string NameKey = "name"`, `ScheduleKey = "generatedScheduleId"`;
  - the messages `NameRequiredMessage = "Enter a plan name."`, `NameTooLongMessage = "Plan name can be at most 80 characters."`, `ScheduleExpiredMessage = "Generate the schedule again to save it."` and `NothingToSaveMessage = "There is nothing to save in this schedule."`;
  - `public const int MaxNameLength = 80`;
  - `static (string? TrimmedName, KeyValuePair<string,string>? Error) CheckName(string? name)`. The rule is "Required; after trimming, not empty", then "After trimming, at most 80 characters". Trim with `string.Trim()`.
- [x] T027 [P] [US1] Add `backend/tests/SpekLaiku.UnitTests/SavedPlanValidatorTests.cs`:
  - `null`, `""` and `"   "` give "Enter a plan name.";
  - 80 characters pass;
  - 81 characters give "Plan name can be at most 80 characters.";
  - `"  Weekend  "` gives `"Weekend"`;
  - 80 characters plus surrounding spaces pass (the length is checked after trimming);
  - `"<script>"` passes unchanged.
- [x] T028 [P] [US1] Add the result and DTO types:
  - `backend/src/SpekLaiku.Api/Services/SavePlanResult.cs`: a record with `Created(SavedPlan)`, `AlreadySaved(SavedPlan)` and `Invalid(IReadOnlyList<KeyValuePair<string,string>> errors)` factory methods, following `PlanScheduleResult`, with an `Outcome` enum `Created | AlreadySaved | Invalid`;
  - `backend/src/SpekLaiku.Api/DTOs/Requests/SavePlanRequest.cs`: `public sealed record SavePlanRequest(Guid? GeneratedScheduleId, string? Name);`, with a doc comment: "No owner field: the plan always belongs to the signed-in user (spec FR-013).";
  - `backend/src/SpekLaiku.Api/DTOs/Responses/SavedPlanSummaryResponse.cs`: `(Guid Id, string Name, string LocationName, IReadOnlyList<DateOnly> Dates, DateTimeOffset SavedAt)`.
- [x] T029 [P] [US1] Add `backend/src/SpekLaiku.Api/Services/SavedPlanSummary.cs` (`record SavedPlanSummary(Guid Id, string Name, string LocationName, IReadOnlyList<DateOnly> Dates, DateTime SavedAtUtc)`) and `backend/src/SpekLaiku.Api/Mapping/SavedPlanMappingProfile.cs`. The profile maps `SavedPlan → SavedPlanSummaryResponse` and `SavedPlanSummary → SavedPlanSummaryResponse`. The response is a positional record and its `SavedAt` parameter has no source member of the same name, so set it in each map with `.ForCtorParam(nameof(SavedPlanSummaryResponse.SavedAt), o => o.MapFrom(x => new DateTimeOffset(DateTime.SpecifyKind(x.SavedAtUtc, DateTimeKind.Utc))))`. Use `ForCtorParam`, not `ForMember`, because AutoMapper fills positional records through their constructor. There are no other rules.
- [x] T030 [US1] Add `SavedPlanService(ApplicationDbContext context, GeneratedScheduleService generatedSchedules, TimeProvider timeProvider)` in `backend/src/SpekLaiku.Api/Services/SavedPlanService.cs`, with `Task<SavePlanResult> SaveAsync(string ownerId, SavePlanRequest request, CancellationToken ct)`:
  1. Check the name with `SavedPlanValidator.CheckName` and collect its error.
  2. If `GeneratedScheduleId` is `null`, add the `generatedScheduleId` error "Generate the schedule again to save it.". Otherwise look for an existing `SavedPlan` with that `GeneratedScheduleId`:
     - same `OwnerId` and no name error → return `AlreadySaved(existing)`;
     - another owner → add the expired error.
  3. If not already saved, `generatedSchedules.FindAsync(id)`:
     - `null` → expired error;
     - `Schedule.Scheduled.Count == 0` → "There is nothing to save in this schedule.".
  4. Any error → `Invalid(errors)`, with name and schedule errors together.
  5. Otherwise add a `SavedPlan`:
     - `Id = Guid.NewGuid()`, `OwnerId = ownerId`;
     - `Name = trimmed`, `SavedAtUtc = now`;
     - `LocationName = snapshot.Setup.Location.Name`, `Dates = snapshot.Setup.Dates.ToList()`;
     - `GeneratedScheduleId = id`, `Snapshot = snapshot`.
  6. Save, catching `DbUpdateException` from the unique index `IX_SavedPlans_GeneratedScheduleId` (a race). In that case, detach the new entity, re-read the existing plan, and return `AlreadySaved` if it has the same owner, or `Invalid` with the expired error if not.
  7. Return `Created(plan)`.

  Register the service as scoped in `Program.cs`. Doc comment: spec FR-001 to FR-005 and FR-013, research section 6. (depends on T026, T028)
- [x] T031 [US1] Add `backend/src/SpekLaiku.Api/Controllers/PlansController.cs`: `[ApiController]`, `[Route("api/plans")]`, `[Authorize(Policy = AuthorizationPolicies.ActiveRegisteredUser)]`, with the constructor `(SavedPlanService service, UserManager<ApplicationUser> userManager, IMapper mapper)`. Add `[HttpPost] Save(SavePlanRequest request, CancellationToken ct)`:
  1. Get `ownerId = userManager.GetUserId(User)!`.
  2. Call `SaveAsync`.
  3. Map the result:
     - `Invalid` → `BadRequest(new ValidationProblemDetails(...))`, in the same shape as `PlanScheduleController`;
     - `AlreadySaved` → `Ok(summary)`;
     - `Created` → `CreatedAtAction(nameof(Get), new { id }, summary)`.

  Until T060 adds `Get`, use `Created($"/api/plans/{id}", summary)`. Add `[ProducesResponseType]` attributes for 201, 200, 400, 401 and 403. Keep the controller thin. (depends on T029, T030)
- [x] T032 [P] [US1] Add `backend/tests/SpekLaiku.UnitTests/SavedPlanMappingTests.cs`:
  - the configuration is valid;
  - `SavedPlan → SavedPlanSummaryResponse` maps name, location name and dates;
  - `SavedAt` has offset zero and the same instant;
  - the response type has no `OwnerId`, `Snapshot` or `GeneratedScheduleId` member (checked by reflection). (depends on T029)
- [x] T033 [US1] Add `backend/tests/SpekLaiku.IntegrationTests/SavePlanEndpointTests.cs` (signed-in Active Registered User):
  - (a) generate, then save "Weekend in Kaunas": 201, a `Location` header `/api/plans/{id}`, the body keys exactly `id, name, locationName, dates, savedAt`, and one `SavedPlans` row whose `Snapshot` equals the `GeneratedSchedules` snapshot (compare the serialised JSON);
  - (b) the same request again gives 200 with the same `id`, and the row count is unchanged;
  - (c) two requests sent at the same time (`Task.WhenAll`) give one row;
  - (d) the names `""`, `"   "` and 81 characters give 400 with `errors.name` and the exact messages; `"  Trim me  "` is saved as `"Trim me"`;
  - (e) an unknown GUID gives 400 with `errors.generatedScheduleId` "Generate the schedule again to save it.";
  - (f) with `factory.Clock` moved 30 minutes ahead (restored in `finally`), saving gives the same expired error;
  - (g) an empty name plus an unknown id give both errors in one response;
  - (h) a body with `"ownerId": "<another user's id>"` saves the plan under the caller;
  - (i) a schedule where nothing was scheduled (`generatedScheduleId` `null`) cannot be saved: sending `null` gives the expired error.

  (depends on T031)

### Frontend for User Story 1

- [x] T034 [P] [US1] Add `frontend/src/types/savedPlan.ts`:
  - `SavedPlanSummary { id: string; name: string; locationName: string; dates: string[]; savedAt: string }`;
  - `SavePlanRequest { generatedScheduleId: string | null; name: string }`;
  - `SavePlanFieldKey = "name" | "generatedScheduleId"`.

  Add a header comment referencing `contracts/plans-api.md`.
- [x] T035 [US1] Add `frontend/src/api/savedPlansApi.ts` with `savePlan(request, signal)`, which returns a `SavePlanAnswer`:
  - 201 or 200 → `{ kind: "saved", plan }`;
  - 400 → `{ kind: "invalid", errors: Partial<Record<SavePlanFieldKey, string>> }` (first message per key; read with the same helper style as `planStepAnswer.ts`);
  - 401 → `{ kind: "unauthorized" }`;
  - 403 → `{ kind: "forbidden" }`;
  - anything else throws `ApiError`. Network and abort errors pass through.

  Use `apiFetch` from `apiClient.ts`; pages never call `fetch`. Add `frontend/src/tests/savedPlansApi.test.ts` for each status. (depends on T034)
- [x] T036 [US1] Add `frontend/src/stores/useSavePlanStore.ts` (Zustand, not persisted). It holds:
  - `status`: `"closed" | "open" | "saving" | "saved" | "invalid" | "expired" | "sessionExpired" | "serverError"`;
  - `nameError: string | null` and `savedPlan: SavedPlanSummary | null`;
  - the last request, for Retry.

  Its actions:
  - `open()`; `cancel()` returns to `closed`;
  - `submit(name, generatedScheduleId)` is a no-op while saving, and uses `startTimeout` from `helpers/timedRequest.ts` (10 seconds). It maps the answer:
    - `invalid` with a `generatedScheduleId` error → `expired` (and also sets `nameError` if present);
    - `invalid` with only a name error → `invalid`;
    - `unauthorized` → `sessionExpired`;
    - `forbidden` → refresh `useCurrentUserStore` and `serverError`;
    - a throw → `serverError`.
  - `retry()`; `reset()` aborts the request and returns to `closed`.

  Add `frontend/src/tests/useSavePlanStore.test.ts` for each transition, a double submit sending one request, and the timeout. (depends on T035)
- [x] T037 [US1] Extract the schedule display from `frontend/src/pages/ScheduleOverviewPage.tsx` into `frontend/src/components/scheduleView.tsx` as `ScheduleView({ schedule }: { schedule: PlanSchedule })`. It covers the status region with "✓ All activities scheduled." and the travel summary, the all-unscheduled message, the date sections through `ScheduledDaySection`, and "Could not be scheduled". Move the code unchanged; the existing `ScheduleOverviewPage` tests must pass without changes (research section 12).
- [x] T038 [US1] Add `frontend/src/components/savePlanSection.tsx`, `SavePlanSection({ schedule, onGenerateAgain })`, for a signed-in Active Registered User (Visitors are handled in T050). It renders nothing when `schedule.scheduled.length === 0` (spec FR-001). Otherwise, by status:
  - `closed`: a **Save plan** button.
  - `open`, `saving` or `invalid`: a `<form>` with:
    - a labelled "Plan name" text input (`TextField` from `components/textField.tsx`);
    - **Save** (disabled while saving) and **Cancel**;
    - while saving, the text "Saving your plan…" in a `role="status"` element;
    - on `invalid`, the message next to the field with `aria-invalid` and `aria-describedby`, and focus moved to the field.

    Escape inside the form acts as Cancel. The browser also checks "Enter a plan name." for an empty or spaces-only name before sending, with the same message.
  - `saved`: `role="status"` "✓ Success: Plan saved." with a link "Go to My plans" to `/plans`. No Save button.
  - `expired`: `role="alert"` "Generate the schedule again to save it." with a **Generate again** button calling `onGenerateAgain`. The form stays open with the entered name.
  - `serverError`: `role="alert"` "Error: Plan could not be saved. Try again." with **Retry**.

  (depends on T036)
- [x] T039 [US1] In `frontend/src/pages/ScheduleOverviewPage.tsx`:
  - use `<ScheduleView schedule={schedule} />`;
  - render `<SavePlanSection schedule={schedule} onGenerateAgain={() => generate(setup, activities)} />` below it when `status === "loaded"`;
  - reset `useSavePlanStore` when the page closes, and when a new schedule is generated.

  The page must stay under about 200 lines. (depends on T037, T038)
- [x] T040 [US1] Add `frontend/src/tests/savePlanSection.test.tsx` (signed-in Active Registered User, mocked `savedPlansApi`). Cover:
  - the button is shown;
  - no button when nothing is scheduled;
  - the form opens with a labelled field;
  - the empty-name message with focus on the field;
  - the 81-character server message is shown;
  - Saving disables Save;
  - the success text and the My plans link;
  - expired shows **Generate again**, which calls the callback and keeps the name;
  - server error with Retry re-sends the same request;
  - Cancel and Escape close the form without a request;
  - the name `<script>` is sent as text.

  Update `frontend/src/tests/ScheduleOverviewPage.test.tsx`: the Save plan button appears for a loaded schedule of a signed-in user. (depends on T039)
  - Done 2026-11-18: the Save plan tests render the real Schedule Overview page (`savePlanSection.test.tsx`), so they also cover the Save plan button for a signed-in user; `ScheduleOverviewPage.test.tsx` passes unchanged after the `ScheduleView` extraction. Opening the form moves focus to the name field, so Escape works from the keyboard (spec User Story 7).

**Checkpoint**: A signed-in user can save a plan. Backend and frontend tests pass. My plans does not exist yet (the success link opens an unknown route until Phase 5).

---

## Phase 4: User Story 2 - Keep my plan when I log in or register to save it (Priority: P1)

**Goal**: A Visitor's "Save plan" leads to Log in or Register and back to the same schedule, which can then be saved. A save answered with 401 does the same.

**Independent Test**: As a Visitor, generate, select "Save plan", log in, and see the same schedule without "Generating your schedule…". Then repeat with Register.

- [x] T041 [P] [US2] Add `frontend/src/stores/useKeptScheduleStore.ts`: Zustand with `persist` and `createJSONStorage(() => sessionStorage)`, storage name `spek-laiku-kept-schedule`, following `usePlanSetupStore.ts`. It holds:
  - `kept: { key: string; schedule: PlanSchedule } | null`;
  - `keep(setup, activities, schedule)`, which stores the schedule with `key = JSON.stringify(checkedPlanRequest(setup, activities))`;
  - `take(setup, activities): PlanSchedule | null`, which always clears `kept` and returns the schedule only when the key matches;
  - `clear()`.

  Add `frontend/src/tests/useKeptScheduleStore.test.ts`: match, mismatch after a changed date, cleared after take, and survives a store reload from `sessionStorage`.
- [x] T042 [US2] In `frontend/src/stores/usePlanScheduleStore.ts`, add `restore(schedule: PlanSchedule)`, which aborts any request and sets `{ status: "loaded", schedule, controller: null }`. In `frontend/src/pages/ScheduleOverviewPage.tsx`'s mount effect, first call `useKeptScheduleStore.getState().take(setup, activities)`; if it returns a schedule, call `restore` and do not `generate`. Add to `frontend/src/tests/usePlanScheduleStore.test.ts` and `frontend/src/tests/ScheduleOverviewPage.test.tsx`:
  - a matching kept schedule is shown with no request sent;
  - a mismatching one is ignored and a new schedule is generated;
  - leaving the page still resets the schedule store (feature 008 FR-014). (depends on T041)
- [x] T043 [US2] In `frontend/src/components/savePlanSection.tsx`, for a Visitor (`useCurrentUserStore` status `signedOut` or `error`), render:
  - a **Save plan** button;
  - the hint "Log in or register to save this plan." linked with `aria-describedby`.

  The click calls `keep(setup, activities, schedule)` and navigates to `/login?returnTo=%2Fplan%2Fschedule` with state `{ loginReason: "required" }`. For a signed-in user whose save ends in `sessionExpired`, call `keep(...)`, refresh `useCurrentUserStore`, and navigate to the same address with `{ loginReason: "expired" }`. Pass `setup` and `activities` in as props from the page. (depends on T041)
- [x] T044 [US2] In `frontend/src/stores/useLogoutStore.ts`, clear `useKeptScheduleStore` next to the existing `usePlanSetupStore` and `usePlanActivitiesStore` clears. Add the case to `frontend/src/tests/logout.test.tsx`. (depends on T041)
- [x] T045 [US2] Make Register return to the "return to" page:
  - In `frontend/src/pages/LoginPage.tsx`, the "Create an account" link goes to `/register?returnTo=<encoded returnTo>` when the Log in page has a `returnTo`, and to `/register` otherwise.
  - In `frontend/src/pages/RegisterPage.tsx`, read `returnTo` with `useSearchParams`, and on `success` navigate to `safeReturnTo(returnTo) ?? "/"` with the existing `{ successMessage: "Account created." }` state. `alreadySignedIn` still goes to `/`.

  Add to `frontend/src/tests/LoginPage.test.tsx` and `frontend/src/tests/RegisterPage.test.tsx`:
  - the link carries `returnTo`;
  - registration with `returnTo=/plan/schedule` lands there with the banner;
  - an unsafe `returnTo` (`//evil.example`, `/login`) lands on `/`;
  - no `returnTo` lands on `/` (spec FR-008, research section 9).
- [x] T046 [US2] Add to `frontend/src/tests/savePlanSection.test.tsx`:
  - a Visitor sees the button and the hint;
  - clicking stores the kept schedule and navigates to `/login?returnTo=%2Fplan%2Fschedule` with "Log in to continue." shown;
  - a 401 during a save keeps the schedule and shows "Your session has expired. Log in again." on Log in. (depends on T043)
- [x] T047 [P] [US2] Add to `backend/tests/SpekLaiku.IntegrationTests/SavePlanEndpointTests.cs`:
  - a Visitor client generates a schedule, then signs in on the same client (`TestSignInStartupFilter.Path`) and saves with that `generatedScheduleId`, which gives 201 (spec Key Entities: the id works after login);
  - a Visitor `POST /api/plans` gives 401 and no row is created (spec FR-006, project FR-026).

**Checkpoint**: Visitor → Log in or Register → same schedule → save works. Logout clears the kept schedule. All tests pass.

---

## Phase 5: User Story 3 - See my saved plans (Priority: P1)

**Goal**: My plans lists the signed-in user's plans, newest first, with loading, empty and error states and a "My plans" navigation link.

**Independent Test**: A user with three saved plans opens My plans and sees all three newest first. Another user's plan is not listed.

- [x] T048 [US3] Add `Task<IReadOnlyList<SavedPlanSummary>> ListAsync(string ownerId, CancellationToken ct)` to `backend/src/SpekLaiku.Api/Services/SavedPlanService.cs`:
  - `AsNoTracking`, `Where(p => p.OwnerId == ownerId)`;
  - `OrderByDescending(p => p.SavedAtUtc).ThenBy(p => p.Id)`;
  - `Select` into `SavedPlanSummary` (never loads `Snapshot`, research section 5).

  Add `[HttpGet] List(CancellationToken ct)` to `backend/src/SpekLaiku.Api/Controllers/PlansController.cs`, returning `Ok(mapper.Map<List<SavedPlanSummaryResponse>>(...))`.
- [x] T049 [US3] Add `backend/tests/SpekLaiku.IntegrationTests/SavedPlansListEndpointTests.cs`:
  - a new user gets `[]`;
  - three plans saved with `factory.Clock` advanced one minute between saves (restored in `finally`) come back newest first, each with exactly the keys `id, name, locationName, dates, savedAt`;
  - a second user's plan is not in the first user's list;
  - (spec SC-005) a user with 50 saved plans gets all 50 in one response, and each item has only the five summary keys (no `scheduled`, `snapshot` or setup fields). This shows the list never loads the stored schedules. Seed the 50 rows directly through `ApplicationDbContext` in a scope, copying one saved plan's `Snapshot` with new ids and `GeneratedScheduleId = null`. Do not assert a time: the 2-second target is checked by hand in T076 (quickstart Scenario 4), so the test stays deterministic (constitution III). (depends on T048)
- [x] T050 [P] [US3] Add `frontend/src/helpers/canViewSavedPlans.ts`: `canViewSavedPlans(status, user)` is true only for `status === "signedIn" && user?.role === "Registered User" && user.accountStatus === "Active"`. Add a comment that the server checks the same rule (policy `ActiveRegisteredUser`). Add `frontend/src/tests/canViewSavedPlans.test.ts`.
  - Pulled forward into Phase 3 (2026-11-18): `SavePlanSection` needed it. The helper and `canViewSavedPlans.test.ts` already exist; Phase 5 only uses them.
- [x] T051 [P] [US3] Add `frontend/src/helpers/formatSavedAt.ts`:
  - `formatSavedAt(iso)` returns "Saved on Sat 21 Nov 2026 at 14:05" in `Europe/Vilnius` (24-hour time; date parts as in `formatPlanDate.ts`);
  - `formatPlanDates(dates)` joins `formatPlanDateShort` values with ", ".

  Add `frontend/src/tests/formatSavedAt.test.ts`, including a winter and a summer time instant (UTC+2 and UTC+3).
- [x] T052 [US3] Add `getSavedPlans(signal)` to `frontend/src/api/savedPlansApi.ts`:
  - 200 → `{ kind: "plans", plans }`;
  - 401 → `{ kind: "unauthorized" }`;
  - 403 → `{ kind: "forbidden" }`;
  - anything else throws.

  Add `frontend/src/stores/useSavedPlansStore.ts` with `status` `"loading" | "loaded" | "serverError"`, `plans`, `load()` (10-second timeout), `retry()` and `reset()`. On `unauthorized`, refresh `useCurrentUserStore`, so `SignedInOnly` sends the user to Log in. Add the API and store tests. (depends on T035)
- [x] T053 [US3] Add `frontend/src/components/savedPlanList.tsx`, `SavedPlanList({ plans, caption })`, rendered as one real `<table>` (spec US3 scenario 6):
  - a `<caption>` (for example "Your saved plans", visually hidden when the page heading already says it);
  - column headers `<th scope="col">`: Plan, Location, Dates, Saved, and Actions (visually hidden text);
  - one row per plan:
    - the plan name in a `<th scope="row">`;
    - the location name;
    - `formatPlanDates(dates)`;
    - `formatSavedAt(savedAt)`;
    - an **Open** link to `/plans/<id>` with `aria-label="Open <name>"` in the last cell.

  In `frontend/src/styles.css`, below the existing small-screen breakpoint, show each row as a card: `display: block` for the table, row and cells; the header row visually hidden; the plan name first as the card title; Open below it. Each cell is prefixed with a visible label from a `data-label` attribute, so the meaning does not depend on the hidden headers. Use one markup for both widths, not two components. The name is rendered as text (spec FR-017). (depends on T051)
- [x] T054 [US3] Add `frontend/src/components/registeredUserOnly.tsx`, `RegisteredUserOnly({ children })`, used inside `SignedInOnly`:
  - loading → nothing;
  - Suspended → `<Navigate to="/account-suspended" replace />`;
  - `!canViewSavedPlans` → `<AccessDeniedPage />`;
  - otherwise the children.

  Add `frontend/src/tests/registeredUserOnly.test.tsx`. (depends on T050)
- [x] T055 [US3] Add `frontend/src/pages/MyPlansPage.tsx`:
  - `usePageTitle("My plans")` and an `<h1>My plans</h1>`;
  - load on mount, reset on close;
  - loading: `role="status"` "Loading your plans…" with placeholder rows;
  - empty: "No saved plans yet." with a **New plan** link-button to `/plan/setup`;
  - error: `role="alert"` "Error: Saved plans could not be loaded." with **Retry**;
  - loaded: `<SavedPlanList plans={plans} />`.

  In `frontend/src/components/appRoutes.tsx`, add `path="plans"` wrapped in `<SignedInOnly><RegisteredUserOnly>`. (depends on T052, T053, T054)
- [x] T056 [US3] In `frontend/src/components/topNavigation.tsx`, add a "My plans" `NavLink` to `/plans` after "Create plan" when `canViewSavedPlans(status, user)`, and update the header comment. Update the navigation tests that pin the link list (`frontend/src/tests/layout.test.tsx` or the existing navigation test file). (depends on T050)
- [x] T057 [US3] Add `frontend/src/tests/MyPlansPage.test.tsx`:
  - loading text;
  - empty state with New plan;
  - three plans in the given order with formatted dates and saved time;
  - error with Retry re-requesting;
  - each Open link named "Open <plan name>" pointing to `/plans/<id>`;
  - a Visitor at `/plans` is sent to `/login?returnTo=%2Fplans` with "Log in to continue.". (depends on T055)

**Checkpoint**: My plans works end to end, and the success link from Phase 3 now opens it. All tests pass.

---

## Phase 6: User Story 4 - Open a saved plan (Priority: P1)

**Goal**: The plan page shows one saved plan read-only, exactly as saved, in the Schedule Overview layout.

**Independent Test**: Save a plan, log out and in, open it from My plans. Name, location, dates, maximum distance, "Saved on…", the note and the same schedule are shown.

- [x] T058 [P] [US4] Add `backend/src/SpekLaiku.Api/Services/SavedPlanLookup.cs` (`Found(SavedPlan)`, `NotFound`, `Forbidden`, following the result records) and the DTOs:
  - `backend/src/SpekLaiku.Api/DTOs/Responses/SavedPlanLocationResponse.cs`: `(string Name, string Area, double Latitude, double Longitude)`;
  - `backend/src/SpekLaiku.Api/DTOs/Responses/SavedPlanResponse.cs`: `(Guid Id, string Name, DateTimeOffset SavedAt, SavedPlanLocationResponse Location, IReadOnlyList<DateOnly> Dates, int MaxTravelDistanceKm, IReadOnlyList<ScheduledActivityResponse> Scheduled, IReadOnlyList<UnscheduledActivityResponse> Unscheduled, TravelSummaryResponse Travel)`.
- [x] T059 [US4] Add to `backend/src/SpekLaiku.Api/Mapping/SavedPlanMappingProfile.cs`:
  - `PlaceLocation → SavedPlanLocationResponse`;
  - `SavedPlan → SavedPlanResponse`. `SavedPlanResponse` is a positional record, so set each constructor parameter that has no source member of the same name with `ForCtorParam`:
    - `SavedAt` from `SavedAtUtc`, as in T029;
    - `Location` from `Snapshot.Setup.Location`;
    - `Dates` from `Snapshot.Setup.Dates`;
    - `MaxTravelDistanceKm` from `Snapshot.Setup.MaxTravelDistanceKm`;
    - `Scheduled` from `Snapshot.Schedule.Scheduled`;
    - `Unscheduled` from `Snapshot.Schedule.Unscheduled`;
    - `Travel` from `Snapshot.Schedule.Travel`.

    The items are mapped by the existing `PlanScheduleMappingProfile` maps. `Id` and `Name` match by name.

  These are path selections only, with no rules. Add cases to `backend/tests/SpekLaiku.UnitTests/SavedPlanMappingTests.cs`:
  - all fields mapped;
  - the travel leg and `null` travel kept;
  - the response JSON contains no `categoryId`, `key`, `ownerId`, `activities`, `durationHours` or `maxWindMs`. (depends on T058)
- [x] T060 [US4] Add `Task<SavedPlanLookup> GetAsync(string ownerId, Guid id, CancellationToken ct)` to `backend/src/SpekLaiku.Api/Services/SavedPlanService.cs`:
  - `AsNoTracking`, `FirstOrDefaultAsync(p => p.Id == id)`;
  - no plan → `NotFound`;
  - `OwnerId != ownerId` → `Forbidden`;
  - otherwise `Found`.

  Add `[HttpGet("{id:guid}")] Get(Guid id, CancellationToken ct)` to `PlansController`:
  - `Found` → `Ok(mapper.Map<SavedPlanResponse>(plan))`;
  - `Forbidden` → `Forbid()`. The cookie handler's `OnRedirectToAccessDenied` sets 403, and `UseStatusCodePages` adds the standard problem body, as for every other 403 in the API. That body contains no plan data (contracts/plans-api.md);
  - `NotFound` → `NotFound(new ProblemDetails { Status = 404, Title = "Not found.", Detail = "This plan no longer exists." })`.

  Change the `Created(...)` in `Save` to `CreatedAtAction(nameof(Get), new { id = plan.Id }, summary)`. Opening never calls the weather or map data services (spec FR-010). (depends on T059)
- [x] T061 [US4] Add `backend/tests/SpekLaiku.IntegrationTests/SavedPlanDetailsEndpointTests.cs`:
  - (a) save, then GET: 200 with the contract's top-level keys, and `scheduled`, `unscheduled` and `travel` equal (JSON comparison) to the `POST /api/plan-schedule` response the plan was saved from;
  - (b) `factory.Forecast.Calls` and `factory.MapPlaces.Calls` are unchanged by the GET;
  - (c) after the category used by the plan is renamed through the database, the GET still shows the old activity name (spec FR-015);
  - (d) a random GUID gives 404 with `detail` "This plan no longer exists.";
  - (e) `/api/plans/not-a-guid` gives 404. (depends on T060)
- [x] T062 [US4] Add the `SavedPlan` type (matching `SavedPlanResponse`, reusing `ScheduledActivity`, `UnscheduledActivity` and `TravelSummary` from `types/planSchedule.ts`) to `frontend/src/types/savedPlan.ts`. Add `getSavedPlan(id, signal)` to `frontend/src/api/savedPlansApi.ts`:
  - 200 → `{ kind: "plan", plan }`;
  - 403 → `{ kind: "forbidden" }`;
  - 404 → `{ kind: "notFound" }`;
  - 401 → `{ kind: "unauthorized" }`;
  - anything else throws.

  Add `frontend/src/stores/useSavedPlanStore.ts` with `status` `"loading" | "loaded" | "notFound" | "forbidden" | "serverError"`, `plan`, `load(id)` (10-second timeout), `retry()` and `reset()`. Add the API and store tests.
- [x] T063 [US4] Add `frontend/src/pages/PlanDetailsPage.tsx`, using `useParams().planId`, load on mount and reset on close:
  - **loaded**:
    - `usePageTitle(plan.name)` and `<h1>{plan.name}</h1>`;
    - breadcrumbs `<nav aria-label="Breadcrumb">`: Home › My plans › name, with the last item `aria-current="page"`;
    - location name with area, `formatPlanDates(dates)`, "Maximum travel distance: N km" and `formatSavedAt(savedAt)`;
    - the note "This is your plan as saved on <Sat 21 Nov 2026>. The forecast may have changed since.";
    - `<ScheduleView schedule={{ generatedScheduleId: null, scheduled, unscheduled, travel }} />`;
    - no edit, recalculate, duplicate or delete actions.
  - **loading**: `role="status"` "Loading your plan…".
  - **notFound**: `<h1>Plan not found</h1>`, "This plan no longer exists.", and links Home and My plans.
  - **forbidden**: `<AccessDeniedPage />`.
  - **serverError**: `role="alert"` "Error: Plan could not be loaded." with **Retry**.

  Add the route `path="plans/:planId"` in `frontend/src/components/appRoutes.tsx` with the same guards as `/plans`. (depends on T062)
- [x] T064 [US4] Add `frontend/src/tests/PlanDetailsPage.test.tsx`:
  - the loaded plan shows the heading, breadcrumbs, saved time, note, the schedule entries with "Travel:" and the unscheduled list;
  - no Save plan button;
  - the not-found text and links;
  - forbidden shows "You do not have permission to open this page.";
  - the error with Retry;
  - the page title is "<name> – Spėk laiku". (depends on T063)

**Checkpoint**: Saved plans can be opened. Backend and frontend tests pass.

---

## Phase 7: User Story 5 - Nobody else can see or use my plans (Priority: P1)

**Goal**: Every plans endpoint refuses Visitors, Administrators, Suspended users and non-owners on the server, and the frontend shows the matching pages.

**Independent Test**: User B opens user A's plan address and sees Access Denied with no plan data. A Visitor, an Administrator and a Suspended user are refused on all three endpoints.

- [x] T065 [US5] Add `backend/tests/SpekLaiku.IntegrationTests/SavedPlansAuthorizationTests.cs` (constitution III), with a theory over the three endpoints (`POST /api/plans` with a valid body, `GET /api/plans`, `GET /api/plans/{an existing plan id}`):
  - a Visitor gets 401 with an empty body (status pages are turned off for 401 in `Program.cs`);
  - an Active Administrator, a Suspended Administrator and a Suspended Registered User get 403. The body may be the standard problem body, but it contains none of the plan's data: assert it does not contain the plan's name, its id, `"scheduled"` or `"locationName"`, following `AdminCategoriesAuthorizationTests`;
  - an account deleted after sign-in gets 403;
  - no `SavedPlans` row is created by any refused POST.

  Plus:
  - user B's GET of user A's plan gives 403, and the body contains none of A's plan data (no plan name, `"scheduled"`, `"locationName"` or `"dates"`);
  - user B's list does not contain A's plan;
  - user B saving with the `generatedScheduleId` A already saved gives 400 with the expired error, and A's plan is unchanged (research section 6);
  - a suspended owner can no longer open their own plan (403).
- [x] T066 [P] [US5] In `frontend/src/pages/AccessDeniedPage.tsx`, add a "Go to My plans" link to `/plans` after the home link when `canViewSavedPlans(status, user)`, and update the comment (spec FR-014). Add the case to the Access Denied tests in `frontend/src/tests/` (the file that tests `AccessDeniedPage`, or `administratorOnly.test.tsx`).
- [x] T067 [P] [US5] Add to `frontend/src/tests/registeredUserOnly.test.tsx` and `frontend/src/tests/layout.test.tsx`:
  - an Administrator has no My plans link and sees Access Denied at `/plans` and `/plans/<id>`;
  - a Suspended user is sent to `/account-suspended`;
  - a Visitor at `/plans/<id>` is sent to Log in with that address as `returnTo`.

**Checkpoint**: Authorization covered for every protected operation, including the other-user cases. All tests pass.

---

## Phase 8: User Story 6 - See my latest plans on the home page (Priority: P2)

**Goal**: Home shows an Active Registered User their five latest plans with "All my plans".

**Independent Test**: A user with seven saved plans opens Home and sees the five most recently saved plans and "All my plans".

- [x] T068 [US6] Add `frontend/src/components/savedPlansBlock.tsx`: a `<section aria-labelledby>` with `<h2>Your saved plans</h2>`, using `useSavedPlansStore` (load on mount):
  - loading: `role="status"` "Loading your saved plans…", in the block only;
  - empty: "No saved plans yet." with a **Create your first plan** link-button to `/plan/setup`;
  - error: `role="alert"` "Error: Saved plans could not be loaded." with **Retry**;
  - loaded: `<SavedPlanList plans={plans.slice(0, 5)} />` and an "All my plans" link to `/plans`.

  In `frontend/src/pages/HomePage.tsx`, render it only when `canViewSavedPlans(status, user)`. (spec FR-011, research section 11)
- [x] T069 [US6] Update `frontend/src/tests/HomePage.test.tsx`:
  - the block's loading, empty with its button, and error with Retry (the rest of Home, including Create plan, still shows);
  - seven plans show five, plus All my plans;
  - the block is not shown to a Visitor, an Administrator or a Suspended user. (depends on T068)

**Checkpoint**: Home block works. All tests pass.

---

## Phase 9: User Story 7 - Use saving and saved plans on a phone and with assistive technology (Priority: P2)

**Goal**: The Save plan form, My plans, the Home block and the plan page work at 320 px, by keyboard and with a screen reader.

**Independent Test**: At 320 px with keyboard and screen reader, save with an empty name, fix the error, save, open My plans and open the plan.

- [x] T070 [P] [US7] Update `frontend/src/tests/accessibility.test.tsx`. Check that:
  - the Save plan form field has a visible label and, on error, `aria-invalid="true"` and an `aria-describedby` pointing at the message text;
  - My plans and the plan page each have exactly one `<h1>` and the page titles "My plans – Spėk laiku" and "<name> – Spėk laiku";
  - each Open link's accessible name is "Open <plan name>";
  - saving, loading, success and error texts are in `role="status"` or `role="alert"` elements (spec US7, FR-018).
- [x] T071 [P] [US7] Update `frontend/src/tests/keyboard.test.tsx`:
  - the Save plan button, field, Save and Cancel are reachable by Tab in order;
  - Escape closes the form and returns focus to **Save plan**;
  - Enter in the field submits;
  - on My plans, Tab reaches each Open link.
- [x] T072 [P] [US7] Update `frontend/src/tests/responsive.test.tsx`: at 320 px, the Save plan form, My plans with an 80-character plan name, the Home block and the plan page have no horizontal overflow (spec SC-006). Adjust `frontend/src/styles.css` only if a test shows overflow (for example `overflow-wrap: anywhere` on the plan name).

**Checkpoint**: Accessibility, keyboard and responsive checks cover the new screens. `npm test` passes.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, full verification, review. No new behaviour.

- [x] T073 [P] Update `README.md`:
  - add a "Saved plans" section after "Schedule overview", covering:
    - **Save plan** and the name rules;
    - a Visitor is sent to Log in or Register and comes back to the same schedule;
    - the 30-minute limit and "Generate again";
    - My plans and the Home block;
    - opening a plan shows it as saved, with no recalculation (feature 012);
    - plans are private;
  - in the database or migrations part, mention the new migration `AddSavedPlans` (tables `SavedPlans` and `GeneratedSchedules`);
  - in "Deployment notes", add: "Generated schedules are kept for 30 minutes in the `GeneratedSchedules` table so they can be saved; expired rows are deleted when the next schedule is generated, so no cleanup job is needed."
- [x] T074 [P] In `docs/ux-design.md`:
  - remove "(the My plans link comes with feature 010)" from the Forbidden row, now that the link exists;
  - add to the My Plans and Plan Details / Edit rows that Duplicate, Delete, Edit and Recalculate come with features 011 and 012.

  Change nothing else. Check `docs/architecture.md` for statements contradicting the implementation, and correct only what is now wrong.
- [x] T075 Run all checks and confirm they pass:
  - from the repository root, `dotnet build SpekLaiku.slnx`, `dotnet test SpekLaiku.slnx` and `dotnet format SpekLaiku.slnx --verify-no-changes`;
  - from `frontend/`, `npm run lint`, `npm test` and `npm run build`.

  Compare the test counts with T002: there should be only additions.
- [x] T076 Apply the migration to the local database (`dotnet ef database update --project src/SpekLaiku.Api` from `backend/`) and walk through `specs/010-save-view-plans/quickstart.md` Scenarios 1 to 6 in the running app. Record which passed, and any that could not be done (for example if Overpass is unavailable, as in feature 009).
- [x] T077 Review `git diff main...HEAD` and confirm:
  - only the files in plan.md "Source Code", plus the README, docs and spec files, changed;
  - there is no debug code, commented-out code or temporary file;
  - every new or changed C# class is under 200 lines;
  - `ScheduleOverviewPage.tsx`, `PlanDetailsPage.tsx`, `MyPlansPage.tsx` and `savePlanSection.tsx` are each under about 200 lines;
  - the migration contains only the two tables and their indexes and foreign key.
- [x] T078 Run a separate AI-assisted review of the branch (`/code-review` and `/security-review`, because this feature adds access control). Record the tool, the important findings, the changes made, and the findings not applied with a short reason, for the Pull Request description (constitution VII). Apply accepted fixes and re-run T075.

  **Result (2026-11-18)**:
  - **`/security-review` (Claude Code)**: no HIGH or MEDIUM findings that clear the 80% confidence bar. Checked:
    - plan reads and lists across users (owner from the sign-in, an ownership check, and a 403 with no plan data);
    - reuse of another user's `generatedScheduleId` (refused with the generic "expired" error, also on the race path);
    - owner injection and mass assignment (the request has only the id and the name);
    - DTO-only responses;
    - the `ActiveRegisteredUser` policy;
    - the jsonb converter (no polymorphic type handling);
    - injection (EF LINQ only);
    - the `returnTo` open redirect (`safeReturnTo`);
    - XSS (no `dangerouslySetInnerHTML`);
    - the kept schedule in sessionStorage;
    - logging (exception type only);
    - CSRF (unchanged pattern: SameSite=Lax cookie, JSON body).

    No changes were needed.
  - **`/code-review` (Claude Code), 10 findings: 5 correctness bugs and 5 code quality items.**
    - **Applied:**
      1. A save that got 401 sent the user to Log in while the app still thought they were signed in, so the Log in page bounced them to Home and the kept schedule was lost. `SavePlanSection` now calls `markSessionEnded()` before navigating, as `useCategoryFormStore` does. New test: the next `/me` never answers, and Log in still opens with "Your session has expired.".
      2. Under React StrictMode (`main.tsx`), the Schedule Overview's start-up code ran twice. The first run used up the kept schedule, and the second generated a new one, so FR-007 failed in the dev build. `useKeptScheduleStore.take` became `find`, which does not use the schedule up, and the page clears the kept schedule once it is shown. New test renders the app in StrictMode.
      3. Register navigated before the signed-in state was read again, so the restored schedule briefly showed the Visitor's Save plan button. The "already signed in" branch also ignored `returnTo`. Register now waits for `refresh()` and uses `returnTo` in both branches. Two new tests.
      4. A database write failure while remembering a generated schedule turned an already computed schedule into a 500, for Visitors too. `GeneratedScheduleService.RememberAsync` now returns `null` and logs a warning with only the exception type, so the schedule is shown but cannot be saved. New unit test.
      5. Refusing an empty name a second time did not move focus back to the field, because the status and message did not change. The store now counts refusals (`nameRefusals`). New test.
      6. `canCreatePlan` repeated the Active Registered User check. It now calls `canViewSavedPlans`.
      7. `formatSavedAt` formatted each time twice. It now formats once.
      8. The two controllers of this feature built their 400 answers differently. Both now use the shared `FieldErrors.ToValidationProblem()` (grouped by field). The other controllers are left for a separate change.
    - **Not applied:**
      9. "The `NothingToSaveMessage` check can never fail": kept, because spec FR-001 and research section 14 require the server to check this itself rather than trust that generation never stores an empty schedule. "`ActiveRegisteredUserHandler`'s signed-in check is redundant": kept, so the handler stays correct on its own and its unit test covers the Visitor.
      10. "Home loads every plan to show five": a deliberate choice (research section 11). Users have a few dozen plans at most, and one request keeps My plans and Home consistent. A `limit` parameter can be added if plan counts grow.
    - The new tests for 1, 2 and 5 were checked against the old code: each failed before the fix.
  - **Re-run of T075 after the fixes**: backend 654 unit and 330 integration tests, `dotnet format` clean; frontend lint, Prettier, 81 files and 1107 tests, build clean.
- [x] T079 Capture screenshots for the Pull Request (constitution V), at desktop width and at 320 px:
  - the Schedule Overview with the Save plan form and a validation error;
  - the success message;
  - the Visitor hint;
  - My plans;
  - the Home block;
  - a plan page;
  - the Access Denied page for another user's plan.

  Keep the images outside the repository unless the README already stores screenshots.
- [x] T080 Prepare the Pull Request description for the user. Include:
  - a link to `specs/010-save-view-plans/spec.md`;
  - a summary of the change;
  - the tests and checks run (T075, T076);
  - the migration `AddSavedPlans`;
  - the spec refinements made during planning (FR-008 Register link, User Story 2 scenario 5);
  - the screenshots;
  - the AI review record from T078.

  The user opens and merges the Pull Request.
  - Done 2026-11-18: the description was given to the user. The final check run, after the review fixes, was: backend 654 unit and 330 integration tests; frontend 81 files and 1108 tests; build, `dotnet format`, lint and Prettier clean. T076 and T079 were done by the user.

**Checkpoint**: All checks green, docs current, review recorded, screenshots and PR description ready. Ready for commit and Pull Request on request.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Setup): no dependencies.
- **Phase 2** (Foundational): depends on Phase 1. Blocks all story phases.
- **Phase 3** (US1): depends on Phase 2.
- **Phase 4** (US2): depends on Phase 3 (extends `SavePlanSection` and the save store).
- **Phase 5** (US3): depends on Phase 2 for the backend and on Phase 3 for `savedPlansApi.ts` and `PlansController`.
- **Phase 6** (US4): depends on Phase 5 (routes, guard, `SavedPlanList` helpers, `formatSavedAt`) and on Phase 3 (`ScheduleView`).
- **Phase 7** (US5): depends on Phases 3, 5 and 6 (all three endpoints must exist).
- **Phase 8** (US6): depends on Phase 5 (`useSavedPlansStore`, `SavedPlanList`, `canViewSavedPlans`).
- **Phase 9** (US7): depends on Phases 3 to 8.
- **Phase 10** (Polish): depends on all story phases.

### User Story Dependencies

- **US1 (P1)**: foundation only. It is the MVP: a signed-in user can save.
- **US2 (P1)**: builds on US1's Save plan section. Without it, Visitors simply cannot save.
- **US3 (P1)**: independent of US2. It needs US1's API file and controller.
- **US4 (P1)**: needs US3's routes and guard, and US1's `ScheduleView`.
- **US5 (P1)**: verifies the policy from Phase 2 and the ownership checks from US1, US3 and US4. It adds the Access Denied link.
- **US6 (P2)**: needs US3's store and list component.
- **US7 (P2)**: cross-checks all new screens.

### Within Each Phase

- Backend types and validators come before services, services before controllers, and controllers before endpoint tests.
- Frontend types come before the API, then stores, components, pages and page tests.
- Each phase ends with its tests green before the next phase starts.

## Parallel Opportunities

- **Phase 2**:
  - T003, T007, T008, T011 and T012 touch different files.
  - T006, T010, T022 and T023 can run once their dependencies are done.
- **Phase 3**: T026, T027, T028, T029 and T032 on the backend; T034 on the frontend; backend and frontend work can proceed side by side after T031.
- **Phase 4**: T041 and T047 (backend) are independent of each other.
- **Phase 5**: T050 and T051 are independent. The backend (T048, T049) can run next to them.
- **Phase 6**: T058 next to the frontend type work in T062.
- **Phase 7**: T066 and T067 next to T065.
- **Phase 9**: T070, T071 and T072 are separate test files.
- **Phase 10**: T073 and T074.

### Parallel Example: Phase 3 (User Story 1)

```text
Task: "T026 [P] [US1] SavedPlanValidator in backend/src/SpekLaiku.Api/Services/SavedPlanValidator.cs"
Task: "T027 [P] [US1] SavedPlanValidatorTests in backend/tests/SpekLaiku.UnitTests/SavedPlanValidatorTests.cs"
Task: "T028 [P] [US1] SavePlanResult, SavePlanRequest, SavedPlanSummaryResponse"
Task: "T034 [P] [US1] frontend/src/types/savedPlan.ts"
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 → Phase 2 (stop for review).
2. Phase 3: a signed-in user saves a plan (stop for review).
3. **Validate**: save works, with validation, idempotency and expiry. The plan is in the database.

### Incremental Delivery

1. Phase 4 (US2): Visitors can save through Log in or Register.
2. Phase 5 (US3): My plans.
3. Phase 6 (US4): open a plan. Saving and viewing are now complete.
4. Phase 7 (US5): authorization verified across all endpoints.
5. Phases 8 and 9 (P2): Home block and accessibility.
6. Phase 10: docs, verification, review, PR.

Each phase is a stop point for diff review. Commits use Conventional Commit messages (for example `feat(plans): save a generated schedule`) and are made only when the user asks.
