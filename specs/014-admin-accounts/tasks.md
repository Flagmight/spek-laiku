# Tasks: Administrator Account Access Management

**Input**: Design documents from `specs/014-admin-accounts/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/admin-accounts-api.md ✓, quickstart.md ✓

**Tests**: Required. Constitution III makes automated backend and frontend tests mandatory for every feature, including an authorization test for each protected operation. Each story phase includes its tests.

**Organization**:

- Phase 1 is setup.
- Phase 2 is the shared foundation: the response types, their mapping with the exact-property test, the test factory parameters, the frontend types and the date helper. After it, the app behaves exactly as before.
- Phases 3 to 7 are one phase per user story, in this order:
  - US1 Suspend (P1). It also builds the list endpoint, the page, the route and the navigation item, because suspending needs them.
  - US2 Reactivate (P1).
  - US4 Only active administrators (P1). It is placed after US2 so that its tests run against both changes.
  - US3 Find an account (P2).
  - US5 Keyboard, screen reader and phone (P2).
- Phase 8 is polish.

Each phase ends at a reviewable checkpoint. Stop after each phase for a diff review; commit and push only on request.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on other incomplete tasks in this phase)
- **[Story]**: Which user story this task belongs to ([US1] to [US5])

## Shared test notes

- **Shared database**: integration tests share one `PostgreSqlApiFactory` (collection `PostgreSqlCollection.Name`). Other test classes leave accounts in the same `AspNetUsers` table, so:
  - never assert on the unfiltered list;
  - list tests create their accounts with an email that contains a marker unique to the test, for example `$"list-{Guid.NewGuid():N}"`, and call `GET /api/admin/accounts?search=<marker>` (research section 14).
- **Accounts**: use `factory.CreateUserAsync(status, role: …, email: …, registrationDate: …)` (extended in T005) for target accounts, and `factory.CreateSignedInClientAsync("Administrator")` for the caller.
- **Reading the row back**: open a scope from `factory.Services` and read `ApplicationDbContext.Users.AsNoTracking()` by id.
- **Log capture**: use the existing `CapturingLoggerProvider` in `backend/tests/SpekLaiku.IntegrationTests/`, added through `factory.WithWebHostBuilder` as in `PlanCheckFailureTests.cs`.
- **Frontend helpers**: tests use `routeFetch`, `jsonResponse`, `signedInUser("Administrator")` and `renderApp("/admin/users")` from `frontend/src/tests/renderApp.tsx`.
  - `routeFetch` fails a test on any request without a handler.
  - Shared account fixtures go in `frontend/src/tests/adminAccountsFixtures.ts` (T007).
- **Vitest cold start**: the first `npm test` of a session may fail with "Failed to start forks worker". Re-run it once before investigating.

---

## Phase 1: Setup

**Purpose**: Branch ready, baseline green.

- [x] T001 Confirm that the branch `014-admin-accounts` (already created) is based on the current `origin/main`:
  - Run `git fetch`, then `git log origin/main..HEAD` and `git log HEAD..origin/main`. Both should be empty.
  - Run `git status`. It should show only the untracked `specs/014-admin-accounts/` folder.
  - Result (2026-11-25): both logs empty (the branch is at `99ffcd3`, PR #20); `git status` shows only `specs/014-admin-accounts/`.
- [x] T002 Run the baseline checks one step at a time in the foreground, and confirm that all pass before changing any code. Record the test counts here for comparison in T046.
  - From the repository root: `dotnet build SpekLaiku.slnx`, `dotnet test SpekLaiku.slnx` and `dotnet format SpekLaiku.slnx --verify-no-changes`.
  - From `frontend/`: `npm run lint`, `npm run format:check`, `npm test` and `npm run build`.
  - Expected from feature 012 (2026-11-22, plus later merges): about 812 unit and 443 integration tests; frontend about 91 files and 1320 tests. Record the actual numbers.
  - Result (2026-11-25), each step run on its own in the foreground, all passing:
    - **Backend**: build with 0 warnings and 0 errors; **812 unit** and **443 integration** tests; `dotnet format --verify-no-changes` clean.
    - **Frontend**: lint clean; `format:check` clean; **91 files** and **1320 tests**; build clean.

**Checkpoint**: Branch is current, all checks green.

---

## Phase 2: Foundational (response types, mapping, test helpers, frontend types)

**Purpose**: The pieces both the list and the status change use. No endpoint and no visible change yet.

- [x] T003 [P] Create the response DTOs (data-model.md "API types"):
  - `backend/src/SpekLaiku.Api/DTOs/Responses/AdminAccountResponse.cs`: `public sealed record AdminAccountResponse(string Id, string Email, string Role, string AccountStatus, DateTime RegistrationDate);`. "Exactly these five properties".
  - `backend/src/SpekLaiku.Api/DTOs/Responses/AdminAccountListResponse.cs`: `public sealed record AdminAccountListResponse(IReadOnlyList<AdminAccountResponse> Accounts, bool HasMore);`. `Accounts` holds "at most 50"; `HasMore` "is true when more accounts match than are returned".
  - `backend/src/SpekLaiku.Api/Services/AdminAccountSummary.cs`: `public sealed record AdminAccountSummary(string Id, string Email, string Role, AccountStatus AccountStatus, DateTime RegistrationDate);`. The list query projects each row to it, so only these five columns are read, and `AccountStatus` stays the enum until it is mapped in memory, with no `ToString()` inside the database query (data-model.md "Service results").
- [x] T004 Create `backend/src/SpekLaiku.Api/Mapping/AdminAccountMappingProfile.cs`:
  - Map `AdminAccountSummary` → `AdminAccountResponse` member by member with `ForCtorParam`, as `CurrentUserMappingProfile` does: `Id`, `Email`, `Role`, `AccountStatus.ToString()` (`"Active"` or `"Suspended"`) and `RegistrationDate`. The mapping runs in memory, after the query.
  - Add a comment that only these five members may ever be mapped (spec FR-011). The profile has no map from `ApplicationUser`, so an entity cannot be returned by mistake.
  - Then add `backend/tests/SpekLaiku.UnitTests/AdminAccountMappingTests.cs`:
    - `MapsTheFiveFields`.
    - `MapsSuspendedStatusAsItsName`.
    - `SerializedResponse_HasExactlyTheFiveProperties`: serialize a mapped response with the web defaults (`JsonSerializerDefaults.Web`); assert the property names are exactly `id`, `email`, `role`, `accountStatus` and `registrationDate` (spec SC-004). `AdminAccountsListEndpointTests` (T035) checks the same against a real user whose password hash and stamps are set.
    - The AutoMapper configuration validity test, as the other mapping tests do.
- [x] T005 [P] Extend `CreateUserAsync` in `backend/tests/SpekLaiku.IntegrationTests/PostgreSqlApiFactory.cs`:
  - Add optional `string? email = null` and `DateTime? registrationDate = null` parameters, after the existing ones, so current callers are unchanged.
  - A null email keeps `user-<guid>@example.com`. A null date keeps `DateTime.UtcNow`. A given date must be UTC.
  - Update its XML comment (research section 14).
- [x] T006 [P] Create `frontend/src/types/adminAccount.ts` (data-model.md "Frontend types and state"):
  - `AdminAccount { id: string; email: string; role: "Registered User" | "Administrator"; accountStatus: "Active" | "Suspended"; registrationDate: string }`
  - `AdminAccountList { accounts: AdminAccount[]; hasMore: boolean }`
  - `AccountStatus = AdminAccount["accountStatus"]`
- [x] T007 [P] Create `frontend/src/tests/adminAccountsFixtures.ts`:
  - **Accounts**:
    - `activeUser`: "ana@example.com", Active Registered User.
    - `suspendedUser`: "bob@example.com", Suspended Registered User.
    - `administrator`: "admin@example.com", Active Administrator.
    - `suspendedAdministrator`: "old-admin@example.com".
  - **Helpers**:
    - `accountList(accounts, hasMore = false)`.
    - `withStatus(account, status)`.
  - Dates in November 2026, UTC.
- [x] T008 [P] Add `formatRegistrationDate(iso: string): string` to `frontend/src/helpers/formatSavedAt.ts`, sharing its Lithuanian-time formatter:
  - A date only, for example "Sat 21 Nov 2026" (research section 13).
  - Test it in the existing `frontend/src/tests/formatSavedAt.test.ts`. Include an instant that is 23:30 UTC, which is already the next day in Vilnius.

**Checkpoint**: The mapping test proves no secret field can be returned. All tests green, no visible change.

---

## Phase 3: User Story 1 - Suspend a Registered User account (Priority: P1) 🎯 MVP

**Goal**: An Active Administrator opens the User accounts page, selects Suspend on an Active Registered User, confirms, and sees the status change. The suspended user's next request is refused.

**Independent Test**: The spec's User Story 1 independent test passes in `AccountSuspensionEffectTests` and `UserAccountsPage.test.tsx`.

### Backend for User Story 1

- [x] T009 [P] [US1] Create `backend/src/SpekLaiku.Api/DTOs/Requests/AccountStatusRequest.cs`: `public sealed record AccountStatusRequest(string? AccountStatus);`. It is nullable, so a missing value reaches the validation in T012 instead of the generic model error, as `RegistrationRequest` does.
- [x] T010 [P] [US1] Create the service results in `backend/src/SpekLaiku.Api/Services/`:
  - `AdminAccountListing.cs`: `public sealed record AdminAccountListing(IReadOnlyList<AdminAccountSummary> Accounts, bool HasMore);`.
  - `AccountStatusChange.cs`: a result record with the four outcomes of data-model.md: `Changed(account)`, `Unchanged(account)`, `NotFound`, `AdministratorAccount`, where `account` is an `AdminAccountSummary`. Static factory methods and an `Account` property, in the style of `SavedPlanChange`.
  - Add `AdminAccountListing` → `AdminAccountListResponse` to `backend/src/SpekLaiku.Api/Mapping/AdminAccountMappingProfile.cs`, using the summary map of T004 for `Accounts`, and a `MapsTheListingWithHasMore` case to `AdminAccountMappingTests.cs`.
- [x] T011 [US1] Create `backend/src/SpekLaiku.Api/Services/AdminAccountService.cs` (`ApplicationDbContext`, `UserManager<ApplicationUser>` for `NormalizeEmail` only, `IMapper`, `ILogger<AdminAccountService>`). About 110 lines; must stay under 200.
  - **`ListAsync(string search, CancellationToken)`**:
    - Filter: when `search` is not empty, keep `NormalizedEmail` containing `userManager.NormalizeEmail(search)`. US1 always passes `""`; US3 adds the search tests.
    - Order: `RegistrationDate` descending, then `Id`.
    - `Take(51)`, with `.Select(user => new AdminAccountSummary(user.Id, user.Email ?? string.Empty, user.Role, user.AccountStatus, user.RegistrationDate))`, so only these five columns are read and the password hash never is (research section 10).
    - Return at most 50 and `HasMore = count > 50`. Add the constant `PageSize = 50`.
  - **`SetStatusAsync(string administratorId, string accountId, AccountStatus status, CancellationToken)`** (research section 3):
    1. An `accountId` longer than 450 characters returns `NotFound` without a query.
    2. `await context.Users.Where(user => user.Id == accountId && user.Role == PlanCreatorHandler.RegisteredUserRole && user.AccountStatus != status).ExecuteUpdateAsync(setters => setters.SetProperty(user => user.AccountStatus, status).SetProperty(user => user.ConcurrencyStamp, Guid.NewGuid().ToString()), cancellationToken)`.
    3. Read the account (`AsNoTracking`, by id), projected to `AdminAccountSummary` with the same `Select` as `ListAsync`, shared through one private expression. If it is missing, return `NotFound`. If its role is not Registered User, return `AdministratorAccount`.
    4. If step 2 updated 1 row: log at Information "Account {AccountId} suspended by administrator {AdministratorId}." or "Account {AccountId} reactivated by administrator {AdministratorId}." and return `Changed(account)`. Otherwise return `Unchanged(account)`, with no log entry.
    - Never log an email (spec FR-021).
    - Technical failures are not caught (`ApiExceptionHandler`, as in `ActivityCategoryService`).
    - Add an XML comment that names research section 3: the atomic role check, and why the concurrency stamp changes.
- [x] T012 [US1] Create `backend/src/SpekLaiku.Api/Controllers/AdminAccountsController.cs`:
  - Route `api/admin/accounts`, `[Authorize(Policy = AuthorizationPolicies.ActiveAdministrator)]`, and the same `ProducesResponseType` attributes as `AdminCategoriesController`. Keep it thin.
  - **`GET`** `List([FromQuery] string? search, CancellationToken)`: in this phase it passes `""`, and T034 adds the validation. It answers 200 `AdminAccountListResponse`.
  - **`PUT {id}/status`** `SetStatus(string id, AccountStatusRequest request, CancellationToken)`:
    - Parse `request.AccountStatus` exactly as `"Active"` or `"Suspended"` (ordinal, no numbers, `Enum.TryParse` is not enough because it accepts `"1"`). Otherwise answer 400 `ValidationProblemDetails` with `errors.accountStatus` "Select Active or Suspended.".
    - Call the service with `userManager.GetUserId(User)!`.
    - Map the result: `Changed` and `Unchanged` → 200 with the account mapped from its `AdminAccountSummary`; `NotFound` → 404, title "Not found.", detail "This account no longer exists."; `AdministratorAccount` → 409, title "Administrator account.", detail "Administrator accounts cannot be suspended or reactivated here." (contracts/admin-accounts-api.md).
  - Register `AdminAccountService` as scoped in `backend/src/SpekLaiku.Api/Program.cs`, next to `ActivityCategoryService`.
- [x] T013 [US1] Create `backend/tests/SpekLaiku.IntegrationTests/AdminAccountStatusEndpointTests.cs` for suspending:
  - `Suspend_Answers200WithTheSuspendedAccount`: the contract body; the row's `AccountStatus` is `Suspended`.
  - `Suspend_ChangesTheConcurrencyStamp`.
  - `Suspend_KeepsEmailRoleRegistrationDateAndPasswordHash`.
  - `SuspendTwice_SecondAnswers200WithNoChange`: the concurrency stamp after the second call equals the one after the first.
  - `UnknownId_Gets404WithTheMessage`, and a 451-character id gives 404.
  - `MissingOrInvalidStatus_Gets400`: a missing value, `""`, `"suspended"`, `"1"` and `"Deleted"` each give `errors.accountStatus` "Select Active or Suspended.", and the row is unchanged.
  - `StaleIdentityUpdate_DoesNotUndoTheSuspension`: load the user through `UserManager` in a scope, suspend it through the endpoint, then call `userManager.UpdateAsync` with the stale object. The result fails with `ConcurrencyFailure`, and the row is still `Suspended` (research section 3).
- [x] T014 [US1] Create `backend/tests/SpekLaiku.IntegrationTests/AccountSuspensionEffectTests.cs`, part 1:
  - `SuspendedUser_IsRefusedOnTheNextRequest`: a signed-in Registered User (`CreateSignedInUserAsync`) gets 200 from `GET /api/plans`. After an administrator suspends them through `PUT /api/admin/accounts/{id}/status`, the same client gets 403 from `GET /api/plans` and from `POST /api/plan-setup/check`, and `GET /api/auth/me` returns `"accountStatus": "Suspended"`. The client never logged out (spec SC-002).
  - `SuspendedUser_CanStillLogOut`: after the suspension, `POST /api/auth/logout` gives 204 for the same client, and its next `GET /api/auth/me` gives 401 (spec FR-009: Log out stays available).
- [x] T015 [US1] Create `backend/tests/SpekLaiku.IntegrationTests/AdminAccountLogTests.cs`:
  - `Suspension_LogsBothIdsAndNoEmail`: exactly one entry containing "suspended by administrator", the target's id and the administrator's id, and neither email.
  - `RepeatedSuspension_WritesNoEntry`.
  
  Use `CapturingLoggerProvider` through `WithWebHostBuilder` (shared test notes).
  
  The other half of spec FR-021, logging a technical failure, is covered by the existing `ApiExceptionHandler` and its unit tests (`ApiExceptionHandlerTests`), because `SetStatusAsync` catches no exception. T044 checks that this stays true.

### Frontend for User Story 1

- [x] T016 [P] [US1] Create `frontend/src/api/adminAccountsApi.ts`, using `apiFetch` and `ApiError` as `activityCategoriesApi.ts` does:
  - **`listAccounts(search: string, signal?)`**: returns `{ kind: "loaded"; list: AdminAccountList }` or `{ kind: "invalidSearch"; message: string }` (400 `errors.search[0]`).
    - It sends `?search=` URL-encoded, only when the search is not empty.
    - 401, 403 and any other status throw `ApiError`.
  - **`setAccountStatus(id: string, accountStatus: AccountStatus, signal?)`**:
    - `PUT /api/admin/accounts/${encodeURIComponent(id)}/status` with the JSON body.
    - Returns `{ kind: "changed"; account }`, `{ kind: "gone" }` (404), `{ kind: "administrator" }` (409), `{ kind: "sessionEnded" }` (401) or `{ kind: "forbidden" }` (403). Any other status throws `ApiError`.
  - Test both in `frontend/src/tests/adminAccountsApi.test.ts`: every status above, the URL encoding of a search with `&` and of an id, and that an empty search sends no query string.
- [x] T017 [US1] Create `frontend/src/stores/useAdminAccountsStore.ts`:
  - **State**: `status` (`"idle" | "loading" | "loaded" | "error"`), `accounts`, `hasMore`, `search`, `searchError`.
  - **`load(search = "")`**:
    - It sets `loading`, aborts the previous request's `AbortController` and starts `startTimeout` from `helpers/timedRequest.ts`.
    - It ignores an answer whose controller is not the current one.
    - A timeout or network error sets `error`, and an abort by a newer request sets nothing.
    - An `ApiError` 401 or 403 refreshes the current user (`useCurrentUserStore.getState().refresh()`) and leaves the status as it was.
  - **`replace(account)`**: replaces the row with the same id.
  - **`reset()`**: aborts and clears.
  - Export `loadingAccountsMessage = "Loading accounts…"` and `accountsLoadFailedMessage = "Error: Accounts could not be loaded."`.
  - Test in `frontend/src/tests/useAdminAccountsStore.test.ts`:
    - loading then loaded;
    - error, and Retry by calling `load` again;
    - a 10-second timeout with fake timers;
    - 401 and 403 refresh the current user;
    - `replace`;
    - `reset` drops a late answer.
- [x] T018 [US1] Create `frontend/src/stores/useAccountStatusStore.ts`, modelled on `usePlanActionsStore.ts`:
  - **State**: `pending` (`{ accountId, change: "suspend" | "reactivate" } | null`), `message`, `failed`.
  - **`change(account, target)`**:
    - Ignored while `pending` is set.
    - Sends `setAccountStatus` with the 10-second timeout.
    - **Success**: calls `useAdminAccountsStore.getState().replace(account)` and sets the success message.
    - **`gone`**: "Error: This account no longer exists.", then reloads the list.
    - **`administrator`**: "Error: Administrator accounts cannot be suspended or reactivated here.", then reloads the list.
    - **`sessionEnded` or `forbidden`**: refreshes the current user.
    - **Any other failure, timeout or network error**: the change's error message, with `failed` set for Retry.
    - It returns the result, so the page can move focus.
  - **`retry()`** and **`clear()`**.
  - Export the messages:
    - `accountSuspendedMessage = "✓ Success: Account suspended."`
    - `accountReactivatedMessage = "✓ Success: Account reactivated."`
    - `suspendingMessage = "Suspending account…"`
    - `reactivatingMessage = "Reactivating account…"`
    - `suspendFailedMessage = "Error: Account could not be suspended. Try again."`
    - `reactivateFailedMessage = "Error: Account could not be reactivated. Try again."`
    - `accountGoneMessage = "Error: This account no longer exists."`
    - `administratorAccountMessage = "Error: Administrator accounts cannot be suspended or reactivated here."`
  - Test the suspend paths in `frontend/src/tests/useAccountStatusStore.test.ts`:
    - pending blocks a second change;
    - success replaces the row;
    - 404 and 409 show their message and reload;
    - 500, timeout and Retry;
    - 401 and 403 refresh the current user.
- [x] T019 [P] [US1] Create `frontend/src/components/accountStatusButton.tsx`:
  - **No button** for an Administrator account (spec FR-003).
  - **Active Registered User**: "Suspend" with `aria-label` "Suspend <email>". It opens `ConfirmDialog` with the question "Suspend <email>? They will lose access until reactivated.", confirm label "Suspend" and cancel label "Cancel".
    - Confirm calls `onChange(account, "Suspended")`.
    - Cancel and Escape close it and return focus to the button (spec FR-004, FR-018).
  - **Suspended Registered User**: a disabled placeholder for now; US2 adds Reactivate.
  - Props: `account`, `disabled`, `onChange`, and a `buttonRef` callback so the list can focus it.
- [x] T020 [US1] Create `frontend/src/components/accountList.tsx`:
  - **Table**: `className="accounts"`, with a visually hidden caption "User accounts" and the columns Email, Role, Status, Registered and a hidden "Actions".
  - **Cells**: the status as the word "Active" or "Suspended", and the date through `formatRegistrationDate`. Cells carry `cell-label` spans for the cards, as `savedPlanList.tsx` does.
  - **Focus**: keeps a `Map<id, HTMLButtonElement>` of the buttons and exposes `focusAccount(id)` through a ref or an `onReady` callback, so the page can move focus after a change (spec FR-006).
- [x] T021 [US1] Create `frontend/src/pages/UserAccountsPage.tsx`:
  - **Page**: `usePageTitle("User accounts")`, one `h1` "User accounts", and a status region (`role="status"`, `aria-live="polite"`) for the store messages. "Error:" messages go in an alert region, with Retry when `failed` is set.
  - **States**: loading shows `loadingAccountsMessage`; a load error shows `accountsLoadFailedMessage` with a Retry button.
  - **List**: `AccountList` with `disabled` while any change is pending.
  - **After a successful change**: focus the account's new button.
  - **Lifecycle**: calls `load("")` on mount, and `reset()` on both stores on unmount.
  - Keep it under about 150 lines.
- [x] T022 [US1] Wire the page:
  - In `frontend/src/components/appRoutes.tsx`, add `path="admin/users"` with `<AdministratorOnly><UserAccountsPage /></AdministratorOnly>`, as `admin/categories` is.
  - In `frontend/src/components/topNavigation.tsx`, add `<li><NavLink to="/admin/users">Users</NavLink></li>` right after Categories, inside the same `showAdministratorLinks` condition. Update the component's comment to name feature 014 (spec FR-016).
  - In `frontend/src/stores/useLogoutStore.ts`, reset `useAdminAccountsStore` and `useAccountStatusStore` with the other stores. Add a case to `frontend/src/tests/useLogoutStore.test.tsx`: after a successful logout, both stores are back to their initial state, and a late list answer is dropped.
- [x] T023 [US1] Add the base styles to `frontend/src/styles.css`: the `accounts` table, with the same wide-screen layout and phone card rules as `.saved-plans`, and the action button in the last column. US5 verifies 320 px.
- [x] T024 [US1] Create `frontend/src/tests/UserAccountsPage.test.tsx`, part 1:
  - The heading and tab title "User accounts - Spėk laiku".
  - The columns, the status words and the formatted date.
  - "Suspend" only on the Active Registered User, and no button on either Administrator account.
  - The accessible name "Suspend ana@example.com".
  - The dialog text; Cancel and Escape send no request and return focus to Suspend.
  - Confirming sends one `PUT` with `{"accountStatus":"Suspended"}`, announces "✓ Success: Account suspended.", shows "Suspended", and moves focus to the account's button.
  - "Suspending account…" with every button disabled while pending.
  - The 500 error with Retry, which sends the same request again.
  - 404 and 409 show their messages and reload the list.
  - A 403 on the status change refreshes `GET /api/auth/me`. When that answers `"accountStatus": "Suspended"`, the Account Suspended page is shown (spec edge case: the administrator is suspended while the page is open).
  - Loading, and the load error with Retry.
- Result of Phase 3 (2026-11-25):
  - **Checks**: backend build with 0 warnings; 817 unit (T002: 812, +5) and 459 integration tests (T002: 443, +16), all passing; `dotnet format` clean. Frontend lint and Prettier clean; the new and changed test files pass (14 page tests, 25 API and store tests, the logout case).
  - **Mutation check of T013**: with the `ConcurrencyStamp` update removed from `SetStatusAsync`, `StaleIdentityUpdate_DoesNotUndoTheSuspension` and `Suspend_ChangesTheConcurrencyStamp` both failed; with it restored, both pass.
  - **Differences from the task text**:
    - T017: a list answer of 401 or 403 refreshes the current user **and** shows the load error with Retry, instead of leaving the status as it was, so the page is never left on "Loading accounts…" if the refresh does not redirect.
    - T022: the "late list answer is dropped" part of the logout case is covered by `useAdminAccountsStore.test.ts` ("drops a late answer after reset"); the logout case checks both stores are back to their initial state.
    - T023: the table has both classes `saved-plans accounts`, so it reuses the saved plans table and card rules instead of copying them; `.accounts` adds only the full-width button on phones and the inline button on wider screens.
    - Added `backend/tests/SpekLaiku.IntegrationTests/AdminAccountRequests.cs`, the request and stored-row helpers shared by the account tests, and the two new stores to the reset list in `frontend/src/tests/setup.ts`. Neither is in plan.md "Source Code"; both are test support.
  - **Existing tests changed** (allowed by T046, because "Users" is added on purpose): `topNavigation.test.tsx` "shows Home, Categories and Log out to an Active Administrator" now expects "Users" between Categories and Log out (renamed accordingly, with its link checked); `keyboard.test.tsx` "reaches the skip link, the navigation, Create category and each Edit button in that order" gains the Users link in the Tab order, and "creates a category using only the keyboard" tabs six times instead of five to reach Create category. No assertion was removed or weakened.

**Checkpoint**: An administrator can suspend an account on the page, and the suspended user is blocked on the next request. MVP reached.

---

## Phase 4: User Story 2 - Reactivate a suspended account (Priority: P1)

**Goal**: An Active Administrator reactivates a suspended Registered User without a confirmation, and the user has the same access and saved plans as before.

**Independent Test**: The spec's User Story 2 independent test passes in `AccountSuspensionEffectTests` and `UserAccountsPage.test.tsx`.

- [ ] T025 [US2] Replace the placeholder in `frontend/src/components/accountStatusButton.tsx` with "Reactivate" (`aria-label` "Reactivate <email>"). It calls `onChange(account, "Active")` at once, with no dialog (spec FR-005).
- [ ] T026 [US2] Add the reactivate paths to `frontend/src/tests/useAccountStatusStore.test.ts`: the success message "✓ Success: Account reactivated.", the pending message "Reactivating account…", and the error "Error: Account could not be reactivated. Try again." with Retry.
- [ ] T027 [US2] Add to `backend/tests/SpekLaiku.IntegrationTests/AdminAccountStatusEndpointTests.cs`:
  - `Reactivate_Answers200WithTheActiveAccount`.
  - `ReactivateAnActiveAccount_Answers200WithNoChange`.
- [ ] T028 [US2] Add `ReactivatedUser_HasTheSameAccessAndPlans` to `backend/tests/SpekLaiku.IntegrationTests/AccountSuspensionEffectTests.cs`:
  - The user saves two plans first. Insert them with `SavedPlanSeed`, as the feature 012 tests do.
  - Suspend, then reactivate through the endpoint.
  - The same client then gets 200 from `GET /api/plans` with the same ids, names and `savedAt`, and each plan's stored snapshot is unchanged (spec SC-005).
- [ ] T029 [US2] Add `Reactivation_LogsBothIdsAndNoEmail` to `backend/tests/SpekLaiku.IntegrationTests/AdminAccountLogTests.cs`.
- [ ] T030 [US2] Add to `frontend/src/tests/UserAccountsPage.test.tsx`:
  - "Reactivate bob@example.com" sends one `PUT` with `{"accountStatus":"Active"}` without a dialog, announces "✓ Success: Account reactivated.", shows "Active", and moves focus to "Suspend bob@example.com".
  - "Reactivating account…" while pending.
  - The error with Retry.

**Checkpoint**: Suspend and reactivate both work, and plans survive both.

---

## Phase 5: User Story 4 - Only active administrators can manage accounts (Priority: P1)

**Goal**: Only a signed-in Active Administrator can list or change accounts, Administrator accounts can never be changed here, and no answer contains a sign-in secret.

**Independent Test**: The spec's User Story 4 independent test passes in `AdminAccountsAuthorizationTests` and `AdminAccountStatusEndpointTests`.

- [ ] T031 [US4] Create `backend/tests/SpekLaiku.IntegrationTests/AdminAccountsAuthorizationTests.cs`, in the style of `AdminCategoriesAuthorizationTests.cs`. Endpoints: `"GET list"`, `"GET search"` (`?search=x`) and `"PUT status"`.
  - `Visitor_Gets401WithEmptyBody` (theory over the endpoints).
  - `OtherSignedInUser_Gets403WithoutAccountData`: a theory over Active Registered User, Suspended Registered User and Suspended Administrator. The body contains no target email and no `accounts` property.
  - `RefusedPut_LeavesTheTargetUnchanged`, for every caller above: the target's status and concurrency stamp are unchanged.
  - `ActiveAdministrator_Gets200` for both endpoints.
  
  This covers constitution III (an authorization test for each protected operation).
- [ ] T032 [US4] Add the Administrator-target tests to `backend/tests/SpekLaiku.IntegrationTests/AdminAccountStatusEndpointTests.cs` (spec FR-007, User Story 4 scenario 8):
  - `ActiveAdministratorTarget_Gets409Unchanged` and `SuspendedAdministratorTarget_Gets409Unchanged` (reactivate), each with the detail "Administrator accounts cannot be suspended or reactivated here.".
  - `OwnAccount_Gets409Unchanged`: the caller suspends themselves; afterwards the same client still gets 200 from `GET /api/admin/accounts`.
- [ ] T033 [US4] Add to the frontend tests:
  - In `frontend/src/tests/topNavigation.test.tsx`: "Users" comes right after "Categories" for an Active Administrator, and is absent for a visitor, an Active Registered User, a Suspended Registered User and a Suspended Administrator.
  - In `frontend/src/tests/administratorOnly.test.tsx`: `/admin/users` for a visitor goes to Log in with "Log in to continue." and back after logging in as an Active Administrator; for an Active Registered User it shows Access denied and sends no accounts request; for a Suspended user it shows the Account Suspended page (spec FR-017).

**Checkpoint**: The access rules are verified for both endpoints and the page.

---

## Phase 6: User Story 3 - Find an account (Priority: P2)

**Goal**: The administrator finds an account by part of its email. The 50-account limit is explained.

**Independent Test**: The spec's User Story 3 independent test passes in `AdminAccountsListEndpointTests` and `UserAccountsPage.test.tsx`.

- [ ] T034 [US3] Create `backend/src/SpekLaiku.Api/Services/AdminAccountSearch.cs` (static), with `Validate(string? search)`:
  - It returns the trimmed text, empty for null or only spaces, or the error "Search text can be at most 256 characters." when the trimmed text is longer than 256 characters (spec FR-002).
  - Use it in `AdminAccountsController.List`: an error answers 400 `ValidationProblemDetails` with `errors.search`; otherwise it passes the text to `ListAsync`.
  - Test it in `backend/tests/SpekLaiku.UnitTests/AdminAccountSearchTests.cs`: null, `""` and `"   "` give `""`; `"  ana  "` gives `"ana"`; exactly 256 characters is accepted; 257 is refused with the message; 256 characters plus spaces around them is accepted.
- [ ] T035 [US3] Create `backend/tests/SpekLaiku.IntegrationTests/AdminAccountsListEndpointTests.cs` (shared test notes, unique markers):
  - `Search_MatchesAnyPartOfTheEmailIgnoringCase`: a search for the upper-case marker finds the lower-case emails.
  - `Search_TrimsSpaces`.
  - `Search_MatchesUnderscoreAndPercentLiterally`: an email containing `_` is found by `_`, and a search for `%` finds only emails containing `%`, not every account (research section 5).
  - `List_IsNewestRegistrationFirst`: three accounts with explicit `registrationDate` values.
  - `FiftyOneMatches_Return50WithHasMore` and `ExactlyFiftyMatches_ReturnHasMoreFalse`: these return the 50 newest.
  - `NoMatch_ReturnsEmptyList`.
  - `TooLongSearch_Gets400`: 257 characters give `errors.search` "Search text can be at most 256 characters.".
  - `List_ReturnsOnlyTheFiveFields`: each account object has exactly the five properties, and the raw body contains neither the account's password hash nor its security stamp, read from the database (spec SC-004).
  - `AdministratorAccounts_AreListedWithTheirRole`: an Active and a Suspended Administrator account with the marker are in the list with `role` "Administrator" and their status (spec FR-003).
- [ ] T036 [P] [US3] Create `frontend/src/components/accountSearchForm.tsx`:
  - A form with a visible label "Search by email" and a "Search" submit button, so Enter also searches.
  - The input is `type="search"`, full width on phones, with 16 px text.
  - A "Clear search" button when a search is shown.
  - The error, prefixed with "Error:", next to the field and linked by `aria-describedby`, with `aria-invalid` set.
  - It calls `onSearch(text)` and `onClear()`.
- [ ] T037 [US3] Extend `frontend/src/stores/useAdminAccountsStore.ts`:
  - `load(search)` trims the text.
  - An answer of `invalidSearch` sets `searchError` to "Error: Search text can be at most 256 characters." and keeps the shown list.
  - `search` holds the text of the shown result.
  - Add to `frontend/src/tests/useAdminAccountsStore.test.ts`: the latest search wins (a slow first answer after a fast second is ignored, and the first request's signal is aborted); `invalidSearch` sets the error; a successful search clears it.
- [ ] T038 [US3] Extend `frontend/src/pages/UserAccountsPage.tsx`:
  - `AccountSearchForm` above the list.
  - When `hasMore` is set: "Showing the 50 most recently registered accounts. Search by email to find others.".
  - When a search has no match: "No accounts match your search." with "Clear search".
  - "Clear search" empties the field and calls `load("")`.
  - After a reload triggered by a 404 or 409, keep the current search.
- [ ] T039 [US3] Add to `frontend/src/tests/UserAccountsPage.test.tsx`:
  - Enter in the field sends `?search=ana`.
  - The list shows only the answer.
  - No match shows the message and "Clear search", which reloads the full list.
  - The `hasMore` notice.
  - The 256-character error next to the field, with the list kept.
  - "Loading accounts…" during a search.

**Checkpoint**: Search, the empty state and the limit notice work.

---

## Phase 7: User Story 5 - Manage accounts with keyboard, screen reader and on a phone (Priority: P2)

**Goal**: The page works with the keyboard and a screen reader, and on a 320 px screen.

**Independent Test**: The spec's User Story 5 independent test passes in the accessibility, keyboard and responsive tests.

- [ ] T040 [P] [US5] Add the User accounts page to `frontend/src/tests/accessibility.test.tsx`:
  - one `h1`;
  - the skip link is the first focusable item;
  - every button has a name that includes the email;
  - the search field has its label;
  - the status and alert regions exist;
  - an error is linked to the field.
- [ ] T041 [P] [US5] Add to `frontend/src/tests/keyboard.test.tsx`:
  - Tab order: skip link, navigation, search field, Search, then each account's button in list order.
  - The suspend dialog keeps Tab and Shift+Tab inside, Escape closes it, and focus returns to the button.
  - Enter on "Reactivate …" reactivates.
- [ ] T042 [US5] Add to `frontend/src/tests/responsive.test.tsx`, using the same style checks as the existing My plans rules:
  - At 320 px the accounts render as cards with labelled values.
  - The status is a word.
  - Buttons and the search field are full width, buttons are at least 44 × 44 px, and input text is at least 16 px.
  - Nothing is wider than the viewport.
  
  Adjust the `accounts` rules in `frontend/src/styles.css` if a check fails (spec FR-020).

**Checkpoint**: All stories done.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, full verification, review. No new behaviour.

- [ ] T043 [P] Update the documentation:
  - **`README.md`**:
    - **New "User accounts" section**, after "Activity categories". It says:
      - an Active Administrator selects **Users** to list accounts (newest first, at most 50, with a search by email);
      - **Suspend** (after a confirmation) and **Reactivate** apply to Registered User accounts only, and a suspension takes effect on the user's next request;
      - saved plans are kept;
      - each change is logged with the two account ids and no email;
      - Administrator accounts are still managed in the database.
    - **"Testing an Administrator or Suspended account"**: say that Registered User accounts can now be suspended and reactivated on the User accounts page, and keep the SQL for promoting an Administrator and for Administrator accounts.
    - Say that feature 014 adds no migration.
  - **`docs/ux-design.md`**:
    - The Admin: User Accounts row in section 3: deletion comes after the MVP.
    - The state table in section 6: add Loading ("Loading accounts…"), Server error ("Error: Accounts could not be loaded." with Retry), Pending ("Suspending account…" / "Reactivating account…"), Success ("✓ Success: Account suspended." / "✓ Success: Account reactivated.") and "Administrator account" ("Error: Administrator accounts cannot be suspended or reactivated here.").
    
    Change nothing else.
  - **`docs/architecture.md`**: check for statements that now contradict the implementation, and correct only what is wrong.
- [ ] T044 Review `git diff main...HEAD` and confirm:
  - only the files in plan.md "Source Code", plus the README, docs and spec files, changed;
  - there is no debug code, commented-out code or temporary file;
  - every new C# class is under 200 lines (`AdminAccountService`, `AdminAccountsController`), and `UserAccountsPage.tsx`, `accountList.tsx`, `useAdminAccountsStore.ts` and `useAccountStatusStore.ts` are each under about 200 lines;
  - nothing under `Migrations/` changed, and no package was added;
  - no email is passed to a logger anywhere in the new code;
  - `AdminAccountService` and `AdminAccountsController` catch no exception, so a technical failure reaches `ApiExceptionHandler` and is logged there (spec FR-021).
  
  Record the result here.
- [ ] T045 Run a separate AI-assisted review of the branch: `/code-review`, and `/security-review`, because this feature adds change operations behind access control on user accounts. Record:
  - the tool;
  - the important findings;
  - the changes made;
  - the findings not applied, each with a short reason.
  
  These go in the Pull Request description (constitution VII). Apply the accepted fixes, then run T046.
- [ ] T046 Run all checks one step at a time in the foreground, and confirm they pass:
  - from the repository root: `dotnet build SpekLaiku.slnx`, `dotnet test SpekLaiku.slnx` and `dotnet format SpekLaiku.slnx --verify-no-changes`;
  - from `frontend/`: `npm run lint`, `npm run format:check`, `npm test` and `npm run build`.
  
  Compare the test counts with T002. The only existing tests allowed to change are:
  - `topNavigation.test.tsx` and `administratorOnly.test.tsx`: assertions added for "Users" (T033);
  - the accessibility, keyboard and responsive tests: cases added (T040 to T042);
  - `useLogoutStore.test.tsx`: the two stores are reset.
  
  No existing assertion may be removed or weakened. Record the results here.
- [ ] T047 Walk through `specs/014-admin-accounts/quickstart.md` Part 2, scenarios 1 to 7, in the running app (README "Run the application"). Record which passed and any that could not be done. The prerequisite SQL promotes an account in the local development database only; ask the user before running it.
  - For spec SC-001 (find and suspend in under 1 minute), time from selecting **Users** to the "✓ Success: Account suspended." message, searching for the account by part of its email on the way, and record the time here. There is no automated timing test.
- [ ] T048 Capture screenshots for the Pull Request (constitution V), at desktop width and at 320 px:
  - the User accounts list;
  - the suspend dialog;
  - the list after a suspension, with the success message;
  - a search with no match.
  
  Keep the images outside the repository unless the README already stores screenshots.
- [ ] T049 Prepare the Pull Request description for the user. Include:
  - a link to `specs/014-admin-accounts/spec.md`;
  - a summary of the change;
  - the tests and checks run (T046, T047);
  - "no migration";
  - the spec change made during planning (registration date in Lithuanian time, research section 13);
  - the screenshots (T048);
  - the AI review record (T045).
  
  The user opens and merges the Pull Request.

**Checkpoint**: All checks green, docs current, review recorded, screenshots and PR description ready. Ready for commit and Pull Request on request.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Setup): no dependencies.
- **Phase 2** (Foundational): depends on Phase 1. Blocks all story phases.
- **Phase 3** (US1): depends on Phase 2. It creates the service, controller, API module, both stores, the list, the button, the page, the route and the navigation item that every later story extends.
- **Phase 4** (US2): depends on Phase 3 (the button, the store and the effect tests).
- **Phase 5** (US4): depends on Phase 3 (both endpoints, the route, the navigation item). T031 checks refused `PUT`s for both target statuses, so it runs after Phase 4.
- **Phase 6** (US3): depends on Phase 3 (the service's `ListAsync`, the list store, the page).
- **Phase 7** (US5): depends on Phases 3, 4 and 6 (the dialog, both buttons and the search form exist).
- **Phase 8** (Polish): depends on all story phases.

### User Story Dependencies

- **US1 (P1)**: foundation only. It is the MVP: an administrator suspends an account on the page, and the user is blocked on the next request.
- **US2 (P1)**: adds Reactivate over US1's button and store.
- **US4 (P1)**: verifies US1's endpoints and page rules. It is placed after US2 so the authorization tests cover both changes.
- **US3 (P2)**: adds the search over US1's list. It is independent of US2 and US4.
- **US5 (P2)**: cross-checks all new screens.

### Within Each Phase

- Backend DTOs and results come before the service, the service before the controller, and the controller before the endpoint tests.
- Frontend types come before the API module, then the stores, components, page, and page tests.
- Each phase ends with its tests green before the next phase starts.

## Parallel Opportunities

- **Phase 2**: T003, T005, T006, T007 and T008 touch different files. T004 needs T003.
- **Phase 3**:
  - T009 and T010 in parallel.
  - The frontend T016 and T019 can run in parallel with each other and with the whole backend part (T009 to T015).
- **Phase 6**: T036 (the search form) in parallel with T034 and T035 (backend).
- **Phase 7**: T040 and T041 in parallel.
- **Phase 8**: T043 is independent of the code checks.

### Parallel Example: Phase 3 (User Story 1)

```text
Task: "T011 [US1] AdminAccountService in backend/src/SpekLaiku.Api/Services/AdminAccountService.cs"
Task: "T016 [P] [US1] listAccounts and setAccountStatus in frontend/src/api/adminAccountsApi.ts with its test"
Task: "T019 [P] [US1] Suspend with ConfirmDialog in frontend/src/components/accountStatusButton.tsx"
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 → Phase 2 (stop for review).
2. Phase 3: suspend an account on the page (stop for review).
3. **Validate**:
   - `AccountSuspensionEffectTests` shows the suspended user is refused on the next request.
   - The page shows the dialog, the success message and the new status.

### Incremental Delivery

1. Phase 4 (US2): Reactivate.
2. Phase 5 (US4): authorization verified.
3. Phase 6 (US3): search and the limit notice.
4. Phase 7 (US5): keyboard, screen reader and phone.
5. Phase 8: docs, verification, review, PR.

Each phase is a stop point for diff review. Commits use Conventional Commit messages (for example `feat(admin): suspend a registered user account`) and are made only when the user asks.
