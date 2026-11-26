# Implementation Plan: 016-account-deletion

**Branch**: `016-account-deletion` | **Date**: 2026-11-26 | **Spec**: [specs/016-account-deletion/spec.md](spec.md)

**Input**: Feature specification from `/specs/016-account-deletion/spec.md`

## Summary

A signed-in Active Registered User opens a new Account page, selects "Delete account", re-enters their password in a confirmation dialog, and their account and all their saved plans are deleted. They are signed out and land on Home with "✓ Success: Your account has been deleted." (project FR-005, FR-039 account deletion). Wrong passwords share the login lock of feature 002. Suspended users and Administrators cannot delete here.

**Backend**:

- A new `AccountController` with one endpoint, `POST /api/account/delete` with `{ password }`, under the existing `ActiveRegisteredUser` policy ([contract](contracts/account-deletion-api.md)). The request names no account.
- A new `AccountDeletionService`:
  - **Password**: `SignInManager.CheckPasswordSignInAsync(..., lockoutOnFailure: true)`, the same call as Log in, so the lock is shared (research section 4).
  - **Delete**: one transaction. The plans are deleted with `ExecuteDeleteAsync`, then the account with a conditional `ExecuteDeleteAsync` (`Registered User` and `Active`). Anything else rolls back (research section 5).
  - **Log**: an Information entry with the account id and the plan count.
- The controller signs the user out in the same answer (204).
- No migration and no authorization change. Other sessions of the deleted account are already refused, because the handlers re-read the account on every request. New tests prove it (research section 7).

**Frontend**:

- An Account page at `/account` inside `SignedInOnly` and `RegisteredUserOnly`, and "Account" in the navigation after "My plans".
- A new `DeleteAccountDialog` with a password field, using the dialog styles and focus rules of `ConfirmDialog` (research section 10).
- A new `useAccountDeletionStore`, with the pending, field error, lock and technical error states, and Retry.
- After a deletion the session data is cleared through a new shared `clearSignedInData()`, also used by logout (research section 11).

## Technical Context

**Language/Version**: C# on .NET 10 (ASP.NET Core Web API); TypeScript with React 19, built with Vite. Unchanged.

**Primary Dependencies**: Existing only (research section 1).

- Backend: EF Core 10 with Npgsql, ASP.NET Core Identity, AutoMapper.
- Frontend: React, React Router, Zustand.
- Tests: xUnit, `Microsoft.AspNetCore.Mvc.Testing` with Testcontainers PostgreSQL (`PostgreSqlApiFactory`), `TestSignInStartupFilter`, `CapturingLoggerProvider`; Vitest and React Testing Library.

**No new NuGet or npm package.**

**Storage**: PostgreSQL. **No new table, column or migration.** The feature deletes rows in `AspNetUsers` and `SavedPlans`. The existing cascades remove the Identity rows ([data-model.md](data-model.md)).

**Testing**:

- **Backend unit tests** (`backend/tests/SpekLaiku.UnitTests/`):
  - `AccountDeletionValidatorTests`: a missing and an empty password give "Enter your password."; a password of only spaces and a normal one are accepted.
- **Backend integration tests** (`backend/tests/SpekLaiku.IntegrationTests/`, real PostgreSQL):
  - `AccountDeletionEndpointTests`:
    - The correct password gives 204 and a `Set-Cookie` that removes the session cookie.
    - The account row and its two plans are gone. Another user's account and plans are unchanged.
    - An account with no plans is deleted the same way.
    - The next `GET /api/auth/me` on the same client gives 401.
  - `AccountDeletionPasswordTests`:
    - A missing body gives 400 `errors.request`. A missing or empty password gives 400 "Enter your password." and does not change `AccessFailedCount`.
    - A wrong password gives 400 "Password is incorrect.", increases `AccessFailedCount` by 1 and deletes nothing.
    - A password with spaces around it is not trimmed: the right password with a space added is wrong.
    - The fifth wrong password in a row gives 429 and sets `LockoutEnd`. While locked, the correct password gives 429 and nothing is deleted.
    - The lock is shared: four wrong logins and one wrong dialog attempt lock the account; after a dialog lock, `POST /api/auth/login` with the correct password gives 401.
  - `AccountDeletionAuthorizationTests`:
    - A visitor gets 401 with an empty body.
    - A Suspended Registered User, an Active Administrator and a Suspended Administrator get 403, each with the correct password.
    - After every refusal the account and its plans are unchanged and `AccessFailedCount` is 0.
    
    This covers constitution III.
  - `DeletedAccountSessionTests`: two clients signed in to the same account. After one deletes it:
    - The other gets 403 on `GET /api/plans` and `POST /api/account/delete`, and 401 on `GET /api/auth/me`.
    - Login with the old details gives 401 "Incorrect email or password."
    - `POST /api/registration` with the same email gives 201, and the new account's `GET /api/plans` is empty (spec FR-005, FR-006, SC-002, SC-005).
  - `AccountDeletionAtomicityTests`: a `DbCommandInterceptor` that throws on the delete from `"AspNetUsers"` gives 500, and the account and all its plans are still there (spec SC-004, research section 16).
  - `AccountDeletionLogTests`:
    - A deletion writes one Information entry with the id and the plan count and no email.
    - A wrong password writes nothing.
    - The lock writes one Warning with the id only.
- **Frontend tests** (`frontend/src/tests/`):
  - `accountApi.test.ts`:
    - 204, 400 (both messages), 429, 401 and 403 map to their answers; any other status throws `ApiError`.
    - The body is `{ password }`, sent exactly as entered.
  - `useAccountDeletionStore.test.ts`:
    - Open and close. Closing empties the password.
    - An empty password gives the field error without a request.
    - Pending blocks a second submit.
    - Deleted clears the session data (the plan in progress, the current user) and resolves "deleted".
    - Wrong password: the field error, the field emptied, a focus request. The lock message.
    - 401 marks the session ended; 403 refreshes the current user; neither offers Retry.
    - A 500, a network error and the 10-second timeout give the technical error with Retry; Retry sends the same password.
    - `reset`.
  - `AccountPage.test.tsx`:
    - The heading, the tab title, the email and the warning text.
    - The dialog question with the email; focus in the field; Cancel and Escape change nothing and return focus to "Delete account".
    - Confirming navigates Home with the success banner and the visitor navigation.
    - Each error state, the pending text with the field and buttons disabled, and Retry.
  - `topNavigation.test.tsx` (changed): "Account" after "My plans", for an Active Registered User only.
  - `registeredUserOnly.test.tsx` (changed): `/account` as a visitor goes to Log in with return; as a Suspended user, Account Suspended; as an Administrator, Access denied.
  - `accessibility.test.tsx`, `keyboard.test.tsx`, `responsive.test.tsx` (changed):
    - The field label and its linked error, and the skip link.
    - Tab and Shift+Tab stay in the dialog; Enter in the field submits.
    - Full-width field and buttons, and the email wraps at 320 px.
  - `useLogoutStore.test.tsx` (changed): logout still clears the same data through `clearSignedInData()`, and resets the deletion store.

**Target Platform**: Unchanged (an ASP.NET Core API in a Linux container; current desktop and mobile browsers, 320 px and wider).

**Project Type**: Web application (backend API and frontend single-page app).

**Performance Goals**:

- A deletion answers within 1 second: one account read, one password hash check, and two deletes in one transaction.
- Spec SC-001 (under 1 minute) depends on the page, not the server.

**Constraints**:

- Production C# classes stay under 200 lines. `AccountDeletionService` is planned at about 100 lines and `AccountController` at about 70. `Program.cs` (171 lines) gains one registration line.
- `AccountPage.tsx` stays under about 80 lines. The section and the dialog are separate components.
- No external call.
- An email or password is never logged (spec FR-015, NFR-006).

**Scale/Scope**:

- One endpoint, one page, one store, two components, one helper and one navigation item.
- Accounts with any number of plans, deleted in one statement.

**Authorization** (research section 3):

- **Who**: the existing `ActiveRegisteredUser` policy on the controller.
- **Which account**: always the signed-in user's own. The conditional delete re-checks the role and status in the same statement.

**Backend changes** (`backend/src/SpekLaiku.Api/`):

- **Controllers**: `Controllers/AccountController.cs` (new). `Delete` calls the service, maps the result to 204, 400, 403 or 429, and on success calls `SignInManager.SignOutAsync()`.
- **Services**:
  - `Services/AccountDeletionService.cs` (new): `DeleteAsync(principal, request)`. It validates the request, reads the account, checks the password with the lock, runs the transaction and logs.
  - `Services/AccountDeletionValidator.cs` (new): the empty-password rule, with the same wording as `LoginValidator`.
  - `Services/AccountDeletionResult.cs` (new): the result record (data-model.md).
- **DTOs**: `DTOs/Requests/AccountDeletionRequest.cs` (new), `{ Password }`. No response DTO, because 204 has no body.
- **Mapping**: none. There is nothing to return.
- **Program.cs** (changed): registers `AccountDeletionService`.
- **Not changed**: entities, `ApplicationDbContext`, migrations, the authorization policies and handlers, `IdentityOptionsSetup`, `AuthController`, `LoginService`, rate limiting and `ApiExceptionHandler`.

**Frontend changes** (`frontend/src/`):

- **Types**: `types/accountDeletion.ts` (new): `AccountDeletionAnswer`.
- **API**: `api/accountApi.ts` (new): `deleteAccount(password, signal)`.
- **Stores**:
  - New: `stores/useAccountDeletionStore.ts`.
  - Changed: `stores/useLogoutStore.ts`, which uses `clearSignedInData()`.
- **Helpers**: `helpers/clearSignedInData.ts` (new): the list of stores cleared when a session ends on purpose, moved from `useLogoutStore`, plus the deletion store.
- **Components**:
  - New:
    - `components/deleteAccountSection.tsx`: the warning, the "Delete account" button, and focus return.
    - `components/deleteAccountDialog.tsx`: the form, the field, the messages and the focus trap.
  - Changed:
    - `components/topNavigation.tsx`: "Account".
    - `components/appRoutes.tsx`: `/account`.
- **Pages**: `pages/AccountPage.tsx` (new): the title, heading, email and the section.
- **Styles**: `styles.css` (changed): the dialog field at full width, and `overflow-wrap: anywhere` for the email.

**Documentation**:

- `README.md`:
  - **New "Account" section**: the page, deleting an account with the password, the shared lock, the log entry, and that it cannot be undone.
  - **"Testing an Administrator or Suspended account"**: add that test accounts are deleted on the Account page, and that Administrator accounts are not.
- `docs/ux-design.md`:
  - **Screen list**: "Profile" becomes "Account" (email and delete account; profile details later).
  - **Navigation table**: "Account" in place of "Profile (Could Have)".
  - **State table**: an Account row with the confirmation, pending, success, wrong password, lock and server error states.
- `docs/architecture.md`: the 016 row notes the password re-entry and that the administrator deletion of FR-042 is still open.
- **Spec**: changed during planning. The messages next to the field also start with "Error:" (FR-008; research section 9).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID, DRY, KISS, YAGNI | ✓ | One endpoint. The policy, guards, `TextField`, dialog styles, `startTimeout`, `SuccessBanner` and the Identity lock are reused. The session clearing is moved to one shared helper. No grace period, export, profile editing or administrator deletion (spec Scope Boundaries). |
| I. 200-line limit / ~200 for components | ✓ | The service is about 100 lines and the controller about 70. The page is split into a section and a dialog. |
| I. Naming | ✓ | `AccountDeletionService`, `AccountDeletionValidator` and `AccountDeletionResult` each name one responsibility. Page PascalCase, components and helpers camelCase, store `use<Name>Store`. |
| II. Thin controllers | ✓ | One service call, a status mapping, and the sign-out. |
| II. Business rules in services | ✓ | The password rule, the lock, the condition on role and status, the all-or-nothing delete and the log are in `Services/`. |
| II. DbContext directly, no repository | ✓ | `AccountDeletionService` uses `ApplicationDbContext` for the transaction and the deletes, `UserManager` to read the account, and `SignInManager` for the password check. |
| II. Async I/O | ✓ | All database and Identity calls are async. |
| II. DTOs, AutoMapper without rules | ✓ | A request DTO only. No entity is returned, and there is no mapping because the answer has no body. |
| II. Migrations | ✓ | None needed. No schema change. |
| III. Tests, deterministic, fakes | ✓ | Real PostgreSQL; unique emails in the shared database; an interceptor for the failure; no external services. |
| III. Authorization test per protected operation | ✓ | `AccountDeletionAuthorizationTests` covers Visitor, Suspended Registered User, Active and Suspended Administrator. `DeletedAccountSessionTests` covers a session of a deleted account. |
| III. Loading, success, empty, validation-error, server-error states | ✓ | Pending, success, empty field, wrong password, lock and server error are tested in the store and on `AccountPage.test.tsx`. There is no list, so no empty-list state. |
| IV. Identity, server-side authorization, validation | ✓ | Identity checks the password and counts the lock. The policy and the conditional delete are on the server, and the body is validated there. |
| IV. Central error handling, no details leaked | ✓ | Unexpected errors go through `ApiExceptionHandler`. A 403 carries no account data. |
| IV. Secrets and logging | ✓ | The password is only sent in the body, never in a URL, and never logged or returned. Log entries carry the id and a count. A test checks that no email is logged. |
| IV. OWASP | ✓ | **Broken access control**: the policy, no account id in the request, the conditional delete, with tests. **Authentication failures**: password re-entry and the shared lock against guessing. **Injection**: EF Core parameters. **CSRF**: the `SameSite=Lax` session cookie and a JSON `POST`, as the other endpoints, and the password is also required. **Sensitive data exposure**: no account data is returned. |
| V. Version control | ✓ | Feature branch `016-account-deletion` from an updated `main`. |
| VI. Documentation | ✓ | README, `docs/ux-design.md` and `docs/architecture.md` updates are planned. The spec was aligned during planning. |
| VII. AI-assisted development | ✓ | The spec and plan are done before any implementation. |
| VIII. Simplicity, no new dependency | ✓ | No package and no schema change. |
| Accessibility constraint | ✓ | The dialog focus trap with Escape and focus return; a labelled field with a linked error; announced pending and success messages; 320 px layout. |

**Gate result**: PASS. No violations, so Complexity Tracking is empty.

**Post-design re-check**: PASS. The Phase 1 artifacts add nothing that conflicts with the table above. Three deliberate choices are recorded, not violations:

1. The account is deleted with `ExecuteDeleteAsync` instead of `UserManager.DeleteAsync`. This is still EF Core through `ApplicationDbContext`, not custom authentication. It is needed for the condition on role and status, and for the plan count (research section 5).
2. The endpoint is `POST /api/account/delete` instead of `DELETE`, because it carries a password in the body (research section 2).
3. A new dialog component instead of extending `ConfirmDialog`, because the field changes the first focus, the trap and the submit (research section 10).

## Project Structure

### Documentation (this feature)

```text
specs/016-account-deletion/
├── spec.md
├── plan.md                        # This file
├── research.md                    # Phase 0 output
├── data-model.md                  # Phase 1 output
├── quickstart.md                  # Phase 1 output
├── contracts/
│   └── account-deletion-api.md    # Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md                       # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code

```text
backend/
├── src/SpekLaiku.Api/
│   ├── Controllers/
│   │   └── AccountController.cs                 (new)
│   ├── DTOs/
│   │   └── Requests/AccountDeletionRequest.cs   (new)
│   ├── Services/
│   │   ├── AccountDeletionService.cs            (new)
│   │   ├── AccountDeletionValidator.cs          (new)
│   │   └── AccountDeletionResult.cs             (new)
│   └── Program.cs                               (changed)
└── tests/
    ├── SpekLaiku.UnitTests/
    │   └── AccountDeletionValidatorTests.cs     (new)
    └── SpekLaiku.IntegrationTests/
        ├── AccountDeletionEndpointTests.cs      (new)
        ├── AccountDeletionPasswordTests.cs      (new)
        ├── AccountDeletionAuthorizationTests.cs (new)
        ├── DeletedAccountSessionTests.cs        (new)
        ├── AccountDeletionAtomicityTests.cs     (new)
        └── AccountDeletionLogTests.cs           (new)

frontend/src/
├── types/        accountDeletion.ts (new)
├── api/          accountApi.ts (new)
├── stores/       useAccountDeletionStore.ts (new); useLogoutStore.ts (changed)
├── helpers/      clearSignedInData.ts (new)
├── components/   deleteAccountSection.tsx, deleteAccountDialog.tsx (new);
│                 topNavigation.tsx, appRoutes.tsx (changed)
├── pages/        AccountPage.tsx (new)
├── styles.css    (changed)
└── tests/        see "Testing" above

README.md                                        (changed: Account, test accounts)
docs/ux-design.md                                (changed: Account screen, navigation, states)
docs/architecture.md                             (changed: 016 row)
```

**Structure Decision**: The existing web application layout (`backend/` and `frontend/`), as documented in `docs/architecture.md` and `AGENTS.md`. The controller and service follow `AdminAccountsController` and `AdminAccountService` (feature 014). The password check follows `LoginService`. The page follows `MyPlansPage` with the delete confirmation of feature 011.

## Complexity Tracking

No constitution violations. Nothing to justify.
