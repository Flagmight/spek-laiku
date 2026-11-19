# Tasks: Plan Management

**Input**: Design documents from `specs/011-plan-management/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/plans-api.md ✓, quickstart.md ✓

**Tests**: Required. Constitution III makes automated backend and frontend tests mandatory for every feature, including an authorization test for each protected operation. Each story phase includes its tests.

**Organization**:

- Phase 1 is setup.
- Phase 2 is the shared foundation:
  - the `CreatedAtUtc` column and list order;
  - the change service skeleton with its ownership check;
  - the controller's result mapping;
  - the confirmation dialog;
  - the shared plan name form;
  - the extracted saved plan view.
  
  After it, the app behaves exactly as before.
- Phases 3 to 8 are one phase per user story, in the spec's order: US1 Delete, US2 Duplicate, US3 Edit, US4 Rename, US5 Authorization, US6 Phone and assistive technology. US5 comes after US4 because it verifies all four endpoints.
- Phase 9 is polish.

Each phase ends at a reviewable checkpoint. Stop after each phase for a diff review; commit and push only on request.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on other incomplete tasks in this phase)
- **[Story]**: Which user story this task belongs to ([US1] to [US6])

## Shared test notes

- Integration tests share one `PostgreSqlApiFactory` (collection `PostgreSqlCollection.Name`), and that includes `factory.Clock`. A test that moves `factory.Clock.UtcNow` must restore it in a `finally` block.
- Each test creates its own users with `factory.CreateSignedInClientAsync(role, status)` or `factory.CreateUserAsync()`, so tests never see each other's plans.
- To create a saved plan in an integration test:
  1. Get an id with `new ScheduleScenario(factory).GenerateIdAsync(client)`. It generates the indoor plan, which always schedules one activity.
  2. `POST /api/plans` with that id and a name.
  
  For "nothing scheduled", use `ScheduleScenario.NothingScheduledPlanAsync()` with `GenerateAsync`.
- Frontend tests use `routeFetch`, `signedInUser` and `renderApp` from `frontend/src/tests/renderApp.tsx`, and the fixtures in `frontend/src/tests/savedPlansFixtures.ts`.
- The Vitest cold start may fail the first `npm test` of a session with "Failed to start forks worker". Re-run it once before investigating.

---

## Phase 1: Setup

**Purpose**: Branch ready, baseline green.

- [x] T001 Confirm the branch `011-plan-management` (already created) is based on the current `origin/main`. Run `git fetch`, then `git log origin/main..HEAD` and `git log HEAD..origin/main`: they should show only this feature's spec files and no missing commits.
- [x] T002 Run the baseline checks and confirm all pass before changing any code. Record the test counts for comparison in T071.
  - From the repository root: `dotnet build SpekLaiku.slnx` and `dotnet test SpekLaiku.slnx`.
  - From `frontend/`: `npm run lint`, `npm test` and `npm run build`.
  - Baseline (2026-11-19): backend build with 0 warnings; 654 unit and 330 integration tests. Frontend lint clean; 81 files and 1108 tests; build clean.

**Checkpoint**: Branch is current, all checks green.

---

## Phase 2: Foundational (creation time, change service skeleton, shared UI pieces)

**Purpose**: Everything several stories need: the stable list order, one ownership check for every change, one result-to-HTTP mapping, the confirmation dialog, the shared name form and the extracted plan view. There are no new endpoints or visible actions yet.

**⚠️ CRITICAL**: No user story work starts until this phase is complete and all tests pass.

### Creation time and list order (research section 5)

- [x] T003 Add `public DateTime CreatedAtUtc { get; set; }` to `backend/src/SpekLaiku.Api/Entities/SavedPlan.cs`, with the doc comment "When this row was created, by a save or a duplicate; never changed afterwards. Breaks ties on SavedAtUtc so a copy is listed directly above its original (feature 011 research section 5)." Change the class comment from "Read-only in feature 010" to say that feature 011 renames, replaces, copies and deletes plans.
- [x] T004 In `backend/src/SpekLaiku.Api/Data/SavedPlanConfiguration.cs`, add `builder.Property(plan => plan.CreatedAtUtc).IsRequired();`. Then, from `backend/`:
  1. Run `dotnet ef migrations add AddSavedPlanCreatedAt --project src/SpekLaiku.Api`.
  2. In the generated `Up`, after `AddColumn`, add `migrationBuilder.Sql("UPDATE \"SavedPlans\" SET \"CreatedAtUtc\" = \"SavedAtUtc\";");`.
  3. Check that the migration adds only this column ("Existing rows get their `SavedAtUtc` in the migration"), and that `Down` drops only it.
  
  (depends on T003)
- [x] T005 In `backend/src/SpekLaiku.Api/Services/SavedPlanService.cs`:
  - Set `CreatedAtUtc` to the same `now` as `SavedAtUtc` in `InsertAsync`.
  - Change `ListAsync` to `.OrderByDescending(plan => plan.SavedAtUtc).ThenByDescending(plan => plan.CreatedAtUtc).ThenBy(plan => plan.Id)`.
  - Update the doc comment: "newest saved first, then the most recently created (a copy above its original), then by id".
  
  (depends on T003)
- [x] T006 [P] In `backend/tests/SpekLaiku.IntegrationTests/DatabaseSchemaTests.cs`, assert that `SavedPlans.CreatedAtUtc` exists as `timestamp with time zone`, `NOT NULL`. In `backend/tests/SpekLaiku.IntegrationTests/SavedPlansListEndpointTests.cs`, add a test: two plans with the same `SavedAtUtc` (set directly in the database through a scope's `ApplicationDbContext`) and different `CreatedAtUtc` are listed with the later-created one first. (depends on T004, T005)

### Change service skeleton and controller mapping (research sections 7 and 8)

- [x] T007 [P] Add `backend/src/SpekLaiku.Api/Services/SavedPlanChange.cs`: a record with a private constructor, following `SavePlanResult` and `SavedPlanLookup`.
  - `Outcome` enum: `Changed | Deleted | Invalid | NotFound | Forbidden`.
  - Members: `SavedPlan? Plan`, `IReadOnlyList<KeyValuePair<string,string>> Errors` (default `[]`).
  - Factories: `Changed(SavedPlan)`, `static readonly Deleted`, `Invalid(errors)`, `static readonly NotFound`, `static readonly Forbidden`.
  - `[MemberNotNullWhen(true, nameof(Plan))] bool HasPlan => Plan is not null`.
  - Doc comment: data-model.md "SavedPlanChange". `Forbidden` never carries plan data.
- [x] T008 Add `SavedPlanChangeService(ApplicationDbContext context, GeneratedScheduleService generatedSchedules, TimeProvider timeProvider)` in `backend/src/SpekLaiku.Api/Services/SavedPlanChangeService.cs`, with only the private helper:
  - `Task<(SavedPlan? Plan, SavedPlanChange? Refusal)> FindOwnedAsync(string ownerId, Guid id, CancellationToken ct)`.
  - It reads the plan **tracked** with `FirstOrDefaultAsync(plan => plan.Id == id)`.
  - It returns `(null, SavedPlanChange.NotFound)` when missing, `(null, SavedPlanChange.Forbidden)` when `OwnerId != ownerId`, and otherwise `(plan, null)`.
  - Class doc comment: "Changes to an existing saved plan, only by its owner (feature 011 spec FR-015, research sections 7 and 8). Every operation checks ownership first; another user's plan is refused with no plan data and nothing changed."
  - Register it as scoped in `backend/src/SpekLaiku.Api/Program.cs`, next to `SavedPlanService`.
  - Implementation note: the constructor starts with `ApplicationDbContext` only, because an unread primary-constructor parameter is a CS9113 build warning. `TimeProvider` is added with its first use in T030, and `GeneratedScheduleService` in T042.
  
  (depends on T007)
- [x] T009 In `backend/src/SpekLaiku.Api/Controllers/PlansController.cs`:
  - Inject `SavedPlanChangeService savedPlanChangeService`.
  - Move the 404 body from `Get` into `private NotFoundObjectResult PlanNotFound()`, with title "Not found." and detail "This plan no longer exists.", and use it in `Get`.
  - Add `private ActionResult ToActionResult(SavedPlanChange change, Func<SavedPlan, ActionResult> onChanged)`:
    - `Invalid` → `BadRequest(change.Errors.ToValidationProblem())`;
    - `NotFound` → `PlanNotFound()`;
    - `Forbidden` → `Forbid()`;
    - `Deleted` → `NoContent()`;
    - `Changed` → `onChanged(change.Plan)`.
  - Keep the controller thin, with no rules.
  - Implementation note: `SavedPlanChangeService` is injected in T017, together with its first use in `Delete` (CS9113, see T008).
  
  (depends on T008)

### Shared frontend pieces (research sections 9, 11 and 12)

- [x] T010 [P] Add `confirmDialog.tsx` in `frontend/src/components/confirmDialog.tsx`: `ConfirmDialog({ question, confirmLabel, cancelLabel = "Cancel", onConfirm, onCancel, busy })`.
  - **Markup**: a backdrop `div` and `<div role="dialog" aria-modal="true" aria-labelledby={questionId}>`. The question is a `<p id={questionId}>`. The buttons are **confirmLabel** first, then **Cancel**.
  - **Focus**: moves to the confirm button on mount.
  - **Keys**:
    - Tab on the last button moves focus to the first, and Shift+Tab on the first moves it to the last.
    - Escape calls `onCancel`.
  - **Busy**: the confirm button is disabled while `busy`.
  - **Text**: plain text only.
  - Doc comment: spec FR-002, FR-013, FR-020, research section 9 (no native `<dialog>`, because jsdom does not implement `showModal`).
- [x] T011 [P] Add `frontend/src/tests/confirmDialog.test.tsx`:
  - the role, `aria-modal` and accessible name equal to the question;
  - focus on the confirm button;
  - Tab from Cancel returns to the confirm button, and Shift+Tab from the confirm button goes to Cancel;
  - Escape and Cancel call `onCancel` once;
  - the confirm button calls `onConfirm`;
  - the confirm button is disabled while `busy`;
  - a question containing `<script>` is shown as text.
  
  (depends on T010)
- [x] T012 Extract `planNameForm.tsx` from `frontend/src/components/savePlanSection.tsx` into `frontend/src/components/planNameForm.tsx`: `PlanNameForm({ formLabel, submitLabel, name, nameError, nameRefusals, opened, busy, onNameChange, onSubmit, onCancel, children })`.
  - It renders the form with `aria-label={formLabel}` and `noValidate`, and the `TextField` "Plan name" with id `plan-name`.
  - **Focus**: moves to the field when `opened` becomes true and on every refusal (`nameError` or `nameRefusals` changes).
  - **Keys**: Escape calls `onCancel`.
  - **Children**: shown as the status slot.
  - **Buttons**: `submitLabel`, disabled while `busy`, then **Cancel**.
  
  `SavePlanSection` uses it with `formLabel="Save plan"` and `submitLabel="Save"`, and keeps its own focus return to the Save plan button. There is no behaviour change: `frontend/src/tests/savePlanSection.test.tsx` must pass unchanged. Doc comment: research section 11.
- [x] T013 [P] Move `SavedPlanView` out of `frontend/src/pages/PlanDetailsPage.tsx` into `frontend/src/components/savedPlanView.tsx` as an exported component `SavedPlanView({ plan, actions, notice })`.
  - `actions` (a `ReactNode`) is rendered between the `h1` and the setup list.
  - `notice` (a string or `null`) is rendered in a `<p role="status">` directly under the `h1`.
  - `PlanDetailsPage` passes neither yet.
  
  There is no behaviour change: `frontend/src/tests/PlanDetailsPage.test.tsx` must pass unchanged. Plan "Constraints": the page will grow in US1 to US4.
- [x] T014 [P] Add `planNotice?: "deleted" | "duplicated"` to `frontend/src/types/navigationState.ts`, with the comment "Set after a delete or duplicate from the plan page; My plans or the copy's page shows 'Plan deleted.' or 'Plan duplicated.' in its own status region (feature 011 research section 12)."
- [x] T015 Run the backend build and tests, and the frontend lint, tests and build. All pass with only the new tests added. (depends on T003 to T014)
  - Result (2026-11-19): backend build with 0 warnings; 654 unit and 333 integration tests (+3); `dotnet format --verify-no-changes` clean after converting the generated migration files to LF line endings. Frontend lint and Prettier clean; 82 files and 1116 tests (+1 file, +8 tests); build clean.

**Checkpoint**: The migration is applied in tests, the list order is stable, and the change service, controller mapping, dialog, name form and plan view are in place. The app's behaviour is unchanged.

---

## Phase 3: User Story 1 - Delete a plan I no longer need (Priority: P1) 🎯 MVP

**Goal**: An Active Registered User deletes their own plan from My plans or the plan page, after confirming in a dialog. The plan is gone everywhere.

**Independent Test**: As a user with two plans, click **Delete** on "Weekend in Kaunas" in My plans. The dialog "Delete 'Weekend in Kaunas'? This cannot be undone." appears. **Cancel** keeps the plan. **Delete** in the dialog shows "Plan deleted.", removes the row, and the plan's address shows "This plan no longer exists.".

### Backend for User Story 1

- [x] T016 [US1] Add `Task<SavedPlanChange> DeleteAsync(string ownerId, Guid id, CancellationToken ct)` to `backend/src/SpekLaiku.Api/Services/SavedPlanChangeService.cs`:
  1. Call `FindOwnedAsync`, and return its refusal if there is one.
  2. Otherwise `context.SavedPlans.Remove(plan)`, `SaveChangesAsync`, and return `SavedPlanChange.Deleted`.
  3. If `SaveChangesAsync` throws `DbUpdateConcurrencyException` (another request deleted it first), return `SavedPlanChange.NotFound`.
  
  Doc comment: spec FR-001.
- [x] T017 [US1] Add `[HttpDelete("{id:guid}")] Delete(Guid id, CancellationToken ct)` to `backend/src/SpekLaiku.Api/Controllers/PlansController.cs`, returning `ToActionResult(await savedPlanChangeService.DeleteAsync(userId, id, ct), _ => NoContent())`, with `[ProducesResponseType]` for 204 and 404. (depends on T016)
- [x] T018 [US1] Add `backend/tests/SpekLaiku.IntegrationTests/DeletePlanEndpointTests.cs` (signed-in Active Registered User):
  - (a) delete one of two plans: 204 with an empty body. `GET /api/plans` lists only the other plan, and `GET /api/plans/{id}` gives 404 with detail "This plan no longer exists.";
  - (b) deleting it again gives 404 with the same detail;
  - (c) the other plan's row is unchanged (name, `SavedAtUtc`, snapshot);
  - (d) the `GeneratedSchedules` row the plan was saved from still exists (only the plan is deleted);
  - (e) `factory.Forecast.Calls` and `factory.MapPlaces.Calls` are the same before and after the request (spec FR-017), following `SavedPlanDetailsEndpointTests.OpeningAPlan_CallsNeitherExternalService`.
  
  (depends on T017)

### Frontend for User Story 1

- [x] T019 [P] [US1] Add `deletePlan(id, signal)` to `frontend/src/api/savedPlansApi.ts`. It returns `DeletePlanAnswer = { kind: "deleted" } | { kind: "notFound" } | { kind: "forbidden" } | { kind: "unauthorized" }`, for 204, 404, 403 and 401. Anything else throws `ApiError`. It sends `DELETE /api/plans/{encodeURIComponent(id)}`. Add the cases to `frontend/src/tests/savedPlansApi.test.ts`: each status, the method and the path, and a 500 that throws.
- [x] T020 [P] [US1] Add `remove(id: string)` to `frontend/src/stores/useSavedPlansStore.ts`, which filters the plan out of `plans` and leaves `status` unchanged. Add a test in `frontend/src/tests/useSavedPlansStore.test.ts`.
- [x] T021 [US1] Add `frontend/src/stores/usePlanActionsStore.ts` (not persisted), with these messages as exported constants:
  - `planDeletedMessage = "Plan deleted."`;
  - `deleteFailedMessage = "Error: Plan could not be deleted. Try again."`;
  - `planGoneMessage = "This plan no longer exists."`;
  - `deletingMessage = "Deleting your plan…"`, the pending text (spec FR-020).
  
  **State**:
  - `pending: { kind: "delete" | "duplicate"; planId: string } | null`;
  - `error: { kind; planId; message } | null`;
  - `notice: string | null`;
  - `controller`.
  
  **`deletePlan(planId)`**:
  1. It is a no-op while `pending` is set.
  2. It sets `pending`, clears `error` and `notice`, and sends with `startTimeout` (10 seconds).
  3. **Deleted**: `notice = planDeletedMessage`. It returns `"deleted"`.
  4. **notFound**: `error.message = planGoneMessage`. It returns `"gone"`.
  5. **401 or 403**: `useCurrentUserStore.getState().refresh()` and `error = deleteFailedMessage`.
  6. **Throw or timeout**: `error = deleteFailedMessage`. It returns `"failed"`.
  
  **Other actions**:
  - `retry()` repeats the last action.
  - `clearNotice()` clears the notice.
  - `reset()` aborts and starts again.
  
  Doc comment: spec FR-001 to FR-003, research section 12. (depends on T019)
- [x] T022 [P] [US1] Add `frontend/src/tests/usePlanActionsStore.test.ts` for delete:
  - success sets the notice;
  - a second call while pending sends no request;
  - 404 sets "This plan no longer exists.";
  - 500 and a 10-second timeout (fake timers) set "Error: Plan could not be deleted. Try again.";
  - Retry sends the same request;
  - 401 refreshes the current user.
  
  (depends on T021)
- [x] T023 [US1] Give `frontend/src/components/savedPlanList.tsx` an optional prop `actions?: (plan: SavedPlanSummary) => ReactNode`. When it is set, it is rendered after the Open link in the last cell. Home's `SavedPlansBlock` does not pass it.
- [x] T024 [US1] Add `frontend/src/components/planActions.tsx`: `PlanActions({ plan, onDeleted })`, where `plan` is `{ id, name }`, for now with only the **Delete** button.
  - **Button**: `aria-label={`Delete ${plan.name}`}`, disabled while `usePlanActionsStore` has `pending` for this plan.
  - **Dialog**: clicking **Delete** opens `ConfirmDialog` with the question `` `Delete '${plan.name}'? This cannot be undone.` `` and `confirmLabel="Delete"`.
  - **Cancel and Escape**: close the dialog and return focus to the Delete button (a ref).
  - **Confirm**: calls `deletePlan(plan.id)`. On `"deleted"` or `"gone"` it calls `onDeleted(plan.id)`. On `"failed"` it closes the dialog.
  
  Doc comment: spec FR-002, FR-019, FR-020. (depends on T010, T021)
- [x] T025 [US1] Update `frontend/src/pages/MyPlansPage.tsx`:
  - Pass `actions={(plan) => <PlanActions plan={plan} onDeleted={removeAndFocus} />}` to `SavedPlanList`.
  - `removeAndFocus(id)`:
    1. Find the index of the row.
    2. Call `useSavedPlansStore.getState().remove(id)`.
    3. After render, focus the Open link of the plan that followed it, or the `h1` (with `tabIndex={-1}`) when no plan follows.
  - Show `usePlanActionsStore` `notice` in a `<p role="status">` under the `h1`. While `pending` is set, the same paragraph shows the pending text ("Deleting your plan…", later "Duplicating your plan…").
  - Show `error` in a `<p role="alert">` with a **Retry** button. There is no Retry for `planGoneMessage`.
  - On mount, read `NavigationState.planNotice === "deleted"` and set the notice to "Plan deleted.". Clear the router state with `navigate(location.pathname, { replace: true, state: null })`.
  - Reset the actions store on unmount.
  - When the last plan is deleted, the existing empty state shows.
  
  Update the file's comment ("Read-only in this feature" no longer applies). (depends on T020, T023, T024)
- [x] T026 [US1] Update `frontend/src/pages/PlanDetailsPage.tsx`: pass `SavedPlanView` an `actions` element with `<PlanActions plan={plan} onDeleted={() => navigate("/plans", { state: { planNotice: "deleted" } })} />`. Update the file's comment. (depends on T013, T024, T025)
- [x] T027 [US1] Extend `frontend/src/tests/MyPlansPage.test.tsx`:
  - each row has a "Delete <name>" button;
  - clicking it shows the dialog text exactly;
  - Cancel and Escape send no request and return focus to that button;
  - confirming sends `DELETE /api/plans/{id}`, removes the row, shows "Plan deleted." in a status region, and focuses the next row's "Open <name>" link (and the `h1` when the last row was deleted);
  - deleting the only plan shows "No saved plans yet.";
  - 500 shows the error with Retry, and the row stays;
  - 404 removes the row and shows "This plan no longer exists.";
  - the button is disabled while pending, and "Deleting your plan…" is shown in a status region while the request is pending.
  
  Extend `frontend/src/tests/PlanDetailsPage.test.tsx`: confirming Delete opens My plans with "Plan deleted.". Extend `frontend/src/tests/HomePage.test.tsx`: the Home block shows no Delete button. (depends on T025, T026)
  - Result (2026-11-19):
    - **Implementation notes**:
      - The status region (pending text, notice, and error with Retry) is a shared component, `frontend/src/components/planActionMessages.tsx`, used by My plans and the plan page.
      - `PlanActions` got the optional `onGone` prop already here, not in T036, because a delete that gets 404 has the same problem as F2: on the plan page it must show "This plan no longer exists." in place, not open My plans with "Plan deleted.". My plans passes `onGone`; the plan page does not, and a test covers it.
    - **Changed feature 010 tests** (added to T071's list):
      - `PlanDetailsPage.test.tsx` "offers no save, edit, recalculate, duplicate or delete actions" now checks only that no Save plan or Recalculate is offered and nothing is generated.
      - `keyboard.test.tsx` "reaches each Open link on My plans in order" now expects each row's Open link followed by its Delete button.
    - **Checks**: backend build with 0 warnings; 654 unit and 338 integration tests (+5); `dotnet format` clean. Frontend lint and Prettier clean; 83 files and 1141 tests; build clean.

**Checkpoint**: Delete works from both pages with confirmation, focus and error handling. Backend and frontend tests are green.

---

## Phase 4: User Story 2 - Duplicate a plan (Priority: P1)

**Goal**: A user copies one of their plans as "Copy of <name>". The copy is listed directly above the original and is a separate plan.

**Independent Test**: Click **Duplicate** on "Weekend in Kaunas" in My plans. "Plan duplicated." is shown, and "Copy of Weekend in Kaunas" is listed directly above the original (also after a reload), with the same content and Saved date.

### Backend for User Story 2

- [x] T028 [P] [US2] Add `public const string CopyPrefix = "Copy of ";` and `public static string CopyName(string original)` to `backend/src/SpekLaiku.Api/Services/SavedPlanValidator.cs`:
  1. Build `CopyPrefix + original`.
  2. If it is longer than `MaxNameLength` (80), cut it to 80.
  3. If the last kept character is a high surrogate (`char.IsHighSurrogate`), cut one more.
  
  Doc comment: spec FR-005, research section 6.
- [x] T029 [P] [US2] Extend `backend/tests/SpekLaiku.UnitTests/SavedPlanValidatorTests.cs` with `CopyName` tests:
  - `"Weekend"` → `"Copy of Weekend"`;
  - a 72-character name → 80 characters, unchanged;
  - an 80-character name → 80 characters ending with the first 72 characters of the name;
  - a name whose 72nd and 73rd characters are an emoji (a surrogate pair) → 79 characters with no lone surrogate;
  - `CopyName(CopyName("A"))` → `"Copy of Copy of A"`.
- [x] T030 [US2] Add `Task<SavedPlanChange> DuplicateAsync(string ownerId, Guid id, CancellationToken ct)` to `backend/src/SpekLaiku.Api/Services/SavedPlanChangeService.cs`:
  1. Call `FindOwnedAsync`, and return its refusal if there is one.
  2. Add a new `SavedPlan` with:
     - `Id = Guid.NewGuid()`, `OwnerId = ownerId` (never from the request);
     - `Name = SavedPlanValidator.CopyName(original.Name)`;
     - `SavedAtUtc = original.SavedAtUtc`, `CreatedAtUtc = timeProvider now`;
     - `LocationName` and `Dates` (a new list) from the original;
     - `GeneratedScheduleId = null`;
     - `Snapshot = original.Snapshot`. The snapshot is an immutable record stored as `jsonb`, so sharing the instance is safe.
  3. `SaveChangesAsync`, then return `Changed(copy)`.
  
  Doc comment: spec FR-004 to FR-006, FR-016, clarification Q3. (depends on T008, T028)
- [x] T031 [US2] Add `[HttpPost("{id:guid}/copies")] Duplicate(Guid id, CancellationToken ct)` to `backend/src/SpekLaiku.Api/Controllers/PlansController.cs`, with no body parameter. It returns `ToActionResult(change, plan => CreatedAtAction(nameof(Get), new { id = plan.Id }, mapper.Map<SavedPlanSummaryResponse>(plan)))`, with `[ProducesResponseType]` for 201 and 404. (depends on T030)
- [x] T032 [US2] Add `backend/tests/SpekLaiku.IntegrationTests/DuplicatePlanEndpointTests.cs`:
  - (a) 201, a `Location` header `/api/plans/{copyId}`, the body keys exactly `id, name, locationName, dates, savedAt`, the name "Copy of <name>", and `savedAt` equal to the original's;
  - (b) `GET /api/plans/{copyId}` equals the original's details except `id` and `name`;
  - (c) with three plans saved at different times (move `factory.Clock` between saves, restore in `finally`), duplicating the middle one lists the copy directly above it, and the order is the same on a second `GET`;
  - (d) a copy of the copy is listed above both;
  - (e) an 80-character name gives an 80-character copy name;
  - (f) the copy's `GeneratedScheduleId` is `null` in the database;
  - (g) deleting the copy leaves the original unchanged;
  - (h) a JSON body `{"ownerId":"<another user's id>"}` is ignored, and the copy belongs to the caller;
  - (i) `factory.Forecast.Calls` and `factory.MapPlaces.Calls` are the same before and after the request (spec FR-017).
  
  (depends on T031)

### Frontend for User Story 2

- [x] T033 [P] [US2] Add `duplicatePlan(id, signal)` to `frontend/src/api/savedPlansApi.ts`. It returns `{ kind: "duplicated"; plan: SavedPlanSummary } | notFound | forbidden | unauthorized`, for 201, 404, 403 and 401, and sends `POST /api/plans/{id}/copies` with no body. Add the tests to `frontend/src/tests/savedPlansApi.test.ts`.
- [x] T034 [P] [US2] Add `insertAbove(copy: SavedPlanSummary, originalId: string)` to `frontend/src/stores/useSavedPlansStore.ts`. It inserts the copy directly before the original, or at the start when the original is not in the list. Add the tests to `frontend/src/tests/useSavedPlansStore.test.ts`.
- [x] T035 [US2] Add `duplicatePlan(planId)` to `frontend/src/stores/usePlanActionsStore.ts`, with the same pending, timeout, retry and refresh rules as delete, and the constants `planDuplicatedMessage = "Plan duplicated."`, `duplicateFailedMessage = "Error: Plan could not be duplicated. Try again."` and `duplicatingMessage = "Duplicating your plan…"` (the pending text). On success it sets the notice and returns `{ kind: "duplicated", copy }`. On 404 it returns `"gone"` with `planGoneMessage`. Extend `frontend/src/tests/usePlanActionsStore.test.ts` in the same way as T022. (depends on T033)
- [x] T036 [US2] Add the **Duplicate** button to `frontend/src/components/planActions.tsx`, before Delete: `aria-label={`Duplicate ${plan.name}`}`, no confirmation, and disabled while any action of this plan is pending. Add the prop `onDuplicated(copy)`, called on success. A `"gone"` result calls a new optional prop `onGone(plan.id)`.
  - My plans passes the same function as `onDeleted`, so the row is removed and "This plan no longer exists." is shown (spec Edge Cases).
  - The plan page passes nothing, so the store's error "This plan no longer exists." is shown on the page and nothing navigates. (depends on T035)
- [x] T037 [US2] Wire Duplicate into both pages:
  - **`frontend/src/pages/MyPlansPage.tsx`**: `onDuplicated={(copy) => useSavedPlansStore.getState().insertAbove(copy, plan.id)}`. Focus stays on the Duplicate button. A `planNotice === "duplicated"` from navigation is not used here.
  - **`frontend/src/pages/PlanDetailsPage.tsx`**:
    - `onDuplicated={(copy) => navigate(`/plans/${copy.id}`, { state: { planNotice: "duplicated" } })}`.
    - On load, a `planNotice` of `"duplicated"` is passed to `SavedPlanView` as `notice="Plan duplicated."`, and the router state is cleared.
    - The page loads the new `planId`, because the existing effect depends on `planId`.
  
  (depends on T034, T036)
- [x] T038 [US2] Extend the page tests:
  - **`frontend/src/tests/MyPlansPage.test.tsx`**:
    - "Duplicate <name>" sends `POST /api/plans/{id}/copies` with no body;
    - the copy row appears directly above the original;
    - "Plan duplicated." is shown in a status region;
    - a double click sends one request, and "Duplicating your plan…" is shown in a status region while it is pending;
    - 500 shows "Error: Plan could not be duplicated. Try again." with Retry;
    - 404 removes the row with "This plan no longer exists.".
  - **`frontend/src/tests/PlanDetailsPage.test.tsx`**: Duplicate opens `/plans/{copyId}`, shows the copy's name as the heading, and shows "Plan duplicated.". A duplicate that gets 404 shows "This plan no longer exists." on the same page and does not navigate.
  
  (depends on T037)
  - Result (2026-11-19):
    - **Fix to Phase 3**: Retry from the status region repeated the request but not the page's follow-up, so a delete that succeeded on Retry said "Plan deleted." and left the row. The store now takes a result handler with each action (`deletePlan(planId, onResult)`, `duplicatePlan(planId, onResult)`) and keeps it with `lastAction`, and `retry()` calls it again. `removeAndFocus` on My plans reads the list from the store, because Retry can finish later. New tests: the store passes a retried delete and a retried duplicate to the same handler; on My plans, a delete that succeeds on Retry removes the row, and a duplicate that succeeds on Retry lists the copy.
    - **Implementation note (T037)**: on the copy's page, "Plan duplicated." is shown through `usePlanActionsStore.showNotice` in the shared status region, as "Plan deleted." is on My plans, not through `SavedPlanView`'s `notice` prop.
    - **Changed test**: `keyboard.test.tsx` My plans tab order now expects Open, Duplicate and Delete for each row (already listed in T071 under T027).
    - **Checks**: backend build with 0 warnings; 659 unit (+5) and 347 integration tests (+9); `dotnet format` clean. Frontend lint and Prettier clean; 83 files and 1158 tests (+17); build clean.

**Checkpoint**: Duplicate works from both pages. The copy order holds after a reload. Tests are green.

---

## Phase 5: User Story 3 - Edit a saved plan (Priority: P1)

**Goal**: "Edit plan" loads the saved plan into the planning steps with an editing notice. The user regenerates the schedule, and **Save changes** replaces the plan in place.

**Independent Test**: Open "Weekend in Kaunas" (Kayaking and Picnic), click **Edit plan**, remove Picnic, add Museum, generate and click **Save changes**. "✓ Success: Changes saved." appears, the plan page shows Kayaking and Museum, and My plans lists one "Weekend in Kaunas".

### Backend for User Story 3

- [x] T039 [US3] Move the generated schedule checks into `backend/src/SpekLaiku.Api/Services/GeneratedScheduleService.cs` as `Task<(PlanSnapshot? Snapshot, KeyValuePair<string,string>? Error)> FindSavableAsync(Guid? id, CancellationToken ct)`:
  - `null` id, unknown or expired → the `generatedScheduleId` error "Generate the schedule again to save it.";
  - `Schedule.Scheduled.Count == 0` → "There is nothing to save in this schedule.";
  - otherwise the snapshot.
  
  Use the constants in `SavedPlanValidator`. Then change `SavedPlanService.SaveAsync` to call it, keeping its exact behaviour and order (the existing-plan check stays before it). `SavePlanEndpointTests` must pass unchanged. Add tests for the three cases to `backend/tests/SpekLaiku.UnitTests/GeneratedScheduleServiceTests.cs`. Research section 3.
- [x] T040 [P] [US3] Extend the details response (research section 4, contract "GET /api/plans/{id}: changed"):
  - `backend/src/SpekLaiku.Api/DTOs/Responses/SavedPlanLocationResponse.cs` becomes `(long Id, string Name, string Area, double Latitude, double Longitude)`.
  - `backend/src/SpekLaiku.Api/DTOs/Responses/SavedPlanResponse.cs` gains `IReadOnlyList<CheckedPlanActivityResponse> Activities` after `MaxTravelDistanceKm`.
  - In `backend/src/SpekLaiku.Api/Mapping/SavedPlanMappingProfile.cs`, add `.ForCtorParam(nameof(SavedPlanResponse.Activities), o => o.MapFrom(plan => plan.Snapshot.Activities))`. It uses the existing `CheckedPlanActivity → CheckedPlanActivityResponse` map in `PlanActivityMappingProfile`.
  - Update the doc comments: the activities are the owner's own values, needed to edit the plan. The owner, the generated schedule id and the places' keys are still not sent.
- [x] T041 [US3] Update the tests for the details response:
  - **`backend/tests/SpekLaiku.UnitTests/SavedPlanMappingTests.cs`**:
    - Replace the assertion that `CategoryId` and the limits are not exposed with assertions that `Location.Id` and `Activities` (category id, name, type as text, duration, daylight, limits, Indoor limits `null`) are mapped.
    - Keep the assertions that `OwnerId`, `GeneratedScheduleId` and `NearbyPlace.Key` are not exposed.
  - **`backend/tests/SpekLaiku.IntegrationTests/SavedPlanDetailsEndpointTests.cs`**: the contract body now includes `location.id` and `activities` (keys exactly as in the contract).
  
  (depends on T040)
- [x] T042 [US3] Add `Task<SavedPlanChange> ReplaceAsync(string ownerId, Guid id, SavePlanRequest request, CancellationToken ct)` to `backend/src/SpekLaiku.Api/Services/SavedPlanChangeService.cs`:
  1. **Ownership**: call `FindOwnedAsync`, and return its refusal if there is one.
  2. **Name**: check it with `SavedPlanValidator.CheckName`.
  3. **Repeat**: if `request.GeneratedScheduleId == plan.GeneratedScheduleId` and it is not `null`, then on no name error set `plan.Name`, save and return `Changed(plan)`, and otherwise return `Invalid`.
  4. **Held by another plan**: if another saved plan holds this id (`AnyAsync(p => p.GeneratedScheduleId == id && p.Id != plan.Id)`), add the expired error.
  5. **Otherwise**: call `generatedSchedules.FindSavableAsync` and collect its error.
  6. **Errors**: any error → `Invalid(errors)`, with name and schedule errors together and the plan unchanged.
  7. **Replace**: set
     - `Name`, `SavedAtUtc = now`;
     - `LocationName = snapshot.Setup.Location.Name`, `Dates = snapshot.Setup.Dates.ToList()`;
     - `GeneratedScheduleId = request.GeneratedScheduleId`, `Snapshot = snapshot`.
     
     Leave `Id`, `OwnerId` and `CreatedAtUtc` alone. Save.
  8. **Race**: catch the unique violation on `IX_SavedPlans_GeneratedScheduleId` as `SavedPlanService.InsertAsync` does, and return `Invalid` with the expired error (detach and reload are not needed; the plan was not changed in the database).
  
  Doc comment: spec FR-010, FR-011, research section 3. (depends on T008, T039)
- [x] T043 [US3] Add `[HttpPut("{id:guid}")] Replace(Guid id, SavePlanRequest request, CancellationToken ct)` to `backend/src/SpekLaiku.Api/Controllers/PlansController.cs`. It returns `ToActionResult(change, plan => Ok(mapper.Map<SavedPlanSummaryResponse>(plan)))`, with `[ProducesResponseType]` for 200, 400 and 404. (depends on T042)
- [x] T044 [US3] Add `backend/tests/SpekLaiku.IntegrationTests/ReplacePlanEndpointTests.cs`. The setup saves a plan, then generates a second schedule with a different setup (another date or activity) for the id.
  - (a) 200, same `id`, the new name, location name and dates, and `savedAt` equal to `factory.Clock` now. `GET /api/plans/{id}` shows the new activities and schedule, `GET /api/plans` lists it once, and `CreatedAtUtc` is unchanged.
  - (b) The same request again gives 200; only the name changes when a different name is sent.
  - (c) An id already saved as another plan of the same user gives 400 `errors.generatedScheduleId` "Generate the schedule again to save it.", and the plan is unchanged.
  - (d) Unknown id, `null` id, and expired (clock +30 minutes, restored in `finally`) give the same error. An empty name plus an unknown id give both errors.
  - (e) A nothing-scheduled generated schedule gives "There is nothing to save in this schedule.".
  - (f) Extra body fields (`"setup"`, `"scheduled"`, `"ownerId"`) are ignored.
  - (g) After each 400, the stored snapshot, name and `SavedAtUtc` equal the values before.
  
  (depends on T043)

### Frontend for User Story 3

- [x] T045 [P] [US3] Update `frontend/src/types/savedPlan.ts` and the fixtures:
  - Add `id: number` to `SavedPlan.location`.
  - Add `export type SavedPlanActivity = Omit<CheckedPlanActivity, "id">` and `activities: SavedPlanActivity[]` to `SavedPlan`.
  - Update `savedPlan` in `frontend/src/tests/savedPlansFixtures.ts` with a location id and two activities: one Outdoor with limits, and one Indoor with `null` limits.
  
  Existing tests keep passing.
- [x] T046 [P] [US3] Add `replacePlan(id, request: SavePlanRequest, signal)` to `frontend/src/api/savedPlansApi.ts`. It returns `SavePlanAnswer` plus `{ kind: "notFound" }`, for 200, 400 (field errors as in `savePlan`), 401, 403 and 404, and sends `PUT /api/plans/{id}` with the JSON body. Add the tests to `frontend/src/tests/savedPlansApi.test.ts`.
- [x] T047 [P] [US3] Add `frontend/src/helpers/planFromSavedPlan.ts`: `fillPlanFromSavedPlan(plan: SavedPlan)`. It clears and then sets `usePlanSetupStore` and `usePlanActivitiesStore` exactly as in the data-model.md table "Filling the plan in progress from a saved plan":
  - setup `location`, `locationText = locationLabel(location)`, `dates`, `maxTravelDistanceText`, `checked: null`, `recheckNotice: false`;
  - one activity per saved activity, with `id: crypto.randomUUID()`, the numbers as text and `""` for `null`, `checked: null`.
  
  Use the stores' `setState`, without new store actions. Add `frontend/src/tests/planFromSavedPlan.test.ts`: the setup values, both activities, Indoor limits as `""`, unique ids, and nothing checked.
- [x] T048 [P] [US3] Add `frontend/src/stores/usePlanEditStore.ts`, persisted with `createJSONStorage(() => sessionStorage)` under the key `spek-laiku-plan-edit`, version 1, with `migrate` returning `{ edit: null, savedPlanKey: null }`.
  - **State**:
    - `edit: { planId: string; planName: string; ownerEmail: string } | null`;
    - `savedPlanKey: string | null` (research section 10, "Saved marker").
  - **Actions**:
    - `start(edit)`;
    - `clear()`, which clears only the edit;
    - `markSaved(setup, activities)`, which sets `savedPlanKey = planKey(setup, activities)`;
    - `clearAll()`, which clears the edit and the saved marker.
  
  Move the private `planKey` function from `frontend/src/stores/useKeptScheduleStore.ts` into `frontend/src/helpers/planKey.ts` and use it in both stores. `useKeptScheduleStore.test.ts` must pass unchanged.
  
  Add `frontend/src/helpers/hasPlanInProgress.ts` (spec FR-013):
  1. If the edit store has an edit, return true.
  2. If the setup and activities stores are both checked and `planKey(setup.checked, activities.checked) === savedPlanKey`, return false.
  3. Otherwise return true when the setup store has a `location` or any `dates`, or the activities store has any activity.
  
  Add `frontend/src/tests/usePlanEditStore.test.ts` and `frontend/src/tests/hasPlanInProgress.test.ts`:
  - an empty tab is false;
  - a typed location is true;
  - a plan saved and unchanged is false;
  - a plan saved and then one activity changed is true;
  - an edit of another plan is true.
- [x] T049 [US3] Clear the edit everywhere an edit must end:
  - **`frontend/src/stores/useLogoutStore.ts`**: also `usePlanEditStore.getState().clearAll()` (the edit and the saved marker) after a successful logout.
  - **`frontend/src/components/planActions.tsx`**: on `"deleted"`, clear the edit when `edit?.planId === plan.id`. This is added in US3 because the edit store does not exist before it.
  - **Tests**: extend `frontend/src/tests/useLogoutStore.test.tsx`, and add a case to `MyPlansPage.test.tsx`.
  
  (depends on T048)
- [x] T050 [US3] Add `frontend/src/components/editingNotice.tsx`. It renders nothing without an edit. Otherwise it renders a framed box (class `recheck-notice`, as `RecheckNotice`) with:
  - the text `` `Editing '${planName}'. Your saved plan is not changed until you save.` ``;
  - a **Cancel editing** button that clears the setup, activities, kept schedule and edit stores and navigates to `/plans/${planId}`.
  
  When `useCurrentUserStore` has a user whose `email` differs from `ownerEmail`, an effect clears the setup, activities and kept schedule stores, calls `usePlanEditStore.getState().clearAll()` (the edit and the saved marker), and renders nothing (research section 10). Show it under the `h1` and `PlanProgress` in these four pages:
  - `frontend/src/pages/PlanSetupPage.tsx`;
  - `frontend/src/pages/ActivitySelectionPage.tsx`;
  - `frontend/src/pages/PlacesAndForecastPage.tsx`;
  - `frontend/src/pages/ScheduleOverviewPage.tsx`.
  
  (depends on T048)
- [x] T051 [US3] Add **Edit plan** to the plan page. In `frontend/src/pages/PlanDetailsPage.tsx`, the actions element gets an **Edit plan** button first.
  - **Start editing**:
    1. Fill the stores with `fillPlanFromSavedPlan(plan)`.
    2. Clear `useKeptScheduleStore`.
    3. Call `usePlanEditStore.getState().start({ planId: plan.id, planName: plan.name, ownerEmail: user.email })`.
    4. `navigate("/plan/setup")`.
  - **Plan in progress**: when `hasPlanInProgress()` is true, first show `ConfirmDialog` with the question "Editing this plan replaces the plan you have not saved. Continue?" and `confirmLabel="Continue"`.
    - **Continue** starts editing.
    - **Cancel** and Escape close the dialog, return focus to Edit plan and keep the stores unchanged.
  
  If the page passes about 200 lines, move the action buttons into `frontend/src/components/planDetailsActions.tsx`. (depends on T047, T048, T010)
- [x] T052 [US3] Extend `frontend/src/stores/useSavePlanStore.ts`:
  - `submit` takes one object, `submit({ generatedScheduleId, planId, setup, activities }: SaveSubmission)`, where `planId?: string`, `setup: CheckedPlanSetup` and `activities: CheckedPlanActivity[]`.
    - It sends `replacePlan(planId, request)` when `planId` is set, and otherwise `savePlan` as before.
    - The store keeps the whole submission as `lastSubmission`, replacing `lastRequest`, so `retry()` sends the same request to the same endpoint and still has the setup and activities for the saved marker.
  - New status `planGone` on a `notFound` answer.
  - New action `saveAsNew()`: clears the plan id, sets `status: "open"` and keeps the name.
  - After a `"saved"` answer, both for a new plan and for a replace, call `usePlanEditStore.getState().markSaved(setup, activities)` with the submission's setup and activities, also when the answer comes from `retry()` (research section 10, "Saved marker").
  - The constants `changesSavedMessage = "✓ Success: Changes saved."`, `changesFailedMessage = "Error: Changes could not be saved. Try again."` and `planGoneSaveAsNewMessage = "This plan no longer exists. Save it as a new plan instead."`.
  
  If the file passes 200 lines, move `toResult` into `frontend/src/helpers/savePlanResult.ts`. Extend `frontend/src/tests/useSavePlanStore.test.ts`:
  - `PUT` with the plan id;
  - Retry repeats the `PUT`;
  - 404 gives `planGone`;
  - `saveAsNew` then `submit` sends `POST`;
  - 400 expired gives `expired` as for a new plan;
  - a successful save and a successful replace both set `savedPlanKey`, and a failed save does not;
  - a save that fails with 500 and then succeeds through Retry sets `savedPlanKey`.
  
  Update the existing `useSavePlanStore.test.ts` calls to the object form, with no change to what they assert. (depends on T046, T048)
- [x] T053 [US3] Update `frontend/src/components/savePlanSection.tsx` for editing. When `usePlanEditStore` has an edit and the user is the Active Registered owner:
  - The closed state shows a **Save changes** button. Opening it sets the store's name to `edit.planName`.
  - The form uses `PlanNameForm` with `formLabel="Save changes"` and `submitLabel="Save changes"`. Submit calls `submit({ generatedScheduleId: schedule.generatedScheduleId, planId: edit.planId, setup, activities })`.
  - The existing Save plan form calls `submit({ generatedScheduleId: schedule.generatedScheduleId, setup, activities })` (no plan id). `SavePlanSection` already receives `setup` and `activities` as props.
  - **Saved**: shows `<p role="status">✓ Success: Changes saved. <Link to={`/plans/${planId}`}>Open plan</Link></p>`, then clears the edit store, keeping the plan id for the link in a ref. The setup and activities stay.
  - **Server error**: shows `changesFailedMessage` with Retry.
  - **Expired**: shows the existing "Generate the schedule again to save it." with **Generate again**.
  - **planGone**: shows `planGoneSaveAsNewMessage` with a **Save plan** button. That button clears the edit and calls `saveAsNew()`, which shows the normal Save plan form with the name kept.
  - **Nothing scheduled**: nothing is offered, as before.
  - **sessionExpired**: the existing feature 010 path keeps the schedule and sends the user to Log in with `returnTo=/plan/schedule`. The persisted edit store is not cleared, so the user comes back in edit mode.
  
  Keep the file under about 200 lines. Move the Save changes branch into `frontend/src/components/saveChangesSection.tsx` if needed. (depends on T012, T050, T052)
- [x] T054 [US3] Add `frontend/src/tests/editingNotice.test.tsx`, and extend the planning step and plan page tests:
  - **The notice**: shown on each of the four steps with the plan name; absent without an edit. **Cancel editing** clears the stores and opens `/plans/{id}`. A different signed-in email discards the edit.
  - **`PlanDetailsPage.test.tsx`**:
    - Edit plan fills Plan Setup (the location text, dates and distance are visible) and Activity Selection (both activities with their values).
    - With a plan in progress, the confirmation dialog appears; Cancel keeps the in-progress location, and Continue replaces it.
    - After a successful Save plan, Edit plan on another plan opens Plan Setup without the dialog. After a save followed by a change to the setup, the dialog appears.
    - A saved plan with a past date shows "Dates cannot be in the past." after Continue (this uses the existing step check, with the fake period from the server).
  - **`frontend/src/tests/savePlanSection.test.tsx`**, while editing:
    - Save changes with the name filled;
    - `PUT /api/plans/{id}` with the schedule id;
    - "✓ Success: Changes saved." with an "Open plan" link to `/plans/{id}`;
    - the notice is gone afterwards;
    - 500 with Retry;
    - expired with Generate again;
    - 404 then **Save plan** sends `POST /api/plans`;
    - a schedule with nothing scheduled offers nothing;
    - 401 on Save changes opens Log in with "Your session has expired. Log in again.". After logging in as the same email, the Schedule Overview shows the editing notice, the same schedule and **Save changes**.
  
  (depends on T050, T051, T053)
  - Result (2026-11-19):
    - **Service split (T042)**: `SavedPlanChangeService` would have passed 200 lines with rename, so `ReplaceAsync` is in a new `SavedPlanEditService`, and the ownership check is the static `SavedPlanOwnership.FindOwnedAsync`, used by both (research section 7, "Update during implementation"). T056 adds `RenameAsync` to `SavedPlanEditService`.
    - **Test clock**: `PostgreSqlApiFactory` now registers `SavedPlanChangeService` and `SavedPlanEditService` with the test clock, like `SavedPlanService`. Before this, the Phase 4 copy order tests passed only because the real clock also moves forward.
    - **Cancel editing (T050)**: clearing the plan in progress on a planning step made that step redirect to an earlier step, and the redirect won over the navigation to the plan page (React Router navigates as a lower-priority update). Cancel editing now ends the edit and navigates with `NavigationState.discardPlanInProgress`, and the plan page clears the setup, activities and kept schedule when it opens. The clearing is the shared helper `frontend/src/helpers/discardPlanInProgress.ts`, also used when another account's edit is discarded. A test covers Cancel editing from step 2.
    - **New files beyond the plan**:
      - `components/editPlanButton.tsx` (T051), so the plan page stays small.
      - `components/savePlanStatus.tsx` (the form's status slot, out of `savePlanSection.tsx` to stay under 200 lines).
      - `helpers/savePlanResult.ts` (T052's fallback, so `useSavePlanStore.ts` stays under 200 lines).
      - `helpers/discardPlanInProgress.ts`.
    - **Retry sends the same name**: `lastSubmission` keeps the name that was sent, so Retry sends exactly the same request even if the field was changed after the error, as in feature 010.
    - **Checks**: backend build with 0 warnings; 663 unit (+4) and 354 integration tests (+7); `dotnet format` clean. Frontend lint and Prettier clean; 86 files (+3) and 1202 tests (+44); build clean.

**Checkpoint**: Editing works end to end. The edit survives a reload in the same tab and is discarded by Cancel editing, logout, deleting the plan or another account. Tests are green.

---

## Phase 6: User Story 4 - Rename a saved plan (Priority: P2)

**Goal**: A user changes a plan's name on the plan page. The schedule and "Saved on" are unchanged.

**Independent Test**: Open "Weekend in Kaunas", click **Rename**, enter "Kaunas trip" and save. "✓ Success: Plan renamed." is shown, and the heading, page title and breadcrumbs say "Kaunas trip". "Saved on" is unchanged.

### Backend for User Story 4

- [ ] T055 [P] [US4] Add `backend/src/SpekLaiku.Api/DTOs/Requests/RenamePlanRequest.cs`: `public sealed record RenamePlanRequest(string? Name);`, with the doc comment "Only the name; renaming never changes the schedule or the saved time (feature 011 spec FR-014)."
- [ ] T056 [US4] Add `Task<SavedPlanChange> RenameAsync(string ownerId, Guid id, RenamePlanRequest request, CancellationToken ct)` to `backend/src/SpekLaiku.Api/Services/SavedPlanEditService.cs` (split from `SavedPlanChangeService` in Phase 5):
  1. Call `FindOwnedAsync`, and return its refusal if there is one. Ownership comes first, so a foreign or missing plan gives 403 or 404 even with an invalid name.
  2. Check the name with `SavedPlanValidator.CheckName`. On error return `Invalid([error])`.
  3. Set `plan.Name = trimmed` only, save, and return `Changed(plan)`.
  
  (depends on T008, T055)
- [ ] T057 [US4] Add `[HttpPut("{id:guid}/name")] Rename(Guid id, RenamePlanRequest request, CancellationToken ct)` to `backend/src/SpekLaiku.Api/Controllers/PlansController.cs`. It returns `ToActionResult(change, plan => Ok(mapper.Map<SavedPlanSummaryResponse>(plan)))`, with `[ProducesResponseType]` for 200, 400 and 404. (depends on T056)
- [ ] T058 [US4] Add `backend/tests/SpekLaiku.IntegrationTests/RenamePlanEndpointTests.cs`:
  - (a) 200 with the new name. `SavedAtUtc`, `CreatedAtUtc`, `GeneratedScheduleId` and the snapshot are unchanged in the database;
  - (b) `"  Kaunas trip  "` is stored as `"Kaunas trip"`;
  - (c) `""`, `"   "` and 81 characters give 400 with `errors.name` and the exact messages, and the name is unchanged;
  - (d) `"<script>"` is stored unchanged;
  - (e) an unknown id with an empty name gives 404, not 400;
  - (f) `factory.Forecast.Calls` and `factory.MapPlaces.Calls` are the same before and after the request (spec FR-017).
  
  (depends on T057)

### Frontend for User Story 4

- [ ] T059 [P] [US4] Add `renamePlan(id, name, signal)` to `frontend/src/api/savedPlansApi.ts`. It returns `{ kind: "renamed"; plan: SavedPlanSummary } | { kind: "invalid"; errors } | notFound | forbidden | unauthorized`, and sends `PUT /api/plans/{id}/name` with `{ name }`. Add `RenamePlanRequest` to `frontend/src/types/savedPlan.ts`. Add the tests to `frontend/src/tests/savedPlansApi.test.ts`.
- [ ] T060 [US4] Add `frontend/src/stores/useRenamePlanStore.ts`, with the same shape as `useSavePlanStore`:
  - **Statuses**: `closed | open | saving | renamed | invalid | notFound | sessionExpired | serverError`.
  - **State and actions**: `name`, `nameError`, `nameRefusals`, `lastRequest`, `controller`; `open(currentName)`, `cancel`, `setName`, `submit(planId)`, `retry`, `reset`.
  - An empty name is refused locally with "Enter a plan name.".
  - The constants are `planRenamedMessage = "✓ Success: Plan renamed."` and `renameFailedMessage = "Error: Plan could not be renamed. Try again."`.
  - On `renamed` it calls `useSavedPlanStore.getState().rename(plan.name)`. Add `rename(name)` to `frontend/src/stores/useSavedPlanStore.ts`; it updates the loaded plan's name.
  
  Add `frontend/src/tests/useRenamePlanStore.test.ts`: the local empty check, success updates the saved plan store, 400 messages, 404, 500 and timeout, Retry, 401 gives `sessionExpired`. (depends on T059)
- [ ] T061 [US4] Add `frontend/src/components/renamePlanForm.tsx`, using `PlanNameForm` with `formLabel="Rename plan"` and `submitLabel="Save"`.
  - The status slot shows `renamingMessage = "Renaming your plan…"` (defined in `useRenamePlanStore`) while saving, `renameFailedMessage` with **Retry**, and "This plan no longer exists." on 404.
  - Cancel and Escape close it and return focus to the Rename button.
  - `sessionExpired` sends the user to Log in with `returnTo` set to the plan page and `loginReason: "expired"`, after `markSessionEnded()`, as `savePlanSection.tsx` does.
  
  In `frontend/src/pages/PlanDetailsPage.tsx`, add a **Rename** button after Edit plan that opens the form in place of the action buttons. On `renamed`, show `planRenamedMessage` as the view's notice. The heading, `usePageTitle` and breadcrumbs follow the store's plan name. (depends on T012, T060)
- [ ] T062 [US4] Extend `frontend/src/tests/PlanDetailsPage.test.tsx` for Rename:
  - the form opens with the current name and focus in the field;
  - an empty name shows "Enter a plan name." with focus on the field, both on the first and the second refusal;
  - a valid name sends `PUT /api/plans/{id}/name`, shows "✓ Success: Plan renamed.", and updates the heading, title and breadcrumb;
  - "Saved on" is unchanged;
  - "Renaming your plan…" is shown in a status region while the request is pending;
  - Escape closes the form with focus on Rename;
  - 500 shows the error with Retry and keeps the entered name.
  
  (depends on T061)

**Checkpoint**: Rename works with validation, focus and errors. Tests are green.

---

## Phase 7: User Story 5 - Nobody else can change my plans (Priority: P1)

**Goal**: Every change operation is refused for Visitors, Administrators, Suspended users and non-owners, with no plan data, nothing changed and nothing copied.

**Independent Test**: As user B, send delete, duplicate, rename and save changes requests for user A's plan. Each gives 403, and A's plan is unchanged and has no copy. Repeat signed out (401), as an Administrator (403) and as a Suspended user (403).

- [ ] T063 [US5] Add `backend/tests/SpekLaiku.IntegrationTests/PlanManagementAuthorizationTests.cs`, following `SavedPlansAuthorizationTests.cs`. Use a theory over the endpoints `"delete"`, `"duplicate"`, `"rename"` and `"replace"`, with a helper that sends each with a valid body. For `"replace"`, use a fresh `generatedScheduleId` from the caller where the caller can generate, and otherwise from A.
  - (a) Not signed in: 401 with an empty body.
  - (b) Administrator Active, Administrator Suspended and Registered User Suspended: 403.
  - (c) Another Active Registered User on A's plan: 403. The body contains neither A's plan name nor its location name. A's row is unchanged (name, `SavedAtUtc`, snapshot JSON), A still has exactly one plan, and B has no plans.
  - (d) An unknown GUID: 404 with "This plan no longer exists.".
  - (e) An id that is not a GUID: 404.
  
  Doc comment: spec FR-015, FR-016, SC-005, constitution III. (depends on T017, T031, T043, T057)
- [ ] T064 [P] [US5] Confirm the frontend handles 403 and 401 on every new call:
  - a 403 refreshes the current user, so the guards show Account Suspended or Access Denied;
  - a 401 on rename and save changes goes to Log in with "Your session has expired. Log in again.".
  
  Add one test per store (`usePlanActionsStore`, `useRenamePlanStore`, `useSavePlanStore` with a plan id) where it is not already covered.

**Checkpoint**: Authorization is verified for all four new endpoints. Tests are green.

---

## Phase 8: User Story 6 - Manage plans on a phone and with assistive technology (Priority: P2)

**Goal**: All new actions, forms and dialogs work at 320 px, with the keyboard only and with a screen reader.

**Independent Test**: At 320 px with a keyboard and screen reader, duplicate a plan on My plans, delete the copy through the dialog, then rename a plan with an empty name, fix it and save.

- [ ] T065 [P] [US6] Update `frontend/src/styles.css`:
  - **Dialog**: `.confirm-backdrop` covers the page with a semi-transparent background. The dialog is centred, with `max-width: min(28rem, calc(100vw - 2rem))` and wrapping text.
  - **Row actions**: Open, Duplicate and Delete wrap in the last table cell. In the 320 px card layout they sit below the card title as in feature 010, with at least 44 px tap targets.
  - **Notice and forms**: the editing notice and the rename form fit at 320 px.
  - **Contrast**: 4.5:1 for text and 3:1 for the backdrop edge and buttons (NFR-012). Use the existing colour variables.
- [ ] T066 [P] [US6] Extend `frontend/src/tests/accessibility.test.tsx`:
  - My plans and the plan page with the dialog open have no axe violations;
  - the plan page with the rename form open and an error has none;
  - Plan Setup with the editing notice has none.
- [ ] T067 [P] [US6] Extend `frontend/src/tests/keyboard.test.tsx` with these flows, using only the keyboard (Tab, Shift+Tab, Enter, Escape):
  - Duplicate, then Delete through the dialog, on My plans;
  - Rename with an error and a fix;
  - Edit plan, then Cancel editing.
- [ ] T068 [P] [US6] Extend `frontend/src/tests/responsive.test.tsx`: at 320 px, My plans with actions, the plan page with its actions, the dialog and the rename form use the card and wrapping classes, and have no fixed widths wider than the viewport.

**Checkpoint**: Accessibility, keyboard and responsive tests are green for every new screen part.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, full verification, review. No new behaviour.

- [ ] T069 [P] Update `README.md`:
  - **"Saved plans" section**: add Delete (with confirmation, permanent), Duplicate ("Copy of …", same Saved date, listed above the original), Rename, and Edit plan (regenerate, then Save changes replaces the plan; duplicate first to keep the original).
  - **Database or migrations part**: mention the migration `AddSavedPlanCreatedAt`.
- [ ] T070 [P] In `docs/ux-design.md`:
  - **My Plans row** in the screen table: change "(feature 010 lists and opens; duplicate and delete come with feature 011)" to say all actions are available.
  - **Plan Details / Edit row**: editing and renaming come with feature 011, and recalculating with feature 012.
  - **My Plans state table**: add the Rename success "✓ Success: Plan renamed." and the Save changes success "✓ Success: Changes saved." where they belong.
  
  Change nothing else. Check `docs/architecture.md` for statements that contradict the implementation, and correct only what is now wrong.
- [ ] T071 Run all checks and confirm they pass:
  - from the repository root, `dotnet build SpekLaiku.slnx`, `dotnet test SpekLaiku.slnx` and `dotnet format SpekLaiku.slnx --verify-no-changes`;
  - from `frontend/`, `npm run lint`, `npm test` and `npm run build`.
  
  Compare the test counts with T002. The only existing assertions allowed to change are:
  - T041: the `SavedPlanMappingTests` exposure assertion, and the `SavedPlanDetailsEndpointTests` contract keys. Both now check more fields, not fewer.
  - T045: the `savedPlan` fixture gains fields.
  - T005 and T006: the list-order tie-break.
  - T048: `planKey` moves to a helper, and `useKeptScheduleStore.test.ts` is unchanged.
  - T027: the feature 010 `PlanDetailsPage.test.tsx` "no actions" test is narrowed to "no Save plan or Recalculate, nothing generated", and the `keyboard.test.tsx` My plans tab order includes each row's actions. Both change because feature 011 adds the actions on purpose (spec FR-019).
  
  List them in the PR description (constitution III).
- [ ] T072 Apply the migration to the local database (`dotnet ef database update --project src/SpekLaiku.Api` from `backend/`) and walk through `specs/011-plan-management/quickstart.md` Scenarios 1 to 6 in the running app. Record which passed, and any that could not be done (for example if Overpass is unavailable).
- [ ] T073 Review `git diff main...HEAD` and confirm:
  - only the files in plan.md "Source Code", plus the README, docs and spec files, changed;
  - there is no debug code, commented-out code or temporary file;
  - every new or changed C# class is under 200 lines (`SavedPlanService`, `SavedPlanChangeService`, `PlansController`);
  - `savePlanSection.tsx`, `useSavePlanStore.ts`, `PlanDetailsPage.tsx` and `MyPlansPage.tsx` are each under about 200 lines;
  - the migration adds only `CreatedAtUtc` and the one `UPDATE`.
- [ ] T074 Run a separate AI-assisted review of the branch: `/code-review`, and `/security-review` because this feature adds change and delete operations behind access control. Record the tool, the important findings, the changes made, and the findings not applied with a short reason, for the Pull Request description (constitution VII). Apply accepted fixes and re-run T071.
- [ ] T075 Capture screenshots for the Pull Request (constitution V), at desktop width and at 320 px:
  - My plans with the actions;
  - the delete dialog;
  - "Plan duplicated." with the copy above the original;
  - the plan page with its actions;
  - the rename form with a validation error;
  - Plan Setup with the editing notice;
  - "✓ Success: Changes saved.".
  
  Keep the images outside the repository unless the README already stores screenshots.
- [ ] T076 Prepare the Pull Request description for the user. Include:
  - a link to `specs/011-plan-management/spec.md`;
  - a summary of the change;
  - the tests and checks run (T071, T072);
  - the migration `AddSavedPlanCreatedAt`;
  - the change to the `GET /api/plans/{id}` body (activities and location id) and the replaced feature 010 test assertion;
  - the spec refinement made during planning (User Story 2 scenario 2, "at most 80 characters");
  - the screenshots;
  - the AI review record from T074.
  
  The user opens and merges the Pull Request.

**Checkpoint**: All checks green, docs current, review recorded, screenshots and PR description ready. Ready for commit and Pull Request on request.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Setup): no dependencies.
- **Phase 2** (Foundational): depends on Phase 1. Blocks all story phases.
- **Phase 3** (US1 Delete): depends on Phase 2.
- **Phase 4** (US2 Duplicate): depends on Phase 3 (`usePlanActionsStore`, `planActions.tsx`, the `actions` slot on both pages).
- **Phase 5** (US3 Edit): depends on Phase 2 (dialog, name form, plan view). T049 adds clearing the edit on delete to `planActions.tsx` from Phase 3, and T052 extends feature 010's save with the saved marker.
- **Phase 6** (US4 Rename): depends on Phase 2 (name form, change service). Its page work follows Phase 5's Edit plan button order.
- **Phase 7** (US5 Authorization): depends on Phases 3 to 6, because all four endpoints must exist.
- **Phase 8** (US6): depends on Phases 3 to 6.
- **Phase 9** (Polish): depends on all story phases.

### User Story Dependencies

- **US1 (P1)**: foundation only. It is the MVP: a user can delete a plan they no longer want.
- **US2 (P1)**: reuses US1's actions store and component.
- **US3 (P1)**: independent of US1 and US2 on the backend. On the frontend it only touches `planActions.tsx` to clear an edit on delete.
- **US4 (P2)**: independent of US1 to US3 on the backend. On the frontend it shares the plan page's action area.
- **US5 (P1)**: verifies the ownership checks of US1 to US4. It is placed after US4 so it covers all four endpoints in one test class.
- **US6 (P2)**: cross-checks all new screens.

### Within Each Phase

- Backend types and validators come before services, services before controllers, and controllers before endpoint tests.
- Frontend types come before the API, then stores, components, pages and page tests.
- Each phase ends with its tests green before the next phase starts.

## Parallel Opportunities

- **Phase 2**:
  - T006, T007, T010, T011, T013 and T014 touch different files.
  - The backend (T003 to T009) and the frontend (T010 to T014) can run side by side.
- **Phase 3**: T019 and T020 next to the backend T016 to T018. T022 after T021.
- **Phase 4**: T028 and T029 on the backend; T033 and T034 on the frontend.
- **Phase 5**: T040 next to T039; T045, T046, T047 and T048 on the frontend in parallel.
- **Phase 6**: T055 and T059.
- **Phase 7**: T064 next to T063.
- **Phase 8**: T065 to T068 are separate files.
- **Phase 9**: T069 and T070.

### Parallel Example: Phase 5 (User Story 3)

```text
Task: "T040 [P] [US3] Details response gains location.id and activities"
Task: "T045 [P] [US3] frontend/src/types/savedPlan.ts and fixtures"
Task: "T046 [P] [US3] replacePlan in frontend/src/api/savedPlansApi.ts"
Task: "T047 [P] [US3] frontend/src/helpers/planFromSavedPlan.ts"
Task: "T048 [P] [US3] frontend/src/stores/usePlanEditStore.ts and hasPlanInProgress.ts"
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 → Phase 2 (stop for review).
2. Phase 3: delete with confirmation (stop for review).
3. **Validate**: a user deletes a plan from My plans and from the plan page. Cancel deletes nothing, and the address then shows "This plan no longer exists.".

### Incremental Delivery

1. Phase 4 (US2): duplicate.
2. Phase 5 (US3): edit and Save changes. This is the largest phase, so review it at its checkpoint.
3. Phase 6 (US4): rename.
4. Phase 7 (US5): authorization verified across all four endpoints.
5. Phase 8 (US6): phone, keyboard and screen reader.
6. Phase 9: docs, verification, review, PR.

Each phase is a stop point for diff review. Commits use Conventional Commit messages (for example `feat(plans): delete a saved plan`) and are made only when the user asks.
