# Implementation Plan: 011-plan-management

**Branch**: `011-plan-management` | **Date**: 2026-11-19 | **Spec**: [specs/011-plan-management/spec.md](spec.md)

**Input**: Feature specification from `/specs/011-plan-management/spec.md`

## Summary

An Active Registered User can manage their own saved plans (project FR-022 to FR-025, FR-039):

- Delete a plan after a confirmation dialog.
- Duplicate a plan as "Copy of <name>".
- Rename a plan without touching its schedule.
- Edit a plan. "Edit plan" fills the existing planning steps with the plan's setup and activities. The user generates the schedule again, and **Save changes** replaces the plan in place.

Only the owner can do any of this.

**Backend**:

- Four endpoints on the existing `PlansController`, all under the existing `ActiveRegisteredUser` policy: `DELETE /api/plans/{id}`, `POST /api/plans/{id}/copies`, `PUT /api/plans/{id}/name` and `PUT /api/plans/{id}`.
- A new `SavedPlanChangeService` with one shared ownership check.
- The generated schedule rule of feature 010 is shared through `GeneratedScheduleService.FindSavableAsync`, so Save changes only accepts a schedule the server generated.
- `GET /api/plans/{id}` also returns the activities and the location id that editing needs.
- A `CreatedAtUtc` column (migration `AddSavedPlanCreatedAt`) keeps a copy directly above its original.

**Frontend**:

- Duplicate and Delete on My plans.
- Edit plan, Rename, Duplicate and Delete on the plan page.
- An accessible confirmation dialog.
- An edit-in-progress store with an editing notice on every planning step.
- **Save changes** on the Schedule Overview.
- One name form shared by Save plan, Save changes and Rename.

## Technical Context

**Language/Version**: C# on .NET 10 (ASP.NET Core Web API); TypeScript with React 19, built with Vite. Unchanged.

**Primary Dependencies**: Existing only (research section 1).

- Backend: EF Core 10 with Npgsql, ASP.NET Core Identity, AutoMapper, `TimeProvider`.
- Frontend: React, React Router, Zustand with `persist`.
- Tests: xUnit, `Microsoft.AspNetCore.Mvc.Testing` with Testcontainers PostgreSQL (`PostgreSqlApiFactory`), `FakeForecastClient`, `FakeMapPlacesClient`, `FakeGeocodingClient`, `FixedTimeProvider`, `TestSignInStartupFilter`; Vitest and React Testing Library.

**No new NuGet or npm package.**

**Storage**: PostgreSQL. One new column, `SavedPlans.CreatedAtUtc`, in one new migration, **`AddSavedPlanCreatedAt`**. The migration fills existing rows from `SavedAtUtc` ([data-model.md](data-model.md)). On the browser side, the edit in progress is kept in `sessionStorage`, as the plan in progress already is (research section 10).

**Testing**:

- **Backend unit tests** (`backend/tests/SpekLaiku.UnitTests/`):
  - `SavedPlanValidatorTests` (changed): `CopyName` for a short name, a name that ends exactly at 80 characters, a cut name, and a cut that would split a surrogate pair (79 characters).
  - `SavedPlanMappingTests` (changed): the details response maps `location.id` and `activities` (Indoor limits `null`). `OwnerId`, `GeneratedScheduleId` and `NearbyPlace.Key` are still not exposed (research section 4).
  - `GeneratedScheduleServiceTests` (changed): `FindSavableAsync` returns the snapshot, or "expired" for unknown and expired ids, or "nothing to save".
- **Backend integration tests** (`backend/tests/SpekLaiku.IntegrationTests/`, real PostgreSQL, fake external services, fixed clock):
  - `DeletePlanEndpointTests`:
    - 204, then the plan is not listed and `GET` gives 404.
    - A second delete gives 404.
    - The other plans of the user are untouched.
  - `DuplicatePlanEndpointTests`:
    - 201 with a `Location` header and the contract body.
    - Same snapshot, `savedAt` and setup as the original; `GeneratedScheduleId` is null.
    - Listed directly above the original (also when the original is not the newest), and a copy of a copy above both.
    - An 80-character name gives an 80-character copy name.
    - Changing or deleting the copy leaves the original unchanged.
  - `RenamePlanEndpointTests`:
    - 200 with the new name.
    - `savedAt`, `CreatedAtUtc` and the snapshot are unchanged.
    - Name errors give 400 with the messages, and the plan is unchanged.
    - A name is trimmed.
  - `ReplacePlanEndpointTests`:
    - 200. Same id. New name, setup, activities and schedule from the generated schedule. `savedAt` = clock now. The plan is listed once.
    - A repeat with the same id gives 200 and changes only the name.
    - An id already saved as another plan gives 400.
    - Expired (clock moved 30 minutes) and unknown ids give 400. Name and id errors are returned together.
    - Setup or schedule fields in the body are ignored.
    - The plan is unchanged after every 400.
  - `PlanManagementAuthorizationTests`: for each of the four endpoints:
    - Visitor 401, Administrator 403, Suspended 403.
    - Another user's plan gives 403 with no plan data, and that plan is unchanged, not copied and not deleted.
    - An unknown id gives 404.
    
    This covers constitution III ("one user cannot change another user's data").
  - `SavedPlanDetailsEndpointTests` (changed): the contract body includes `location.id` and `activities`.
  - `SavedPlansListEndpointTests` (changed): the order uses `CreatedAtUtc` to break ties on `savedAt`.
  - `DatabaseSchemaTests` (changed): `CreatedAtUtc` exists and is required.
  - `SavePlanEndpointTests`, `SavedPlansAuthorizationTests` and `GeneratedScheduleTests` stay green after the shared `FindSavableAsync` change.
- **Frontend tests** (`frontend/src/tests/`):
  - `savedPlansApi.test.ts` (changed): `deletePlan`, `duplicatePlan`, `renamePlan` and `replacePlan`. Each status maps to an answer.
  - `confirmDialog.test.tsx`: focus on open; Tab and Shift+Tab stay inside; Escape cancels; the role, `aria-modal` and label.
  - `usePlanActionsStore.test.ts`: pending blocks a second action; delete and duplicate success, 404, server error, timeout and Retry.
  - `useRenamePlanStore.test.ts`.
  - `usePlanEditStore.test.ts`: start, cancel, cleared on logout, a different email discards the edit.
  - `planFromSavedPlan.test.ts`: setup and activity text values, and Indoor limits as empty text.
  - `useSavePlanStore.test.ts` (changed): `PUT` with a plan id, `planGone`, `saveAsNew`.
  - `useSavedPlansStore.test.ts` (changed): `remove`, `insertAbove`.
  - `MyPlansPage.test.tsx` (changed):
    - Duplicate and Delete with accessible names.
    - The dialog texts; Cancel and Escape delete nothing and return focus.
    - Delete removes the row, announces "Plan deleted." and moves focus.
    - Duplicate inserts above the original and announces "Plan duplicated.".
    - The errors with Retry; 404 removes the row.
    - Buttons are disabled while pending.
  - `PlanDetailsPage.test.tsx` (changed):
    - The four actions.
    - Rename: the form, validation, focus, Escape, success and the updated heading, title and breadcrumbs, error with Retry.
    - Delete navigates to My plans with the notice.
    - Duplicate opens the copy with the notice.
    - Edit plan fills the stores and opens Plan Setup.
    - The replace confirmation when a plan is in progress, where Cancel keeps it.
  - `editingNotice.test.tsx`: shown on all four steps; Cancel editing clears the stores and opens the plan page.
  - `savePlanSection.test.tsx` (changed):
    - While editing: **Save changes** with the name filled, "✓ Success: Changes saved." with **Open plan**, the error with Retry, the expired schedule with **Generate again**.
    - `planGone` with **Save plan** saving as new.
  - `HomePage.test.tsx` (unchanged behaviour): the block still shows only Open.
  - The accessibility, keyboard and responsive tests cover the new actions, the dialog and the forms at 320 px.
  - The `savedPlansFixtures.ts` details fixture gains `location.id` and `activities`.

**Target Platform**: Unchanged (ASP.NET Core API in a Linux container; current desktop and mobile browsers, 320 px and wider).

**Project Type**: Web application (backend API and frontend single-page app).

**Performance Goals**:

- A delete, duplicate or rename answers within 2 seconds (spec SC-001, SC-002). Each is one indexed read and one write, with no external call.
- Editing uses the planning steps' existing targets (feature 008: schedule within 5 seconds of the data).

**Constraints**:

- Production C# classes stay under 200 lines:
  - `SavedPlanService.cs` (147 lines) shrinks when its generated schedule checks move out.
  - `SavedPlanChangeService.cs` is planned at about 150 lines.
  - `PlansController.cs` (79 lines) grows to about 150 lines.
- `savePlanSection.tsx` (195 lines) shrinks when the form moves into `planNameForm.tsx` (research section 11).
- `useSavePlanStore.ts` (169 lines) grows by about 25 lines. If it passes 200, the answer-to-state mapping `toResult` moves into `helpers/savePlanResult.ts`.
- No external call while deleting, duplicating or renaming (spec FR-017).

**Scale/Scope**:

- A few dozen plans per user (feature 010 Assumptions).
- Four new endpoints and two changed (the details body and the list order).
- One migration, one dialog, one notice, two new forms using a shared form component.

**Authorization** (research section 8):

- The existing `ActiveRegisteredUser` policy on `PlansController`.
- An ownership check in `SavedPlanChangeService`, run first on every change.

**Backend changes** (`backend/src/SpekLaiku.Api/`):

- **Entities**: `Entities/SavedPlan.cs` (changed): `CreatedAtUtc`, and comments updated (no longer read-only).
- **Data**: `Data/SavedPlanConfiguration.cs` (changed): `CreatedAtUtc` required.
- **Migrations**: `AddSavedPlanCreatedAt` (new). Generated with `dotnet ef migrations add AddSavedPlanCreatedAt --project src/SpekLaiku.Api`, with one `UPDATE` step added that fills existing rows from `SavedAtUtc`.
- **Services**:
  - `Services/SavedPlanChangeService.cs` (new): `RenameAsync`, `ReplaceAsync`, `DuplicateAsync`, `DeleteAsync`, and the private ownership lookup.
  - `Services/SavedPlanChange.cs` (new): the result record.
  - `Services/GeneratedScheduleService.cs` (changed): `FindSavableAsync`, with the remembered, expiry and nothing-scheduled checks moved here from `SavedPlanService`.
  - `Services/SavedPlanService.cs` (changed):
    - Uses `FindSavableAsync`.
    - Sets `CreatedAtUtc` on insert.
    - Orders the list by (`SavedAtUtc` desc, `CreatedAtUtc` desc, `Id`).
  - `Services/SavedPlanValidator.cs` (changed): `CopyName`.
- **Controllers**: `Controllers/PlansController.cs` (changed):
  - `Delete`, `Duplicate`, `Rename` and `Replace`.
  - One private method maps a `SavedPlanChange` to 200, 201, 204, 400, 403 or 404.
  - The 404 problem body becomes one helper shared with `Get`.
- **DTOs**:
  - `DTOs/Requests/RenamePlanRequest.cs` (new).
  - `DTOs/Requests/SavePlanRequest.cs`: reused by `PUT /api/plans/{id}`.
  - `DTOs/Responses/SavedPlanResponse.cs` (changed): `Activities` as `IReadOnlyList<CheckedPlanActivityResponse>`.
  - `DTOs/Responses/SavedPlanLocationResponse.cs` (changed): `Id`.
- **Mapping**: `Mapping/SavedPlanMappingProfile.cs` (changed): `Activities` from `Snapshot.Activities`, using the existing `CheckedPlanActivity` → `CheckedPlanActivityResponse` map from `PlanActivityMappingProfile`. `PlaceLocation.Id` is mapped to the location.
- **Program.cs** (changed): registers `SavedPlanChangeService`.
- **Not changed**: authorization policies and handlers, clients, rate limiting, `ApiExceptionHandler`, existing migrations.

**Frontend changes** (`frontend/src/`):

- **Types**:
  - `types/savedPlan.ts` (changed): `location.id`, `activities`, `RenamePlanRequest`.
  - `types/navigationState.ts` (changed): `planNotice`.
- **API**: `api/savedPlansApi.ts` (changed): `deletePlan`, `duplicatePlan`, `renamePlan` and `replacePlan`, each returning a typed answer as the existing functions do.
- **Stores**:
  - New:
    - `stores/usePlanEditStore.ts` (persisted).
    - `stores/usePlanActionsStore.ts`.
    - `stores/useRenamePlanStore.ts`.
  - Changed:
    - `stores/useSavePlanStore.ts`: plan id, `planGone`, `saveAsNew`.
    - `stores/useSavedPlansStore.ts`: `remove`, `insertAbove`.
    - `stores/useSavedPlanStore.ts`: `rename`.
    - `stores/useLogoutStore.ts`: clears the edit.
- **Helpers**:
  - `helpers/planFromSavedPlan.ts` (new): fills the setup and activities stores (data-model.md).
  - `helpers/hasPlanInProgress.ts` (new): a location, a date, an activity or an edit is present, unless the plan is unchanged since its last save (spec FR-013, research section 10).
  - `helpers/planKey.ts` (new, moved from `useKeptScheduleStore.ts`): the key of a checked setup and activities, used by the kept schedule and the saved marker.
- **Components**:
  - New:
    - `components/confirmDialog.tsx`.
    - `components/planNameForm.tsx` (extracted from `savePlanSection.tsx`).
    - `components/renamePlanForm.tsx`.
    - `components/editingNotice.tsx`: the notice, **Cancel editing**, and discarding an edit when the signed-in email differs.
    - `components/planActions.tsx`: the Duplicate and Delete buttons with the dialog. Used by My plans rows and the plan page.
  - Changed:
    - `components/savePlanSection.tsx`: uses `PlanNameForm`, and shows Save changes while editing.
    - `components/savedPlanList.tsx`: optional `actions` render prop.
- **Pages** (all changed):
  - `pages/MyPlansPage.tsx`: row actions, the notice region, focus after delete, and the `planNotice` from navigation.
  - `pages/PlanDetailsPage.tsx`: Edit plan, Rename, Duplicate and Delete, and the `planNotice`. The view part moves to `components/savedPlanView.tsx` if the page passes about 200 lines.
  - `pages/PlanSetupPage.tsx`, `pages/ActivitySelectionPage.tsx`, `pages/PlacesAndForecastPage.tsx` and `pages/ScheduleOverviewPage.tsx`: `EditingNotice`.
- **Styles**: `styles.css` (changed): the dialog and backdrop, the action buttons in the table and cards at 320 px, and the editing notice.

**Documentation**:

- `README.md`: the "Saved plans" section gains delete, duplicate, rename and edit, and the new migration in "Database".
- `docs/ux-design.md`:
  - The My Plans and Plan Details / Edit rows say that duplicate, delete and edit come with feature 011 (now done).
  - The My Plans state table gains "Changes saved" and "Plan renamed".
- The spec was updated during planning: User Story 2 scenario 2 now says "at most 80 characters" for a cut copy name (research section 6).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID, DRY, KISS, YAGNI | ✓ | The generated schedule rule is shared (`FindSavableAsync`), and so are the name rules (`SavedPlanValidator`), one name form for three uses, and one dialog for two confirmations. Editing reuses the planning steps instead of a second editor (research sections 3, 4, 10, 11). No undo, trash, history or conflict detection (spec Assumptions, clarification Q4). |
| I. 200-line limit / ~200 for components | ✓ | The changes go into a new `SavedPlanChangeService` because `SavedPlanService` would pass 200 lines. `savePlanSection.tsx` shrinks. A fallback split is named for `useSavePlanStore.ts` and `PlanDetailsPage.tsx`. |
| I. Naming | ✓ | `SavedPlanChangeService` and `SavedPlanChange` describe one responsibility. Pages are PascalCase, components and helpers camelCase, stores `use<Name>Store`. |
| II. Thin controllers | ✓ | The new actions call one service method and map the result. The mapping is one shared private method. |
| II. Business rules in services | ✓ | Ownership, the copy name, the generated schedule rule, idempotent replace and the list order are in `Services/`. The frontend only shows answers and asks for confirmation. |
| II. DbContext directly, no repository | ✓ | `SavedPlanChangeService` uses `ApplicationDbContext`. |
| II. Async I/O | ✓ | All database calls are async. |
| II. DTOs, AutoMapper without rules | ✓ | Entities are never returned. The new members are path selections (`Snapshot.Activities`, `Snapshot.Setup.Location`). |
| II. Migrations | ✓ | One new migration, `AddSavedPlanCreatedAt`, in this branch. The merged `AddSavedPlans` migration is not touched. |
| III. Tests, deterministic, fakes | ✓ | Fixed clock for `savedAt`, `CreatedAtUtc` and expiry. Fake forecast, places and geocoding clients. Real PostgreSQL for the migration, the order and the unique index. |
| III. Authorization test per protected operation | ✓ | `PlanManagementAuthorizationTests` covers all four new endpoints for Visitor, Administrator, Suspended, another user and an unknown id. |
| III. Loading, success, empty, validation-error, server-error states | ✓ | Tested for delete, duplicate, rename, save changes and the dialogs. |
| IV. Identity, server-side authorization, validation | ✓ | Every change checks ownership on the server first. Names are validated on the server. The replacing schedule never comes from the browser (spec FR-011). |
| IV. Central error handling, no details leaked | ✓ | Unexpected errors go through `ApiExceptionHandler`. A 403 never carries plan data. |
| IV. Logging | ✓ | No plan names or positions are logged. |
| IV. OWASP | ✓ | Broken access control: an ownership check on every change, with tests. Injection: EF Core parameters, and names shown as plain text (spec FR-018). CSRF: the session cookie is `SameSite=Lax`, so a cross-site page cannot send it with `PUT`, `POST` or `DELETE` requests. The new endpoints rely on this, as `POST /api/plans` already does. There is no antiforgery token in the API, and this feature does not add one. |
| V. Version control | ✓ | Feature branch `011-plan-management` from an updated `main`. |
| VI. Documentation | ✓ | README and `docs/ux-design.md` updates are planned. The spec was aligned during planning. |
| VII. AI-assisted development | ✓ | Spec, clarification and plan are done before any implementation. |
| VIII. Simplicity, no new dependency | ✓ | No package. One column. No background services. |
| Accessibility constraint | ✓ | Dialog focus trap with Escape and focus return; named row actions; status announcements; errors next to fields; 320 px cards. |

**Gate result**: PASS. No violations, so Complexity Tracking is empty.

**Post-design re-check**: PASS. The Phase 1 artifacts add nothing that conflicts with the table above. Two deliberate trade-offs are recorded, not violations:

1. The details response now exposes the owner's activity values (research section 4). This changes a feature 010 test, not a rule.
2. The confirmation dialog is a custom component instead of the native `<dialog>`, so that it can be tested in jsdom (research section 9).

## Project Structure

### Documentation (this feature)

```text
specs/011-plan-management/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── plans-api.md     # Phase 1 output (new endpoints, changed details and list order)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code

```text
backend/
├── src/SpekLaiku.Api/
│   ├── Controllers/
│   │   └── PlansController.cs                  (changed)
│   ├── Data/
│   │   └── SavedPlanConfiguration.cs           (changed)
│   ├── DTOs/
│   │   ├── Requests/RenamePlanRequest.cs       (new)
│   │   └── Responses/
│   │       ├── SavedPlanResponse.cs            (changed)
│   │       └── SavedPlanLocationResponse.cs    (changed)
│   ├── Entities/
│   │   └── SavedPlan.cs                        (changed)
│   ├── Mapping/
│   │   └── SavedPlanMappingProfile.cs          (changed)
│   ├── Migrations/
│   │   └── <timestamp>_AddSavedPlanCreatedAt.cs (new, generated)
│   ├── Services/
│   │   ├── SavedPlanChangeService.cs           (new)
│   │   ├── SavedPlanChange.cs                  (new)
│   │   ├── GeneratedScheduleService.cs         (changed)
│   │   ├── SavedPlanService.cs                 (changed)
│   │   └── SavedPlanValidator.cs               (changed)
│   └── Program.cs                              (changed)
└── tests/
    ├── SpekLaiku.UnitTests/
    │   ├── SavedPlanValidatorTests.cs          (changed)
    │   ├── SavedPlanMappingTests.cs            (changed)
    │   └── GeneratedScheduleServiceTests.cs    (changed)
    └── SpekLaiku.IntegrationTests/
        ├── DeletePlanEndpointTests.cs          (new)
        ├── DuplicatePlanEndpointTests.cs       (new)
        ├── RenamePlanEndpointTests.cs          (new)
        ├── ReplacePlanEndpointTests.cs         (new)
        ├── PlanManagementAuthorizationTests.cs (new)
        ├── SavedPlanDetailsEndpointTests.cs    (changed)
        ├── SavedPlansListEndpointTests.cs      (changed)
        └── DatabaseSchemaTests.cs              (changed)

frontend/src/
├── types/        savedPlan.ts, navigationState.ts (changed)
├── api/          savedPlansApi.ts (changed)
├── stores/       usePlanEditStore.ts, usePlanActionsStore.ts, useRenamePlanStore.ts (new);
│                 useSavePlanStore.ts, useSavedPlansStore.ts, useSavedPlanStore.ts, useLogoutStore.ts, useKeptScheduleStore.ts (changed)
├── helpers/      planFromSavedPlan.ts, hasPlanInProgress.ts, planKey.ts (new)
├── components/   confirmDialog.tsx, planNameForm.tsx, renamePlanForm.tsx, editingNotice.tsx,
│                 planActions.tsx (new); savePlanSection.tsx, savedPlanList.tsx (changed)
├── pages/        MyPlansPage.tsx, PlanDetailsPage.tsx, PlanSetupPage.tsx, ActivitySelectionPage.tsx,
│                 PlacesAndForecastPage.tsx, ScheduleOverviewPage.tsx (changed)
├── styles.css    (changed)
└── tests/        see "Testing" above

README.md                                       (changed: plan management, migration)
docs/ux-design.md                               (changed: feature 011 notes and states)
```

**Structure Decision**: The existing web application layout (`backend/` and `frontend/`), as documented in `docs/architecture.md` and `AGENTS.md`. The new service and result follow `SavedPlanService` and `SavePlanResult`. The new stores and API functions follow those of feature 010. The planning steps are reused for editing (research section 10).

## Complexity Tracking

No constitution violations. Nothing to justify.
