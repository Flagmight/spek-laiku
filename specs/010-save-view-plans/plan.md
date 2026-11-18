# Implementation Plan: 010-save-view-plans

**Branch**: `010-save-view-plans` | **Date**: 2026-11-18 | **Spec**: [specs/010-save-view-plans/spec.md](spec.md)

**Input**: Feature specification from `/specs/010-save-view-plans/spec.md`

## Summary

An Active Registered User saves the schedule shown on the Schedule Overview under a name, sees all their saved plans on My plans (and the latest five on Home), and opens one read-only. A Visitor who selects "Save plan" goes through Log in or Register and comes back to the same schedule. Only the owner can list or open a plan (project FR-020, FR-021, FR-025, FR-026, FR-038).

The server only saves what it generated itself (clarification Q1):

1. `POST /api/plan-schedule` now remembers each schedule with at least one scheduled activity for 30 minutes in a `GeneratedSchedules` table and returns its `generatedScheduleId`.
2. `POST /api/plans` takes only that id and a name, and copies the remembered snapshot (setup, activities and the full schedule as JSON) into a `SavedPlans` row owned by the signed-in user.
3. `GET /api/plans` lists the user's plans. `GET /api/plans/{id}` returns one plan, with 403 for another user's plan and 404 for a missing one.

**Backend**:

- `SavedPlan` and `GeneratedSchedule` entities and one migration, `AddSavedPlans`.
- A `PlanSnapshot` record that reuses the existing schedule records.
- `GeneratedScheduleService`, `SavedPlanService` and a static `SavedPlanValidator`.
- A thin `PlansController`.
- A new `ActiveRegisteredUser` authorization policy and handler.
- New DTOs and a `SavedPlanMappingProfile`.

**Frontend**:

- My plans and Plan details pages.
- A "Save plan" section on the Schedule Overview.
- A "Your saved plans" block on Home.
- A `RegisteredUserOnly` guard and a "My plans" navigation link.
- A kept-schedule store that survives Log in and Register in the same tab.
- Register returns to the "return to" page.
- The schedule display is extracted so the Schedule Overview and the Plan details page share it.

## Technical Context

**Language/Version**: C# on .NET 10 (ASP.NET Core Web API); TypeScript with React 19, built with Vite. Unchanged.

**Primary Dependencies**: Existing only (research section 1).

- Backend: EF Core 10 with Npgsql, ASP.NET Core Identity, AutoMapper, `System.Text.Json`, `TimeProvider`.
- Frontend: React, React Router, Zustand with `persist`, `Intl.DateTimeFormat`.
- Tests: xUnit, `Microsoft.AspNetCore.Mvc.Testing` with Testcontainers PostgreSQL (`PostgreSqlApiFactory`), `FakeForecastClient`, `FakeMapPlacesClient`, `FixedTimeProvider`, `TestSignInStartupFilter`; Vitest and React Testing Library.

**No new NuGet or npm package.**

**Storage**: PostgreSQL. Two new tables, `SavedPlans` and `GeneratedSchedules`, each with a `jsonb` `Snapshot` column ([data-model.md](data-model.md)). There is one new migration, `AddSavedPlans`. On the browser side, a kept schedule is held in `sessionStorage` only while a Visitor logs in or registers (research section 8).

**Testing**:

- **Backend unit tests** (`backend/tests/SpekLaiku.UnitTests/`):
  - `SavedPlanValidatorTests`: empty, spaces only, 80 and 81 characters after trimming, trimming.
  - `ActiveRegisteredUserHandlerTests`: Registered User Active succeeds; Suspended, Administrator, a deleted account and a Visitor fail.
  - `PlanSnapshotJsonTests`: a full snapshot with indoor weather, a `null` travel leg, both unscheduled reasons and enums written by name, written and read back equal (research section 4, Risk).
  - `SavedPlanMappingTests`: summary and details DTOs. `CategoryId`, `NearbyPlace.Key`, `OwnerId` and the activity limits are not exposed. `savedAt` is UTC.
  - `PlanScheduleMappingTests` (changed): `generatedScheduleId`.
- **Backend integration tests** (`backend/tests/SpekLaiku.IntegrationTests/`, real PostgreSQL, fake external services, fixed clock):
  - `SavePlanEndpointTests`:
    - 201 with the contract body and a `Location` header.
    - The saved snapshot equals the generated schedule.
    - A repeat with the same id gives 200 and still one row.
    - Name errors; unknown, expired (clock moved 30 minutes) and empty-schedule ids.
    - Name and id errors together.
    - An `ownerId` in the body is ignored.
  - `SavedPlansListEndpointTests`: newest first, only the caller's plans, empty array, 50 plans returned with summary fields only (spec SC-005; the 2-second target is checked by hand).
  - `SavedPlanDetailsEndpointTests`: contract body equal to what was saved; the 404 body; no forecast or places call while opening (the fake clients count calls).
  - `SavedPlansAuthorizationTests`: for each of the three endpoints, Visitor 401, Administrator 403, Suspended 403. Another user's plan gives 403 with no plan data in the body. Another user's plans are never listed (constitution III).
  - `GeneratedScheduleTests`:
    - A schedule with something scheduled returns an id and stores one row.
    - Nothing scheduled returns `null` and stores no row.
    - Expired rows are deleted on the next generation.
    - A Visitor's id can be saved after the same client signs in.
  - `PlanScheduleEndpointTests` (changed): only `ValidPlan_ReturnsTheContractBody` gains the `generatedScheduleId` key.
  - `DatabaseSchemaTests` (changed): the two tables, the unique index and the cascade foreign key.
  - The existing `PlanSchedule*` authorization, failure and travel tests must stay green.
- **Frontend tests** (`frontend/src/tests/`):
  - `savedPlansApi.test.ts`: each status code mapped to an answer.
  - `useSavePlanStore.test.ts`, `useSavedPlansStore.test.ts`, `useSavedPlanStore.test.ts` and `useKeptScheduleStore.test.ts`: key match and mismatch, cleared on take and on logout.
  - `formatSavedAt.test.ts`.
  - `savePlanSection.test.tsx`:
    - Visitor: button, hint, navigates to Log in and keeps the schedule.
    - User: form, validation messages, focus, Escape, saving, success link, expired with **Generate again**, server error with Retry, 401 to Log in "expired".
  - `MyPlansPage.test.tsx`: loading, empty with **New plan**, list, error with Retry, accessible Open names.
  - `PlanDetailsPage.test.tsx`: loaded, breadcrumbs, note, not found, forbidden, error.
  - `HomePage.test.tsx` (changed): the block's loading, empty, error, five items, shown only to Active Registered Users.
  - `ScheduleOverviewPage.test.tsx` (changed): a kept schedule is shown without generating; a mismatching one is ignored.
  - `RegisterPage.test.tsx` and `LoginPage.test.tsx` (changed): `returnTo` carried and used, an unsafe `returnTo` ignored.
  - `registeredUserOnly.test.tsx`.
  - Navigation and Access Denied: the My plans link.
  - Schedule fixtures gain `generatedScheduleId`.
  - The accessibility, keyboard and responsive tests are extended to the new pages.

**Target Platform**: Unchanged (ASP.NET Core API in a Linux container; current desktop and mobile browsers, 320 px and wider).

**Project Type**: Web application (backend API and frontend single-page app).

**Performance Goals**:

- My plans and a plan page within 2 seconds for 50 plans (spec SC-005). The list reads five columns through an index on (`OwnerId`, `SavedAtUtc`) and never loads `Snapshot`.
- Generating a schedule adds one insert and one indexed delete, so the 5-second target of feature 008 still holds.

**Constraints**:

- Production C# classes stay under 200 lines. `PlanScheduleService` (67 lines) gains about 5 lines.
- `ScheduleOverviewPage.tsx` (186 lines) shrinks by extracting `scheduleView.tsx` and `savePlanSection.tsx` (research section 12).
- The saved snapshot records become a storage format (research section 4, Risk).
- No external call while saving, listing or opening (spec FR-016).

**Scale/Scope**: A few dozen plans per user (spec Assumptions). Three new endpoints, one changed endpoint, two new pages, one new page section, one new Home block.

**Authorization** (research section 7):

- The new `ActiveRegisteredUser` policy on `PlansController`.
- An ownership check in `SavedPlanService`.
- `PlanScheduleController` is unchanged (`PlanCreator`).

**Backend changes** (`backend/src/SpekLaiku.Api/`):

- **Entities**:
  - `Entities/SavedPlan.cs` (new).
  - `Entities/GeneratedSchedule.cs` (new).
- **Data**:
  - `Data/SavedPlanConfiguration.cs` (new): table, `varchar(80)` name, `date[]`, indexes, cascade foreign key, `jsonb` snapshot.
  - `Data/GeneratedScheduleConfiguration.cs` (new).
  - `Data/PlanSnapshotConversion.cs` (new): the shared `System.Text.Json` options, value converter and comparer.
  - `Data/ApplicationDbContext.cs` (changed): two `DbSet`s and two configurations.
- **Migrations**: `AddSavedPlans` (new, generated with `dotnet ef migrations add AddSavedPlans --project src/SpekLaiku.Api`).
- **Services**:
  - `Services/PlanSnapshot.cs` (new).
  - `Services/GeneratedScheduleService.cs` (new): `RememberAsync`, `FindAsync`, the 30-minute lifetime.
  - `Services/SavedPlanService.cs` (new): `SaveAsync`, `ListAsync`, `GetAsync`, including the ownership check.
  - `Services/SavedPlanValidator.cs` (new, static).
  - `Services/SavePlanResult.cs`, `Services/SavedPlanLookup.cs` and `Services/SavedPlanSummary.cs` (new).
  - `Services/PlanSchedule.cs` (unchanged).
  - `Services/PlanScheduleResult.cs` (changed): carries `Guid? GeneratedScheduleId`.
  - `Services/PlanScheduleService.cs` (changed): calls `GeneratedScheduleService.RememberAsync` when something was scheduled.
  - Comments on `CheckedPlanSetup`, `CheckedPlanActivity`, `PlanSchedule`, `ScheduledActivity`, `UnscheduledActivity`, `NearbyPlace`, `WeatherSnapshot`, `TravelLeg`, `TravelSummary` and `PlaceLocation` say they are stored as JSON.
- **Authorization**:
  - `Authorization/ActiveRegisteredUserRequirement.cs` (new).
  - `Authorization/ActiveRegisteredUserHandler.cs` (new).
  - `Authorization/AuthorizationPolicies.cs` (changed): `ActiveRegisteredUser`.
- **Controllers**:
  - `Controllers/PlansController.cs` (new): `POST`, `GET`, `GET {id:guid}`.
  - `Controllers/PlanScheduleController.cs` (changed): maps the result with its id.
- **DTOs**:
  - `DTOs/Requests/SavePlanRequest.cs` (new).
  - `DTOs/Responses/SavedPlanSummaryResponse.cs`, `SavedPlanResponse.cs` and `SavedPlanLocationResponse.cs` (new).
  - `DTOs/Responses/PlanScheduleResponse.cs` (changed): `GeneratedScheduleId`.
- **Mapping**:
  - `Mapping/SavedPlanMappingProfile.cs` (new).
  - `Mapping/PlanScheduleMappingProfile.cs` (changed).
- **Program.cs** (changed): the policy, the handler and the two services registered.
- **Not changed**: clients, rate limiting, `ApiExceptionHandler`, the existing migrations.

**Frontend changes** (`frontend/src/`):

- **Types**:
  - `types/savedPlan.ts` (new).
  - `types/planSchedule.ts` (changed): `generatedScheduleId`.
- **API**: `api/savedPlansApi.ts` (new): `savePlan`, `getSavedPlans`, `getSavedPlan`, each returning a typed answer as `planScheduleApi.ts` does.
- **Stores**:
  - `stores/useSavePlanStore.ts`, `stores/useSavedPlansStore.ts`, `stores/useSavedPlanStore.ts` and `stores/useKeptScheduleStore.ts` (new).
  - `stores/usePlanScheduleStore.ts` (changed): `restore`.
  - `stores/useLogoutStore.ts` (changed): clears the kept schedule.
- **Helpers**:
  - `helpers/formatSavedAt.ts` (new).
  - `helpers/canViewSavedPlans.ts` (new): an Active Registered User. One rule for the navigation, Home, Access Denied and the guard.
- **Components**:
  - `components/scheduleView.tsx` (new, extracted from `ScheduleOverviewPage`).
  - `components/savePlanSection.tsx` (new).
  - `components/savedPlanList.tsx` (new): one real `<table>`, shown as cards at 320 px through CSS, shared by My plans and Home.
  - `components/savedPlansBlock.tsx` (new, Home).
  - `components/registeredUserOnly.tsx` (new).
  - `components/topNavigation.tsx` (changed): My plans.
  - `components/appRoutes.tsx` (changed): `/plans` and `/plans/:planId`, inside `SignedInOnly` and `RegisteredUserOnly`.
- **Pages**:
  - `pages/MyPlansPage.tsx` and `pages/PlanDetailsPage.tsx` (new).
  - `pages/ScheduleOverviewPage.tsx` (changed): uses `ScheduleView` and `SavePlanSection`; takes a kept schedule on open.
  - `pages/HomePage.tsx` (changed): `SavedPlansBlock`.
  - `pages/LoginPage.tsx` (changed): the Register link carries `returnTo`.
  - `pages/RegisterPage.tsx` (changed): goes to `safeReturnTo(returnTo) ?? "/"`.
  - `pages/AccessDeniedPage.tsx` (changed): the My plans link for Active Registered Users.
- **Styles**: `styles.css` (changed): the saved plan table and cards layout at 320 px.

**Documentation**:

- `README.md`:
  - A "Saved plans" section: save, Visitor login route, My plans, the 30-minute limit.
  - The new migration in "Database".
  - A Deployment note: the `GeneratedSchedules` table cleans itself up.
- `docs/ux-design.md`: the Access Denied note "(the My plans link comes with feature 010)" is resolved. The Plan Details row notes that edit and recalculate come with features 011 and 012.
- The spec was updated during planning: User Story 2 scenario 5 (Administrator), FR-008 (Register link carries any `returnTo`), and the dates example (research sections 9 and 10).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID, DRY, KISS, YAGNI | ✓ | Saving reuses the existing schedule records and response DTOs. One schedule display component serves two pages. No `limit` parameter, no background job, no normalised tables that nothing queries yet (research sections 4, 11 and 12). |
| I. 200-line limit / ~200 for components | ✓ | Each new service has one job: remembering, saving and reading, validating. `ScheduleOverviewPage.tsx` shrinks. |
| I. Naming | ✓ | `SavedPlanService` and `GeneratedScheduleService` follow existing service names. Pages are PascalCase, components and helpers camelCase, stores `use<Name>Store`. |
| II. Thin controllers | ✓ | `PlansController` only maps results to 200, 201, 400, 403 and 404 and reads the user id. |
| II. Business rules in services | ✓ | Validation, expiry, idempotency and ownership are all in `Services/`. The frontend only shows the server's answers. |
| II. DbContext directly, no repository | ✓ | The services use `ApplicationDbContext`. |
| II. Async I/O | ✓ | All database calls are async. |
| II. DTOs, AutoMapper without rules | ✓ | Entities are never returned. The response DTOs are positional records, so members with another source name or path (`SavedAt`, the `Snapshot` parts, `GeneratedScheduleId`) are set with `ForCtorParam` path selections, with no rules. |
| II. Migrations | ✓ | One new migration, `AddSavedPlans`, in this branch. No merged migration is touched. |
| III. Tests, deterministic, fakes | ✓ | Fixed clock for expiry. Fake forecast and places clients. Real PostgreSQL through Testcontainers for `jsonb`, `date[]` and `ExecuteDeleteAsync`. |
| III. Authorization test per protected operation | ✓ | `SavedPlansAuthorizationTests` covers all three endpoints for Visitor, Administrator and Suspended, plus the other-user cases (constitution III "one user cannot change another user's data"). |
| III. Loading, success, empty, validation-error, server-error states | ✓ | Tested for the save form, My plans, the Home block and the plan page. |
| IV. Identity, server-side authorization, validation | ✓ | Identity is unchanged. The policy and ownership checks are on the server. The name is validated on the server. The schedule content is never accepted from the browser (spec FR-004). |
| IV. Central error handling, no details leaked | ✓ | Unexpected errors go through `ApiExceptionHandler`. A 403 carries only the standard problem body, never plan data. |
| IV. Logging | ✓ | No plan names or positions are logged. |
| IV. OWASP | ✓ | Broken access control: ownership on every read; ids unguessable for generated schedules. Injection: EF Core parameters, names shown as text (spec FR-017). |
| V. Version control | ✓ | Feature branch from updated `main`. |
| VI. Documentation | ✓ | README and `docs/ux-design.md` updates planned. The spec was updated with the planning refinements. |
| VII. AI-assisted development | ✓ | Spec, clarification and plan are done before any implementation. |
| VIII. Simplicity, no new dependency | ✓ | No package. Two tables, no background services. |
| Accessibility constraint | ✓ | Labelled name field, errors as text next to the field, Escape to cancel, named Open buttons, status announcements, 320 px cards. |

**Gate result**: PASS. No violations, so Complexity Tracking is empty.

**Post-design re-check**: PASS. The Phase 1 artifacts add nothing that conflicts with the table above. Two deliberate trade-offs are recorded, not violations:

1. The two list columns copied from the snapshot (research section 5).
2. The domain records are reused as a storage format, protected by a round-trip test (research section 4).

## Project Structure

### Documentation (this feature)

```text
specs/010-save-view-plans/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── plans-api.md            # Phase 1 output (new endpoints)
│   └── plan-schedule-api.md    # Phase 1 output (change to the 008/009 contract)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code

```text
backend/
├── src/SpekLaiku.Api/
│   ├── Authorization/
│   │   ├── ActiveRegisteredUserRequirement.cs  (new)
│   │   ├── ActiveRegisteredUserHandler.cs      (new)
│   │   └── AuthorizationPolicies.cs            (changed)
│   ├── Controllers/
│   │   ├── PlansController.cs                  (new)
│   │   └── PlanScheduleController.cs           (changed)
│   ├── Data/
│   │   ├── SavedPlanConfiguration.cs           (new)
│   │   ├── GeneratedScheduleConfiguration.cs   (new)
│   │   ├── PlanSnapshotConversion.cs           (new)
│   │   └── ApplicationDbContext.cs             (changed)
│   ├── DTOs/
│   │   ├── Requests/SavePlanRequest.cs         (new)
│   │   └── Responses/
│   │       ├── SavedPlanSummaryResponse.cs     (new)
│   │       ├── SavedPlanResponse.cs            (new)
│   │       ├── SavedPlanLocationResponse.cs    (new)
│   │       └── PlanScheduleResponse.cs         (changed)
│   ├── Entities/
│   │   ├── SavedPlan.cs                        (new)
│   │   └── GeneratedSchedule.cs                (new)
│   ├── Mapping/
│   │   ├── SavedPlanMappingProfile.cs          (new)
│   │   └── PlanScheduleMappingProfile.cs       (changed)
│   ├── Migrations/
│   │   └── <timestamp>_AddSavedPlans.cs        (new, generated)
│   ├── Services/
│   │   ├── PlanSnapshot.cs                     (new)
│   │   ├── GeneratedScheduleService.cs         (new)
│   │   ├── SavedPlanService.cs                 (new)
│   │   ├── SavedPlanValidator.cs               (new)
│   │   ├── SavePlanResult.cs                   (new)
│   │   ├── SavedPlanLookup.cs                  (new)
│   │   ├── SavedPlanSummary.cs                 (new)
│   │   ├── PlanScheduleResult.cs               (changed)
│   │   └── PlanScheduleService.cs              (changed)
│   └── Program.cs                              (changed)
└── tests/
    ├── SpekLaiku.UnitTests/
    │   ├── SavedPlanValidatorTests.cs          (new)
    │   ├── ActiveRegisteredUserHandlerTests.cs (new)
    │   ├── PlanSnapshotJsonTests.cs            (new)
    │   ├── SavedPlanMappingTests.cs            (new)
    │   └── PlanScheduleMappingTests.cs         (changed)
    └── SpekLaiku.IntegrationTests/
        ├── SavePlanEndpointTests.cs            (new)
        ├── SavedPlansListEndpointTests.cs      (new)
        ├── SavedPlanDetailsEndpointTests.cs    (new)
        ├── SavedPlansAuthorizationTests.cs     (new)
        ├── GeneratedScheduleTests.cs           (new)
        ├── PlanScheduleEndpointTests.cs        (changed: contract keys)
        └── DatabaseSchemaTests.cs              (changed)

frontend/src/
├── types/        savedPlan.ts (new), planSchedule.ts (changed)
├── api/          savedPlansApi.ts (new)
├── stores/       useSavePlanStore.ts, useSavedPlansStore.ts, useSavedPlanStore.ts,
│                 useKeptScheduleStore.ts (new); usePlanScheduleStore.ts, useLogoutStore.ts (changed)
├── helpers/      formatSavedAt.ts, canViewSavedPlans.ts (new)
├── components/   scheduleView.tsx, savePlanSection.tsx, savedPlanList.tsx, savedPlansBlock.tsx,
│                 registeredUserOnly.tsx (new); topNavigation.tsx, appRoutes.tsx (changed)
├── pages/        MyPlansPage.tsx, PlanDetailsPage.tsx (new); ScheduleOverviewPage.tsx, HomePage.tsx,
│                 LoginPage.tsx, RegisterPage.tsx, AccessDeniedPage.tsx (changed)
├── styles.css    (changed)
└── tests/        see "Testing" above

README.md                                       (changed: Saved plans, migration, deployment note)
docs/ux-design.md                               (changed: notes resolved)
```

**Structure Decision**: The existing web application layout (`backend/` and `frontend/`) as documented in `docs/architecture.md` and `AGENTS.md`. New entities and their configurations follow `ActivityCategory` and `ActivityCategoryConfiguration`. The new policy follows `PlanCreator`. The new pages and guard follow the existing pages and `PlanCreatorOnly`.

## Complexity Tracking

No constitution violations. Nothing to justify.
