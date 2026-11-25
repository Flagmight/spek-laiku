# Implementation Plan: 014-admin-accounts

**Branch**: `014-admin-accounts` | **Date**: 2026-11-25 | **Spec**: [specs/014-admin-accounts/spec.md](spec.md)

**Input**: Feature specification from `/specs/014-admin-accounts/spec.md`

## Summary

An Active Administrator can see the user accounts, find one by email, suspend a Registered User account after a confirmation, and reactivate it (project FR-029, FR-031, FR-039 account suspension, FR-041, FR-042 reactivation). Administrator accounts cannot be changed here, and passwords are never shown. Account deletion is left for after the MVP.

**Backend**:

- A new `AdminAccountsController` under the existing `ActiveAdministrator` policy, with two endpoints:
  - `GET /api/admin/accounts?search=` lists accounts, newest first, at most 50, with `hasMore`.
  - `PUT /api/admin/accounts/{id}/status` sets `Active` or `Suspended` ([contract](contracts/admin-accounts-api.md)).
- A new `AdminAccountService`:
  - **Change**: the role check and the status change are one conditional `ExecuteUpdateAsync`. It also sets a new `ConcurrencyStamp`, so an overlapping Identity update cannot write the old status back (research section 3).
  - **Log**: an Information entry with the account ids for each change.
- No migration and no authorization change. The existing handlers already read the status from the database on every request, so a suspension applies on the user's next request. New tests prove it (research section 4).

**Frontend**:

- A User accounts page at `/admin/users` inside `AdministratorOnly`, and "Users" in the navigation.
- A table on desktop and cards at 320 px.
- An email search.
- Suspend with the existing `ConfirmDialog`, and Reactivate.
- Announced pending, success and error messages with Retry.
- Focus moves to the account's new button after a change.

## Technical Context

**Language/Version**: C# on .NET 10 (ASP.NET Core Web API); TypeScript with React 19, built with Vite. Unchanged.

**Primary Dependencies**: Existing only (research section 1).

- Backend: EF Core 10 with Npgsql, ASP.NET Core Identity, AutoMapper.
- Frontend: React, React Router, Zustand.
- Tests: xUnit, `Microsoft.AspNetCore.Mvc.Testing` with Testcontainers PostgreSQL (`PostgreSqlApiFactory`), `TestSignInStartupFilter`; Vitest and React Testing Library.

**No new NuGet or npm package.**

**Storage**: PostgreSQL. **No new table, column or migration.** The feature reads `AspNetUsers` and writes only `AccountStatus` and `ConcurrencyStamp` ([data-model.md](data-model.md)).

**Testing**:

- **Backend unit tests** (`backend/tests/SpekLaiku.UnitTests/`):
  - `AdminAccountSearchTests`: trimming; an empty text; exactly 256 characters accepted; 257 refused with the message.
  - `AdminAccountMappingTests`: `AdminAccountSummary` maps the five fields; `AccountStatus` as `"Active"` or `"Suspended"`; the serialized JSON has exactly the five properties and no `passwordHash`, `securityStamp`, `concurrencyStamp` or lockout field (spec FR-011, SC-004).
- **Backend integration tests** (`backend/tests/SpekLaiku.IntegrationTests/`, real PostgreSQL):
  - `AdminAccountsListEndpointTests`:
    - Newest registration first, ties broken by id.
    - A search matches any part of the email in any letter case, and trims spaces.
    - `_` and `%` are matched literally.
    - 51 matching accounts give 50 and `hasMore: true`; exactly 50 give `hasMore: false`.
    - No match gives an empty list.
    - 257 characters give 400 with `errors.search`.
    - Administrator accounts are listed.
  - `AdminAccountStatusEndpointTests`:
    - Suspend and reactivate give 200 with the account, and the row's status changes.
    - A repeat gives 200 with no change and no log entry.
    - An unknown id gives 404 "This account no longer exists.".
    - An Administrator account, Active or Suspended, and the caller's own account give 409, unchanged.
    - A missing or invalid `accountStatus` gives 400.
    - The email, role, registration date and password hash are unchanged after a change.
    - The `ConcurrencyStamp` changes.
    - A stale Identity update made after the suspension fails and does not reactivate the account (research section 3).
  - `AccountSuspensionEffectTests`:
    - A signed-in Registered User with saved plans is suspended through the endpoint. Their next `GET /api/plans` and `POST /api/plan-setup/check` give 403, and `GET /api/auth/me` says `Suspended`.
    - After reactivation, `GET /api/plans` gives 200 with the same plans: same ids, names, `savedAt` and snapshot (spec SC-002, SC-005).
  - `AdminAccountsAuthorizationTests`: for both endpoints:
    - A visitor gets 401 with an empty body.
    - An Active Registered User, a Suspended Registered User and a Suspended Administrator get 403 with no account data.
    - The target account is unchanged after every refused `PUT`.
    
    This covers constitution III.
  - `AdminAccountLogTests`:
    - A change writes one Information entry with both ids and neither email.
    - A repeat writes none.
    
    Captured with a test logger provider added through `WithWebHostBuilder`.
  - `PostgreSqlApiFactory` (changed): `CreateUserAsync` gains optional `email` and `registrationDate` parameters (research section 14).
- **Frontend tests** (`frontend/src/tests/`):
  - `adminAccountsApi.test.ts`:
    - **List**: 200, 400 search error; 401 and 403 throw `ApiError`.
    - **Status**: 200, 400, 404, 409, 401, 403; any other status throws.
    - The search is URL-encoded.
  - `useAdminAccountsStore.test.ts`:
    - Loading, loaded, error, and the 10-second timeout.
    - Retry.
    - The latest search wins: an older answer is ignored and the older request is aborted.
    - `replace` updates one row.
    - `reset`.
  - `useAccountStatusStore.test.ts`:
    - Pending blocks a second change.
    - Suspend and reactivate success messages.
    - 404 and 409 messages, which load the list again.
    - Server error, timeout and Retry.
    - 401 and 403 refresh the current user.
  - `UserAccountsPage.test.tsx`:
    - The heading, the tab title and the table columns.
    - The buttons only on Registered User accounts, with names that include the email.
    - The dialog text; Cancel and Escape change nothing and return focus.
    - Confirming announces success and moves focus to Reactivate; Reactivate has no dialog.
    - The pending messages, with every button disabled.
    - The error with Retry.
    - The search, no match with Clear search, the 256-character error and the `hasMore` notice.
    - Loading, load error with Retry.
  - `topNavigation.test.tsx` (changed): "Users" after "Categories", for an Active Administrator only.
  - `administratorOnly.test.tsx` (changed): `/admin/users` as a visitor goes to Log in; as a Registered User, Access denied; as a Suspended user, Account Suspended.
  - `accessibility.test.tsx`, `keyboard.test.tsx`, `responsive.test.tsx` (changed): the page's labels and skip link; the dialog by keyboard; cards with no horizontal scrolling at 320 px and full-width buttons.
  - `useLogoutStore.test.tsx` (changed): logout resets the account stores.

**Target Platform**: Unchanged (an ASP.NET Core API in a Linux container; current desktop and mobile browsers, 320 px and wider).

**Project Type**: Web application (backend API and frontend single-page app).

**Performance Goals**:

- The list and a search answer within 1 second for a few hundred accounts: one query on `AspNetUsers` with `LIMIT 51` and five columns.
- A status change answers within 1 second: one update and one read.
- Spec SC-001 (find and suspend in under 1 minute) depends on the page, not the server.

**Constraints**:

- Production C# classes stay under 200 lines. `AdminAccountService` is planned at about 110 lines and `AdminAccountsController` at about 80. `Program.cs` (170 lines) gains one registration line.
- `UserAccountsPage.tsx` stays under about 150 lines. The list, search and status button are separate components.
- No external call (spec Assumptions).
- An email is never logged (spec FR-021).

**Scale/Scope**:

- A few hundred accounts (spec Assumptions); at most 50 per answer.
- Two endpoints, one page, two stores, three components and one navigation item.

**Authorization** (research sections 2, 4 and 7):

- **Who**: the existing `ActiveAdministrator` policy on the whole controller.
- **Which accounts**: the "Registered User accounts only" rule is in `AdminAccountService`, checked in the same statement as the change.

**Backend changes** (`backend/src/SpekLaiku.Api/`):

- **Controllers**: `Controllers/AdminAccountsController.cs` (new). `List` and `SetStatus` map service results to 200, 400, 404 and 409, using the same `FieldErrors` style as `AdminCategoriesController`.
- **Services**:
  - `Services/AdminAccountService.cs` (new): `ListAsync(search)`, which projects the five columns, and `SetStatusAsync(administratorId, accountId, status)`, which updates and logs.
  - `Services/AdminAccountSearch.cs` (new): validates the search text.
  - `Services/AccountStatusChange.cs` (new): the result record.
  - `Services/AdminAccountSummary.cs` (new): the five values of one account, with `AccountStatus` as the enum. The list query projects to it, and `SetStatusAsync` returns it (data-model.md).
  - `Services/AdminAccountListing.cs` (new): the summaries and `HasMore`, returned by `ListAsync`.
- **DTOs**:
  - `DTOs/Requests/AccountStatusRequest.cs` (new).
  - `DTOs/Responses/AdminAccountResponse.cs` (new).
  - `DTOs/Responses/AdminAccountListResponse.cs` (new).
- **Mapping**: `Mapping/AdminAccountMappingProfile.cs` (new): `AdminAccountSummary` → `AdminAccountResponse` and `AdminAccountListing` → `AdminAccountListResponse`, member by member, in memory. `AccountStatus` becomes its name there, never inside the database query.
- **Program.cs** (changed): registers `AdminAccountService`.
- **Not changed**: entities, `ApplicationDbContext`, migrations, the authorization policies and handlers, `AuthController`, rate limiting and `ApiExceptionHandler`.

**Frontend changes** (`frontend/src/`):

- **Types**: `types/adminAccount.ts` (new).
- **API**: `api/adminAccountsApi.ts` (new): `listAccounts(search, signal)` and `setAccountStatus(id, status, signal)`, each returning a typed outcome.
- **Stores**:
  - New: `stores/useAdminAccountsStore.ts` and `stores/useAccountStatusStore.ts`.
  - Changed: `stores/useLogoutStore.ts`, which resets both.
- **Helpers**: `helpers/formatSavedAt.ts` (changed): `formatRegistrationDate`, a date only, in Lithuanian time (research section 13).
- **Components**:
  - New:
    - `components/accountList.tsx`: the table and cards, and the button refs for focus.
    - `components/accountSearchForm.tsx`: the field, Search, Clear search and the error.
    - `components/accountStatusButton.tsx`: Suspend with the `ConfirmDialog`, or Reactivate.
  - Changed:
    - `components/topNavigation.tsx`: "Users".
    - `components/appRoutes.tsx`: `/admin/users`.
- **Pages**: `pages/UserAccountsPage.tsx` (new): the title, heading, message region, search, list, `hasMore` notice and empty state.
- **Styles**: `styles.css` (changed): the `accounts` table, using the `saved-plans` rules for cards at 320 px, and the status words.

**Documentation**:

- `README.md`:
  - **New "User accounts" section**: the page, suspend and reactivate, the log entries, and that Administrator accounts are still managed in the database.
  - **"Testing an Administrator or Suspended account"**: suspending and reactivating a Registered User is now done on the page; the SQL stays for Administrator accounts.
- `docs/ux-design.md`:
  - **Admin: User Accounts row**: delete comes after the MVP.
  - **State table**: gains Loading, Server error, Success, Pending and "Administrator account".
- **Spec**: changed during planning. The registration date is shown in Lithuanian time (Assumptions; research section 13).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID, DRY, KISS, YAGNI | ✓ | One status endpoint for both changes. The dialog, guards, table and card styles and timeout helper are reused. No paging, history, reasons or deletion (spec Scope Boundaries). |
| I. 200-line limit / ~200 for components | ✓ | The service is about 110 lines and the controller about 80. The page is split into three components. |
| I. Naming | ✓ | `AdminAccountService`, `AdminAccountSearch`, `AccountStatusChange` each name one responsibility. Page PascalCase, components and helpers camelCase, stores `use<Name>Store`. |
| II. Thin controllers | ✓ | Each action calls one service method and maps its result. |
| II. Business rules in services | ✓ | The search rules, the Registered-User-only rule, idempotence and logging are in `Services/`. The page only shows the server's answer and hides buttons for convenience. |
| II. DbContext directly, no repository | ✓ | `AdminAccountService` uses `ApplicationDbContext` for the projection and `ExecuteUpdateAsync`, and `UserManager` only for `NormalizeEmail`. |
| II. Async I/O | ✓ | All database calls are async. |
| II. DTOs, AutoMapper without rules | ✓ | `ApplicationUser` is never returned. The profile maps five members by name. |
| II. Migrations | ✓ | None needed. No schema change. |
| III. Tests, deterministic, fakes | ✓ | Real PostgreSQL; unique email markers in the shared database; explicit registration dates for order tests; no external services. |
| III. Authorization test per protected operation | ✓ | `AdminAccountsAuthorizationTests` covers both endpoints for Visitor, Active and Suspended Registered Users and a Suspended Administrator. `AdminAccountStatusEndpointTests` covers Administrator targets, including oneself. |
| III. Loading, success, empty, validation-error, server-error states | ✓ | All five are tested on `UserAccountsPage.test.tsx` and in both stores. |
| IV. Identity, server-side authorization, validation | ✓ | Identity accounts. The policy is on the server, the target role check is in the same statement as the change, and the search and status are validated on the server. |
| IV. Central error handling, no details leaked | ✓ | Unexpected errors go through `ApiExceptionHandler`. A 403 carries no account data, and a 409 or 404 carries only its fixed message. |
| IV. Secrets and logging | ✓ | No password, hash or stamp is read for display or returned (an exact-property test). Log entries carry ids only, and a test checks that no email is logged. |
| IV. OWASP | ✓ | **Broken access control**: the policy plus the target role rule, with tests. **Injection**: EF Core parameters; `Contains` becomes `LIKE` with a parameter in which EF Core escapes `%` and `_`, so the text is matched literally (research section 5). **CSRF**: the `SameSite=Lax` session cookie and the JSON `PUT`, as the other admin endpoints. **Sensitive data exposure**: five fields only. |
| V. Version control | ✓ | Feature branch `014-admin-accounts` from an updated `main`. |
| VI. Documentation | ✓ | README and `docs/ux-design.md` updates are planned. The spec was aligned during planning. |
| VII. AI-assisted development | ✓ | The spec and plan are done before any implementation. |
| VIII. Simplicity, no new dependency | ✓ | No package and no schema change. |
| Accessibility constraint | ✓ | The dialog focus trap with Escape and focus return; buttons named with the email; status as a word; announced messages; errors next to the field; 320 px cards. |

**Gate result**: PASS. No violations, so Complexity Tracking is empty.

**Post-design re-check**: PASS. The Phase 1 artifacts add nothing that conflicts with the table above. Two deliberate choices are recorded, not violations:

1. The service writes the status with `ExecuteUpdateAsync` instead of `UserManager.UpdateAsync`. This is still EF Core through `ApplicationDbContext`, not custom authentication or cryptography (constitution IV). It is needed for the atomic role check and the concurrency stamp (research section 3).
2. A refused Administrator target answers 409, not 403, so that the browser does not mistake it for its own session changing (research section 7).

## Project Structure

### Documentation (this feature)

```text
specs/014-admin-accounts/
├── spec.md
├── plan.md                     # This file
├── research.md                 # Phase 0 output
├── data-model.md               # Phase 1 output
├── quickstart.md               # Phase 1 output
├── contracts/
│   └── admin-accounts-api.md   # Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md                    # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code

```text
backend/
├── src/SpekLaiku.Api/
│   ├── Controllers/
│   │   └── AdminAccountsController.cs          (new)
│   ├── DTOs/
│   │   ├── Requests/AccountStatusRequest.cs    (new)
│   │   └── Responses/
│   │       ├── AdminAccountResponse.cs         (new)
│   │       └── AdminAccountListResponse.cs     (new)
│   ├── Mapping/
│   │   └── AdminAccountMappingProfile.cs       (new)
│   ├── Services/
│   │   ├── AdminAccountService.cs              (new)
│   │   ├── AdminAccountSearch.cs               (new)
│   │   ├── AdminAccountSummary.cs              (new)
│   │   ├── AdminAccountListing.cs              (new)
│   │   └── AccountStatusChange.cs              (new)
│   └── Program.cs                              (changed)
└── tests/
    ├── SpekLaiku.UnitTests/
    │   ├── AdminAccountSearchTests.cs          (new)
    │   └── AdminAccountMappingTests.cs         (new)
    └── SpekLaiku.IntegrationTests/
        ├── AdminAccountsListEndpointTests.cs   (new)
        ├── AdminAccountStatusEndpointTests.cs  (new)
        ├── AccountSuspensionEffectTests.cs     (new)
        ├── AdminAccountsAuthorizationTests.cs  (new)
        ├── AdminAccountLogTests.cs             (new)
        └── PostgreSqlApiFactory.cs             (changed)

frontend/src/
├── types/        adminAccount.ts (new)
├── api/          adminAccountsApi.ts (new)
├── stores/       useAdminAccountsStore.ts, useAccountStatusStore.ts (new); useLogoutStore.ts (changed)
├── helpers/      formatSavedAt.ts (changed)
├── components/   accountList.tsx, accountSearchForm.tsx, accountStatusButton.tsx (new);
│                 topNavigation.tsx, appRoutes.tsx (changed)
├── pages/        UserAccountsPage.tsx (new)
├── styles.css    (changed)
└── tests/        see "Testing" above

README.md                                       (changed: User accounts, test accounts)
docs/ux-design.md                               (changed: Admin: User Accounts notes and states)
```

**Structure Decision**: The existing web application layout (`backend/` and `frontend/`), as documented in `docs/architecture.md` and `AGENTS.md`. The controller follows `AdminCategoriesController`. The service and result follow `ActivityCategoryService` and `SavedPlanChange`. The page follows `ActivityCategoriesPage` and the My plans row actions (feature 011).

## Complexity Tracking

No constitution violations. Nothing to justify.
