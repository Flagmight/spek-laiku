# Implementation Plan: 003-activity-categories

**Branch**: `003-activity-categories` | **Date**: 2026-11-02 | **Spec**: [specs/003-activity-categories/spec.md](spec.md)

**Input**: Feature specification from `/specs/003-activity-categories/spec.md`

## Summary

Let an Active Administrator list, create and edit activity categories: name, Indoor or Outdoor type, default duration, daylight setting, four default weather limits (Outdoor only) and the map place tags used later to find places. The backend gets a new `ActivityCategory` entity and migration (with the five starter categories), an `ActivityCategoryService` with a validator, a shared `ActivityLimitRules` class for the ranges that feature 005 will reuse, an `ActiveAdministrator` authorization policy that reads the account's role and status on every request, and an `AdminCategoriesController` at `/api/admin/categories` with optimistic concurrency through PostgreSQL `xmin`. The frontend gets an Activity categories page with a list and a create / edit form, an Access Denied page, an `AdministratorOnly` guard, a "Categories" navigation item for administrators and two Zustand stores. No new package.

## Technical Context

**Language/Version**: C# on .NET 10 (ASP.NET Core Web API); TypeScript with React 19, built with Vite. Unchanged from features 001 and 002.

**Primary Dependencies**: Existing only. Backend: ASP.NET Core Identity (`UserManager` for the account lookup), EF Core with Npgsql (arrays, `xmin` concurrency token, `PostgresErrorCodes`), AutoMapper. Frontend: React, React Router, Zustand. Tests: xUnit, `Microsoft.AspNetCore.Mvc.Testing`, Testcontainers PostgreSQL, EF Core in-memory provider, Vitest, React Testing Library, user-event. **No new NuGet or npm package.**

**Authorization**: A policy `ActiveAdministrator` (`Authorization/AuthorizationPolicies.cs`, `ActiveAdministratorRequirement.cs`, `ActiveAdministratorHandler.cs`), registered in `Program.cs` with `AddAuthorizationBuilder().AddPolicy(...)` and `AddScoped<IAuthorizationHandler, ActiveAdministratorHandler>()`. The handler loads the account through `UserManager.GetUserAsync` and succeeds only for `Role == "Administrator"` and `AccountStatus.Active`. The existing cookie events turn a missing sign-in into `401` and a refusal into `403` (research section 1). The controller has the policy on the class.

**Backend structure**:
- `Entities/ActivityCategory.cs`, `Entities/ActivityType.cs` (new): see `data-model.md`.
- `Data/ApplicationDbContext.cs`: `DbSet<ActivityCategory> ActivityCategories`; the configuration (lengths, `numeric(4,1)`, enum to `int`, unique `NormalizedName` index, `Version` as `IsRowVersion()`) and the starter `HasData` live in `Data/ActivityCategoryConfiguration.cs` (`IEntityTypeConfiguration<ActivityCategory>`, applied from `OnModelCreating`), and `Data/StarterCategories.cs` holds the seed values, so `ApplicationDbContext` stays short.
- `Migrations/<timestamp>_AddActivityCategories.cs` (new): table, index and five starter rows.
- `DTOs/Requests/ActivityCategoryRequest.cs` (new): nullable `Name`, `Type`, `DefaultDurationHours`, `MaxWindMs`, `MaxRainMmPerHour`, `MinTemperatureC`, `MaxTemperatureC`, `PlaceTags` (text as typed), `bool RequiresDaylight`. `DTOs/Requests/UpdateActivityCategoryRequest.cs` (new): the same fields plus `uint Version` (research section 6).
- `DTOs/Responses/ActivityCategoryResponse.cs` (new): the category object in `contracts/categories-api.md`.
- `Mapping/ActivityCategoryMappingProfile.cs` (new): entity → response (`Type` as its name, `PlaceTags` as the list). No business rules.
- `Services/ActivityLimitRules.cs` (new, static): range constants and one check per field (duration, wind, rain, minimum and maximum temperature, minimum below maximum), each returning the message or `null` (research section 7).
- `Services/PlaceTagParser.cs` (new, static): `Parse(string? text)` returning the normalized list or a failure, with `MaxLength = 200` (research section 3).
- `Services/ActivityCategoryValidator.cs` (new, static): `Validate(ActivityCategoryRequest)` returning the ordered field errors and the parsed values (normalized name, type, tags), using `ActivityLimitRules` and `PlaceTagParser`.
- `Services/ActivityCategoryService.cs` (new): `ListAsync` (sorted in memory by `NormalizedName` with `StringComparer.Ordinal`, research section 9), `GetAsync(id)`, `CreateAsync(request)`, `UpdateAsync(id, request)` on `ApplicationDbContext`; duplicate-name check plus unique-violation translation (research section 8); version check plus `DbUpdateConcurrencyException` → conflict (research section 4). Returns `ActivityCategoryResult` (`Services/ActivityCategoryResult.cs`, new): `Success(category)`, `Invalid(errors)`, `NotFound()`, `Conflict()`.
- `Controllers/AdminCategoriesController.cs` (new): `[Route("api/admin/categories")]`, `[Authorize(Policy = AuthorizationPolicies.ActiveAdministrator)]`; `GET`, `GET {id:guid}`, `POST` (`201` with `Location`), `PUT {id:guid}`; translates results into `200`/`201`, `400` `ValidationProblemDetails` (same shape as `AuthController`), `404` and `409` problem details. No business rules.
- `Program.cs`: registers the policy, the handler and `ActivityCategoryService`.

**Error responses**: Problem details as in features 001 and 002. `400` with field keys in form order, `404` "Category not found.", `409` "This category was changed by someone else. Reload it and try again.", `500` from the existing `ApiExceptionHandler`. API messages have no prefix; the frontend adds "Error: ". Details in `contracts/categories-api.md`.

**Frontend structure**:
- `types/activityCategory.ts` (new): `ActivityCategory` (the response object), `ActivityCategoryRequest` (with `placeTags` as text and numbers as `number | null`), `ActivityCategoryField` (the eight field keys) and `ActivityCategoryFieldErrors`.
- `api/activityCategoriesApi.ts` (new): `listCategories(signal)`, `getCategory(id, signal)`, `createCategory(request, signal)`, `updateCategory(id, request, version, signal)`. The save calls return `{ kind: "saved", category } | { kind: "invalid", errors } | { kind: "conflict" } | { kind: "notFound" } | { kind: "sessionEnded" } | { kind: "forbidden" }`; any other status throws `ApiError`, following `authApi.ts`.
- `helpers/parseDecimal.ts` (new): text → `number | null` (`null` for empty or not a number; research section 6).
- `stores/useActivityCategoriesStore.ts` (new): `status: "loading" | "loaded" | "error"`, `categories`, `load()` (10-second timeout, latest request wins), `reset()`. Categories kept in the order the API returns.
- `stores/useCategoryFormStore.ts` (new): mirrors `useLoginStore`: `status: "idle" | "pending" | "invalid" | "conflict" | "serverError"`, `errors`, `lastRequest`, `controller`, `submit(request)` (ignored while pending, read through `get()`), `retry()`, `reloadCategory(id)` (fetches the stored values for "Reload"), `reset()`, 10-second timeout. On `saved` it reloads the list and resolves with the category; on `notFound` it reloads the list and sets `serverError`; on `sessionEnded` it calls `useCurrentUserStore.getState().markSessionEnded()`; on `forbidden` it calls `useCurrentUserStore.getState().refresh()` (research section 10).
- `pages/ActivityCategoriesPage.tsx` (new): `usePageTitle("Activity categories")`, `<h1>` "Activity categories", the list and the form side by side (stacked on narrow screens), "Create category" (hidden while the list is loading or failed). Holds which form is open (none, create, or a category id). After a save it closes the form and navigates to its own path with `{ successMessage: "Category saved." }`. Resets both stores on unmount.
- `components/categoryList.tsx` (new): loading text "Loading activity categories…" in a `role="status"` region, the error "Error: Activity categories could not be loaded." with Retry in a `role="alert"` region, the empty state, and one row per category with name, type and an "Edit" button with an accessible name "Edit <name>".
- `components/categoryForm.tsx` (new): heading "Create category" or "Edit <name>" (focused on open, scrolled into view), fields Name, Type (radio group Indoor / Outdoor, none selected when creating), Default duration (h), Requires daylight (checkbox), Map place tags; the weather fields for Outdoor through `components/weatherLimitFields.tsx` (new). Field errors through the existing `TextField`, the existing `ErrorSummary`, focus on the first invalid field, "Saving category…" while pending, the server error with Retry, the conflict message with Reload, Save and Cancel. Typed values are component state. Each file stays under about 200 lines; the Type radio group becomes `components/categoryTypeField.tsx` if needed.
- `components/textField.tsx`: also accepts `type="text"`, an optional `inputMode` and the range hint, so number fields show their allowed range as a hint (spec FR-002).
- `components/administratorOnly.tsx` (new): inside `SignedInOnly`; nothing while loading; a Suspended user → `<Navigate to="/account-suspended" replace />`; a non-Administrator → `AccessDeniedPage`; otherwise its children.
- `pages/AccessDeniedPage.tsx` (new): `usePageTitle("Access denied")`, `<h1>` "Access denied", "You do not have permission to open this page." and a link "Go to the home page" to `/`.
- `components/appRoutes.tsx`: route `admin/categories` → `SignedInOnly` → `AdministratorOnly` → `ActivityCategoriesPage`.
- `components/topNavigation.tsx`: a "Categories" `NavLink` to `/admin/categories` for a signed-in Active Administrator, between Home and Log out (spec FR-017).
- `styles.css`: list-and-form layout (two columns on desktop, one column below the existing mobile breakpoint), radio group and checkbox targets of at least 44 × 44 px, reusing the existing form rules.
- `tests/setup.ts`: resets the two new stores after each test.

**Origins and CSRF**: Unchanged from feature 002: same origin, `SameSite=Lax` cookie, JSON-only bodies (`[ApiController]` rejects form-encoded bodies with `415`), no CORS policy, no antiforgery token. `PUT` is never sent cross-site without a preflight that the API does not allow.

**Storage**: PostgreSQL through `ApplicationDbContext`. **One migration**: `AddActivityCategories` (table, unique index, starter data).

**Testing**:
- Backend unit tests: `ActivityLimitRules` (each boundary and decimal rule), `PlaceTagParser` (normalizing, duplicates, refused forms, 200 versus 201 characters), `ActivityCategoryValidator` (each message, key order, Indoor ignores limits, minimum temperature rule), `ActivityCategoryService` on the in-memory provider (create, update, duplicate name, unknown id, stale version, unique-violation translation through a `SaveChangesInterceptor` that throws), `ActiveAdministratorHandler` (each role and status, missing account).
- Backend integration tests against Testcontainers PostgreSQL: the authorization table for all four endpoints, the starter categories after migration, create / list / get / update, every validation message, letter-case duplicates, the `xmin` conflict, Outdoor → Indoor, and the unique index (schema test). Tests that create categories use unique names, because the database is shared by the test collection.
- Frontend tests with Vitest and faked `fetch`: page states, form behaviour and focus, stores (timeouts with fake timers, double submit, retry, reset, conflict, session ended, forbidden), `parseDecimal`, the guard and Access Denied page, navigation per role and status, keyboard order, accessibility attributes and the CSS rules for 320 px.

**Target Platform**: Web application, same browsers and server as features 001 and 002.

**Project Type**: Full-stack web application.

**Performance Goals**: Creating a category in under 2 minutes and correcting one limit in under 1 minute for the administrator (SC-001, SC-002); one query per list load and at most three per save.

**Constraints**: Server-side validation and authorization on every endpoint; the same ranges and messages as Form 4; no category stored with invalid values (SC-004); accessibility and 320 px layout; every new C# class under 200 lines and every new React component under about 200 lines.

**Scale/Scope**: Four endpoints, two pages, one guard, two stores; well under 100 categories (spec assumption), so no paging or search.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- PASS (I Code quality): Range rules are in one class (`ActivityLimitRules`) shared with feature 005, tag parsing in one class (`PlaceTagParser`). Each class has one responsibility and stays under 200 lines; the form is split into components. Names describe responsibility (no Manager, Helper or Utils).
- PASS (II Architecture): The controller only translates HTTP and results; validation, uniqueness, concurrency and queries live in `ActivityCategoryService` and its validator, using `ApplicationDbContext` directly with no repository layer. All I/O is async. Responses are DTOs mapped by AutoMapper with no rules in the profile. The schema change is the migration `AddActivityCategories` in this branch. The frontend calls the API only through `api/activityCategoriesApi.ts`.
- PASS (III Testing): Unit and integration tests for the rules and endpoints, and frontend tests for loading, success, empty, validation-error and server-error states. Every endpoint has authorization tests for a visitor, a Registered User, a Suspended Registered User, a Suspended Administrator and an Active Administrator. The "one user cannot change another user's data" rule does not apply: categories are shared data with no owner, and the authorization tests prove that only an Active Administrator can change them. No external service is involved; no test depends on the clock.
- PASS (IV Security): Authorization is enforced on the server by a policy that reads the current role and status (OWASP broken access control); hiding the "Categories" link is not relied on. All input is validated on the server. EF Core parameterized queries (injection). The tag pattern accepts only letters, digits, `_`, `:` and `-`, so a tag cannot inject syntax into the map query that feature 007 builds. No secrets, no sensitive data logged. Unexpected failures go through the central `ApiExceptionHandler`.
- PASS (V Version control): Work is on `003-activity-categories`, created from an updated `main` after 002 was merged.
- PASS (VI Documentation): The README gets the new migration step, the starter categories and how to open the Activity categories page as an Administrator. The spec already records the clarified behaviour.
- PASS (VII AI use): Spec, clarifications and plan exist before implementation.
- PASS (VIII Simplicity): No new package. One table with an array column instead of a child table; `xmin` instead of a hand-made version column; seed data in the migration instead of start-up code; one authorization policy instead of a role system. `ActivityLimitRules` holds only rules this feature needs now.

**Post-design re-check**: PASS. The data model, contract and quickstart add no layer, package or violation.

## Project Structure

### Documentation (this feature)

```text
specs/003-activity-categories/
├── spec.md                 # Feature specification
├── plan.md                 # This file
├── research.md             # Technical decisions
├── data-model.md           # ActivityCategory, ActivityType, starter data, migration
├── quickstart.md           # Validation steps
├── contracts/
│   └── categories-api.md   # Admin categories API contract
├── checklists/
│   └── requirements.md     # Spec quality checklist
└── tasks.md                # Created by /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── src/SpekLaiku.Api/
│   ├── Authorization/
│   │   ├── AuthorizationPolicies.cs              # new, policy names
│   │   ├── ActiveAdministratorRequirement.cs     # new
│   │   └── ActiveAdministratorHandler.cs         # new
│   ├── Controllers/AdminCategoriesController.cs  # new
│   ├── Data/ApplicationDbContext.cs              # + ActivityCategories
│   ├── Data/ActivityCategoryConfiguration.cs     # new, table configuration and starter data
│   ├── Data/StarterCategories.cs                 # new, the five starter categories
│   ├── DTOs/Requests/ActivityCategoryRequest.cs, UpdateActivityCategoryRequest.cs   # new
│   ├── DTOs/Responses/ActivityCategoryResponse.cs                                 # new
│   ├── Entities/ActivityCategory.cs, ActivityType.cs                              # new
│   ├── Mapping/ActivityCategoryMappingProfile.cs                                  # new
│   ├── Migrations/<timestamp>_AddActivityCategories.cs                            # new
│   ├── Services/
│   │   ├── ActivityLimitRules.cs                 # new, shared with feature 005
│   │   ├── PlaceTagParser.cs                     # new
│   │   ├── ActivityCategoryValidator.cs          # new
│   │   ├── ActivityCategoryService.cs            # new
│   │   └── ActivityCategoryResult.cs             # new
│   └── Program.cs                                # registers policy, handler, service
└── tests/
    ├── SpekLaiku.UnitTests/                       # rules, parser, validator, service, handler tests
    └── SpekLaiku.IntegrationTests/                # endpoint, authorization, concurrency and schema tests

frontend/src/
├── api/activityCategoriesApi.ts                   # new
├── types/activityCategory.ts                      # new
├── helpers/parseDecimal.ts                        # new
├── stores/useActivityCategoriesStore.ts, useCategoryFormStore.ts   # new
├── pages/ActivityCategoriesPage.tsx, AccessDeniedPage.tsx          # new
├── components/categoryList.tsx, categoryForm.tsx, weatherLimitFields.tsx,
│             administratorOnly.tsx                                  # new
├── components/textField.tsx, topNavigation.tsx, appRoutes.tsx      # changed
├── styles.css                                                      # changed
└── tests/                                         # page, form, store, guard, navigation tests
```

**Structure Decision**: Use the existing backend and frontend layout from features 001 and 002. The only new folder is `backend/src/SpekLaiku.Api/Authorization/` for the policy, which features 014 and 015 also use; `docs/architecture.md` is updated to list it.

## Complexity Tracking

None. The Constitution Check has no violations to justify.
