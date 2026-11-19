# Research: 011-plan-management

**Date**: 2026-11-19 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

The Technical Context had no open questions: the stack, the storage and the authorization are those of feature 010. The sections below record the design decisions this feature needs.

## 1. No new packages needed

- **Decision**: No NuGet or npm package.
- **Rationale**: Every part is already available: EF Core and Npgsql for the new column and the change operations, AutoMapper for the responses, Zustand with `persist` for the edit in progress, React Router for navigation. The confirmation dialog is a small component (section 9).
- **Alternatives considered**: A dialog library (for example Radix UI or `react-modal`). Rejected: the project rules forbid a package that the plan cannot justify, and one dialog needs about 60 lines.

## 2. Endpoints: one per operation, under the existing `/api/plans`

- **Decision**:
  - `DELETE /api/plans/{id}` deletes (204).
  - `POST /api/plans/{id}/copies` duplicates (201 with the copy's summary and a `Location` header).
  - `PUT /api/plans/{id}/name` renames (200 with the summary).
  - `PUT /api/plans/{id}` saves changes from an edit (200 with the summary). The body is `{ generatedScheduleId, name }`, the same as a save.
  - `GET /api/plans/{id}` also returns the plan's activities and the location's id, so "Edit plan" can fill the planning steps without a second request (section 4).
  
  All of them are on `PlansController` under the existing `ActiveRegisteredUser` policy. See [contracts/plans-api.md](contracts/plans-api.md).
- **Rationale**: Each operation has its own result and error messages, and its own authorization test. Separate routes keep each action thin and each test readable. Rename and Save changes are different operations: rename must never touch the schedule (spec FR-014), and Save changes must always replace it from a generated schedule (spec FR-011). `PUT /api/plans/{id}` replaces the whole plan, which is what `PUT` means.
- **Alternatives considered**:
  - One `PATCH /api/plans/{id}` for rename and save changes. Rejected: one body whose meaning depends on which fields are present is harder to validate and to test.
  - `POST /api/plans/{id}/duplicate`. Rejected for the resource form `copies`; both work, and `copies` returns the new resource with `201 Created` like `POST /api/plans`.

## 3. Saving changes reuses the generated schedule rule of feature 010

- **Decision**: `PUT /api/plans/{id}` takes only the `generatedScheduleId` and the name. The server copies the remembered snapshot into the plan, as `POST /api/plans` does. It sets `SavedAtUtc` to now, sets `GeneratedScheduleId` to the new id, and copies `LocationName` and `Dates` from the snapshot. The plan keeps its `Id`, `OwnerId` and `CreatedAtUtc`.
  - The checks that decide whether a generated schedule can be saved move from `SavedPlanService` into one method used by both services, `GeneratedScheduleService.FindSavableAsync`:
    - It is remembered and not expired.
    - Something is scheduled in it.
    
    The checks keep the same messages.
  - **Repeats**:
    - When the same plan already holds this `generatedScheduleId` (a repeated or double-submitted Save changes), the name is applied and 200 is returned. Nothing else changes.
    - When another plan holds it (for example it was saved as a new plan, or another plan was edited with it in another tab), the answer is 400 "Generate the schedule again to save it.", as in feature 010.
    - A unique index violation from a race is handled in the same way as in `SavedPlanService.InsertAsync`.
- **Rationale**: Spec FR-011 requires the replacing schedule to be one the server generated. Reusing the rule keeps one implementation (constitution I, DRY). It also keeps the unique `GeneratedScheduleId` meaning "this generated schedule is saved in exactly one plan".
- **Alternatives considered**:
  - Accepting the setup and schedule from the browser. Rejected by spec FR-011.
  - Keeping the old `GeneratedScheduleId` and allowing reuse. Rejected: the idempotency check of feature 010 depends on the id being unique.

## 4. Loading a plan into the planning steps: the details response gains the activities and the location id

- **Decision**: `GET /api/plans/{id}` adds:
  - `location.id`, the place id that Plan Setup sends on Continue.
  - `activities`: the saved `CheckedPlanActivity` list with `categoryId`, `name`, `type`, `durationHours`, `requiresDaylight` and the four limits, in the shape of `CheckedPlanActivityResponse` from feature 005 without its browser `id`.
  
  "Edit plan" fills the stores from the plan the page has already loaded:
  - The setup store gets the location, `locationText`, the dates and the distance, with `checked = null`.
  - The activities store gets one `PlanActivity` per saved activity, with a new browser id, its numbers as text and `checked = null`.
  
  Then it opens Plan Setup. Every step checks its values again on Continue, exactly as for a new plan (spec FR-008).
- **Rationale**: The plan page already has the plan, so editing starts with no second request, no extra loading state and no extra error state. The values belong to the signed-in owner, so sending them hides nothing. The server never trusts them: Plan Setup looks the place up again by its id, and Activity Selection reads each category again (features 004 and 005).
  - **Change to feature 010**: `SavedPlanMappingTests` asserted that `CategoryId` and the activity limits are not exposed. That was a YAGNI choice, not a security rule (feature 010 research has no reason against it). The test is changed to check that the new fields are mapped and that `OwnerId`, `GeneratedScheduleId` and `NearbyPlace.Key` are still not exposed.
- **Alternatives considered**:
  - A separate `GET /api/plans/{id}/draft` endpoint. Rejected: a second request with its own loading, error, 403 and 404 states and tests, for data the page could already have.
  - Marking the steps as already checked. Rejected: dates may have passed and categories may have changed, and spec FR-008 requires the usual checks.

## 5. Copies are listed directly above their original: a `CreatedAtUtc` column

- **Decision**: Add `CreatedAtUtc` (`timestamp with time zone`, required) to `SavedPlans` in a new migration, **`AddSavedPlanCreatedAt`**:
  - Existing rows get `CreatedAtUtc = SavedAtUtc` by a SQL step in the generated migration.
  - A save and a duplicate set it to now.
  - Save changes and Rename leave it unchanged.
  
  The list order becomes `SavedAtUtc` descending, then `CreatedAtUtc` descending, then `Id`.
  - A copy keeps the original's `SavedAtUtc` (clarification Q3) and is newer, so it is listed directly above its original, also after a reload.
  - A copy of a copy lands above both.
- **Rationale**: Spec FR-006 and User Story 2 require the copy directly above its original. Today's tie-break is `Id`, which is a random GUID, so the copy would land above or below at random. A creation time is the simplest stable key, and it says what it means.
- **Alternatives considered**:
  - A database sequence column. Rejected: it works the same, but its meaning is less clear.
  - Ordering only in the browser right after duplicating. Rejected: the order would change after a reload.
  - Giving the copy the current `SavedAtUtc`. Rejected by clarification Q3.

## 6. Copy name

- **Decision**: `SavedPlanValidator.CopyName(name)` returns `"Copy of " + name`, cut to 80 UTF-16 characters (the unit `CheckName` counts). When the cut would leave half of a surrogate pair (for example an emoji), that half is dropped, so the name is 79 characters. The spec says "at most 80" (FR-005), and User Story 2 scenario 2 was aligned with that during planning.
- **Rationale**: One place for the name rules (constitution I). A split surrogate would store an invalid character.
- **Alternatives considered**: Asking for a name before duplicating. Out of scope (spec Assumptions).

## 7. Backend structure: a second service for changes

- **Decision**: A new `SavedPlanChangeService` holds `RenameAsync`, `ReplaceAsync`, `DuplicateAsync` and `DeleteAsync`. Each first loads the plan tracked and checks the owner through one private method, which returns not found, forbidden or the plan. Each returns a `SavedPlanChange` result: changed (with the plan, or none for a delete), invalid (field errors), not found or forbidden.
  - `PlansController` maps this result with one private method: 200, 201 or 204; 400 with the validation problem; 403 through `Forbid()`; 404 with the "This plan no longer exists." problem body that `Get` already returns (moved into one helper).
  - `SavedPlanService` keeps saving, listing and reading, and loses the generated schedule checks to `GeneratedScheduleService.FindSavableAsync` (section 3).
- **Rationale**: `SavedPlanService` is 147 lines, and the four operations would take it well over the 200-line limit (constitution I). Changes to an existing plan are one responsibility, with a shared ownership check.
- **Alternatives considered**:
  - One service per operation. Rejected: four small classes that would repeat the ownership lookup.
  - Adding to `SavedPlanService`. Rejected by the line limit.
- **Update during implementation (Phase 5)**: with duplicate, delete and replace in place, `SavedPlanChangeService` was 191 lines, and rename would have passed 200. It was split by responsibility:
  - `SavedPlanChangeService` copies and deletes.
  - `SavedPlanEditService` edits in place: `ReplaceAsync`, and `RenameAsync` in US4.
  - The shared ownership check is the static `SavedPlanOwnership.FindOwnedAsync`, so it is still written once.
  
  The integration test factory registers both services with the test clock, as it does for `SavedPlanService`.

## 8. Ownership and authorization

- **Decision**:
  - The existing `ActiveRegisteredUser` policy on `PlansController` covers the new actions: a Visitor gets 401, and an Administrator or a Suspended user gets 403 (spec FR-015).
  - In `SavedPlanChangeService`, a plan that does not exist gives 404, and another user's plan gives 403 with no plan data and with nothing changed, copied or deleted.
  - A copy's owner is always the signed-in user. The request has no body, so there is no owner to send (spec FR-016).
  - The server keeps no record of "this plan is being edited". An edit is only browser state until Save changes, and Save changes checks the owner like every other operation.
- **Rationale**: The same model as feature 010 research section 7. It meets constitution IV (server-side authorization, ownership on every request) and III (an authorization test per protected operation).
- **Alternatives considered**: Answering 404 for another user's plan to hide its existence. Rejected: feature 010 clarification Q4 chose 403, and the ids are unguessable GUIDs.

## 9. Confirmation dialogs: one small accessible component

- **Decision**: `components/confirmDialog.tsx` renders `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at its question, and the two buttons. The confirm button comes first, matching "with **Delete** and **Cancel**".
  - It moves focus to the first button when it opens and keeps Tab and Shift+Tab inside.
  - Escape and **Cancel** call `onCancel`.
  - On close the parent returns focus to the button that opened it, using a stored ref.
  - The page behind does not get `inert`. The dialog covers it with a backdrop and keeps focus inside, which `docs/ux-design.md` section 10 asks for.
  
  The same component serves the Delete confirmation (spec FR-002) and the "Editing this plan replaces the plan you have not saved. Continue?" confirmation (spec FR-013).
- **Rationale**: The native `<dialog>` element with `showModal()` is not implemented by jsdom (version 29 in this project), so tests would need a stub that hides real behaviour. A plain component is fully testable with React Testing Library and small enough for the 200-line guideline.
- **Alternatives considered**:
  - The native `<dialog>` with a test stub. Rejected because of the stub.
  - `window.confirm`. Rejected: it cannot be styled, its focus return is browser-specific, and it does not meet the wording and accessibility rules in `docs/ux-design.md`.

## 10. The edit in progress: a small persisted store

- **Decision**: `stores/usePlanEditStore.ts` holds `{ planId, planName, ownerEmail } | null`, in `sessionStorage` like the setup and activities stores. That way an edit survives a reload and a login in the same tab, and is gone when the tab closes (spec FR-013).
  - The plan in progress is still the setup and activities stores, so the planning steps need no changes beyond showing the notice.
  - Starting an edit asks for confirmation first when the tab holds a plan in progress: a location, a date or an activity entered, or another edit. After confirming, it clears the kept schedule and the schedule, fills the setup and activities stores (section 4), sets the edit and opens Plan Setup.
  - **Cancel editing** clears the setup, activities, kept schedule and edit stores and opens `/plans/{planId}`.
  - Logging out clears the edit with the other plan stores (`useLogoutStore`).
  - When the signed-in user's email differs from `ownerEmail` (another account logged in after a session expired), the edit and the plan in progress are discarded when the notice first renders (spec Edge Cases). The server would refuse the save anyway (section 8).
  - After a successful Save changes the edit ends: the store is cleared and the notice disappears. The setup and activities stay as the plan in progress, as after a save in feature 010.
  - **Saved marker**: the store also holds `savedPlanKey: string | null`, the `checkedPlanRequest` JSON of the setup and activities at the last successful Save plan or Save changes (the same key as `useKeptScheduleStore`, moved to `helpers/planKey.ts`).
    - `hasPlanInProgress` returns false when there is no edit, both stores are checked, and their key equals `savedPlanKey`.
    - Any change to the setup or activities clears their `checked` value, so the plan counts as in progress again.
    - It is cleared on logout, and when the editing notice discards another account's edit.
    - The save store keeps the setup and activities with its last submission, so a save that succeeds on Retry records the marker too.
    
    Without it, every "Edit plan" after a save would warn about an unsaved plan (spec FR-013).
  - When the user deletes the plan being edited in the same tab, the edit is cleared.
- **Rationale**: This reuses the existing plan-in-progress mechanism (feature 004 research section 7, feature 010 research section 8). The email is the only user identifier the browser has (`CurrentUser` holds `email`, `role` and `accountStatus`).
- **Alternatives considered**:
  - A separate set of edit stores. Rejected: it would duplicate every planning step.
  - Holding the edit in the URL (`/plans/{id}/edit/...`). Rejected: every planning route and progress link would change.

## 11. One name form for Save plan, Save changes and Rename

- **Decision**: Extract `components/planNameForm.tsx` from `savePlanSection.tsx`: the "Plan name" field, focus on open and on every refusal, Escape as Cancel, the submit and Cancel buttons with labels from props, and a status slot.
  - `savePlanSection.tsx` uses it for Save plan, and for **Save changes** while editing, switching labels and messages from the edit store.
  - `renamePlanForm.tsx` uses it on the plan page.
  - `useSavePlanStore` gains the plan id to replace. It calls `replacePlan` instead of `savePlan` when the id is set, and gains a `planGone` status for a 404 ("This plan no longer exists. Save it as a new plan instead."). Its **Save plan** button clears the edit and reopens the form as a new save with the name kept.
  - A separate `useRenamePlanStore` handles the rename request and its states.
- **Rationale**: The three forms have the same field, rules, messages and keyboard behaviour (spec FR-009, FR-014, FR-020). One component keeps them the same and keeps `savePlanSection.tsx` (195 lines) under the 200-line guideline.
- **Alternatives considered**: Copying the form three times. Rejected by DRY and the size guideline.

## 12. Delete and duplicate in the browser

- **Decision**:
  - `stores/usePlanActionsStore.ts` holds the pending action (`{ kind: "delete" | "duplicate", planId }`), the last error with its Retry request, and the message to announce. It calls `deletePlan` and `duplicatePlan` in `api/savedPlansApi.ts`.
  - While an action is pending, the actions of that plan are disabled, so one click deletes once and copies once (spec FR-006, Edge Cases).
  - **My plans**:
    - A successful delete removes the row through `useSavedPlansStore.remove(id)`, announces "Plan deleted." and moves focus to the next row's Open link, or to the `h1` when no row follows.
    - A successful duplicate inserts the returned summary directly above its original through `useSavedPlansStore.insertAbove(copy, originalId)` and announces "Plan duplicated.".
    - On My plans, a 404 removes the row and shows "This plan no longer exists.". On the plan page, the message is shown in place.
  - **Plan page**:
    - Delete navigates to `/plans` with `NavigationState.planNotice = "deleted"`.
    - Duplicate navigates to `/plans/{copyId}` with `planNotice = "duplicated"`.
    - The target page shows the notice in its own `role="status"` region, so the text is exactly "Plan deleted." / "Plan duplicated.", not the "✓ Success:" banner.
  - `SavedPlanList` gains an optional `actions` render prop. My plans passes Duplicate and Delete; the Home block passes nothing and stays as in feature 010.
- **Rationale**: These are the exact messages and focus rules in spec User Stories 1 and 2. They reuse the list store instead of reloading the list after each action.
- **Alternatives considered**: Reloading the list after each action. Rejected: an extra request, and focus would be lost while the list reloads.

## 13. Time and messages

- **Decision**: Times are unchanged (Lithuanian time, `formatSavedAt`). All new messages are constants next to the store that shows them, as in feature 010:
  - "Plan deleted.", "Plan duplicated.", "✓ Success: Changes saved.", "✓ Success: Plan renamed."
  - The four "could not be …" errors.
  - The editing notice and the two confirmation texts.
  
  The 10-second timeout uses `startTimeout` from `helpers/timedRequest.ts`.
- **Rationale**: Same patterns as features 008 to 010.

## Risks

- **Changing the details response** (section 4): the frontend `SavedPlan` type and the fixtures in `savedPlansFixtures.ts` gain fields, and the 010 mapping test changes. Existing tests that compare the whole body must be updated in the same task.
- **Migration on existing data** (section 5): the new column is filled from `SavedAtUtc` inside the migration, so no row has a missing value. `DatabaseSchemaTests` checks the column.
- **Stale edit after a long break**: the 30-minute generated schedule rule (section 3) already covers it. A schedule older than 30 minutes is refused and **Generate again** is offered.
