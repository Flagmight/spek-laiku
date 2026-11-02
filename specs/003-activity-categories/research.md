# Activity Category Management Research

Technical decisions for feature 003. Each entry gives the decision, the reason and the alternatives that were rejected.

## 1. Who may manage categories (spec FR-016 to FR-019)

**Decision**: Add one authorization policy, `AuthorizationPolicies.ActiveAdministrator`, with a requirement `ActiveAdministratorRequirement` and a handler `ActiveAdministratorHandler`. The handler loads the signed-in account with `UserManager.GetUserAsync(context.User)` and succeeds only when the account exists, `Role == "Administrator"` and `AccountStatus == Active`. `AdminCategoriesController` has `[Authorize(Policy = AuthorizationPolicies.ActiveAdministrator)]` on the class, so every action is protected. A visitor gets `401` and any other signed-in user gets `403`, through the existing `OnRedirectToLogin` and `OnRedirectToAccessDenied` cookie events in `Program.cs`.

**Rationale**: The role and status are columns on `ApplicationUser`, not claims in the cookie, and feature 014 will change the status while users are signed in. Reading the account on every protected request means a suspended or demoted administrator is refused at once, not after their cookie expires. A policy keeps the rule in one place, out of the controller (constitution II), and later admin features (014, 015) reuse it by name.

**Alternatives considered**:
- Adding role and status claims at sign-in (a custom `IUserClaimsPrincipalFactory`) and using `[Authorize(Roles = "Administrator")]`: rejected, the claims would stay stale for up to 30 minutes after a suspension.
- A role check inside the controller or service: rejected, every action would have to repeat it and a missed one would be a broken access control bug.
- ASP.NET Core Identity roles (`AspNetRoles`): rejected for this feature, the project stores one role string on the user since feature 001; switching is a separate decision.

## 2. Storing a category

**Decision**: A new entity `ActivityCategory` in its own table `ActivityCategories` with a `Guid` key, `Name`, `NormalizedName` (unique index), `Type` (enum `ActivityType`, stored as `int` like `AccountStatus`), `DefaultDurationHours`, `RequiresDaylight`, four nullable weather limits and `PlaceTags`. Numbers are `decimal` with `numeric(4,1)` columns. Details are in `data-model.md`.

**Rationale**:
- `Guid` keys let the migration insert the starter categories with fixed ids (section 5) without breaking the PostgreSQL identity sequence. With an `int` identity column, seeded rows with explicit ids leave the sequence at 1, so the first category an administrator creates would fail with a duplicate key.
- `NormalizedName` (`Name` trimmed and upper-cased with the invariant culture) with a unique index makes names unique without regard to letter case (spec FR-003) and lets PostgreSQL refuse a duplicate even when two administrators save at the same moment. This is the same approach Identity uses for `NormalizedEmail`.
- `decimal` keeps values like 0.5 exact, so the "at most one decimal place" and "steps of 0.5" rules are exact comparisons.
- The ranges are business rules in the service (constitution II), so there are no database check constraints.

**Alternatives considered**: storing weather limits in a separate table (rejected, always exactly zero or four values for one category); `double` columns (rejected, 0.1 steps are not exact).

## 3. Storing map place tags (spec FR-009, FR-044)

**Decision**: `PlaceTags` is a `List<string>` of normalized `key=value` strings, stored by Npgsql as a PostgreSQL `text[]` column. The request sends the tags as the text the administrator typed; `PlaceTagParser` splits it on commas, trims each entry, drops empty entries, checks each pair and removes duplicates while keeping the first-entered order. The response returns the stored list, and the frontend shows it joined with ", ".

**Rationale**: Tags are always read and written together with their category, so a separate table and join add nothing. Npgsql maps primitive collections to arrays without extra configuration or package. Feature 007 splits each entry at its `=` to build the map query.

**Validation rule**: a key and a value are each one or more characters from letters, digits, `_`, `:` and `-` (regular expression `^[\p{L}\p{N}_:-]+$` for each side). This accepts real tags such as `leisure=slipway`, `tourism=picnic_site` and `historic:civilization=roman`, and refuses `*`, a key on its own, spaces inside a pair and a second `=` (clarification Q3). The 200-character limit applies to the text as typed, before trimming.

**Alternatives considered**: a `PlaceTag` child table (rejected, see above); one comma-separated `text` column (rejected, every reader would need the same parser).

## 4. Two administrators editing the same category (spec FR-026)

**Decision**: Use PostgreSQL's `xmin` system column as an optimistic concurrency token: `ActivityCategory.Version` is a `uint` configured with `.IsRowVersion()`, which Npgsql maps to `xmin`. Every category response includes `version`. The update request must send the `version` the form was opened with. `ActivityCategoryService.UpdateAsync` returns `Conflict` when the stored version differs, and also when `SaveChangesAsync` throws `DbUpdateConcurrencyException` (a change committed between the read and the write). The controller returns `409` with the title "This category was changed by someone else. Reload it and try again."

**Rationale**: `xmin` changes on every update without any extra column, trigger or code, and EF Core adds it to the `WHERE` clause of the `UPDATE`, so the check is done by the database itself, as FR-026 requires ("decided on the server").

**Alternatives considered**: a `DateTime UpdatedAt` column compared by the service (rejected, needs a clock and is not checked atomically by the `UPDATE`); a manual `int Version` incremented by the service (works, but `xmin` gives the same with no code).

## 5. Starter categories (spec FR-025)

**Decision**: Add the five starter categories with `HasData` in `ApplicationDbContext`, using fixed `Guid` ids, so the migration `AddActivityCategories` inserts them when the table is created. `NormalizedName` values are written in upper case in the seed data. `HasData` values MUST NOT be changed in later features; a later change to a starter category is an administrator's edit, not a migration.

**Rationale**: A migration runs exactly once per database, which is the "added once at first setup, never added again or reset" rule. Running a check at application start would add start-up code and would re-add a starter category if an administrator renamed all of them, which the clarification forbids. If `HasData` cannot seed the `text[]` column in this EF Core and Npgsql version, the migration uses `migrationBuilder.InsertData` with the same values instead; the outcome is the same.

**Consequence for tests**: integration tests apply the migrations, so the five starter categories always exist there and tests that create categories must use unique names (for example with a `Guid` suffix), because the test database is shared by the collection. The empty state ("No categories yet.") is tested in the frontend with a faked empty response, as the spec's assumptions say.

**Alternatives considered**: EF Core `UseAsyncSeeding` or a hosted service that inserts when the table is empty (rejected, see above); a SQL script in the README (rejected, a fresh clone would have no categories, constitution VIII "reproducible").

## 6. Request shape for numbers and type (spec FR-003 to FR-010)

**Decision**: `ActivityCategoryRequest` has nullable fields: `string? Name`, `string? Type`, `decimal? DefaultDurationHours`, `bool RequiresDaylight`, `decimal? MaxWindMs`, `decimal? MaxRainMmPerHour`, `decimal? MinTemperatureC`, `decimal? MaxTemperatureC`, `string? PlaceTags`; the update request adds `uint Version`. `Type` is a string checked by the validator ("Indoor" or "Outdoor"), not an enum, so a wrong value gives "Select a type." instead of a generic binding error. The frontend number fields are text inputs with `inputMode="decimal"`; a value that is empty or not a number is sent as `null`.

**Rationale**: For every number field the message for "missing" and "out of range" is the same ("Enter a wind limit between 0 and 30 m/s."), so sending text that is not a number as `null` gives the correct message from the server, together with every other field's error in one response, with no second rule set in the browser. This keeps the 001 and 002 pattern: validation lives on the server, the frontend shows the messages.

**Rules in the validator**:
- At most one decimal place: `value * 10 == decimal.Truncate(value * 10)`, so `1.50` is accepted and `1.25` is not.
- Duration in steps of 0.5: `value * 2 == decimal.Truncate(value * 2)`.
- For an Indoor category the weather fields are ignored and stored as `null`, whatever the request contains (spec FR-007).
- The minimum temperature message is added only when both temperatures are valid on their own (spec FR-006).
- Field keys are returned in form order: `name`, `type`, `defaultDurationHours`, `maxWindMs`, `maxRainMmPerHour`, `minTemperatureC`, `maxTemperatureC`, `placeTags`.

**Alternatives considered**: `string` fields for every number parsed by the server (rejected, every client would send numbers as text); validating number format in the browser first (rejected, two rule sets and errors shown in two rounds).

## 7. Shared range rules with feature 005 (spec FR-006)

**Decision**: The ranges and their messages for duration, wind, rain and temperature live in one static class `Services/ActivityLimitRules.cs`, with one method per field that returns the message or `null`. `ActivityCategoryValidator` calls it; feature 005 (Form 4, Activity settings) will call the same methods.

**Rationale**: The spec states the same ranges and messages for both forms; one implementation avoids two copies drifting apart (constitution I, DRY). It contains only the rules this feature already needs, so it is not speculative (constitution VIII).

## 8. Duplicate names (spec FR-003)

**Decision**: `ActivityCategoryService` checks `NormalizedName` against the other categories before saving and returns the name error "A category with this name already exists.". If two saves race past that check, PostgreSQL's unique index refuses the second; the service catches the `DbUpdateException` whose inner `PostgresException` has `SqlState == PostgresErrorCodes.UniqueViolation` and constraint name `IX_ActivityCategories_NormalizedName`, and returns the same name error.

**Rationale**: The check gives the normal message without an exception; the index makes the rule hold under concurrency (spec Edge Cases). An endpoint test proves the check. A real race cannot be reproduced reliably in a test, so the index is proved at the schema level, as `DatabaseSchemaTests` already does for the email index, and the translation of the unique violation into the name error is covered by a service unit test that makes `SaveChangesAsync` throw that exception.

## 9. API shape (contracts/categories-api.md)

**Decision**: A new `AdminCategoriesController` at `/api/admin/categories` with `GET` (list, alphabetical by name), `GET /{id}` (one category, used by "Reload" after a conflict), `POST` (create, `201`) and `PUT /{id}` (update, `200`). No `DELETE` (spec FR-023). All responses are `ActivityCategoryResponse` DTOs mapped by AutoMapper.

**Rationale**: The `/api/admin/` prefix keeps administrator endpoints together for features 014 and 015. The service loads the categories and sorts them in memory by `NormalizedName` with `StringComparer.Ordinal`, so letter case does not change the order and the order is the same on every PostgreSQL server: sorting in the query would follow the database's collation, which differs between the test container and a local server (for example for `-` and `_`) and would make the order tests depend on the machine. The list stays well under 100 rows, so sorting in memory costs nothing noticeable. Letters outside A to Z (for example "Ž") sort after "Z", which is acceptable for an administrator list. The list returns every field because the edit form opens from the list without a second request; the list stays small (spec assumption, well under 100 categories).

## 10. Frontend structure

**Decision**:
- The route `/admin/categories` is wrapped in the existing `SignedInOnly` (visitor → Log in with "Log in to continue." and return), then in a new `AdministratorOnly` guard: a Suspended user is sent to `/account-suspended`; a signed-in Active user who is not an Administrator sees the new `AccessDeniedPage` at the same address; an Active Administrator sees the page.
- Shared state lives in two Zustand stores, as `AGENTS.md` requires: `useActivityCategoriesStore` (the list: `loading | loaded | error`, `load()`, `reload()`, 10-second timeout) and `useCategoryFormStore` (one save: `idle | pending | invalid | conflict | serverError`, field errors, last request, `submit`, `retry`, `reloadCategory`, `reset`, 10-second timeout, synchronous double-submit guard) following `useLoginStore`.
- Which form is open (none, create, or the id being edited) and the typed values are component state of the page and form, as in features 001 and 002.
- After a successful save the page navigates to its own path with the router state `{ successMessage: "Category saved." }`, so the existing `SuccessBanner` shows "✓ Success: Category saved." until dismissed (spec FR-012).
- When a save gets `401`, the form store calls `useCurrentUserStore.getState().markSessionEnded()`; `SignedInOnly` then sends the administrator to Log in with "Your session has expired. Log in again." and back afterwards (spec Edge Cases). When it gets `403`, the store calls `refresh()` on the current-user store, so the guard shows Access Denied or Account Suspended for the new role or status.
- `404` on update (the category no longer exists) shows the server error message and reloads the list (spec Edge Cases).

**Rationale**: Reuses the guard, banner, error summary, text field and store patterns from features 001 and 002; no new package.

**Alternatives considered**: a route per category (`/admin/categories/:id`): rejected, the UX design has the list and form on one page (Screen 9 and section 8).

## 11. Logging (spec FR-022, clarification Q2)

**Decision**: No new log entries. A technical failure while saving is an unhandled exception, which the existing `ApiExceptionHandler` logs (exception type only) and answers with `500`. Successful creates and changes are not logged.

## 12. Dependencies

**Decision**: No new NuGet or npm package. Npgsql already provides `xmin` concurrency, arrays and `PostgresErrorCodes`; the frontend uses React Router, Zustand and the existing components.
