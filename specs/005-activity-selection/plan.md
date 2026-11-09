# Implementation Plan: 005-activity-selection

**Branch**: `005-activity-selection` | **Date**: 2026-11-05 | **Spec**: [specs/005-activity-selection/spec.md](spec.md)

**Input**: Feature specification from `/specs/005-activity-selection/spec.md`

## Summary

Let a Visitor or an Active Registered User, after a checked Plan setup, add activities to the plan from the activity categories, remove them, and change each activity's duration, daylight setting and weather limits for this plan only. Then continue, after a server check, to a first version of step 3, "Places and forecast".

**Backend**:
- A new `PlanActivitiesController` with the feature 004 `PlanCreator` policy.
- `GET /api/plan-activities/categories` returns the categories without map place tags or the edit version, plus `maxActivities` (10), so the page holds no limit of its own (research section 1).
- `POST /api/plan-activities/check`: `PlanActivityService` reads the requested categories in one query, and the static `PlanActivityValidator` checks the count, the category and its type, and every setting with feature 003's `ActivityLimitRules` (research sections 4 and 5).

**Frontend**:
- The Activity selection page grows from feature 004's first version into the category list and the plan's activities.
  - Each activity is a labelled group with its settings.
  - Repeated categories get numbered names worked out when rendering.
- A session-stored activities store, a categories store and a check store that keeps errors on the right activity and drops answers for changed values.
- A first version of step 3 at `/plan/places`.
- The weather limit fields are shared with the admin category form.

No database change, no migration and no new package.

## Technical Context

**Language/Version**: C# on .NET 10 (ASP.NET Core Web API); TypeScript with React 19, built with Vite. Unchanged.

**Primary Dependencies**: Existing only.
- Backend: ASP.NET Core, EF Core with Npgsql, AutoMapper.
- Frontend: React, React Router, Zustand (with `persist`).
- Tests: xUnit, EF Core in-memory provider (unit), `Microsoft.AspNetCore.Mvc.Testing` with Testcontainers PostgreSQL (integration), Vitest, React Testing Library, user-event.

**No new NuGet or npm package** (research section 12).

**External service**: None. This feature reads only the database.

**Authorization**: `[Authorize(Policy = AuthorizationPolicies.PlanCreator)]` on `PlanActivitiesController` (anonymous or Active Registered User; others get `403`). No request limit (research section 8). In the browser, `/plan/places` is wrapped in `PlanCreatorOnly` like the other plan routes.

**Backend structure** (`backend/src/SpekLaiku.Api/`):
- `DTOs/Requests/PlanActivitiesCheckRequest.cs` (new): `List<PlanActivityRequest>? Activities`.
- `DTOs/Requests/PlanActivityRequest.cs` (new): `Guid? CategoryId`, `string? Type`, `decimal? DurationHours`, `bool RequiresDaylight`, `decimal? MaxWindMs`, `decimal? MaxRainMmPerHour`, `decimal? MinTemperatureC`, `decimal? MaxTemperatureC`. Comment why the numbers are `decimal?`: so that a missing value gets the field message instead of a request error.
- `DTOs/Responses/PlanCategoryResponse.cs`, `PlanCategoriesResponse.cs`, `CheckedPlanActivityResponse.cs` and `CheckedPlanActivitiesResponse.cs` (new): as in `contracts/plan-activities-api.md`.
- `Services/CheckedPlanActivity.cs` and `PlanActivitiesResult.cs` (new): as in `data-model.md`.
- `Services/PlanActivityValidator.cs` (new, static): `MaxActivities = 10`, the messages, and `Validate(request, categories)` as in `data-model.md` (Validation rules). It uses `ActivityLimitRules` for every range.
- `Services/PlanActivityService.cs` (new): `ListCategoriesAsync` (delegates to `ActivityCategoryService.ListAsync`), and `CheckAsync`, which does the count check first, then one `AsNoTracking` query for the requested ids, then the validator.
- `Mapping/PlanActivityMappingProfile.cs` (new): `ActivityCategory` to `PlanCategoryResponse`, and `CheckedPlanActivity` to `CheckedPlanActivityResponse`, both with `Type` as its name. No rules.
- `Controllers/PlanActivitiesController.cs` (new): `[Route("api/plan-activities")]`.
  - `GET categories` returns `200` with the categories and `maxActivities` from `PlanActivityValidator.MaxActivities`.
  - `POST check` returns `200` or `400` (`ValidationProblemDetails`, keys in contract order, the same as `PlanSetupController`).
- `Program.cs` (changed): `AddScoped<PlanActivityService>()`. AutoMapper already scans the assembly.

**Error responses**: `400` `ValidationProblemDetails`, `403` from the policy, `500` from the existing `ApiExceptionHandler` (research section 10).

**Frontend structure** (`frontend/src/`):
- `types/planActivity.ts` (new): `PlanCategory`, `PlanActivity`, `CheckedPlanActivity`, `PlanActivityField` and `PlanActivityErrors` (`data-model.md`).
- `api/planActivitiesApi.ts` (new):
  - `listPlanCategories(signal)` returns `PlanCategory[]`; any other status throws `ApiError`.
  - `checkPlanActivities(request, signal)` returns `{ kind: "checked"; activities } | { kind: "invalid"; errors: Record<string, string> } | { kind: "forbidden" }`. Other statuses throw `ApiError`. A `400` without `activities` keys throws. Follows `planSetupApi.ts`.
- `helpers/planActivityNames.ts`, `planActivityRequest.ts` and `planActivityFieldIds.ts` (new): `data-model.md` (Helpers).
- `stores/usePlanActivitiesStore.ts` (new, `persist` to `sessionStorage`), `usePlanCategoriesStore.ts` and `usePlanActivitiesCheckStore.ts` (new): `data-model.md` and research sections 2 and 6.
- `stores/useLogoutStore.ts` (changed): also calls `usePlanActivitiesStore.getState().clear()` (spec FR-019).
- `pages/ActivitySelectionPage.tsx` (changed):
  - Keeps the heading, progress at step 2, `PlanSetupSummary`, Back and the redirect from feature 004.
  - Adds a two-column layout with `PlanCategoryList` and `PlanActivitiesForm`.
  - On mount it loads the categories; on unmount it resets the categories and check stores, but not the activities store.
- `pages/PlacesAndForecastPage.tsx` (new): research section 7.
- `components/planCategoryList.tsx` (new): the loading, error with Retry, empty and list states, each "Add" named "Add <name>", disabled at 10 with the message, and announcements in a status region.
- `components/planActivitiesForm.tsx` (new): `ErrorSummary`, the empty text, one `PlanActivitySettings` per activity, "Checking your activities…", Continue and server error with Retry. Focus moves to the first invalid field after a failed check.
- `components/planActivitySettings.tsx` (new): a `<fieldset>` with `<legend>` of the shown name and the list-level `activities[i]` message, Duration (`TextField`, hint "0.5 to 12"), Requires daylight (checkbox), `WeatherLimitFields` for Outdoor, and "Remove <name>".
- `components/planActivitiesSummary.tsx` (new): the checked activities for step 3.
- `components/weatherLimitFields.tsx` (changed): `idPrefix` prop and plain errors (research section 9). `components/categoryForm.tsx` passes `idPrefix="category"`.
- `components/planProgress.tsx` (changed): step 2 gets the path `/plan/activities`.
- `components/appRoutes.tsx` (changed): `plan/places` inside `PlanCreatorOnly`.
- `styles.css` (changed): the Activity selection layout.
  - Categories left and activities right from 40em, one column below.
  - Each setting on its own row on phones.
  - Reuses the existing form, fieldset, button and breakpoint rules.
- `tests/setup.ts` (changed): resets the three new stores (sessionStorage is already cleared).

**Origins and CSRF**: Unchanged. The new `POST` changes no stored state and accepts JSON only.

**Storage**: None on the server. The browser keeps the activities in `sessionStorage` (research section 2). **No migration.**

**Testing**:
- **Backend unit tests**: `PlanActivityValidator` (every row of the validation table, order of keys, stop rules, repeated categories, Indoor limits ignored), `PlanActivityService` (in-memory database: one result per activity in order, unknown id, name taken from the database), and `PlanActivityMappingProfile` (no tags or version).
- **Backend integration tests**: authorization table for both endpoints, the list contract, and the check contract's statuses and messages, against PostgreSQL with the starter categories plus categories added per test.
- **Frontend tests**: the list in `quickstart.md`, with faked `fetch`.

**Target Platform**: Web application, the same browsers and server as before.

**Project Type**: Full-stack web application.

**Performance Goals**:
- Three activities added and continued in under 1 minute (SC-001).
- The category list is one small query of well under 100 rows. The check is at most one query for 10 ids.

**Constraints**:
- Server-side authorization and validation on both endpoints.
- No map place tags reach planners.
- Category defaults are never written.
- Accessibility and a 320 px layout.
- Every new C# class under 200 lines, and React files under about 200 lines.

**Scale/Scope**: Two endpoints, one page changed, one page added, five components (four new, one shared and changed), three stores, three helpers.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **PASS (I Code quality)**: Every duration and weather range comes from `ActivityLimitRules`, shared with feature 003; the browser holds none. The 10-activity limit exists only in `PlanActivityValidator.MaxActivities` and reaches the page as `maxActivities` in the categories response, like `maxDates` in feature 004 (analysis finding C1). The category order comes from `ActivityCategoryService.ListAsync`. The weather limit fields are one component used by both forms. The shown names of repeated activities are derived in one helper. No Manager, Helper or Utils names; each class has one responsibility.
- **PASS (II Architecture)**:
  - The controller only binds, calls `PlanActivityService` and maps.
  - Rules are in the validator and service.
  - The service uses `ApplicationDbContext` directly with an async `AsNoTracking` query.
  - Responses are DTOs mapped by AutoMapper with no rules in the profile; the `ActivityCategory` entity is never returned.
  - No schema change, so no migration.
  - Frontend calls go only through `api/planActivitiesApi.ts`.
- **PASS (III Testing)**:
  - Unit and integration tests for every rule and both endpoints; frontend tests for loading, success, empty, validation-error and server-error states.
  - Both endpoints have authorization tests for every caller type.
  - "One user cannot change another user's data" does not apply: nothing is stored, and categories are read only here.
  - No external service is involved.
- **PASS (IV Security)**:
  - Authorization is enforced on the server by the existing policy.
  - All input is validated on the server: the category is trusted only by id and read again; the name and type come from the database; every number is range-checked.
  - The planning list leaves out the map place tags and the edit version by type (OWASP excessive data exposure).
  - The count check runs before any query, so one request cannot cause unbounded work (OWASP unrestricted resource consumption).
  - No secrets and nothing new is logged.
  - Failures are handled centrally.
- **PASS (V Version control)**: Work is on `005-activity-selection`, created from an updated `main` after 004 was merged. The first commit corrects the feature table in `docs/architecture.md`.
- **PASS (VI Documentation)**:
  - During planning: the spec was corrected so the type-change rule cannot be confused with an empty field (FR-012).
  - During implementation:
    - The README gets an Activity selection section.
    - `docs/ux-design.md` gets the Activity Selection states "No activity categories are available yet.", "Checking your activities…" and "You can add up to 10 activities.", and the first Places and forecast state.
- **PASS (VII AI use)**: The spec, clarifications and plan exist before implementation.
- **PASS (VIII Simplicity)**:
  - No new package, no new folder and no server state.
  - One new controller with two actions.
  - Browser-only ids instead of server ids.
  - The step 3 page contains only what the spec requires.

**Post-design re-check**: PASS. The data model, contract and quickstart add no layer, package, migration or violation. The shared `WeatherLimitFields` change is a prop addition, and the category form keeps its field ids.

## Project Structure

### Documentation (this feature)

```text
specs/005-activity-selection/
├── spec.md              # Feature specification (with Clarifications)
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1: service models, validation rules, frontend state
├── quickstart.md        # Phase 1: automated and manual validation
├── contracts/
│   └── plan-activities-api.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
backend/
├── src/SpekLaiku.Api/
│   ├── Controllers/PlanActivitiesController.cs           (new)
│   ├── DTOs/Requests/PlanActivitiesCheckRequest.cs       (new)
│   ├── DTOs/Requests/PlanActivityRequest.cs              (new)
│   ├── DTOs/Responses/PlanCategoryResponse.cs            (new)
│   ├── DTOs/Responses/PlanCategoriesResponse.cs          (new)
│   ├── DTOs/Responses/CheckedPlanActivityResponse.cs     (new)
│   ├── DTOs/Responses/CheckedPlanActivitiesResponse.cs   (new)
│   ├── Mapping/PlanActivityMappingProfile.cs             (new)
│   ├── Services/CheckedPlanActivity.cs                   (new)
│   ├── Services/PlanActivitiesResult.cs                  (new)
│   ├── Services/PlanActivityValidator.cs                 (new)
│   ├── Services/PlanActivityService.cs                   (new)
│   └── Program.cs                                        (changed)
└── tests/
    ├── SpekLaiku.UnitTests/PlanActivityValidatorTests.cs     (new)
    ├── SpekLaiku.UnitTests/PlanActivityServiceTests.cs       (new)
    ├── SpekLaiku.UnitTests/PlanActivityMappingTests.cs       (new)
    ├── SpekLaiku.IntegrationTests/PlanCategoriesEndpointTests.cs       (new)
    ├── SpekLaiku.IntegrationTests/PlanActivitiesCheckEndpointTests.cs  (new)
    └── SpekLaiku.IntegrationTests/PlanActivitiesAuthorizationTests.cs  (new)

frontend/src/
├── api/planActivitiesApi.ts                (new)
├── types/planActivity.ts                   (new)
├── helpers/planActivityNames.ts            (new)
├── helpers/planActivityRequest.ts          (new)
├── helpers/planActivityFieldIds.ts         (new)
├── stores/usePlanActivitiesStore.ts        (new)
├── stores/usePlanCategoriesStore.ts        (new)
├── stores/usePlanActivitiesCheckStore.ts   (new)
├── stores/useLogoutStore.ts                (changed)
├── pages/ActivitySelectionPage.tsx         (changed)
├── pages/PlacesAndForecastPage.tsx         (new)
├── components/planCategoryList.tsx         (new)
├── components/planActivitiesForm.tsx       (new)
├── components/planActivitySettings.tsx     (new)
├── components/planActivitiesSummary.tsx    (new)
├── components/weatherLimitFields.tsx       (changed)
├── components/categoryForm.tsx             (changed)
├── components/planProgress.tsx             (changed)
├── components/appRoutes.tsx                (changed)
├── styles.css                              (changed)
└── tests/                                  (new and extended test files, see quickstart.md)
```

**Structure Decision**: The existing web application layout (`backend/` and `frontend/`), as described in `docs/architecture.md`. No new folders.

## Complexity Tracking

No constitution violations to justify.
