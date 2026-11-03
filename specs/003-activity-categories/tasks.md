---

description: "Task list for feature 003 Activity Category Management"
---

# Tasks: Activity Category Management

**Input**: Design documents from `/specs/003-activity-categories/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/categories-api.md, quickstart.md

**Tests**: Required. Constitution principle III requires backend tests for business logic and API behaviour, frontend tests for the relevant screens, and an authorization test for every protected operation. Within each story, write the tests first and confirm they fail before the implementation tasks.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested on its own. Commands are in `AGENTS.md`; backend commands run from the repository root with `.\SpekLaiku.slnx`, frontend commands from `frontend/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: The user story the task belongs to (US1 to US5)
- Paths are from the repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the starting point is green.

- [X] T001 From the repository root run `dotnet build .\SpekLaiku.slnx` and `dotnet test .\SpekLaiku.slnx`, and from `frontend/` run `npm run lint`, `npm test` and `npm run build`, to confirm the baseline after feature 002 passes before any change. Record any pre-existing failure instead of fixing it in this feature.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The table, the shared rules, the authorization policy and the frontend API layer that every story uses.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Database

- [X] T002 Create `backend/src/SpekLaiku.Api/Entities/ActivityType.cs` (`public enum ActivityType { Indoor = 0, Outdoor = 1 }`) and `backend/src/SpekLaiku.Api/Entities/ActivityCategory.cs` with the properties in `data-model.md`: `Guid Id`, `string Name`, `string NormalizedName`, `ActivityType Type`, `decimal DefaultDurationHours`, `bool RequiresDaylight`, `decimal? MaxWindMs`, `decimal? MaxRainMmPerHour`, `decimal? MinTemperatureC`, `decimal? MaxTemperatureC`, `List<string> PlaceTags` (initialised to an empty list) and `uint Version`. No validation logic in the entity.
- [X] T003 In `backend/src/SpekLaiku.Api/Data/ApplicationDbContext.cs` add `DbSet<ActivityCategory> ActivityCategories` and configure, in a new `backend/src/SpekLaiku.Api/Data/ActivityCategoryConfiguration.cs` (`IEntityTypeConfiguration<ActivityCategory>`, applied from `OnModelCreating`): table `ActivityCategories`; `Name` and `NormalizedName` "`varchar(60)`, not null"; unique index on `NormalizedName` named `IX_ActivityCategories_NormalizedName`; `Type` with `HasConversion<int>()`; `DefaultDurationHours`, `MaxWindMs`, `MaxRainMmPerHour`, `MinTemperatureC`, `MaxTemperatureC` with `HasPrecision(4, 1)` ("`numeric(4,1)`"); `PlaceTags` required (Npgsql maps `List<string>` to `text[]`); `Version` with `IsRowVersion()` so Npgsql maps it to `xmin` (research section 4). `Id` is not database-generated (`ValueGeneratedNever()`).
- [X] T004 Create `backend/src/SpekLaiku.Api/Data/StarterCategories.cs`, a static class with the five starter categories exactly as in the `data-model.md` table (names, types, durations, daylight, limits, tags, and `NormalizedName` in upper case), each with a fixed `Guid` written as a constant, and a comment that these values MUST NOT be changed by later migrations (spec FR-025, research section 5). Apply them with `HasData` in `ActivityCategoryConfiguration`.
- [X] T005 From `backend/` run `dotnet ef migrations add AddActivityCategories --project src/SpekLaiku.Api`. Review the generated migration: it creates only `ActivityCategories` with the unique index and inserts the five starter rows, adds no `xmin` column and does not touch the Identity tables. If `HasData` cannot seed the `text[]` column, remove `HasData`, regenerate, and insert the same rows with `migrationBuilder.InsertData` in `Up` (and delete them in `Down`) instead (research section 5). Do not edit the generated `*.Designer.cs` by hand.
- [X] T006 [P] Extend `backend/tests/SpekLaiku.IntegrationTests/DatabaseSchemaTests.cs` with tests that after the migrations `ActivityCategories` contains the five starter categories with the values in `data-model.md` (Museum has all four weather limits `null`), and that inserting a second row with an existing `NormalizedName` throws `DbUpdateException` whose inner `PostgresException` has `SqlState == PostgresErrorCodes.UniqueViolation` and `ConstraintName == "IX_ActivityCategories_NormalizedName"`.

### Shared rules (backend)

- [X] T007 [P] Create `backend/src/SpekLaiku.Api/Services/ActivityLimitRules.cs`, a static class with the ranges as constants and one method per field returning the message or `null` (research section 7): `CheckDuration(decimal?)` → "Enter a duration between 0.5 and 12 hours." when missing, outside 0.5 to 12, or `value * 2 != decimal.Truncate(value * 2)`; `CheckMaxWind(decimal?)` → "Enter a wind limit between 0 and 30 m/s."; `CheckMaxRain(decimal?)` → "Enter a rain limit between 0 and 20 mm/h."; `CheckMinTemperature(decimal?)` → "Enter a minimum temperature between -30 and 45 °C."; `CheckMaxTemperature(decimal?)` → "Enter a maximum temperature between -30 and 45 °C."; the four limit checks fail when missing, out of range, or `value * 10 != decimal.Truncate(value * 10)` (more than one decimal place); and `CheckTemperatureOrder(decimal min, decimal max)` → "Minimum temperature must be lower than maximum temperature." when `min >= max`. Comment that feature 005 (Form 4) uses the same methods.
- [X] T008 [P] Add `backend/tests/SpekLaiku.UnitTests/ActivityLimitRulesTests.cs` with theories for each method: both boundaries accepted (0.5 and 12; 0 and 30; 0 and 20; -30 and 45), just outside refused (0.4, 12.5, -0.1, 30.1, 20.1, -30.1, 45.1), `null` refused, `1.25` refused and `1.50m` accepted for the limits, `1.3` refused and `1.5` accepted for the duration, and the temperature order refusing equal and higher minimums.
- [X] T009 [P] Create `backend/src/SpekLaiku.Api/Services/PlaceTagParser.cs`, a static class with `public const int MaxLength = 200` and `Parse(string? text)` returning either the normalized `IReadOnlyList<string>` or the failure message: "Map place tags can be at most 200 characters." when `text.Length > 200` (checked on the text as sent, before trimming); "Enter tags in the form key=value, for example leisure=slipway." when the text is missing, no entry remains after splitting on `,`, trimming each entry and dropping empty ones, or any entry is not exactly one `=` with a trimmed key and value that each match `^[\p{L}\p{N}_:-]+$`. Spaces around the key and value are removed; the stored entry is `key=value`; duplicates are removed keeping the first-entered order (research section 3).
- [X] T010 [P] Add `backend/tests/SpekLaiku.UnitTests/PlaceTagParserTests.cs` with cases for: `leisure=slipway, sport=canoe` → two entries; ` leisure = slipway ,, sport=canoe ,` → `leisure=slipway`, `sport=canoe`; `historic:civilization=roman` and `tourism=picnic_site` accepted; a repeated pair stored once; `null`, `""`, `" , "`, `slipway`, `leisure=`, `=slipway`, `historic=*`, `historic`, `a=b=c` and `leisure=boat ramp` refused with the format message; exactly 200 characters accepted and 201 refused with the length message.
- [X] T011 Create `backend/src/SpekLaiku.Api/DTOs/Requests/ActivityCategoryRequest.cs`, `public record ActivityCategoryRequest(string? Name, string? Type, decimal? DefaultDurationHours, bool RequiresDaylight, decimal? MaxWindMs, decimal? MaxRainMmPerHour, decimal? MinTemperatureC, decimal? MaxTemperatureC, string? PlaceTags)`, with a comment explaining why the fields are nullable and `Type` is a string (research section 6), and `backend/src/SpekLaiku.Api/DTOs/Requests/UpdateActivityCategoryRequest.cs`, a record with the same fields plus `uint Version`. Make `UpdateActivityCategoryRequest` convertible to `ActivityCategoryRequest` (for example a `ToCategoryRequest()` method) so the validator takes one type.
- [X] T012 Create `backend/src/SpekLaiku.Api/Services/ActivityCategoryValidator.cs`, a static class with `Validate(ActivityCategoryRequest request)` returning a result with the ordered field errors (`IReadOnlyDictionary<string, string>`, keys in the order `name`, `type`, `defaultDurationHours`, `maxWindMs`, `maxRainMmPerHour`, `minTemperatureC`, `maxTemperatureC`, `placeTags`) and, when valid, the parsed values (trimmed name, normalized name `Name.Trim().ToUpperInvariant()`, `ActivityType`, tag list). Rules: name missing, empty or only spaces → "Enter a category name."; trimmed length outside 2 to 60 → "Category name must be between 2 and 60 characters."; type not exactly `"Indoor"` or `"Outdoor"` → "Select a type."; duration through `ActivityLimitRules.CheckDuration`; only when the type is `"Outdoor"`, the four limits through `ActivityLimitRules`, and `CheckTemperatureOrder` (reported on `minTemperatureC`) only when both temperatures are valid on their own; for `"Indoor"` the limits are ignored and returned as `null` (spec FR-007); tags through `PlaceTagParser`. The duplicate-name rule is in the service, not here.
- [X] T013 Add `backend/tests/SpekLaiku.UnitTests/ActivityCategoryValidatorTests.cs` with tests for every message in `contracts/categories-api.md`, an empty request returning `name`, `type`, `defaultDurationHours` and `placeTags` in that order, an Outdoor request with no limits returning all four limit keys, the temperature order message only when both temperatures are in range, an Indoor request with out-of-range limits being valid and returning `null` limits, a name of 2 and of 60 characters after trimming accepted, `"outdoor"` (lower case) refused with "Select a type.", and a valid request returning the trimmed and normalized name.

### Authorization (backend)

- [X] T014 Create `backend/src/SpekLaiku.Api/Authorization/AuthorizationPolicies.cs` (`public const string ActiveAdministrator = "ActiveAdministrator"`), `ActiveAdministratorRequirement.cs` (`IAuthorizationRequirement`, no data) and `ActiveAdministratorHandler.cs` (`AuthorizationHandler<ActiveAdministratorRequirement>` with `UserManager<ApplicationUser>`): call `userManager.GetUserAsync(context.User)` and `context.Succeed(requirement)` only when the account exists, `Role == "Administrator"` and `AccountStatus == AccountStatus.Active`; otherwise do nothing. In `backend/src/SpekLaiku.Api/Program.cs` replace `AddAuthorization()` with `AddAuthorizationBuilder().AddPolicy(AuthorizationPolicies.ActiveAdministrator, policy => policy.RequireAuthenticatedUser().AddRequirements(new ActiveAdministratorRequirement()))` and register `AddScoped<IAuthorizationHandler, ActiveAdministratorHandler>()`. Comment why the account is read on every request (research section 1).
- [X] T015 [P] Add `backend/tests/SpekLaiku.UnitTests/ActiveAdministratorHandlerTests.cs` (using `IdentityTestHost` and its `CreateUserAsync`) with tests that the requirement succeeds for an Active Administrator and does not succeed for an Active Registered User, a Suspended Registered User, a Suspended Administrator, a principal whose account was deleted, and an anonymous principal.

### Response and mapping (backend)

- [X] T016 [P] Create `backend/src/SpekLaiku.Api/DTOs/Responses/ActivityCategoryResponse.cs`, `public sealed record ActivityCategoryResponse(Guid Id, string Name, string Type, decimal DefaultDurationHours, bool RequiresDaylight, decimal? MaxWindMs, decimal? MaxRainMmPerHour, decimal? MinTemperatureC, decimal? MaxTemperatureC, IReadOnlyList<string> PlaceTags, uint Version)`, and `backend/src/SpekLaiku.Api/Mapping/ActivityCategoryMappingProfile.cs` mapping `ActivityCategory` to it (`Type` as `ToString()`), with no business rules. Extend the AutoMapper configuration test in `backend/tests/SpekLaiku.UnitTests/RegistrationFoundationTests.cs` (or a new `MappingConfigurationTests.cs`) so `AssertConfigurationIsValid` covers the new profile, and add one test that an Outdoor and an Indoor entity map to the expected response.

### Test helpers

- [X] T017 [P] In `backend/tests/SpekLaiku.IntegrationTests/PostgreSqlApiFactory.cs` add `CreateSignedInClientAsync(string role = "Registered User", AccountStatus status = AccountStatus.Active)`, which creates a user with `CreateUserAsync`, signs it in through `TestSignInStartupFilter.Path` and returns the HTTPS client holding the cookie, and `UniqueCategoryName(string prefix)`, which returns a name of at most 60 characters with a short random suffix, because the test database (with the starter categories) is shared by the collection (research section 5).
- [X] T018 [P] In `frontend/src/tests/renderApp.tsx` add `routeFetch(handlers)`, which stubs `fetch` with a function that picks a handler by method and path (for example `"GET /api/auth/me"`, `"GET /api/admin/categories"`, `"PUT /api/admin/categories/<id>"`), returns a fresh `Response` each call, records the requests, and fails the test for an unexpected request. Add `signedInUser(role, accountStatus)` returning the `/api/auth/me` body.

### Frontend API layer

- [X] T019 [P] Create `frontend/src/types/activityCategory.ts` with `ActivityType = "Indoor" | "Outdoor"`, `ActivityCategory` (the category object in `contracts/categories-api.md`, numbers as `number | null` for the limits), `ActivityCategoryRequest` (`name: string`, `type: ActivityType | null`, `defaultDurationHours: number | null`, `requiresDaylight: boolean`, the four limits as `number | null`, `placeTags: string`), `ActivityCategoryField` (the eight keys in contract order) and `ActivityCategoryFieldErrors = Partial<Record<ActivityCategoryField, string>>`.
- [X] T020 [P] Create `frontend/src/helpers/parseDecimal.ts`: `parseDecimal(text: string): number | null` returns `null` for an empty or only-spaces text and for anything that is not a plain decimal number with a point (`/^-?\d+(\.\d+)?$/` after trimming, so `"2,5"`, `"abc"` and `"1e3"` give `null`), else the number (research section 6). Add `frontend/src/tests/parseDecimal.test.ts` covering those cases and `"-30"`, `"0.5"`, `" 12 "`.
- [X] T021 Create `frontend/src/api/activityCategoriesApi.ts` following `authApi.ts`: `listCategories(signal)` (`200` → `ActivityCategory[]`), `getCategory(id, signal)` (`200` → category, `404` → `null`), `createCategory(request, signal)` and `updateCategory(id, request, version, signal)` returning `CategorySaveOutcome = { kind: "saved"; category } | { kind: "invalid"; errors } | { kind: "conflict" } | { kind: "notFound" } | { kind: "sessionEnded" } | { kind: "forbidden" }`: `200`/`201` → `saved`, `400` with known field keys → `invalid` (first message per field), `409` → `conflict`, `404` → `notFound`, `401` → `sessionEnded`, `403` → `forbidden`; for the list and get calls `401` and `403` throw `ApiError` with that status. Any other status throws `ApiError`; network and abort errors pass through.
- [X] T022 [P] In `frontend/src/components/textField.tsx` widen `type` to `"email" | "password" | "text"` and add an optional `inputMode` prop passed to the input, so number fields can be text inputs with `inputMode="decimal"` and their range as the existing `hint` (spec FR-002). Existing registration and login tests must still pass unchanged.

**Checkpoint**: The table exists with the starter categories, the rules and the policy are tested, and the frontend can call the API.

---

## Phase 3: User Story 1 - Create an activity category (Priority: P1) 🎯 MVP

**Goal**: An Active Administrator opens the Activity categories page, sees the list, and creates a category.

**Independent Test**: As an Active Administrator open `/admin/categories`, create the Outdoor category "Swimming" with the values from spec User Story 1 scenario 3, and see it in the list with "✓ Success: Category saved."

### Tests for User Story 1

- [X] T023 [P] [US1] Add `backend/tests/SpekLaiku.UnitTests/ActivityCategoryServiceTests.cs` (in-memory `ApplicationDbContext` with a unique database name; call `EnsureCreatedAsync` only in tests that need the starter rows) with tests that `CreateAsync` stores the trimmed name, the upper-case `NormalizedName`, the normalized tags and a new `Id`; stores `null` limits for an Indoor request that sends limits; returns `Invalid` with the validator's errors and stores nothing for an invalid request; returns `Invalid` with `name` = "A category with this name already exists." for a name that differs from an existing one only in letter case or spaces around it; translates a `DbUpdateException` with an inner `PostgresException` (`SqlState` `PostgresErrorCodes.UniqueViolation`, constraint `IX_ActivityCategories_NormalizedName`) thrown by a test `SaveChangesInterceptor` into the same name error; and that `ListAsync` returns the categories ordered by `NormalizedName` with `StringComparer.Ordinal` (for example `"kayak-2"`, `"Kayaking"` and `"Kayak_1"` in that fixed order, because `-` < `I` < `_` by code point), whatever order they were inserted in.
- [X] T024 [P] [US1] Add `backend/tests/SpekLaiku.IntegrationTests/AdminCategoriesCreateEndpointTests.cs` with tests (as an Active Administrator from `CreateSignedInClientAsync("Administrator")`) that `GET /api/admin/categories` returns `200` with a list that contains the five starter categories with every field of the category object and is ordered by `NormalizedName` with `StringComparer.Ordinal`, the same comparison the service uses, so the result does not depend on the database's collation (other tests add categories to the shared database, so do not check the exact length); `POST` with the "Swimming" body from the contract returns `201`, a `Location` header `/api/admin/categories/{id}` and the category object, and the list then contains it; an Indoor `POST` with limits returns `null` limits; a `POST` whose name differs only in letter case from an existing category returns `400` with the name message; and that a visitor gets `401` and an Active Registered User `403` for `GET` and `POST`, with nothing stored (the full table is in US4).
- [X] T025 [P] [US1] Add `frontend/src/tests/useActivityCategoriesStore.test.tsx` with tests that `load()` sets `"loading"` then `"loaded"` with the categories in API order; a `5xx`, a network error and no answer after 10 seconds (fake timers) give `"error"`; a second `load()` started later wins over an earlier slower one; `reset()` aborts a pending load and returns to the initial state.
- [X] T026 [P] [US1] Add `frontend/src/tests/useCategoryFormStore.test.tsx` with tests for create: `submit` sets `"pending"`, then on `201` returns to `"idle"`, resolves with the saved category and calls the list store's `load()`; a second `submit` while pending is ignored; `400` sets `"invalid"` with the field errors; a `5xx`, a network error and the 10-second timeout give `"serverError"`; `retry()` sends the last request again; `reset()` aborts a pending request and drops its result; `401` calls `useCurrentUserStore.getState().markSessionEnded()`; `403` calls `useCurrentUserStore.getState().refresh()`.
- [X] T027 [P] [US1] Add `frontend/src/tests/ActivityCategoriesPage.test.tsx` (signed in as an Active Administrator through `routeFetch`) with tests for: the title "Activity categories - Spėk laiku" and one `<h1>` "Activity categories"; "Loading activity categories…" in a `role="status"` region while the list loads; the list in API order showing each name and type with an "Edit" button whose accessible name is "Edit <name>"; with an empty list "No categories yet. Create the first category." and a "Create category" button; a failed load showing "Error: Activity categories could not be loaded." with Retry and no "Create category" button, and Retry loading again; "Create category" opening a form whose heading "Create category" receives focus, with no type selected and "Requires daylight" unchecked; selecting Indoor hiding the four weather fields and Outdoor showing them; while saving, "Saving category…" in a `role="status"` region and the "Save" button disabled; after `201`, "✓ Success: Category saved." shown, the form closed and the new category in the list; a server error showing "Error: Something went wrong. Try again." with Retry, keeping every typed value, and Retry sending the same body; "Cancel" closing the form without a request; a number field with `2,5` sent as `null` in the request body.

### Implementation for User Story 1

- [X] T028 [US1] Create `backend/src/SpekLaiku.Api/Services/ActivityCategoryResult.cs` with `Success(ActivityCategory category)`, `Invalid(IReadOnlyDictionary<string, string> errors)`, `NotFound()` and `Conflict()` factory methods and `Succeeded`, `IsNotFound`, `IsConflict`, `Category` and `Errors` properties, following `LoginResult.cs`.
- [X] T029 [US1] Create `backend/src/SpekLaiku.Api/Services/ActivityCategoryService.cs` with `ApplicationDbContext` in the constructor and `ListAsync(CancellationToken)` (no tracking; load the categories, then sort them in memory with `OrderBy(category => category.NormalizedName, StringComparer.Ordinal)`, so the order is the same on every PostgreSQL server whatever its collation; the list stays well under 100 rows, research section 9) and `CreateAsync(ActivityCategoryRequest, CancellationToken)`: validate with `ActivityCategoryValidator`; return `Invalid` on errors; return `Invalid` with `name` = "A category with this name already exists." when `AnyAsync` finds the normalized name; otherwise add the entity with `Guid.NewGuid()` and save; catch `DbUpdateException` whose inner `PostgresException` is a unique violation on `IX_ActivityCategories_NormalizedName` and return the same name error (research section 8). Add no logging: a technical failure is an unhandled exception that the existing `ApiExceptionHandler` logs and answers with `500` (spec FR-022, research section 11). Register it with `AddScoped<ActivityCategoryService>()` in `backend/src/SpekLaiku.Api/Program.cs`. Keep the class under 200 lines.
- [X] T030 [US1] Create `backend/src/SpekLaiku.Api/Controllers/AdminCategoriesController.cs`: `[ApiController]`, `[Route("api/admin/categories")]`, `[Authorize(Policy = AuthorizationPolicies.ActiveAdministrator)]` on the class; inject `ActivityCategoryService` and `IMapper`; `[HttpGet] List` → `200` with `ActivityCategoryResponse[]`; `[HttpPost] Create(ActivityCategoryRequest)` → `201` with `CreatedAtAction` (the `Location` points to the `GET {id}` action added in US2; until then use `Created($"/api/admin/categories/{id}", body)`), or `400` `ValidationProblemDetails` built exactly like `AuthController.Login` (title "One or more request fields are invalid."). Add `ProducesResponseType` attributes for `200`/`201`, `400`, `401`, `403` and `500`. No business rules (constitution II).
- [X] T031 [P] [US1] Create `frontend/src/stores/useActivityCategoriesStore.ts` with `categoriesTimeoutMs = 10_000`, state `status: "loading" | "loaded" | "error"`, `categories: ActivityCategory[]`, `controller`, and actions `load()` (aborts any earlier pending load, latest request wins, timeout gives `"error"`) and `reset()`; export `initialActivityCategoriesState`. Reset it after each test in `frontend/src/tests/setup.ts`.
- [X] T032 [US1] Create `frontend/src/stores/useCategoryFormStore.ts` following `useLoginStore.ts`: `categoryFormTimeoutMs = 10_000`; `CategoryFormStatus = "idle" | "pending" | "invalid" | "conflict" | "serverError"`; state `status`, `errors`, `lastRequest` (the request and, for an update, the id and version), `controller`; actions `submit(request)` (ignored while `"pending"`, read through `get()`), `retry()` and `reset()`. On `saved` call `useActivityCategoriesStore.getState().load()`, return to `"idle"` and resolve with the category; on `invalid` set the errors; on `sessionEnded` call `useCurrentUserStore.getState().markSessionEnded()`; on `forbidden` call `useCurrentUserStore.getState().refresh()`; any thrown error gives `"serverError"`. This task handles create; US2 adds update, conflict and `reloadCategory`. Reset it after each test in `frontend/src/tests/setup.ts`.
- [X] T033 [P] [US1] Create `frontend/src/components/categoryList.tsx`: while `"loading"` the text "Loading activity categories…" in a `role="status"` region (never a spinner alone); on `"error"` "Error: Activity categories could not be loaded." through `formatErrorMessage` with a Retry button calling `load()`, in a `role="alert"` region; when loaded and empty "No categories yet. Create the first category."; otherwise a list with one row per category showing the name, the type and a `<button type="button">` "Edit" with `aria-label="Edit <name>"` that calls an `onEdit(category)` prop.
- [X] T034 [P] [US1] Create `frontend/src/components/weatherLimitFields.tsx` with four `TextField`s (`type="text"`, `inputMode="decimal"`): "Max wind (m/s)" with hint "0 to 30", "Max rain (mm/h)" with hint "0 to 20", "Min temperature (°C)" and "Max temperature (°C)" with hint "-30 to 45", ids `category-maxWindMs`, `category-maxRainMmPerHour`, `category-minTemperatureC`, `category-maxTemperatureC`, values and change handlers from props, and an `errors` prop for US3.
- [X] T035 [US1] Create `frontend/src/components/categoryForm.tsx` with props `category: ActivityCategory | null` (null = create), `onSaved(category)` and `onCancel()`: a heading "Create category" (or "Edit <name>") with `tabIndex={-1}` that receives focus and is scrolled into view when the form opens (spec FR-013); fields Name (`category-name`), Type as a `<fieldset>` with legend "Type" and radio buttons "Indoor" and "Outdoor" (none selected when creating; split into `components/categoryTypeField.tsx` if the form passes about 200 lines), Default duration (h) (`category-defaultDurationHours`, hint "0.5 to 12, in steps of 0.5"), the `weatherLimitFields` only for Outdoor, a checkbox "Requires daylight", and Map place tags (`category-placeTags`, hint "key=value pairs separated by commas, for example leisure=slipway"); typed values in component state, numbers converted with `parseDecimal` and Indoor sending `null` limits; the name and map place tags sent exactly as typed, not trimmed, so the server applies the 200-character limit to the text as entered (spec FR-009); "Saving category…" in a `role="status"` region and a disabled "Save" while pending; on `"serverError"` "Error: Something went wrong. Try again." with a Retry button calling `retry()`; a "Cancel" button calling `onCancel`. On a resolved save call `onSaved`.
- [X] T036 [US1] Create `frontend/src/pages/ActivityCategoriesPage.tsx`: `usePageTitle("Activity categories")`, one `<h1>` "Activity categories", calls `load()` on mount and resets both stores on unmount; holds which form is open (`none | create | <id>`) in component state; shows "Create category" only when the list is loaded; renders `categoryList` and, when open, `categoryForm` inside a two-part layout (`className` for the list-and-form layout styled in US5); `onSaved` closes the form and calls `navigate(pathname, { replace: true, state: { successMessage: "Category saved." } })` so the existing `SuccessBanner` shows "✓ Success: Category saved." (spec FR-012). Keep it under about 200 lines.
- [X] T037 [US1] In `frontend/src/components/appRoutes.tsx` add the route `admin/categories` rendering `ActivityCategoriesPage` inside `SignedInOnly` (US4 adds `AdministratorOnly` between them). The server already refuses non-administrators (T014, T030).

**Checkpoint**: An administrator can list and create categories, opening the page by its address; MVP is usable.

---

## Phase 4: User Story 2 - Edit a category's defaults and map place tags (Priority: P1)

**Goal**: An administrator changes an existing category, and two administrators cannot overwrite each other's changes.

**Independent Test**: Edit the starter category "Kayaking", change the maximum wind from 8 to 6 m/s and the tags to `leisure=slipway`, save, edit it again and see the new values.

### Tests for User Story 2

- [X] T038 [P] [US2] Extend `backend/tests/SpekLaiku.UnitTests/ActivityCategoryServiceTests.cs` with tests that `GetAsync` returns a category or `null`; `UpdateAsync` stores the new values; returns `NotFound()` for an unknown id; returns `Conflict()` and changes nothing when the request `Version` differs from the stored one; returns `Conflict()` when `SaveChangesAsync` throws `DbUpdateConcurrencyException` (through a test `SaveChangesInterceptor`); allows renaming a category to its own name in another letter case; refuses another category's name with the name error; and clears all four limits when the type changes from Outdoor to Indoor.
- [X] T039 [P] [US2] Add `backend/tests/SpekLaiku.IntegrationTests/AdminCategoriesUpdateEndpointTests.cs` (as an Active Administrator, on categories created with `UniqueCategoryName`) with tests that `PUT` with the current `version` returns `200` with the new values and a different `version`; a second `PUT` with the old `version` returns `409` with title and detail "This category was changed by someone else. Reload it and try again." and the stored values are those of the first update; `GET /api/admin/categories/{id}` returns the stored values; `GET` and `PUT` for an unknown id return `404` "Category not found."; Outdoor → Indoor returns `null` limits; a `PUT` with invalid fields and an old `version` returns `400`, not `409` (check order in the contract).
- [X] T040 [P] [US2] Extend `frontend/src/tests/useCategoryFormStore.test.tsx` with update tests: `submit` for an existing category sends `PUT /api/admin/categories/<id>` with the `version`; `409` sets `"conflict"` and keeps `lastRequest`; `reloadCategory(id)` fetches the category and resolves with it, and the next `submit` sends the reloaded `version`, not the old one; `404` sets `"serverError"` and calls the list store's `load()`.
- [X] T041 [P] [US2] Add `frontend/src/tests/ActivityCategoriesEdit.test.tsx` with tests for: "Edit Kayaking" opening the form with the heading "Edit Kayaking" focused and every stored value shown (tags joined with ", "); saving changed values shows the banner, closes the form and shows the updated list; changing Outdoor → Indoor hides the weather fields and sends `null` limits; changing an Indoor category to Outdoor shows the four weather fields empty; "Cancel" closes the form without a request; a `409` shows "Error: This category was changed by someone else. Reload it and try again." at the top of the form with a "Reload" button, keeps the typed values, and "Reload" replaces them with the stored values, after which "Save" sends the reloaded `version` and gets `200` with the banner; selecting "Edit" for another category or "Create category" while a form is open replaces it without a warning; with the five starter categories returned by the list, all five are listed in alphabetical order.

### Implementation for User Story 2

- [X] T042 [US2] In `backend/src/SpekLaiku.Api/Services/ActivityCategoryService.cs` add `GetAsync(Guid id, CancellationToken)` and `UpdateAsync(Guid id, UpdateActivityCategoryRequest request, CancellationToken)`: validate first (return `Invalid`); load the entity (return `NotFound()` when missing); return `Conflict()` when `entity.Version != request.Version`; set `context.Entry(entity).Property(e => e.Version).OriginalValue = request.Version`; check the normalized name against other categories (`Id != id`); apply the values (limits `null` for Indoor); save; catch `DbUpdateConcurrencyException` → `Conflict()` and the unique violation → name error (research sections 4 and 8). Keep the class under 200 lines; move the shared "apply values" and "is unique violation" code into private methods.
- [X] T043 [US2] In `backend/src/SpekLaiku.Api/Controllers/AdminCategoriesController.cs` add `[HttpGet("{id:guid}")] Get(Guid id)` → `200` or `404` problem details "Category not found." and `[HttpPut("{id:guid}")] Update(Guid id, UpdateActivityCategoryRequest request)` → `200`, `400`, `404`, or `409` problem details with title and detail "This category was changed by someone else. Reload it and try again."; switch `Create` to `CreatedAtAction(nameof(Get), ...)`. Add the `ProducesResponseType` attributes for `404` and `409`.
- [X] T044 [US2] In `frontend/src/stores/useCategoryFormStore.ts` send `updateCategory(id, request, version)` when `lastRequest` has an id; on `conflict` set `"conflict"`; on `notFound` set `"serverError"` and call `useActivityCategoriesStore.getState().load()`; add `reloadCategory(id)`, which calls `getCategory`, replaces the `version` in `lastRequest` with the reloaded category's `version`, returns to `"idle"` and resolves with the stored category (a failure gives `"serverError"`), so the next save is compared against the reloaded values (spec FR-026).
- [X] T045 [US2] In `frontend/src/components/categoryForm.tsx` and `frontend/src/pages/ActivityCategoriesPage.tsx` support editing: the page passes the selected category and a `key` so a newly selected category replaces the open form (spec Edge Cases); the form fills its fields from the category (numbers as text, tags joined with ", "), shows the heading "Edit <name>", sends the update with the category's `version`, and on `"conflict"` shows "Error: This category was changed by someone else. Reload it and try again." through `formatErrorMessage` in a `role="alert"` element at the top of the form with a "Reload" button that calls `reloadCategory`, refills the fields and from then on uses the reloaded category's `version` for "Save" (spec FR-026). Changing Indoor to Outdoor shows the weather fields empty.

**Checkpoint**: Categories can be created and edited; conflicting saves are refused.

---

## Phase 5: User Story 3 - Understand invalid category values (Priority: P1)

**Goal**: Every invalid value is refused on the server and explained next to its field.

**Independent Test**: Submit an empty create form, then a form with out-of-range limits and malformed tags, and each time see the expected messages with nothing stored.

### Tests for User Story 3

- [X] T046 [P] [US3] Add `backend/tests/SpekLaiku.IntegrationTests/AdminCategoriesValidationEndpointTests.cs` (as an Active Administrator) with tests that: an empty JSON object returns `400` with `name`, `type`, `defaultDurationHours` and `placeTags` and nothing else; an Outdoor body without limits also returns the four limit keys; each message in the contract table is returned for its case; boundary values (wind 0 and 30, rain 0 and 20, temperatures -30 and 45, duration 0.5 and 12) are accepted; wind `1.25` and duration `1.3` are refused; equal minimum and maximum temperatures give the order message on `minTemperatureC`; ` leisure = slipway ,, sport=canoe ,` is stored as two tags and a repeated pair once; `historic=*`, `historic` and a 201-character tags text are refused; a body that is not valid JSON and a string for `maxWindMs` return `errors.request`; a form-encoded body returns `415`; and after each refused request the list is unchanged.
- [X] T047 [P] [US3] Add `frontend/src/tests/CategoryFormValidation.test.tsx` with tests that: an empty submit shows "Error: Enter a category name.", "Error: Select a type.", "Error: Enter a duration between 0.5 and 12 hours." and "Error: Enter tags in the form key=value, for example leisure=slipway." next to their fields, and an error summary listing them in field order whose links move focus to the fields; a single field error shows no summary; the minimum temperature message is shown next to the minimum temperature field; the duplicate-name message is shown next to Name; every typed value is kept; focus moves to the first invalid field; each invalid input has `aria-invalid="true"` and an `aria-describedby` that includes its hint and error; the Type fieldset error is linked to the fieldset.

### Implementation for User Story 3

- [X] T048 [US3] In `frontend/src/components/categoryForm.tsx` (and `weatherLimitFields.tsx`, `categoryTypeField.tsx` if split) show each field error from the store under its field through `TextField` (`formatErrorMessage` adds "Error: "); show the Type error inside the fieldset, linked with `aria-describedby` on the fieldset; build the `ErrorSummary` from the errors in contract key order with the field ids (`category-name`, the first Type radio, `category-defaultDurationHours`, the four limit ids, `category-placeTags`); after `"invalid"` keep all typed values and move focus to the first invalid field (spec FR-011). Keep each component under about 200 lines.

**Checkpoint**: All three P1 editing stories work, with full server-side validation shown in the form.

---

## Phase 6: User Story 4 - Only active administrators can manage categories (Priority: P1)

**Goal**: Only a signed-in Active Administrator can see or change categories, on the server and in the browser.

**Independent Test**: Open the page and send create and edit requests as a visitor, a Registered User, a Suspended Administrator and an Active Administrator; only the Active Administrator succeeds.

### Tests for User Story 4

- [X] T049 [P] [US4] Add `backend/tests/SpekLaiku.IntegrationTests/AdminCategoriesAuthorizationTests.cs` with a theory over the four endpoints (`GET` list, `GET {id}`, `POST`, `PUT {id}`, using a starter category id) and the callers in the contract's authorization table: visitor `401` with an empty body; Active Registered User, Suspended Registered User and Suspended Administrator `403` with no category data in the body; Active Administrator not `401` or `403`. Add tests that a refused `POST` and `PUT` (with valid bodies) store nothing, and that an Administrator whose `AccountStatus` is set to `Suspended` in the database after signing in gets `403` on the next request (research section 1). Add a test that `DELETE /api/admin/categories/{id}` for a starter category returns `405` for an Active Administrator and the category still exists (spec FR-023).
- [X] T050 [P] [US4] Add `frontend/src/tests/administratorOnly.test.tsx` with tests that: a visitor opening `/admin/categories` is sent to `/login?returnTo=%2Fadmin%2Fcategories` with "Log in to continue.", and after logging in as an Active Administrator the Activity categories page opens; an Active Registered User sees the Access Denied page (heading "Access denied", title "Access denied - Spėk laiku", the text "You do not have permission to open this page." and a link to `/`) at the same address and no request to `/api/admin/categories` is sent; a Suspended Registered User and a Suspended Administrator are sent to `/account-suspended`; an Active Administrator sees the Activity categories page.
- [X] T051 [P] [US4] Extend `frontend/src/tests/topNavigation.test.tsx` with tests that a signed-in Active Administrator sees Home, "Categories" (a link to `/admin/categories`) and Log out, and that a visitor, an Active Registered User and a Suspended Administrator do not see "Categories" (spec FR-017).
- [X] T052 [P] [US4] Add `frontend/src/tests/categorySessionEnded.test.tsx` with tests that a save answered with `401` sends the administrator to the Log in page with "Your session has expired. Log in again." and, after logging in, back to `/admin/categories`; and that a save answered with `403` after `/api/auth/me` now returns a Registered User shows the Access Denied page (research section 10).

### Implementation for User Story 4

- [X] T053 [P] [US4] Create `frontend/src/pages/AccessDeniedPage.tsx`: `usePageTitle("Access denied")`, one `<h1>` "Access denied", the paragraph "You do not have permission to open this page." and a `Link` "Go to the home page" to `/` (spec FR-019). Comment that later features use it for their own refused pages and that feature 010 adds a My plans link.
- [X] T054 [US4] Create `frontend/src/components/administratorOnly.tsx`, used inside `SignedInOnly`: renders nothing while the current-user status is `"loading"`; `<Navigate to="/account-suspended" replace />` for a signed-in user with `accountStatus === "Suspended"`; `AccessDeniedPage` for a signed-in user whose `role` is not `"Administrator"`; otherwise its children. In `frontend/src/components/appRoutes.tsx` wrap the `admin/categories` route as `SignedInOnly` → `AdministratorOnly` → `ActivityCategoriesPage` (spec FR-018, FR-019).
- [X] T055 [US4] In `frontend/src/components/topNavigation.tsx` show a `NavLink` "Categories" to `/admin/categories` between Home and Log out only when the status is `"signedIn"`, `user.role === "Administrator"` and `user.accountStatus === "Active"`. Update the comment at the top of the file for the administrator navigation (spec FR-017).

**Checkpoint**: Access is limited to Active Administrators everywhere; all P1 stories are complete.

---

## Phase 7: User Story 5 - Manage categories with keyboard, screen reader and on a phone (Priority: P2)

**Goal**: The Activity categories and Access Denied pages work with a keyboard, a screen reader and at 320 px.

**Independent Test**: Create and edit a category using only the keyboard, and use the page at 320 px wide without horizontal scrolling.

### Tests for User Story 5

- [X] T056 [P] [US5] Extend `frontend/src/tests/keyboard.test.tsx` with tests that on the Activity categories page, as an Active Administrator, the tab order is skip link, navigation (Home, Categories, Log out), "Create category", then each category's "Edit" button; that the form's fields are reached in the order Name, Type, Default duration, the weather fields (Outdoor), Requires daylight, Map place tags, Save, Cancel; that the radio buttons change with the arrow keys; and that a category can be created and saved using only the keyboard.
- [X] T057 [P] [US5] Extend `frontend/src/tests/accessibility.test.tsx` and `frontend/src/tests/layout.test.tsx` with tests that the Activity categories and Access Denied pages each have exactly one `<h1>`, their page titles, and "Skip to main content" as the first focusable item; that every form field has a visible label; that each number field's `aria-describedby` includes its range hint; and that the loading and saving texts are in `role="status"` regions and the error messages in `role="alert"` regions (spec FR-020).
- [X] T058 [P] [US5] Extend `frontend/src/tests/responsive.test.tsx` with tests that the Activity categories page uses a two-column list-and-form rule on desktop and one column below the existing mobile breakpoint (list first), and that its inputs, radio buttons, checkbox and buttons follow the same full-width, 44 × 44 px minimum target and 16 px input text rules as the Register page (spec FR-021).

### Implementation for User Story 5

- [X] T059 [US5] In `frontend/src/styles.css` add the list-and-form layout for the Activity categories page (two columns, list on the left, at desktop width; one column, list first, below the existing mobile breakpoint), reuse the existing form rules for its fields and buttons, and make the radio buttons, the checkbox and their labels at least 44 × 44 px targets, reusing existing class names where possible instead of copying rules.

**Checkpoint**: All user stories are complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T060 [P] Update `README.md`: the new migration step (`dotnet ef database update --project .\backend\src\SpekLaiku.Api`), an "Activity categories" section describing the page at `/admin/categories`, the five starter categories, who can open it, and how to test it as an Administrator using the existing "Testing an Administrator or Suspended account" SQL (quickstart.md Manual Validation).
- [ ] T061 [P] Update `docs/architecture.md`: add `Authorization/` (authorization policies and handlers, first used by feature 003) to the backend folder table and the folder tree, so the documented structure matches the code (constitution "Repository structure").
- [ ] T062 [P] Update `docs/ux-design.md` so it matches the specification (constitution VI): in Form 6 add the messages "Enter a category name.", "Category name must be between 2 and 60 characters.", "Enter a minimum temperature between -30 and 45 °C.", "Enter a maximum temperature between -30 and 45 °C." and "Map place tags can be at most 200 characters."; in the "Admin: Activity Categories" states add Loading ("Loading activity categories…"), Server error ("Error: Activity categories could not be loaded." with Retry) and Conflict ("Error: This category was changed by someone else. Reload it and try again." with Reload); note the five starter categories; and in the Access Denied row note the text "You do not have permission to open this page." and that the My plans link comes with feature 010.
- [ ] T063 [P] Check every new or changed C# class is under 200 lines (constitution I), especially `ActivityCategoryService.cs` and `AdminCategoriesController.cs`, and every new React page or component is under about 200 lines, especially `categoryForm.tsx`; split by responsibility if not.
- [ ] T064 Run `dotnet format .\SpekLaiku.slnx --verify-no-changes`, `dotnet build .\SpekLaiku.slnx` and `dotnet test .\SpekLaiku.slnx` from the repository root, and `npm run lint`, `npm run format:check`, `npm test` and `npm run build` from `frontend/`. Fix any failure without weakening tests or checks.
- [ ] T065 Review `git diff main...HEAD` for unintended files (no `bin/`, `obj/`, `node_modules/`, local settings or debug code), confirm the migration is the only schema change, and list the quickstart Manual Validation steps for the user to run before the Pull Request.
- [ ] T066 Run a separate AI-assisted review of the branch (for example `/code-review` and `/security-review`), apply or reject each finding with a short reason, and prepare the Pull Request description for the user (constitution V, VII and Quality Gates): link to `specs/003-activity-categories/spec.md`, a summary of the change, the tests and checks run (T064 and the manual quickstart steps), the migration `AddActivityCategories`, screenshots of the Activity categories page (desktop and 320 px), the form with errors and the Access Denied page, and the review tool, important findings, changes made and findings not applied. The user opens and merges the Pull Request.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories. Inside it: T002 → T003 → T004 → T005 → T006; T007 and T009 before T012; T011 before T012; T012 before T013; T014 before T015; T019 before T021.
- **US1 (Phase 3)**: Depends on Foundational.
- **US2 (Phase 4)**: Depends on US1 (extends the service, controller, store, form and page created there).
- **US3 (Phase 5)**: Depends on US1 (the form). Can run alongside US2 on the backend test (T046); T048 touches `categoryForm.tsx`, so do it after T045.
- **US4 (Phase 6)**: Depends on US1 (the route and page). Backend authorization tests (T049) need `GET {id}` and `PUT` from US2.
- **US5 (Phase 7)**: Depends on US1 to US4 (tests check the final page, navigation and form).
- **Polish (Phase 8)**: Depends on all stories.

### Within Each User Story

- Tests are written first and must fail before the implementation tasks.
- Backend: result type → service → controller.
- Frontend: stores → components → page → route.

### Parallel Opportunities

- Foundational: T006, T007/T008, T009/T010, T015, T016, T017, T018, T019, T020 and T022 touch different files.
- US1: T023 to T027 (all tests) in parallel; then T031, T033 and T034 in parallel with the backend tasks T028 to T030.
- US2: T038 to T041 in parallel.
- US4: T049 to T053 in parallel.
- US5: T056 to T058 in parallel.
- Polish: T060 to T063 in parallel; then T064, T065 and T066 in order.

---

## Parallel Example: User Story 1

```text
# All tests for User Story 1 together:
Task: "T023 ActivityCategoryServiceTests in backend/tests/SpekLaiku.UnitTests/ActivityCategoryServiceTests.cs"
Task: "T024 AdminCategoriesCreateEndpointTests in backend/tests/SpekLaiku.IntegrationTests/AdminCategoriesCreateEndpointTests.cs"
Task: "T025 useActivityCategoriesStore tests in frontend/src/tests/useActivityCategoriesStore.test.tsx"
Task: "T026 useCategoryFormStore tests in frontend/src/tests/useCategoryFormStore.test.tsx"
Task: "T027 ActivityCategoriesPage tests in frontend/src/tests/ActivityCategoriesPage.test.tsx"

# Independent frontend pieces together:
Task: "T031 useActivityCategoriesStore in frontend/src/stores/useActivityCategoriesStore.ts"
Task: "T033 categoryList in frontend/src/components/categoryList.tsx"
Task: "T034 weatherLimitFields in frontend/src/components/weatherLimitFields.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2 (the table, rules and policy are in place and tested).
2. Complete Phase 3 (US1): an administrator lists and creates categories; the server already refuses everyone else.
3. **STOP and VALIDATE** with the US1 independent test, then review the diff.

### Incremental Delivery

1. US1 → create (MVP).
2. US2 → edit and conflicts.
3. US3 → validation messages in the form.
4. US4 → browser-side access rules, Access Denied page and navigation.
5. US5 → keyboard, screen reader and 320 px.
6. Polish → documentation, size check, full checks, diff review, AI review and Pull Request description.

Implement one phase at a time and stop after each phase for a diff review; commit only when asked, with Conventional Commit messages such as `feat(categories): add activity category table and starter data`.

---

## Notes

- [P] tasks touch different files and do not depend on unfinished tasks.
- Integration tests share one database with the starter categories; tests that create categories use `UniqueCategoryName` and never assume an exact list length.
- No new package. The only schema change is the migration `AddActivityCategories`.
- No `DELETE` endpoint or button (spec FR-023).
