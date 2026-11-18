# Research: 010-save-view-plans

**Date**: 2026-11-18 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

The spec's four open decisions were answered on 2026-11-18 (see spec Clarifications), so there are no open NEEDS CLARIFICATION items. The sections below record the technical choices.

## 1. No new packages needed

- **Decision**: No new NuGet or npm package.
- **Rationale**:
  - Storage uses the existing EF Core with Npgsql. JSON is written with `System.Text.Json`, which is part of .NET.
  - Authorization uses ASP.NET Core Identity and a policy handler like the existing `PlanCreatorHandler`.
  - The frontend uses React Router, Zustand (including the `persist` middleware already used by `usePlanSetupStore`) and `Intl.DateTimeFormat`.
- **Alternatives considered**: A date library for "Saved on … at …" in Lithuanian time. Rejected: `Intl.DateTimeFormat` with `timeZone: "Europe/Vilnius"` does it, as the existing `formatPlanDate.ts` does for dates (constitution VIII).

## 2. Remembering generated schedules: a database table with a 30-minute expiry

- **Decision**:
  - When `POST /api/plan-schedule` produces at least one scheduled activity, `GeneratedScheduleService.RememberAsync` stores a `GeneratedSchedule` row: a new random id, `CreatedAtUtc`, `ExpiresAtUtc = CreatedAtUtc + 30 min`, and the plan snapshot (section 4).
  - The response gains `generatedScheduleId`. It is `null` when nothing was scheduled, because such a schedule cannot be saved (spec FR-001).
  - Before each insert, rows that are already expired are deleted with one `ExecuteDeleteAsync` on an index over `ExpiresAtUtc`.
  - `FindAsync(id)` returns the snapshot only while `now < ExpiresAtUtc`. The time comes from the injected `TimeProvider`, so tests control it with the existing `FixedTimeProvider`.
- **Rationale**:
  - The spec answer (Q1) requires the server to keep what it generated, and lets Save send only the id and the name (spec FR-004).
  - A database row works with more than one API instance and after a restart. The README's Deployment notes already allow several instances for the forecast cache. With an in-memory cache, a save that reached another instance would fail with "Generate the schedule again".
  - Deleting expired rows before each insert keeps the table small without a background job. Generation is already limited to 30 requests per minute per address (shared `PlanSetup` rate limit), which bounds the number of rows.
- **Alternatives considered**:
  - `IMemoryCache` (already used for the forecast and places). Rejected for the instance and restart reasons above, although it would avoid a table.
  - A background cleanup service (`IHostedService`). Rejected: more moving parts for the same result (constitution VIII).
  - Signing the full schedule (an HMAC) and letting the browser send it back. Rejected: it needs key management, and the request body would be large. It is also more complex to explain than an id.

## 3. Generated schedule ids must be unguessable

- **Decision**: `GeneratedSchedule.Id` is `Guid.NewGuid()`. On .NET this is a version 4 GUID with 122 random bits from the operating system's cryptographic random number generator.
- **Rationale**: Anyone holding the id can save that schedule into their own account during its 30 minutes. That is how a Visitor's schedule becomes saveable after login (spec Key Entities). The schedule contains no personal data, but the id still must not be guessable, so no one can save someone else's schedule by chance. Saved plan ids use `Guid.NewGuid()` too. They do not need to be secret, because every read checks the owner (spec Assumptions).
- **Alternatives considered**: `Guid.CreateVersion7()`. Rejected for generated schedules: its first 48 bits are a timestamp, which makes it easier to guess.

## 4. What is stored: one JSON snapshot reusing the schedule's own records

- **Decision**:
  - A new record, `PlanSnapshot(CheckedPlanSetup Setup, IReadOnlyList<CheckedPlanActivity> Activities, PlanSchedule Schedule)`, holds the checked setup, the checked activities and the full schedule that `PlanScheduleService` already builds.
  - It is stored in a `jsonb` column (`Snapshot`) on both `GeneratedSchedules` and `SavedPlans`. An EF Core value converter uses `System.Text.Json`, with enums written as strings, and a value comparer compares the serialised text.
  - Saving copies the snapshot from the generated schedule to the new saved plan unchanged.
- **Rationale**:
  - The spec requires everything that was shown to be kept: setup, activities, times, places, weather, travel, unscheduled reasons and summaries (spec FR-003, SC-003). Reusing the existing records means one source of truth, and the saved plan maps to the existing response DTOs (`ScheduledActivityResponse`, `UnscheduledActivityResponse`, `TravelSummaryResponse`) through the existing `PlanScheduleMappingProfile`.
  - The plan is read-only in this feature (spec Assumptions), so nothing queries inside the JSON.
  - The activity names come from the snapshot. A later category rename therefore does not change a saved plan (spec FR-015).
- **Alternatives considered**:
  - Normalised tables (`SavedPlanActivities`, `SavedScheduleEntries` and a table for places). Rejected: four tables and their mapping for data that is only ever read as a whole. Features 011 and 012 can still move to tables if they need to query parts of a plan.
  - EF Core owned or complex types mapped with `ToJson()`. Rejected for now: they need entity-like classes with settable members, or a copy of each type, while a value converter stores the existing immutable records as they are.
- **Risk and mitigation**: Renaming a member of these records later would change the JSON shape and make older saved plans unreadable. A unit test serialises and reads back a full `PlanSnapshot` (`PlanSnapshotJsonTests`), and the records carry a comment saying they are stored. A future change must add a data migration or keep the old names.

## 5. Columns for the list

- **Decision**: `SavedPlans` also has `LocationName` (`varchar(200)`) and `Dates` (`date[]`) columns, copied from the snapshot when the plan is saved. The My plans and Home lists read only `Id`, `Name`, `LocationName`, `Dates` and `SavedAtUtc`.
- **Rationale**: The list must not load every plan's whole schedule (spec SC-005: within 2 seconds for 50 plans). The two values never change in this feature. Feature 011 updates them together with the snapshot when it edits a plan.
- **Alternatives considered**: Reading the location name and dates out of the JSON in SQL. Rejected: a value-converted column cannot be queried by EF Core, and raw SQL would be the only place in the project that does this.

## 6. Saving the same schedule twice creates one plan

- **Decision**:
  - `SavedPlans.GeneratedScheduleId` stores the id the plan was saved from, with a unique index.
  - On Save, `SavedPlanService` first looks for a plan of the same owner with that `GeneratedScheduleId`. If it finds one, it returns that plan (200) instead of creating another.
  - If two requests race, the second insert breaks the unique index. The service catches the `DbUpdateException`, reads the existing plan and returns it.
  - If the existing plan belongs to another user, the save is refused with the same "Generate the schedule again to save it." answer as an expired id. This only happens if a schedule id was shared between accounts.
  - The generated schedule row is not deleted on save, so a Retry within 30 minutes stays idempotent.
- **Rationale**: Spec FR-005 ("repeated or double-submitted save requests for the same schedule MUST create at most one plan") and the Edge Case "The user selects Save twice quickly". The frontend also disables the button while saving, but the server must not rely on that.
- **Alternatives considered**: Deleting the generated schedule on the first save. Rejected: a double click would make the second request show "Generate the schedule again", although the plan was saved.

## 7. Authorization: a new `ActiveRegisteredUser` policy and an ownership check in the service

- **Decision**:
  - A new policy, `AuthorizationPolicies.ActiveRegisteredUser`, uses `RequireAuthenticatedUser()` and a new `ActiveRegisteredUserRequirement`. Its handler, like `PlanCreatorHandler`, reads the account on every request and succeeds only for `Role == "Registered User"` and `AccountStatus == Active`.
  - `PlansController` uses this policy for all three actions:
    - A Visitor gets 401, through the cookie's `OnRedirectToLogin`, already set up.
    - An Administrator or a Suspended user gets 403.
  - Ownership is checked in `SavedPlanService`:
    - The list query filters by the signed-in user's id.
    - Details returns `NotFound` when no plan has that id and `Forbidden` when the plan's `OwnerId` differs. The controller turns these into 404 and 403 with no plan data (spec FR-012, clarification Q4).
    - Save always uses the signed-in user's id as `OwnerId`. The request has no owner field, and an unknown JSON property is ignored (spec FR-013).
- **Rationale**: Constitution IV: authorization on the server, including ownership. Reading the account on each request applies a suspension at once, as feature 002 does.
- **Alternatives considered**:
  - Resource-based authorization (`IAuthorizationService.AuthorizeAsync(user, plan, requirement)`). Rejected: one equality check in the service is simpler and is tested directly.
  - Returning 404 for another user's plan. Rejected by clarification Q4.

## 8. Keeping the schedule through Log in and Register

- **Decision**:
  - A new Zustand store, `useKeptScheduleStore`, persisted in `sessionStorage` like `usePlanSetupStore`. It holds one kept schedule with the key of the setup and activities it was generated from: the JSON of `checkedPlanRequest(setup, activities)`.
  - "Save plan" as a Visitor, and a save answered 401 (session expired), call `keep(setup, activities, schedule)` and then navigate to `/login?returnTo=%2Fplan%2Fschedule` with `loginReason` `required` or `expired`.
  - When the Schedule Overview opens, it calls `take(setup, activities)`. If a kept schedule matches the current checked setup and activities, it is shown (`usePlanScheduleStore.restore(schedule)`) instead of generating a new one, and the kept copy is removed. Otherwise the page generates as before.
  - Logout clears the kept schedule, next to the setup and activities that `useLogoutStore` already clears. Closing the tab clears `sessionStorage`.
- **Rationale**:
  - Spec FR-007 and User Story 2. The existing schedule store is never persisted, and it is reset when the page closes (feature 008 FR-014). Keeping that behaviour and adding a separate kept copy for the login route changes feature 008's rule only where the spec asks.
  - The key check means a kept schedule is never shown for a plan the user has changed since.
  - If the kept schedule's 30 minutes have passed, saving it gives "Generate the schedule again to save it." (spec FR-004), so a stale kept copy cannot be saved.
- **Alternatives considered**:
  - Persisting `usePlanScheduleStore` itself. Rejected: it would keep every schedule after leaving step 4, which feature 008 FR-014 forbids.
  - Regenerating after login. Rejected: the forecast may have changed, so the user could be shown a different plan from the one they chose to save.

## 9. Register returns to the "return to" page

- **Decision**:
  - The Log in page's "Create an account" link becomes `/register?returnTo=…` when the Log in page has a `returnTo`. It still links to `/register` when it has none.
  - After a successful registration, `RegisterPage` navigates to `safeReturnTo(returnTo) ?? "/"` with the "Account created." banner state. The existing layout banner already shows `successMessage` on any page.
- **Rationale**:
  - Spec FR-008 and clarification Q2. `safeReturnTo` (feature 002) already refuses addresses outside the application and the Log in and Register pages.
  - Carrying any `returnTo`, not only `/plan/schedule`, uses one rule instead of a special case for "Save plan". A Visitor sent to Log in from My plans who then registers also lands where they were going, which matches project FR-040 ("return the user to the page they requested"). The spec was updated to say so.
- **Alternatives considered**: A separate marker such as `?from=savePlan`. Rejected: a second mechanism for the same "return to" idea.

## 10. Administrator who logs in from "Save plan"

- **Decision**: No change to `loginDestination`. An Administrator returns to `/plan/schedule`, and `PlanCreatorOnly` shows the Access Denied page as on every plan page. The spec's User Story 2 scenario 5 was corrected to say this.
- **Rationale**: The "return to" page has priority for every role except Suspended (feature 002 FR-011). A special rule for one page is not worth the extra code for an unlikely case: an Administrator using the Visitor planner.
- **Alternatives considered**: Ignoring `returnTo` for Administrators on plan pages. Rejected for the reason above.

## 11. Lists: newest first, Home shows the first five

- **Decision**:
  - `GET /api/plans` returns all of the user's plans ordered by `SavedAtUtc` descending, then by `Id` so the order is stable.
  - My plans shows all of them. The Home block shows the first five of the same answer, plus the "All my plans" link.
  - One store, `useSavedPlansStore`, serves both.
- **Rationale**: The order is decided on the server. Taking the first five is a display choice. With "a few dozen plans at most" (spec Assumptions) one request is small, and the two places cannot drift apart.
- **Alternatives considered**: A `limit` query parameter. Rejected for now: it adds validation and tests for no visible gain. It can be added if plan counts grow.

## 12. Showing a saved plan: the schedule display is shared, not copied

- **Decision**:
  - The schedule part of `ScheduleOverviewPage` (summaries, per-date sections, unscheduled list) moves into `components/scheduleView.tsx`, used by both the Schedule Overview and the new `PlanDetailsPage`.
  - The "Save plan" button, form and messages go into `components/savePlanSection.tsx`.
  - `ScheduleOverviewPage.tsx` is 186 lines today and must not grow past about 200 (constitution I).
- **Rationale**: Spec User Story 4 scenario 3 ("in the same layout as the Schedule Overview"). One component keeps both pages the same (DRY).

## 13. Time display

- **Decision**:
  - `savedAt` is returned as a UTC ISO 8601 timestamp.
  - A new helper, `formatSavedAt`, formats it as "Saved on Sat 21 Nov 2026 at 14:05" in `Europe/Vilnius` with `Intl.DateTimeFormat`.
  - Dates in lists use the existing `formatPlanDateShort`, joined with ", ".
- **Rationale**: Spec Assumptions (Lithuanian time). The server stores UTC, as `RegistrationDate` does.

## 14. Error answers for Save

- **Decision**: `POST /api/plans` answers:
  - **400** with `errors.name` for a name problem, using the spec's messages.
  - **400** with `errors.generatedScheduleId` = "Generate the schedule again to save it." when the id is missing, unknown, expired or used by another owner.
  - **400** with `errors.generatedScheduleId` = "There is nothing to save in this schedule." when the snapshot has no scheduled activity. The page never sends this, but the server must check it (spec FR-001).
  - **401**, **403**, and **500** for anything unexpected (central `ApiExceptionHandler`).

  The page tells the two `generatedScheduleId` cases apart by the field key, the same way `planStepAnswer.ts` reads `setup` and `activities` keys.
- **Rationale**: The validation-problem format used everywhere in the API. The name and the expired id can fail together, and both messages are shown.
