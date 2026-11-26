# Tasks: Account Deletion

**Input**: Design documents from `specs/016-account-deletion/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/account-deletion-api.md ✓, quickstart.md ✓

**Tests**: Required. Constitution III makes automated backend and frontend tests mandatory for every feature, including an authorization test for each protected operation. Each story phase includes its tests.

**Organization**:

- Phase 1 is setup.
- Phase 2 is the shared foundation: the request DTO, the service result, the validator, the frontend answer type, and the session-clearing helper moved out of logout. After it, the app behaves exactly as before.
- Phases 3 to 5 are one phase per user story, in this order:
  - US1 Delete my account and my plans (P1). It also builds the endpoint, the page, the route and the navigation item, because deleting needs them.
  - US2 Only the account owner can delete the account (P1). It is placed after US1 so its tests run against the finished endpoint and page.
  - US3 Keyboard, screen reader and phone (P2).
- Phase 6 is polish.

Each phase ends at a reviewable checkpoint. Stop after each phase for a diff review; commit and push only on request.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on other incomplete tasks in this phase)
- **[Story]**: Which user story this task belongs to ([US1] to [US3])

## Shared test notes

- **Shared database**: integration tests share one `PostgreSqlApiFactory` (collection `PostgreSqlCollection.Name`). Other test classes leave accounts and plans in the same tables, so never assert on table totals; always filter by the test's own account ids.
- **Accounts**: use `factory.CreateSignedInUserAsync()` for the caller (password `"Password123!"`, the default of `CreateUserAsync`), and `factory.CreateUserAsync(...)` for other accounts. For a second session of the same account, create a second client with `factory.CreateHttpsClient()` and `POST {TestSignInStartupFilter.Path}?email=<email>`.
- **Plans**: insert saved plans with the existing `SavedPlanSeed` helpers in `backend/tests/SpekLaiku.IntegrationTests/SavedPlanSeed.cs`.
- **Reading rows back**: open a scope from `factory.Services` and read `ApplicationDbContext.Users.AsNoTracking()` and `SavedPlans.AsNoTracking()` by id.
- **Log capture**: use the existing `CapturingLoggerProvider` through `factory.WithWebHostBuilder`, as in `AdminAccountLogTests.cs`.
- **Frontend helpers**: tests use `routeFetch` (handlers keyed `"METHOD /path"`, for example `"POST /api/account/delete"`), `jsonResponse`, `signedInUser()` and `renderApp("/account")` from `frontend/src/tests/renderApp.tsx`. `routeFetch` fails a test on any request without a handler.
- **Store reset**: every new store is reset in `frontend/src/tests/setup.ts` after each test.
- **Vitest cold start**: the first `npm test` of a session may fail with "Failed to start forks worker". Re-run it once before investigating.

---

## Phase 1: Setup

**Purpose**: Branch ready, baseline green.

- [x] T001 Confirm that the branch `016-account-deletion` (already created) is based on the current `origin/main`:
  - Run `git fetch`, then `git log origin/main..HEAD` and `git log HEAD..origin/main`. Both should be empty, or the first should list only the spec commit if the user asked for it to be committed.
  - Run `git status`. It should show only `specs/016-account-deletion/` (untracked or committed).
  - Record the result here.
  - Result (2026-11-26): both logs empty (the branch is at `4dc2714`, PR #21); `git status` shows only the untracked `specs/016-account-deletion/`.
- [x] T002 Run the baseline checks one step at a time in the foreground, and confirm that all pass before changing any code. Record the test counts here for comparison in T034.
  - From the repository root: `dotnet build SpekLaiku.slnx`, `dotnet test SpekLaiku.slnx` and `dotnet format SpekLaiku.slnx --verify-no-changes`.
  - From `frontend/`: `npm run lint`, `npm run format:check`, `npm test` and `npm run build`.
  - Expected from feature 014 (T046, 2026-11-25): 824 unit and 498 integration tests; frontend 95 files and 1409 tests. Record the actual numbers.
  - Result (2026-11-26), each step run on its own in the foreground, all passing:
    - **Backend**: build with 0 warnings and 0 errors; **824 unit** and **498 integration** tests; `dotnet format --verify-no-changes` clean.
    - **Frontend**: lint clean; `format:check` clean; **95 files** and **1409 tests**; build clean.

**Checkpoint**: Branch is current, all checks green.

---

## Phase 2: Foundational (request, result, validator, answer type, session clearing)

**Purpose**: The pieces the endpoint, the store and logout share. No endpoint and no visible change yet.

- [x] T003 [P] Create `backend/src/SpekLaiku.Api/DTOs/Requests/AccountDeletionRequest.cs`: `public sealed record AccountDeletionRequest(string? Password);`. It is nullable, so a missing value reaches the validator (T005) instead of the generic model error, as `LoginRequest` does. Add an XML comment: "The password is used exactly as entered: never trimmed. No length rule." (data-model.md "Validation rules").
- [x] T004 [P] Create `backend/src/SpekLaiku.Api/Services/AccountDeletionResult.cs`: a result record in the style of `LoginResult`, with private constructor, static factories and these outcomes (data-model.md "Service result"):
  - `Deleted(int planCount)`: `PlanCount` is for the log only and is never returned.
  - `Invalid(IReadOnlyDictionary<string, string> errors)`: field errors keyed `password`.
  - `IncorrectPassword()`, `LockedOut()`, `NotAllowed()`.
  - Expose them as an `AccountDeletionOutcome` enum property `Outcome` plus `Errors` and `PlanCount`, so the controller can `switch` on it.
- [x] T005 Create `backend/src/SpekLaiku.Api/Services/AccountDeletionValidator.cs`, a static class like `LoginValidator`:
  - `Validate(AccountDeletionRequest request)` returns `errors["password"] = "Enter your password."` when `string.IsNullOrEmpty(request.Password)`; otherwise no errors.
  - Comment: "A password of only spaces is not empty, because passwords are used exactly as entered" (research section 4).
  - Then add `backend/tests/SpekLaiku.UnitTests/AccountDeletionValidatorTests.cs`: `NullPassword_GivesEnterYourPassword`, `EmptyPassword_GivesEnterYourPassword`, `SpacesOnly_IsAccepted`, `NormalPassword_IsAccepted`.
- [x] T006 [P] Create `frontend/src/types/accountDeletion.ts` (contracts/account-deletion-api.md "Browser API module"):

  ```ts
  export type AccountDeletionAnswer =
    | { kind: "deleted" }
    | { kind: "invalid"; message: string }
    | { kind: "locked" }
    | { kind: "signedOut" }
    | { kind: "forbidden" }
  ```
- [x] T007 Move the session clearing out of `frontend/src/stores/useLogoutStore.ts` into `frontend/src/helpers/clearSignedInData.ts` (research section 11):
  - `export function clearSignedInData(): void` runs, in this order, the lines `useLogoutStore.submit` runs today after a successful logout: `useCurrentUserStore.getState().setSignedOut()`, `usePlanSetupStore.getState().clear()`, `usePlanActivitiesStore.getState().clear()`, `useKeptScheduleStore.getState().clear()`, `usePlanEditStore.getState().clearAll()`, `useAdminAccountsStore.getState().reset()`, `useAccountStatusStore.getState().reset()`. Keep each line's comment (which feature and spec requirement it serves) and move the "Signed out on purpose…" comment with `setSignedOut()`.
  - Add a header comment: "Everything that belongs to a session that ended on purpose: logout (feature 002) and account deletion (feature 016). A later feature that keeps session data adds its store here."
  - `useLogoutStore.ts` calls `clearSignedInData()` in place of those lines and no longer imports the stores it only cleared.
  - Run the existing `frontend/src/tests/useLogoutStore.test.tsx` and `frontend/src/tests/logout.test.tsx` unchanged: they must still pass. Add one case to `useLogoutStore.test.tsx`: "clears the session data through clearSignedInData", spying on the helper module.
  - Result (2026-11-26), Phase 2:
    - **T003**: `AccountDeletionRequest` also masks the password in its `ToString`, as `LoginRequest` does, because ASP.NET Core logs action arguments at Trace level (spec FR-015, NFR-006). Tested by the new `backend/tests/SpekLaiku.UnitTests/AccountDeletionRequestTests.cs`; this was not in the task text.
    - **T004**: `IncorrectPassword`, `LockedOut` and `NotAllowed` are static fields rather than methods, as in `AccountStatusChange`; `Deleted(planCount)` and `Invalid(errors)` are methods.
    - **T007**: instead of spying on the module (an ES module export cannot be reliably replaced by `vi.spyOn`), the helper got its own `frontend/src/tests/clearSignedInData.test.ts` (3 cases: signed out without "expired", plan in progress, kept schedule and edit cleared, account stores reset). `useLogoutStore.test.tsx` and `logout.test.tsx` are unchanged and pass, so logout still clears the same data through the helper.
    - **Checks**, each step on its own in the foreground: backend build 0 warnings, **829 unit** (T002: 824, +5) and **498 integration** tests, format clean; frontend lint and format clean, **96 files** and **1412 tests** (T002: 95 and 1409, +1 file, +3), build clean.

**Checkpoint**: The validator tests pass, logout behaves exactly as before, all tests green, no visible change.

---

## Phase 3: User Story 1 - Delete my account and my plans (Priority: P1) 🎯 MVP

**Goal**: A signed-in Active Registered User opens the Account page, selects "Delete account", enters their password, confirms, and lands on Home as a visitor with "✓ Success: Your account has been deleted." The account and its plans are gone, the old login fails and the email can be registered again.

**Independent Test**: The spec's User Story 1 independent test passes in `AccountDeletionEndpointTests`, `DeletedAccountSessionTests` and `AccountPage.test.tsx`.

### Backend for User Story 1

- [x] T008 [US1] Create `backend/src/SpekLaiku.Api/Services/AccountDeletionService.cs` (`ApplicationDbContext`, `UserManager<ApplicationUser>`, `SignInManager<ApplicationUser>`, `ILogger<AccountDeletionService>`). About 100 lines; must stay under 200. One method, `DeleteAsync(ClaimsPrincipal principal, AccountDeletionRequest request, CancellationToken cancellationToken)`:
  1. `AccountDeletionValidator.Validate(request)`; any error returns `Invalid(errors)` before the account is read, so nothing is counted.
  2. `var user = await userManager.GetUserAsync(principal)`. If it is null, or not `{ Role: PlanCreatorHandler.RegisteredUserRole, AccountStatus: AccountStatus.Active }`, return `NotAllowed()`. (The policy already checked this; the account may have changed since.)
  3. If `await userManager.IsLockedOutAsync(user)`, return `LockedOut()` (already locked: the correct password is refused too, and nothing is logged).
  4. `var check = await signInManager.CheckPasswordSignInAsync(user, request.Password!, lockoutOnFailure: true)`, the same call as `LoginService`, so the failed-attempt count and the lock are shared (research section 4). The password is never trimmed.
     - `check.IsLockedOut`: this attempt caused the lock. `logger.LogWarning("Account {UserId} locked after repeated failed password checks.", user.Id)`, then return `LockedOut()`.
     - `!check.Succeeded`: return `IncorrectPassword()`. Not logged.
  5. In one transaction (`await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken)`) (research section 5):
     - `var planCount = await context.SavedPlans.Where(plan => plan.OwnerId == user.Id).ExecuteDeleteAsync(cancellationToken);`
     - `var deleted = await context.Users.Where(account => account.Id == user.Id && account.Role == PlanCreatorHandler.RegisteredUserRole && account.AccountStatus == AccountStatus.Active).ExecuteDeleteAsync(cancellationToken);`
     - If `deleted != 1`: `await transaction.RollbackAsync(cancellationToken)` and return `NotAllowed()` (the account was suspended, promoted or deleted after step 2; nothing is deleted).
     - Otherwise `await transaction.CommitAsync(cancellationToken)`.
  6. `logger.LogInformation("Account {UserId} deleted with {PlanCount} saved plans.", user.Id, planCount)` and return `Deleted(planCount)`.
  - Never pass the email or the password to the logger (spec FR-015).
  - Catch no exception: a technical failure reaches `ApiExceptionHandler`, which logs it, and the open transaction is rolled back when it is disposed.
  - Add an XML comment naming research sections 4 and 5: the shared lock, and why the delete is conditional and in one transaction instead of `UserManager.DeleteAsync`.
- [x] T009 [US1] Create `backend/src/SpekLaiku.Api/Controllers/AccountController.cs`:
  - Route `api/account`, `[ApiController]`, `[Authorize(Policy = AuthorizationPolicies.ActiveRegisteredUser)]` on the class, `ProducesResponseType` attributes for 204, 400, 401, 403, 429 and 500 as in `AuthController`. Keep it thin.
  - `[HttpPost("delete")] Delete(AccountDeletionRequest request, CancellationToken cancellationToken)` calls the service and maps the outcome (contracts/account-deletion-api.md):
    - `Deleted` → `await signInManager.SignOutAsync()`, then `NoContent()` (research section 6).
    - `Invalid` → 400 `ValidationProblemDetails` with the errors, title "One or more request fields are invalid.", as `AuthController.Login`.
    - `IncorrectPassword` → the same 400 shape with `errors.password = ["Password is incorrect."]`.
    - `LockedOut` → `Problem(title: "Too many incorrect passwords. Try again in 15 minutes.", detail: "Too many incorrect passwords. Try again in 15 minutes.", statusCode: StatusCodes.Status429TooManyRequests)`.
    - `NotAllowed` → `Forbid()`, which gives the same empty 403 as a refused policy.
  - A missing or unreadable body gets the existing `InvalidModelStateResponseFactory` answer (`errors.request`).
  - Register `AccountDeletionService` as scoped in `backend/src/SpekLaiku.Api/Program.cs`, next to `AdminAccountService`.
- [x] T010 [US1] Create `backend/tests/SpekLaiku.IntegrationTests/AccountDeletionEndpointTests.cs`:
  - `CorrectPassword_Answers204AndRemovesTheSessionCookie`: the answer has a `Set-Cookie` for the Identity application cookie with an expiry in the past.
  - `CorrectPassword_DeletesTheAccountAndAllItsPlans`: seed two plans for the caller; afterwards neither the `AspNetUsers` row nor any `SavedPlans` row with that `OwnerId` exists.
  - `Deletion_LeavesOtherAccountsAndTheirPlansUnchanged`: another user with one plan; its row and plan are unchanged (spec SC-003).
  - `AccountWithNoPlans_IsDeleted`.
  - `AfterDeletion_SameClientGets401FromMe`.
  - `EmptyJsonObject_Gets400EnterYourPassword` and `MissingBody_Gets400RequestError` (`errors.request`, "The request is invalid.").
- [x] T011 [US1] Create `backend/tests/SpekLaiku.IntegrationTests/AccountDeletionPasswordTests.cs` (spec FR-002, FR-016):
  - `EmptyPassword_Gets400AndCountsNoAttempt`: `errors.password` is `["Enter your password."]`; `AccessFailedCount` stays 0.
  - `WrongPassword_Gets400PasswordIsIncorrect`: `errors.password` is `["Password is incorrect."]`; `AccessFailedCount` is 1; the account and its plan still exist.
  - `PasswordWithAddedSpace_IsWrong`: `"Password123! "` gives "Password is incorrect." (never trimmed).
  - `FifthWrongPassword_Gets429AndLocksTheAccount`: four wrong attempts give 400; the fifth gives 429 with the detail "Too many incorrect passwords. Try again in 15 minutes."; `LockoutEnd` is about 15 minutes ahead.
  - `WhileLocked_CorrectPasswordGets429AndDeletesNothing`.
  - `LockIsShared_WrongLoginsCountInTheDialog`: four wrong `POST /api/auth/login` for the account (from a signed-out client), then one wrong dialog attempt gives 429.
  - `LockIsShared_DialogLockRefusesLogin`: after a lock made in the dialog, `POST /api/auth/login` with the correct password from a signed-out client gives 401 "Incorrect email or password.".
- [x] T012 [US1] Create `backend/tests/SpekLaiku.IntegrationTests/DeletedAccountSessionTests.cs` (spec FR-005, FR-006, SC-002, SC-005, research section 7). Two clients signed in to the same account (shared test notes); client A deletes it:
  - `OtherSession_IsRefusedEverywhere`: client B gets 403 from `GET /api/plans`, 403 from `GET /api/plans/{id}` of a deleted plan, 403 from `POST /api/account/delete` with the correct password, and 401 from `GET /api/auth/me`.
  - `OldDetails_CannotLogIn`: `POST /api/auth/login` with the old email and password gives 401 with the detail "Incorrect email or password.".
  - `SameEmail_CanRegisterAgainWithNoPlans`: `POST /api/registration` with the same email (in another letter case too) gives 201; signing in as the new account, `GET /api/plans` returns an empty list; the new account's id differs from the old one.
- [x] T013 [US1] Create `backend/tests/SpekLaiku.IntegrationTests/AccountDeletionAtomicityTests.cs` (spec SC-004, research section 16):
  - A private `DbCommandInterceptor` that throws `InvalidOperationException` from `NonQueryExecutingAsync` (and `ReaderExecutingAsync`) when `command.CommandText` contains `DELETE FROM "AspNetUsers"`. Add it through `factory.WithWebHostBuilder(builder => builder.ConfigureServices(services => services.AddSingleton<IInterceptor>(...)))` together with an `AddDbContext` options callback, or by replacing the `DbContextOptions<ApplicationDbContext>` registration with one that adds the interceptor; use whichever works with the factory's existing setup and note it in a comment.
  - `FailureAfterThePlansWereDeleted_KeepsTheAccountAndAllPlans`: seed two plans; the answer is 500 with no technical details; the account row and both plans still exist; the same client still gets 200 from `GET /api/auth/me`.
- [x] T014 [US1] Create `backend/tests/SpekLaiku.IntegrationTests/AccountDeletionLogTests.cs` (spec FR-015):
  - `Deletion_LogsTheIdAndPlanCountAndNoEmail`: exactly one entry containing "deleted with 2 saved plans" and the account id, and no entry containing the email.
  - `WrongPassword_WritesNoEntry`: no entry from `AccountDeletionService`.
  - `Lock_LogsOneWarningWithTheIdOnly`: after the fifth wrong password, exactly one Warning containing "locked after repeated failed password checks" and the id, and no email; no entry contains the password.

### Frontend for User Story 1

- [x] T015 [P] [US1] Create `frontend/src/api/accountApi.ts` with `deleteAccount(password: string, signal: AbortSignal): Promise<AccountDeletionAnswer>`:
  - `apiFetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }), signal })`. The password is sent exactly as entered.
  - Map the status as in contracts/account-deletion-api.md: 204 → `deleted`; 400 → `invalid` with the first message of `errors.password` (if there is none, throw `ApiError(400)`); 429 → `locked`; 401 → `signedOut`; 403 → `forbidden`; anything else → throw `ApiError(status)`.
  - Then add `frontend/src/tests/accountApi.test.ts`: each status above; the request method, path and body `{ password: "  spaced  " }` unchanged; a 500 throws `ApiError` with status 500.
- [x] T016 [US1] Create `frontend/src/stores/useAccountDeletionStore.ts` (data-model.md "Browser state", research sections 13 and 14). Export the messages as constants:
  - `deletingAccountMessage = "Deleting your account…"`
  - `deleteFailedMessage = formatErrorMessage("Account could not be deleted. Try again.")`
  - `accountLockedMessage = formatErrorMessage("Too many incorrect passwords. Try again in 15 minutes.")`
  - `enterPasswordMessage = "Enter your password."` and `passwordIncorrectMessage = "Password is incorrect."` (shown through `TextField`, which adds "Error:").
  - `accountDeletedMessage = "Your account has been deleted."` (shown by `SuccessBanner`, which adds "✓ Success:").
  
  State: `dialogOpen`, `password`, `status: "idle" | "pending" | "serverError"`, `fieldError: string | null`, `error: string | null`, `focusRequest: number | null`, `controller: AbortController | null`. Actions:
  - `open()`: `dialogOpen: true` with an empty password and no messages.
  - `close()`: ignored while pending; otherwise back to the initial state (the password is emptied).
  - `setPassword(value)`: stores it and clears `fieldError`.
  - `submit(): Promise<"deleted" | "refused" | "failed" | "ignored">`:
    - While pending, return `"ignored"` (read with `get()`, so a double press sends one request).
    - An empty password sets `fieldError: enterPasswordMessage` and a new `focusRequest`, sends nothing, and returns `"refused"`.
    - Otherwise set pending, start `startTimeout(controller)` from `helpers/timedRequest.ts` (10 seconds), and call `deleteAccount`.
    - Drop the answer if `get().controller !== abort` (after `reset()`), returning `"ignored"`.
    - `deleted`: `clearSignedInData()` (T007), reset this store, return `"deleted"`.
    - `invalid`: `fieldError: message`; for `passwordIncorrectMessage` also empty the password; new `focusRequest`; `status: "idle"`; return `"refused"`.
    - `locked`: `error: accountLockedMessage`, empty the password, new `focusRequest`, `status: "idle"`, return `"refused"`.
    - `signedOut`: `useCurrentUserStore.getState().markSessionEnded()`, reset this store, return `"failed"`.
    - `forbidden`: `void useCurrentUserStore.getState().refresh()`, `error: deleteFailedMessage`, `status: "idle"` (no Retry), return `"failed"`.
    - A thrown error, a network error or the timeout: `error: deleteFailedMessage`, `status: "serverError"`, keep the password, return `"failed"`.
  - `retry()`: `submit()` again with the password still in the store.
  - `focusHandled()`: clears `focusRequest`.
  - `reset()`: aborts a pending request and returns to the initial state.
  
  Add `useAccountDeletionStore.getState().reset()` to `clearSignedInData()` in `frontend/src/helpers/clearSignedInData.ts` (so logout also empties it), and to `frontend/src/tests/setup.ts`.

  Then add `frontend/src/tests/useAccountDeletionStore.test.ts`: open and close; close empties the password; close while pending is ignored; empty password without a request; pending blocks a second submit (one request recorded); deleted clears the plan in progress and sets the current user signed out; wrong password (field error, password emptied, focus request); locked; 401 marks the session ended; 403 refreshes the current user and offers no Retry; 500, network error and the 10-second timeout (fake timers) give `serverError`; Retry sends the same password; `reset` aborts.
- [x] T017 [P] [US1] Create `frontend/src/components/deleteAccountDialog.tsx` (research section 10). Props: `email: string`, `onClose: () => void`, `onDeleted: () => void`. It reads and drives `useAccountDeletionStore`. About 120 lines.
  - The same outer markup as `ConfirmDialog`: `div.confirm-backdrop` > `div.confirm-dialog` with `role="dialog"`, `aria-modal="true"` and `aria-labelledby` the question's id.
  - The question as plain text: `` `Delete your account ${email}? All your saved plans will be deleted. This cannot be undone.` ``.
  - A `<form noValidate>` whose submit calls `submit()` and, on `"deleted"`, `onDeleted()`. Inside it:
    - `TextField` with `id="delete-account-password"`, label "Password", `type="password"`, `autoComplete="current-password"`, the store's `password` and `fieldError`. Disabled while pending (add an optional `disabled` prop to `frontend/src/components/textField.tsx` if it has none).
    - A status region (`role="status"`) with `deletingAccountMessage` while pending.
    - An alert region (`role="alert"`) with `error`, and a "Retry" button when `status === "serverError"` that calls `retry()` (and `onDeleted()` on `"deleted"`).
    - The buttons "Delete account" (`type="submit"`) and "Cancel" (`type="button"`, calls `onClose`). Both disabled while pending.
  - Focus moves to the field when the dialog opens, and again whenever `focusRequest` changes (then `focusHandled()`).
  - Keyboard: Escape calls `onClose` (ignored while pending, as `close()` is). Tab from the last enabled control goes to the field; Shift+Tab from the field goes to the last enabled control (Cancel, or Retry when shown last).
  - Comment why it is not `ConfirmDialog` (research section 10).
- [x] T018 [US1] Create `frontend/src/components/deleteAccountSection.tsx`:
  - A `<section aria-labelledby>` with the heading "Delete account" (`h2`), the text "Deleting your account also deletes all your saved plans. This cannot be undone." and a "Delete account" button that calls `open()`.
  - Renders `DeleteAccountDialog` while `dialogOpen`, with `onClose` = `close()` then focus back to the button (a ref), and `onDeleted` = `navigate("/", { state: { successMessage: accountDeletedMessage } })`, as `logoutButton.tsx` navigates after logout (research section 12).
- [x] T019 [US1] Create `frontend/src/pages/AccountPage.tsx`: `usePageTitle("Account")`, `<h1>Account</h1>`, a paragraph "Email: <email>" with the email in a `span.account-email`, from `useCurrentUserStore`, and `DeleteAccountSection`. Under about 80 lines.
- [x] T020 [US1] Wire the page in:
  - `frontend/src/components/appRoutes.tsx`: `path="account"` wrapped in `SignedInOnly` and `RegisteredUserOnly`, after `plans/:planId` (research section 17).
  - `frontend/src/components/topNavigation.tsx`: `<NavLink to="/account">Account</NavLink>` right after "My plans", with the same `canViewSavedPlans(status, user)` condition. Update the header comment: "an Active Registered User also sees Account after My plans (feature 016, spec FR-010)".
  - `frontend/src/styles.css`: `.account-email { overflow-wrap: anywhere; }`, and full-width `.confirm-dialog .form-field input` (the 320 px rules are checked in US3).
- [x] T021 [US1] Create `frontend/src/tests/AccountPage.test.tsx` with `renderApp("/account")` as an Active Registered User:
  - The heading "Account", the tab title "Account - Spėk laiku", "user@example.com" and the warning text.
  - "Delete account" opens the dialog with the question including the email; the "Password" field has focus.
  - Cancel and Escape close it, send nothing, and return focus to "Delete account"; reopening shows an empty field.
  - Empty field: "Error: Enter your password." next to the field (`aria-describedby`), no request.
  - Wrong password (400): "Error: Password is incorrect.", the field emptied and focused, the dialog open.
  - Locked (429): "Error: Too many incorrect passwords. Try again in 15 minutes." and no Retry; still on the Account page.
  - Pending (a handler that does not resolve): "Deleting your account…", the field and both buttons disabled.
  - 500: "Error: Account could not be deleted. Try again." with Retry; Retry sends the same password; a 204 then lands on Home.
  - 204: Home with "✓ Success: Your account has been deleted.", the visitor navigation (Log in, Register) and no "Account" link; a plan in progress set in `usePlanSetupStore` before is cleared.
  - Enter in the field submits.
- Result (2026-11-26), Phase 3:
  - **Backend**: `AccountDeletionService` (93 lines) and `AccountController` (62 lines) as described. `NotAllowed` answers `Forbid()`. A shared test helper `backend/tests/SpekLaiku.IntegrationTests/AccountDeletionRequests.cs` holds the request, the plan seed, the row reads, a second sign-in and the signed-out login. T013 adds the interceptor with `services.ConfigureDbContext<ApplicationDbContext>(options => options.AddInterceptors(...))` inside `ConfigureTestServices`, which keeps the factory's connection string. In T014 the "no email" checks look only at entries written after the test sign-in, because the test sign-in request has the email in its address.
  - **Frontend**: `deleteAccountDialog.tsx` traps Tab between the first and last enabled control (the field, Retry when shown, Delete account, Cancel), and moves focus to Retry after a technical failure, because the disabled buttons lost it while the request ran. `TextField` gained the optional `disabled` prop. The narrow layout needed no new rule for the dialog: the existing `input` rule (full width, 16 px) and `form button` rule (full width below 40em, 44 px) already apply; only `.account-email` was added to `styles.css`.
  - **Existing tests changed** (allowed: "Account" added after "My plans"): `topNavigation.test.tsx` (the Registered User link list and the count after logging in: 3 → 4; test renamed "… My plans and Account …") and `keyboard.test.tsx` (the Tab order to Log out gains Account; test renamed). `setup.ts` resets the new store.
  - **Checks**, each step on its own in the foreground: backend build 0 warnings, **829 unit** and **521 integration** tests (+23), format clean; frontend lint and format clean, **99 files** and **1450 tests** (+3 files, +38), build clean.

**Checkpoint**: The independent test passes end to end: deleted, signed out, old login refused, email reusable, all-or-nothing proven. All tests green.

---

## Phase 4: User Story 2 - Only the account owner can delete the account (Priority: P1)

**Goal**: Only a signed-in Active Registered User reaches the page and the endpoint, and only for their own account.

**Independent Test**: The spec's User Story 2 independent test passes in `AccountDeletionAuthorizationTests`.

- [x] T022 [US2] Create `backend/tests/SpekLaiku.IntegrationTests/AccountDeletionAuthorizationTests.cs` (constitution III):
  - `Visitor_Gets401WithEmptyBody`.
  - `RefusedCallers_Get403WithTheCorrectPassword` as a `[Theory]` over a Suspended Registered User, an Active Administrator and a Suspended Administrator, each signed in with `CreateSignedInUserAsync(role, status)` and sending `"Password123!"`: 403, no account data in the body, the account row and a seeded plan unchanged, and `AccessFailedCount` still 0 (the password was never checked, research section 3).
  - `RequestCannotNameAnotherAccount`: a body `{ "password": "Password123!", "id": "<other user's id>", "userId": "<other user's id>" }` from an Active Registered User deletes the caller's own account only; the other account and its plan are unchanged.
- [x] T023 [P] [US2] Add cases to `frontend/src/tests/topNavigation.test.tsx`: "Account" right after "My plans" for an Active Registered User, linking to `/account`; no "Account" for a visitor, an Active or Suspended Administrator and a Suspended Registered User.
- [x] T024 [P] [US2] Add cases to `frontend/src/tests/registeredUserOnly.test.tsx` for `/account`: a visitor is sent to Log in with "Log in to continue." and, after logging in as an Active Registered User, lands on the Account page; a Suspended user lands on the Account Suspended page; an Administrator sees Access denied. No `POST /api/account/delete` is sent in any case.
- [x] T025 [US2] Add to `frontend/src/tests/AccountPage.test.tsx`:
  - 401 on confirm: the Log in page with "Your session has expired. Log in again.", and after logging in the Account page opens again (spec Edge Cases).
  - 403 on confirm with `/api/auth/me` now answering Suspended: the Account Suspended page (spec Edge Cases).
  - 403 on confirm with `/api/auth/me` now answering 401 (a lost 204 or another tab): the Log in page with "Your session has expired. Log in again." (research section 13).
- Result (2026-11-26), Phase 4: only tests were added; no production code changed.
  - `AccountDeletionAuthorizationTests` (5 tests): visitor 401 with an empty body; Suspended Registered User, Active and Suspended Administrator 403 with the correct password, nothing deleted and `AccessFailedCount` 0; a body that also names another account's `id`, `userId` and `email` deletes the caller's own account only.
  - `topNavigation.test.tsx`: a new "Account by role" block (shown right after My plans to an Active Registered User, linking to `/account`; hidden for the three other signed-in cases and a visitor). `registeredUserOnly.test.tsx`: a new block for `/account` (page shown, visitor to Log in with `returnTo=%2Faccount`, Administrator Access denied, Suspended to Account Suspended) and a visitor who logs in and lands on the Account page. `AccountPage.test.tsx`: the three cases above.
  - **Checks**: the new and changed test files only (5 backend, 53 frontend tests in the three files), all passing; the full suite runs at the end of Phase 5.

**Checkpoint**: Every caller other than the owner is refused, on the server and in the browser. All tests green.

---

## Phase 5: User Story 3 - Delete my account with keyboard, screen reader and on a phone (Priority: P2)

**Goal**: The page and the dialog are fully usable by keyboard and screen reader, and at 320 px.

**Independent Test**: The spec's User Story 3 independent test passes in `keyboard.test.tsx` and `responsive.test.tsx`.

- [x] T026 [P] [US3] Add Account page cases to `frontend/src/tests/accessibility.test.tsx`: exactly one `h1` "Account"; the first Tab focuses "Skip to main content"; the dialog has `role="dialog"`, `aria-modal` and an accessible name equal to the question; the "Password" field has its label and, after an error, `aria-invalid` and `aria-describedby` pointing at the error; the pending text is in a `role="status"` region and the error in `role="alert"`; the success banner after deletion is inside the layout's `role="status"` region.
- [x] T027 [P] [US3] Add cases to `frontend/src/tests/keyboard.test.tsx`: from the Account page, reach "Delete account" by Tab and open it with Enter; Tab cycles field → "Delete account" → "Cancel" → field, Shift+Tab the other way; Escape closes it and focus returns to the button; type the password and press Enter to delete, landing on Home. Update the existing Tab-order expectation for a Registered User's navigation if it lists the links (the only allowed change to an existing assertion is adding "Account" after "My plans").
- [x] T028 [P] [US3] Add cases to `frontend/src/tests/responsive.test.tsx` and the matching rules to `frontend/src/styles.css` (spec FR-014), in the same style as the existing 320 px checks:
  - in the narrow layout the dialog's field and its buttons are full width and the buttons have `min-height` 44 px (reuse the existing narrow button rule if it already applies to `.confirm-dialog button`);
  - the field's font size is at least 16 px;
  - `.account-email` has `overflow-wrap: anywhere`, so a 60-character email wraps.
- Result (2026-11-26), Phase 5:
  - **Fix found by T028**: the "Delete account" button that opens the dialog is not inside a form, so the `form button` rule did not make it full width at 320 px (spec FR-014). The section got the class `delete-account`, and `styles.css` has `.delete-account > button { display: block; width: 100% }`, sized to its text again from 40em. `.account-email` moved from the email `span` to its paragraph, so the wrapping applies to the block.
  - **Tests added only** (no existing assertion changed in these files): `accessibility.test.tsx` "Account page accessibility" (5 tests: one h1, the tab title, the h2 and the skip link first; the dialog's name and modal state and the labelled field; the field error linked through `aria-describedby`; pending in `role="status"` and the error in `role="alert"`; the success message in the layout's status region, outside `main`). `keyboard.test.tsx` "keyboard use of the Account page" (3 tests: the Tab order from the skip link to Delete account and Enter opening the dialog with focus in the field; Tab and Shift+Tab kept inside, Escape closing and returning focus with no request; typing the password and Enter deleting the account). `responsive.test.tsx` "Account page at 320 px" (3 tests: a 66-character email wraps; the open button full width and 44 × 44 px; the dialog's field full width with 16 px text, its buttons full width and 44 × 44 px).
  - **Checks** (Phases 4 and 5), each step on its own in the foreground: backend build 0 warnings, **829 unit** and **526 integration** tests (Phase 3: 521, +5), format clean; frontend lint and format clean, **99 files** and **1475 tests** (Phase 3: 1450, +25), build clean.

**Checkpoint**: Keyboard, screen reader and 320 px rules covered. All tests green.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, full verification, review. No new behaviour.

- [x] T029 [P] Update the documentation:
  - **`README.md`**:
    - **New "Account" section**, after "Saved plans". It says:
      - an Active Registered User selects **Account** to see their email and delete their account;
      - **Delete account** asks for confirmation and the password, and deletes the account and all its saved plans permanently, then signs the user out;
      - wrong passwords count towards the same 5-try, 15-minute lock as Log in;
      - Administrators and suspended users cannot delete an account here;
      - each deletion is logged with the account id and the number of plans, never the email;
      - feature 016 adds no migration.
    - **"Testing an Administrator or Suspended account"**: add that throwaway test accounts can be deleted on the Account page, and that the walkthrough accounts of earlier features should be kept.
    - **"Run the application"**: change "Features 012 and 014 add no migration." to "Features 012, 014 and 016 add no migration."
    - **"User accounts"**: keep "Deleting accounts is not part of it." (administrator deletion is still open) and add "A user deletes their own account on the Account page (feature 016)."
  - **`docs/ux-design.md`**:
    - Section 1 screen list: the "Profile" row becomes "Account" ("Shows the email and Delete account (feature 016); profile details and preferences may be added later.").
    - Section 6 state table: an Account row with Confirmation ("Delete your account <email>? All your saved plans will be deleted. This cannot be undone." with a Password field, **Delete account** and **Cancel**), Pending ("Deleting your account…"), Success ("✓ Success: Your account has been deleted." on Home), Validation ("Error: Enter your password." / "Error: Password is incorrect."), Locked ("Error: Too many incorrect passwords. Try again in 15 minutes.") and Server error ("Error: Account could not be deleted. Try again." with Retry).
    - Section 7 navigation table: "Account" in place of "Profile *(Could Have)*" (✓ for Registered User only), and "Visitor opens My plans, Account or an admin page" in the behaviour table.
    
    Change nothing else.
  - **`docs/architecture.md`**: the 016 row notes the password re-entry and that the administrator deletion of FR-042 is still open. Check for other statements that now contradict the implementation, and correct only what is wrong.
  - Record the result here.
  - Result (2026-11-26): README has a new "Account" section after "Saved plans" with every point above; "Testing an Administrator or Suspended account" ends with a paragraph on deleting throwaway accounts and keeping the walkthrough accounts; "Run the application" says "Features 012, 014 and 016 add no migration."; "User accounts" keeps "Deleting accounts is not part of it." and points to the Account page. `docs/ux-design.md`: the screen list row is now "Account", the six Account states are in the state table (after Plan Details / Edit), the navigation table and the behaviour row say "Account". Two further rows that named the screens were also updated so the document agrees with itself: the screen-to-requirement table gains "Account | FR-005, FR-039", and the FR-039 row lists "My Plans, Account, Admin: User Accounts". The template example in section 7 ("Dashboard, Tasks, Profile") is the course's example text and is unchanged. `docs/architecture.md`: the 016 row is updated; nothing else contradicts the implementation.
- [x] T030 Review `git diff main...HEAD` and confirm:
  - only the files in plan.md "Source Code", plus the README, docs and spec files, changed (and `textField.tsx` if T017 added `disabled`);
  - there is no debug code, commented-out code or temporary file;
  - `AccountDeletionService` and `AccountController` are under 200 lines, and `AccountPage.tsx`, `deleteAccountSection.tsx`, `deleteAccountDialog.tsx` and `useAccountDeletionStore.ts` are each under about 200 lines;
  - nothing under `Migrations/` changed, and no package was added;
  - no email or password is passed to a logger anywhere in the new code;
  - the new backend code catches no exception, so a technical failure reaches `ApiExceptionHandler` and is logged there (spec FR-015).
  
  Record the result here.
  - Result (2026-11-26): 45 files changed against `main` before the T029 docs (48 with them).
    - **Files**: every production file is in plan.md "Source Code", plus `textField.tsx` (the `disabled` prop) and the `AccountDeletionRequest` password mask recorded in Phase 2. The test files are under the `tests/` folders it names, plus the shared helper `AccountDeletionRequests.cs`, `AccountDeletionRequestTests.cs`, `clearSignedInData.test.ts` and the reset in `setup.ts`, each recorded in its phase. The rest are the README, the two docs and this feature's spec files.
    - **Leftovers**: no `console.`, `debugger`, `Console.Write`, `TODO`, `FIXME`, `.only(` or commented-out code in the added lines, and no temporary file.
    - **Sizes**: `AccountDeletionService` 93 and `AccountController` 62 lines; `AccountPage.tsx` 20, `deleteAccountSection.tsx` 54, `deleteAccountDialog.tsx` 156 and `useAccountDeletionStore.ts` 182.
    - **Migrations and packages**: nothing under `Migrations/`, no `package.json`, lock file or `.csproj` changed.
    - **Logging**: the only two logger calls (`AccountDeletionService`, lines 61 and 90) pass the account id and the plan count; no email or password. `AccountDeletionRequest.ToString()` masks the password.
    - **Exceptions**: no `catch` in the new backend code.
- [x] T031 Run a separate AI-assisted review of the branch: `/code-review`, and `/security-review`, because this feature adds a destructive operation with a password check on user accounts. Record:
  - the tool;
  - the important findings;
  - the changes made;
  - the findings not applied, each with a short reason.
  
  These go in the Pull Request description (constitution VII). Apply the accepted fixes, each with a test that fails before it, then run T032.
  - Result (2026-11-26), tools: Claude Code `/code-review` (level high, `main...016-account-deletion`) and `/security-review`.
    - **`/security-review`**: no vulnerabilities found (none at confidence 8/10 or more). It checked:
      - authorization: the class-level `ActiveRegisteredUser` policy that reads the account on every request, the account taken only from the session (no account field in the request), and the conditional delete that rolls back when the account is no longer an Active Registered User;
      - other sessions of a deleted account (403 everywhere, 401 from `/api/auth/me`, a re-registered email gets a new id), and the cookie removed in the same 204;
      - the password check with the shared lock, never trimmed, an empty password refused before the account is read;
      - CSRF: the `SameSite=Lax`, `Secure`, `HttpOnly` cookie, JSON only, and the password also required, as the other endpoints;
      - mass assignment (one `Password` field) and injection (parameterised EF Core deletes, no raw SQL);
      - logs and answers: the id and plan count only, the password masked in the request's `ToString()`, fixed messages, no account data returned;
      - the browser: the password only in memory and in the POST body to the same origin, cleared on close, wrong password, lock, reset, deletion and logout; no `dangerouslySetInnerHTML` or `eval`.
      
      Not reported, because denial of service is out of scope: someone with a stolen session can lock the account for 15 minutes with wrong passwords, as on Log in. No changes were needed.
    - **`/code-review`**: 5 findings (2 important, 3 nits); 4 applied, 1 not applied. Each new test below failed against the code before its fix and passes with it.
      1. *Important*: nothing of the dialog was dropped when the user left the page with it open (Back, or a 403 that sends them elsewhere): the dialog stayed open with the typed password for the next visit, even for another user on the same browser. After a 403 for an account that was already gone (a lost 204, another tab), the session's plan in progress, kept schedule and edit also survived. Now a 403 resets the store, and when the refresh shows the account is gone, the session stores are cleared too, through a new `clearSessionStores()` split out of `clearSignedInData()` so the session stays marked as expired; `DeleteAccountSection` also resets the store when it unmounts. Tests: store "resets itself on 403, so the dialog and the password are gone" and "clears the session data on 403 when the account is already gone, keeping the session expired"; page "empties the dialog when the user leaves the page with it open". The earlier store test "refreshes the current user on 403 and offers no Retry" now expects the reset store instead of an error kept in it.
      2. *Important*: while the deletion ran, the disabled field and buttons lost focus to the page, so Tab left the modal dialog and reached the navigation (Log out) behind it, and Escape no longer reached the dialog. The dialog now has `tabIndex={-1}` and takes focus while pending; the existing trap keeps Tab on it, and Escape is still ignored while pending. Test: "keeps focus inside the dialog while the deletion runs".
      3. *Nit*: the browser's 10-second abort arriving just after the account row was deleted cancelled the commit, so the deletion was rolled back after the browser had already shown the error, and nothing was logged. The commit and the rollback now use `CancellationToken.None`. Test: the new `backend/tests/SpekLaiku.IntegrationTests/AccountDeletionCancellationTests.cs` aborts the request with an interceptor right after the account delete; before the fix the account was still there, now it is gone and the Information entry is written.
      4. *Nit*: after a deletion, Back went to `/login?returnTo=%2Faccount`. The cause: a router navigation is a React transition while the signed-in state is not, so the guard always replaces the Account page with Log in before Home is shown; calling `navigate` earlier cannot change that (tried and reverted). Home is now opened with `replace: true`, which replaces that Log in entry, so Back returns to the page before Account. Test: "leaves no Log in entry in the history after a deletion: Back returns to the page before Account" (with `/register` before Account; it received `/login?returnTo=%2Faccount` without the fix). Logout from a protected page has the same history entry; that is feature 002's and unchanged.
      5. *Nit, not applied*: Identity's `CheckPasswordSignInAsync` returns `Failed`, not `Success`, when the password is right but resetting the failed-attempt count fails, for example when an administrator changes the account at the same moment; the dialog then says "Password is incorrect.". Not applied: it needs that exact race, nothing is deleted, and the user's next request goes to the Account Suspended page anyway; handling it would mean re-implementing Identity's password and lock logic.
- [x] T032 Run all checks one step at a time in the foreground, and confirm they pass:
  - from the repository root: `dotnet build SpekLaiku.slnx`, `dotnet test SpekLaiku.slnx` and `dotnet format SpekLaiku.slnx --verify-no-changes`;
  - from `frontend/`: `npm run lint`, `npm run format:check`, `npm test` and `npm run build`.
  
  Compare the test counts with T002. The only existing tests allowed to change are:
  - `topNavigation.test.tsx`, `registeredUserOnly.test.tsx`, `keyboard.test.tsx`: "Account" added (T023, T024, T027);
  - `accessibility.test.tsx`, `responsive.test.tsx`: cases added (T026, T028);
  - `useLogoutStore.test.tsx`: the `clearSignedInData` case (T007);
  - `setup.ts`: the new store reset.
  
  No existing assertion may be removed or weakened. Record the results here.
  - Result (2026-11-26), after the T031 fixes, each step run on its own in the foreground, all passing:
    - **Backend**: build with 0 warnings and 0 errors; **829 unit** tests (T002: 824, +5) and **527 integration** tests (T002: 498, +29); `dotnet format --verify-no-changes` clean.
    - **Frontend**: lint and `format:check` clean; **99 files** (T002: 95, +4) and **1480 tests** (T002: 1409, +71); build clean.
    - **Changed existing assertions** (from `git diff main` over the existing test files), all allowed above:
      - `topNavigation.test.tsx`: the Registered User link list expects "Account" after "My plans" with its link checked (test renamed "… My plans and Account …"), and the count after logging in is 4 instead of 3.
      - `keyboard.test.tsx`: the Tab order to Log out gains the Account link (test renamed).
      - `registeredUserOnly.test.tsx`, `accessibility.test.tsx`, `responsive.test.tsx`: cases added only.
      - `setup.ts`: the new store is reset after each test.
      - `useLogoutStore.test.tsx` and `logout.test.tsx`: unchanged (T007 added `clearSignedInData.test.ts` instead).
      
      No existing assertion was removed or weakened.
- [ ] T033 Walk through `specs/016-account-deletion/quickstart.md` Part 2, scenarios 1 to 10, in the running app (README "Run the application"), with **new throwaway accounts** only. Record which passed and any that could not be done. Deleting an account is permanent, so ask the user before each deletion that is not of an account created for this walkthrough.
  - For spec SC-001 (under 1 minute), time from Home to the "✓ Success: Your account has been deleted." message and record it here. There is no automated timing test.
- [ ] T034 Capture screenshots for the Pull Request (constitution V), at desktop width and at 320 px:
  - the Account page;
  - the dialog with "Error: Password is incorrect.";
  - Home after deletion with the success message;
  - the dialog with the lock message.
  
  Keep the images outside the repository unless the README already stores screenshots.
- [ ] T035 Prepare the Pull Request description for the user. Include:
  - a link to `specs/016-account-deletion/spec.md`;
  - a summary of the change;
  - the tests and checks run (T032, T033);
  - "no migration";
  - the spec change made during planning (field messages start with "Error:", research section 9);
  - the screenshots (T034);
  - the AI review record (T031).
  
  The user opens and merges the Pull Request.

**Checkpoint**: All checks green, docs current, review recorded, screenshots and PR description ready. Ready for commit and Pull Request on request.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Setup): no dependencies.
- **Phase 2** (Foundational): depends on Phase 1. Blocks all story phases.
- **Phase 3** (US1): depends on Phase 2. It creates the service, controller, API module, store, dialog, section, page, route and navigation item that the later stories test.
- **Phase 4** (US2): depends on Phase 3 (the endpoint, the route, the navigation item, `AccountPage.test.tsx`).
- **Phase 5** (US3): depends on Phase 3 (the page and the dialog exist).
- **Phase 6** (Polish): depends on all story phases.

### User Story Dependencies

- **US1 (P1)**: foundation only. It is the MVP: a user deletes their own account and plans, and is signed out.
- **US2 (P1)**: verifies US1's endpoint and page rules for every other caller. Independent of US3.
- **US3 (P2)**: cross-checks the new page and dialog. Independent of US2.

### Within Each Phase

- Backend DTO, result and validator come before the service, the service before the controller, and the controller before the endpoint tests.
- Frontend type and helper come before the API module, then the store, the dialog and section, the page, and the page tests.
- Each phase ends with its tests green before the next phase starts.

## Parallel Opportunities

- **Phase 2**: T003, T004 and T006 touch different files. T005 needs T003. T007 is independent of the backend tasks.
- **Phase 3**:
  - The frontend T015 and T017 can run in parallel with each other and with the whole backend part (T008 to T014).
  - T010 to T014 are separate test files; they can be written in parallel once T009 is done.
- **Phase 4**: T023 and T024 in parallel, and with T022 (backend).
- **Phase 5**: T026, T027 and T028 in parallel (T028 also touches `styles.css`, which no other Phase 5 task changes).
- **Phase 6**: T029 is independent of the code checks.

### Parallel Example: Phase 3 (User Story 1)

```text
Task: "T008 [US1] AccountDeletionService in backend/src/SpekLaiku.Api/Services/AccountDeletionService.cs"
Task: "T015 [P] [US1] deleteAccount in frontend/src/api/accountApi.ts with its test"
Task: "T017 [P] [US1] DeleteAccountDialog in frontend/src/components/deleteAccountDialog.tsx"
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 → Phase 2 (stop for review).
2. Phase 3: delete an account on the page (stop for review).
3. **Validate**:
   - `AccountDeletionEndpointTests` and `DeletedAccountSessionTests` show the account and plans are gone, the old login fails and the email is free.
   - `AccountDeletionAtomicityTests` shows a failure part-way deletes nothing.
   - The page shows the dialog, the errors, and Home with the success message.

### Incremental Delivery

1. Phase 4 (US2): authorization verified.
2. Phase 5 (US3): keyboard, screen reader and phone.
3. Phase 6: docs, verification, review, PR.

Each phase is a stop point for diff review. Commits use Conventional Commit messages (for example `feat(account): delete my account and my plans`) and are made only when the user asks.
