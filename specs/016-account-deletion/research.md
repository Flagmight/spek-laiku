# Research: Account Deletion (016)

All Technical Context items were known from the code; nothing was left as NEEDS CLARIFICATION. Each section records a decision, why it was made and what else was considered.

## 1. Dependencies

- **Decision**: No new NuGet or npm package.
- **Rationale**: ASP.NET Core Identity already checks passwords and counts failed attempts (`SignInManager.CheckPasswordSignInAsync`), EF Core 10 has `ExecuteDeleteAsync` and transactions, and the frontend already has the dialog styles, `TextField`, `startTimeout`, `SuccessBanner` and the session stores.
- **Alternatives considered**: None needed.

## 2. Endpoint shape

- **Decision**: `POST /api/account/delete` with the body `{ "password": "..." }` ([contract](contracts/account-deletion-api.md)). The request names no account; the server deletes the signed-in user's own account.
- **Rationale**: The request must carry the password (spec FR-002). A body on `DELETE` has no defined meaning (RFC 9110 section 9.3.5), and some proxies drop it. A `POST` to an action path is the usual way to send a confirmed, destructive command with data. Not naming an account means no request can target another account (spec FR-009, User Story 2 scenario 7).
- **Alternatives considered**:
  - `DELETE /api/account` with a JSON body: rejected for the reason above.
  - `DELETE /api/account` with the password in a header or query: a password in a URL can end up in logs (NFR-006).
  - `DELETE /api/accounts/{id}`: an id in the request invites an id-swapping attack and would need an extra "is this your id" check.

## 3. Authorization

- **Decision**: The new `AccountController` uses the existing `ActiveRegisteredUser` policy. A visitor gets 401 with no body. An Administrator, a Suspended user or a session whose account no longer exists gets 403. The password is checked only after the policy succeeds.
- **Rationale**: This is exactly the spec rule (FR-009, FR-011) and the same policy as saved plans, which already reads the account from the database on every request (`ActiveRegisteredUserHandler`). Because the policy runs first, a refused caller never reaches the password check, so they cannot use it to guess passwords or add to the lock count.
- **Alternatives considered**: A new policy: it would be a copy of `ActiveRegisteredUser`.

## 4. Password check and the shared lock

- **Decision**: `AccountDeletionService` calls `signInManager.CheckPasswordSignInAsync(user, password, lockoutOnFailure: true)`, the same call `LoginService` makes:
  - `Succeeded`: deletion goes ahead.
  - `IsLockedOut`: 429 with "Too many incorrect passwords. Try again in 15 minutes." This covers an account that was already locked (Identity checks the lock before the password, so the correct password is refused too) and the attempt that causes the lock. The attempt that causes the lock writes the same Warning as a login lock, with the account id only.
  - Any other failure: 400 with `errors.password` = "Password is incorrect."
  - An empty or missing password: 400 with `errors.password` = "Enter your password.", checked before the account is touched, so it is not counted (same rule as `LoginValidator`: a password of only spaces is not empty and is checked exactly as entered).
- **Rationale**: One counter per account (spec FR-016, clarification 2026-11-26). Identity's `AccessFailedCount` and `LockoutEnd` columns are already shared by every caller of `CheckPasswordSignInAsync`, so four wrong logins and one wrong dialog attempt lock the account, and a lock made in the dialog also refuses login. A wrong password must not answer 401, because the browser treats 401 as "your session ended" (`markSessionEnded`).
- **Alternatives considered**:
  - `UserManager.CheckPasswordAsync`: it does not count failures or check the lock.
  - Saying "Password is incorrect." on the attempt that causes the lock and the lock message only from the next one: this hides nothing from a user who is already signed in, and the next press would show the lock message anyway.
  - 423 Locked for the lock: less common. 429 is the status the frontend already handles as "wait and try again" in other API modules.

## 5. Deleting the account and its plans together

- **Decision**: In one database transaction, `AccountDeletionService`:
  1. Deletes the account's saved plans with `ExecuteDeleteAsync` and keeps the number deleted for the log.
  2. Deletes the account with a conditional `ExecuteDeleteAsync`: `Id = @id AND Role = 'Registered User' AND AccountStatus = Active`.
  3. Commits if exactly one account row was deleted. Otherwise it rolls back and answers 403, because the account was suspended, promoted or deleted after the policy check.
  
  The database's existing `ON DELETE CASCADE` foreign keys remove the Identity rows that belong to the account (claims, logins, roles, tokens) in the same statement, and any plan saved between steps 1 and 2.
- **Rationale**: Spec FR-003 and SC-004 require all-or-nothing. A transaction gives that. The condition in the delete statement closes the gap between the authorization check and the delete, the same way feature 014 checks the role in its update statement (feature 014 research section 3). Deleting the plans explicitly first gives an exact count for the log (spec FR-015) without a separate count query that could be out of date.
- **Alternatives considered**:
  - `UserManager.DeleteAsync(user)`: it has no status or role condition. A concurrent suspension changes the `ConcurrencyStamp`, so it fails with a generic "optimistic concurrency failure" that would become a 500. It also gives no plan count.
  - Relying only on the cascade for the plans: correct, but then the plan count needs a separate query.
  - Soft delete (a "Deleted" status): the spec says nothing is kept (FR-003), and the email must be free for a new registration (FR-006).

## 6. Signing out in the same answer

- **Decision**: After the commit, the controller calls `signInManager.SignOutAsync()` and answers 204, so the answer also removes the session cookie.
- **Rationale**: The user is signed out at once (spec FR-004) without a second request that could fail. `SignOutAsync` only removes the cookie and does not need the account.
- **Alternatives considered**: The browser calling `POST /api/auth/logout` afterwards: a second request, which can fail and leave a cookie for an account that no longer exists.

## 7. Other sessions of the deleted account

- **Decision**: No new code. Every protected endpoint already re-reads the account (`ActiveRegisteredUserHandler`, `PlanCreatorHandler`, `ActiveAdministratorHandler`), so a cookie for a deleted account gets 403. `GET /api/auth/me` answers 401, because `CurrentUserService` finds no account. In the browser, a 403 makes the stores call `useCurrentUserStore.refresh()`, which turns a signed-in user whose `/me` is now 401 into `signedOut` with `sessionExpired: true`. `SignedInOnly` then sends them to Log in with "Your session has expired. Log in again." New tests prove each step for a deleted account (spec FR-005).
- **Rationale**: The existing design already covers this case (feature 010 research section 7, feature 014 research section 4). This feature only proves it.
- **Alternatives considered**: Rotating the security stamp before deletion and adding a `SecurityStampValidator`: no effect once the row is gone, and more configuration.

## 8. Email reuse and leftover data

- **Decision**: No change. Deleting the row frees the unique `NormalizedEmail` index, so feature 001 registration accepts the email again. A new account gets a new id, so no old plan can match it.
- **Rationale**: Spec FR-006. `GeneratedSchedules` belong to no account and expire after 30 minutes (feature 010), so nothing else holds the user's data. Log entries keep only the account id.
- **Alternatives considered**: None.

## 9. "Error:" on the messages next to the field

- **Decision**: The messages next to the password field are shown as "Error: Enter your password." and "Error: Password is incorrect.", like every field error in the app (`TextField` formats them with `formatErrorMessage`). The spec's FR-008 was changed during planning to say so.
- **Rationale**: The first draft of FR-008 left field messages without "Error:", which would differ from Register, Log in and the category form (project FR-019 of feature 001).
- **Alternatives considered**: An exception for this one dialog: inconsistent, with no benefit.

## 10. The dialog

- **Decision**: A new `components/deleteAccountDialog.tsx` that uses the same `confirm-backdrop` and `confirm-dialog` styles, the same `role="dialog"`, `aria-modal` and `aria-labelledby` as `ConfirmDialog`, and the same Escape and Tab handling. It wraps the question, a `TextField` (`type="password"`, `autoComplete="current-password"`) and the buttons in a `<form>`, so Enter in the field submits. Focus goes to the field when it opens. Tab moves from Cancel back to the field, and Shift+Tab from the field to Cancel. The pending text and the technical error with Retry are shown inside the dialog.
- **Rationale**: `ConfirmDialog` has no field, focuses its confirm button and traps focus between its two buttons. Adding an optional field, a form and a different first focus to it would make the shared component harder to read for the two existing uses.
- **Alternatives considered**: Extending `ConfirmDialog` with `children` and an `initialFocus` prop: possible, but the trap and the submit would differ for one caller only.

## 11. Clearing the session data

- **Decision**: Move the lines that `useLogoutStore` runs after a successful logout (set signed out, clear the plan in progress, activities, kept schedule, plan edit, admin account stores) into `helpers/clearSignedInData.ts`. Both `useLogoutStore` and the new `useAccountDeletionStore` call it, and the deletion store also resets itself.
- **Rationale**: The spec says plan data in the session is cleared "as on log out" (FR-004). One list avoids forgetting a store in one of the two places when a later feature adds one.
- **Alternatives considered**: Calling `useLogoutStore.submit()` after deletion: it would send a logout request that is not needed (section 6).

## 12. The success message

- **Decision**: After a deletion the page navigates to `/` with `{ successMessage: "Your account has been deleted." }`. The existing `SuccessBanner`, inside the layout's `role="status"` region, shows and announces "✓ Success: Your account has been deleted."
- **Rationale**: The same way logout shows "✓ Success: You have logged out." (feature 002). The banner is announced without moving focus.
- **Alternatives considered**: A message kept in a store: the router state is the existing pattern.

## 13. How the browser treats each answer

| Answer | What the browser does |
|---|---|
| 204 | `clearSignedInData()`, reset the deletion store, navigate to Home with the success message. |
| 400 with `errors.password` | Show the message next to the field. On "Password is incorrect." also empty the field and focus it. No Retry. |
| 429 | Show "Error: Too many incorrect passwords. Try again in 15 minutes." in the dialog, empty the field, no Retry. The user stays signed in. |
| 401 | `markSessionEnded()`. `SignedInOnly` sends the user to Log in with "Your session has expired." and back to the Account page afterwards. |
| 403 | `refresh()` of the current user. A Suspended user is sent to Account Suspended by `RegisteredUserOnly`. A deleted account (a lost 204, or another tab) becomes an expired session, as in section 7. No Retry. |
| 5xx, network error, more than 10 seconds | "Error: Account could not be deleted. Try again." with Retry, which sends the password still in the field again. |

- **Rationale**: Spec User Story 1, the Edge Cases and FR-005, FR-007, FR-008, FR-016. The 401 and 403 rules are the same as in the plan and admin stores.

## 14. Where the password is kept in the browser

- **Decision**: In `useAccountDeletionStore` (`password`), like the login and registration stores keep their fields. It is emptied when the dialog closes, after a wrong password or a lock, after a deletion, and on `reset()` (also called by logout through `clearSignedInData()`). It is never stored in `localStorage`, `sessionStorage` or the URL.
- **Rationale**: AGENTS.md puts form submission state in Zustand stores, and Retry needs the value. Emptying the field on close meets the spec edge case "the next time the dialog opens it is empty".

## 15. Logging

- **Decision**: On success the service writes an Information entry: "Account {UserId} deleted with {PlanCount} saved plans.". The lock caused in the dialog writes the existing Warning text with the account id. An unexpected exception during the deletion is written by `ApiExceptionHandler` (Error), as for every endpoint. Wrong passwords are not logged. No entry contains the email or the password.
- **Rationale**: Spec FR-015 and NFR-006, and the same rules as features 002 and 014.

## 16. Proving all-or-nothing in a test

- **Decision**: `AccountDeletionAtomicityTests` adds a `DbCommandInterceptor` through `WithWebHostBuilder` that throws when the command deletes from `"AspNetUsers"`. The test then checks for a 500 and that the account and all its plans are still there.
- **Rationale**: Spec SC-004 needs a failure part-way through, after the plans were deleted inside the transaction. A real PostgreSQL rollback is the thing to prove, so a fake database would not do.
- **Alternatives considered**: Stopping the database container during the request: slow and unreliable.

## 17. Navigation and route

- **Decision**: "Account" links to `/account`. It is shown with the same rule as "My plans" (`canViewSavedPlans`: a signed-in, Active Registered User), right after it. The route is wrapped in `SignedInOnly` and `RegisteredUserOnly`, as `/plans` is. That gives Log in with return for a visitor, Account Suspended for a Suspended user and Access denied for an Administrator (spec FR-010, FR-011).
- **Rationale**: Reuses the guards and the rule of feature 010.
