# Research: 014-admin-accounts

**Date**: 2026-11-25 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Each section records a decision, why it was chosen and the alternatives considered. The Technical Context of the plan had no open "NEEDS CLARIFICATION" items; these are the design questions found while reading the spec against the existing code.

## 1. Dependencies

- **Decision**: No new NuGet or npm package.
- **Rationale**: Listing, searching and changing a column use EF Core, ASP.NET Core Identity and AutoMapper, which the project already uses. The page uses React, React Router and Zustand, and the existing `ConfirmDialog` (feature 011).
- **Alternatives considered**: A data grid or table package for the list. Rejected: the list is at most 50 rows with no sorting or paging (spec FR-001), and the existing `saved-plans` table and card styles already do the desktop and 320 px layouts.

## 2. Endpoint shape

- **Decision**: Two endpoints on a new `AdminAccountsController` under `/api/admin/accounts`, next to `/api/admin/categories`:
  - `GET /api/admin/accounts?search=<text>` lists accounts.
  - `PUT /api/admin/accounts/{id}/status` with `{"accountStatus":"Suspended"}` or `{"accountStatus":"Active"}` sets the status.
  
  See [contracts/admin-accounts-api.md](contracts/admin-accounts-api.md).
- **Rationale**:
  - One status endpoint covers suspend and reactivate with one validation, one authorization test set and one log path.
  - `PUT` of the desired status is naturally idempotent, which is what the spec asks for a repeat (FR-008).
  - The search is a query parameter of the list, because it only narrows the same list (FR-002).
- **Alternatives considered**:
  - `POST …/suspension` and `DELETE …/suspension`: two endpoints for one column, doubling the tests.
  - `PATCH /api/admin/accounts/{id}` with any field: invites changing the email or role, which is out of scope.

## 3. Changing the status safely

- **Decision**: `AdminAccountService.SetStatusAsync` changes the status with one conditional `ExecuteUpdateAsync`:
  - The condition is `Id == id && Role == "Registered User"`.
  - It sets `AccountStatus` and a new `ConcurrencyStamp`.
  
  If no row was updated, one read decides between "does not exist" (404) and "is an Administrator account" (409). The account is then read once and returned.
- **Rationale**:
  - **Atomic role check**: the role check and the change happen in one statement. An account that became an Administrator after the list was loaded (spec edge case) can never be suspended in a race.
  - **No lost suspensions**: Identity's `UserManager.UpdateAsync` rewrites every column of the row. This happens, for example, when a failed login is counted (`AccessFailedAsync` in `LoginService`). If such an update started before the suspension and finished after it, it would write the old `AccountStatus` back. A new `ConcurrencyStamp` makes that late update fail Identity's concurrency check instead.
  - **Constitution II**: the service uses `ApplicationDbContext` directly.
- **Alternatives considered**:
  - **Loading the user and calling `UserManager.UpdateAsync`**: the read and the write are separate, so the role check races. It would also need a retry loop for concurrency failures.
  - **Changing the `SecurityStamp`, which signs the user out everywhere**: not needed, see section 4. It would also send a suspended user to Log in instead of the Account Suspended page that spec FR-009 and feature 002 describe.

## 4. A suspension takes effect on the next request

- **Decision**: No change to authorization. The existing handlers already decide on the database row, not on the cookie:
  - `ActiveAdministratorHandler`, `ActiveRegisteredUserHandler` and `PlanCreatorHandler` each call `UserManager.GetUserAsync` and require `AccountStatus.Active`.
  - Every controller except `AuthController` (`me`, `login`, `logout`) and `RegistrationController` uses one of these three policies.
  
  New integration tests prove the effect through the new endpoint (spec SC-002):
  - A signed-in user's next `GET /api/plans` gives 403 after the suspension.
  - `GET /api/auth/me` reports `Suspended`.
  - After reactivation, `GET /api/plans` gives 200 with the same plans.
- **Rationale**: Feature 002 research section 1 chose a database read per request exactly so that a status change applies at once. The browser's guards already send a Suspended user to the Account Suspended page when `me` says so, and the stores refresh `me` after a 403.
- **Alternatives considered**: Ending the user's sessions. Rejected as in section 3.

## 5. Email search

- **Decision**: The search text is trimmed and normalized with `UserManager.NormalizeEmail`, which is the same normalizer Identity uses for `NormalizedEmail`. The query filters `NormalizedEmail.Contains(normalized)`.
  - **Empty text**: no filter.
  - **More than 256 characters**: refused with 400 and `errors.search` "Search text can be at most 256 characters.". 256 is the length of Identity's email column.
  - **Validation**: a small `AdminAccountSearch` helper in `Services/`, covered by unit tests.
- **Rationale**:
  - **Letter case**: comparing normalized values ignores letter case without a database collation or `ILIKE` (spec FR-002).
  - **No wildcards**: EF Core translates `string.Contains` with a parameter to `LIKE @normalized_contains`, and builds that parameter itself: it escapes the wildcards in the text and adds the `%` around it. So `%` and `_` are matched literally and the service needs no escaping of its own. `AdminAccountsListEndpointTests` proves it for `_` and `%` against PostgreSQL. (Corrected during the T047 walkthrough: the plan first said the translation was `strpos`; the API log showed `LIKE`, and the behaviour is the same.)
- **Alternatives considered**:
  - `EF.Functions.ILike`: needs wildcard escaping and ties the query to PostgreSQL.
  - Searching in the browser over a full list: the browser would receive every account's email, which spec FR-001 limits to 50.

## 6. Order and the 50-account limit

- **Decision**: Order by `RegistrationDate` descending, then `Id`, and take 51 rows. The answer returns at most 50 and `hasMore: true` when the 51st exists (spec FR-001).
- **Rationale**: One query gives the page and the notice. `Id` makes the order stable for accounts registered in the same instant, as tests that create many accounts quickly will do.
- **Alternatives considered**:
  - A separate `COUNT(*)`: a second query for a yes or no.
  - Paging: out of scope (spec Assumptions).
  - An index on `RegistrationDate`: not needed at the expected scale (a few hundred accounts). It can be added later with a migration if the list becomes slow.

## 7. Refusing a change to an Administrator account

- **Decision**: 409 Conflict with a problem body whose `detail` is "Administrator accounts cannot be suspended or reactivated here." (spec FR-007).
- **Rationale**:
  - **Not 403**: the caller is allowed to use the endpoint; the target account is what is refused. The frontend also treats a 403 as "my own session changed" and refreshes the current user (feature 011), which would be wrong here.
  - **Not 400**: the request body is valid.
  - **Conflict fits**: the account's current role conflicts with the change. The page shows the message and loads the list again (spec edge case).
- **Alternatives considered**: 422, which the project does not use elsewhere.

## 8. Repeats and unknown accounts

- **Decision**:
  - Setting the status an account already has answers 200 with the account, and nothing is written or logged (spec FR-008).
  - An unknown id answers 404 with `detail` "This account no longer exists.".
  - The route takes the id as a string of at most 450 characters, which is Identity's key length; a longer id gives 404 without a query.
- **Rationale**:
  - **Repeats**: two administrators acting at once both see success, and only the first change is logged.
  - **Unknown ids**: the message matches the plan wording of feature 011.
  - **String ids**: Identity ids are strings. A `guid` route constraint would answer 404 for a malformed id anyway, but would tie the route to the default id format.
- **Alternatives considered**: 409 for "already suspended". Rejected: the spec treats it as success.

## 9. Logging

- **Decision**: After a change, `AdminAccountService` logs at Information level: "Account {AccountId} suspended by administrator {AdministratorId}." or "Account {AccountId} reactivated by administrator {AdministratorId}." (spec FR-021).
  - It logs no email and no repeat.
  - Technical failures are not caught. They reach `ApiExceptionHandler`, which logs them, as in feature 003.
  - An integration test captures the log through a test logger provider and checks that it contains the two ids and neither email.
- **Rationale**:
  - **Privacy**: ids identify the accounts for an investigation without putting personal data in the log (constitution IV).
  - **Consistency**: `LoginService` already logs account ids the same way.
- **Alternatives considered**: A status history table. Rejected: out of scope (spec Scope Boundaries), and it would need a migration.

## 10. What the list returns

- **Decision**: `AdminAccountResponse(Id, Email, Role, AccountStatus, RegistrationDate)`, mapped member by member in `AdminAccountMappingProfile`. `AccountStatus` is the enum name, as `CurrentUserResponse` does.
  - A unit test serializes a mapped response and checks that the JSON has exactly these five properties (spec FR-011, SC-004).
  - The list query projects only the five columns to an `AdminAccountSummary` record, so the password hash is never even read. `AdminAccountMappingProfile` maps that record to the response in memory. Turning the status enum into its name inside the database query is avoided, and the profile has no map from `ApplicationUser` at all (changed after `/speckit-analyze`, finding U1).
- **Rationale**: An explicit DTO and an exact-property test make it impossible to leak `PasswordHash`, `SecurityStamp`, `ConcurrencyStamp` or the lockout fields by adding a property by mistake.
- **Alternatives considered**: Returning `ApplicationUser` with `[JsonIgnore]` attributes. Rejected: constitution II forbids returning entities.

## 11. Frontend structure

- **Decision**:
  - **Page**: `pages/UserAccountsPage.tsx` at `/admin/users`, inside `AdministratorOnly`, as Activity categories is (spec FR-017).
  - **Navigation**: "Users" after "Categories" in `TopNavigation`, for an Active Administrator only (spec FR-016).
  - **List store** (`stores/useAdminAccountsStore.ts`): the list, the search text, `hasMore`, and the load status (loading, loaded, error).
  - **Status store** (`stores/useAccountStatusStore.ts`): one change at a time with its pending, success and error messages and Retry, modelled on `usePlanActionsStore`.
  - **Components**:
    - `accountList.tsx`: a table on desktop and cards on phones, reusing the `saved-plans` CSS pattern.
    - `accountSearchForm.tsx`: the search field and buttons.
    - `accountStatusButton.tsx`: Suspend with the existing `ConfirmDialog`, or Reactivate.
  - **Focus**: after a change, focus moves to the account's new button. The button is found by the account id through a ref map in `accountList.tsx` (spec FR-006).
- **Rationale**: It follows the existing admin page and the My plans row actions, so the guards, the session-expiry redirect, the dialog's focus trap and the 320 px rules are reused rather than written again.
- **Alternatives considered**: One store for the list and the changes. Rejected: it would pass 200 lines and mix two responsibilities.

## 12. The latest search wins

- **Decision**: `useAdminAccountsStore.load(search)` aborts the previous request's `AbortController` before sending a new one, and ignores an answer whose controller is no longer the current one (spec FR-012).
  - It uses `startTimeout` from `helpers/timedRequest.ts` for the 10-second limit.
  - An aborted request is neither shown nor treated as an error.
- **Rationale**: This is the same pattern as the location search store (feature 004).
- **Alternatives considered**: A request counter only. It would leave old requests running.

## 13. The registration date

- **Decision**: Show the registration date as a date only, for example "Sat 21 Nov 2026", in Lithuanian time (`Europe/Vilnius`). The helper is `formatRegistrationDate` in `helpers/formatSavedAt.ts`, sharing its formatter.
- **Rationale**: Every date and time in the app is shown in Lithuanian time (feature 010 Assumptions). The spec's Assumptions said "in the user's local time"; it was corrected during planning to say "in Lithuanian time, as every date in the app".
- **Alternatives considered**: Date and time. Rejected: the time adds nothing to the decision to suspend.

## 14. Tests against a shared database

- **Decision**: Integration tests use the existing `PostgreSqlApiFactory` collection and `CreateUserAsync` or `CreateSignedInUserAsync`, which give each account a unique `user-<guid>@example.com` email.
  - List tests search for a marker unique to the test. For the 50-account limit, they create 51 accounts with that marker in the email, through a new `CreateUserAsync(email: …)` parameter.
  - Order tests set `RegistrationDate` explicitly.
- **Rationale**: Other test classes leave accounts in the same database, so an unfiltered list cannot be asserted exactly. A unique marker makes each test independent of the others and of the run order (constitution III).
- **Alternatives considered**: A fresh database per test class. Rejected: much slower, and against the existing collection design.
