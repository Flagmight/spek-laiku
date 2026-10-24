# Implementation Plan: 001-user-registration

**Branch**: `001-user-registration` | **Date**: 2026-10-06 | **Spec**: [specs/001-user-registration/spec.md](specs/001-user-registration/spec.md)

**Input**: Feature specification from `/specs/001-user-registration/spec.md`

## Summary

Create a registration flow that accepts and validates an email and password and creates an Active Registered User. Email confirmation is out of scope for this feature. The implementation will use ASP.NET Core Identity, PostgreSQL, EF Core, and the existing React/TypeScript frontend structure.

## Technical Context

**Language/Version**: C# on .NET 10 (ASP.NET Core Web API); TypeScript with React 19, built with Vite

**Primary Dependencies**: Backend: ASP.NET Core Identity with EF Core stores, EF Core with the Npgsql PostgreSQL provider, AutoMapper. Frontend: React, React Router, Zustand. Quality: .NET analyzers and `dotnet format`, ESLint, Prettier. Tests: xUnit, Microsoft.AspNetCore.Mvc.Testing, Vitest, React Testing Library, jsdom. Test-only: Testcontainers for PostgreSQL (`Testcontainers.PostgreSql`) in `SpekLaiku.IntegrationTests`.

**Authentication**: ASP.NET Core Identity cookie with `SignInManager`. The cookie is HttpOnly, Secure and SameSite=Lax, with a 30-minute sliding expiration (project NFR-016). Registration signs the new user in. The frontend reads the signed-in state from `GET /api/auth/me`, which feature 002 will reuse.

**Frontend state**: Zustand (project requirement, added 2026-10-24). `frontend/src/stores/useCurrentUserStore.ts` holds the signed-in state (`loading`, `signedIn`, `signedOut`, `error`), the user and `refresh()`, and replaces the React context `CurrentUserProvider`. `main.tsx` starts the first load before rendering, and only the most recent request may update the store. `frontend/src/stores/useRegistrationStore.ts` holds the registration status, the field errors, `submit`, `retry` and `reset`, and replaces `useRegistration`. The double-submit guard (FR-013) reads the store's current status synchronously, so a second click in the same render is still ignored. `RegisterPage` calls `reset()` when it unmounts, which aborts a pending request and clears the status and errors, so the next visit starts idle. Typed form values stay in component state in `registrationForm.tsx`, because only the form reads them. Tests reset both stores after each test in `frontend/src/tests/setup.ts`.

**Identity user options**: The email is used as the user name, so `options.User.AllowedUserNameCharacters` is set to an empty string. This turns off Identity's user-name character check, so every email the service accepts (spec FR-003) can be stored. `RequireUniqueEmail` stays `true`; a duplicate reported by Identity as `DuplicateEmail` or `DuplicateUserName` is treated like a duplicate found by the database index.

**Origins**: In development the Vite dev server proxies `/api` to the API (`https://localhost:7254`), so the browser sees one origin and the sign-in cookie works with SameSite=Lax and no CORS policy. In production the frontend and the API are served from the same origin, so no CORS policy is registered. If they are ever deployed on different origins, a CORS policy that allows only the frontend origin, with credentials, must be added in the same change.

**Routing**: React Router in `frontend/src/main.tsx` with two routes: `/` (`HomePage.tsx`, a minimal placeholder that shows the FR-008 banner) and `/register` (`RegisterPage.tsx`). Both share a layout with the "Skip to main content" link (first focusable item), the top navigation, the banner area and a `<main>` element that the skip link targets. Each page sets its browser tab title ("Register - Spėk laiku", "Home - Spėk laiku") through a small hook, `frontend/src/hooks/usePageTitle.ts`, and has exactly one `<h1>` (FR-021, NFR-014). After registration the page navigates to `/` and passes the banner message as router state; a signed-in user who opens `/register` is redirected to `/`.

**Error responses**: Problem details (`application/problem+json`), matching the existing `InvalidModelStateResponseFactory` and `ApiExceptionHandler`. Validation errors and duplicates return `400` with `errors` keyed by `email`, `password` and `passwordConfirmation`, one message per field, all failing fields at once. Technical failures return `500`, and the already-signed-in guard returns `403`. The request DTO fields are nullable so that empty or missing values reach the service and get the FR-010 messages instead of the generic "Invalid value." from model validation. API messages have no prefix; the frontend adds "Error: " before every error message it shows (FR-019). The frontend shows "Error: Something went wrong. Try again." with a Retry button for any `5xx`, network error or timeout (FR-015); after such a failure the entered values are kept and Retry sends the same request again. Password fields are cleared only after a validation failure (FR-011). When more than one field fails, the page also shows an error summary at the top of the form with a link to each field (FR-020). Details are in `contracts/registration-api.md`.

**Storage**: PostgreSQL through ApplicationDbContext; persisted account status and Identity user records. The role is stored as a string property `Role` on `ApplicationUser` (value "Registered User" or "Administrator"), not as Identity roles, because this feature only needs to record the role and never checks it. A later feature that authorizes by role may switch to Identity roles with a migration.

**Testing**: xUnit and integration tests for backend behavior; Vitest for frontend tests; ESLint and Prettier for frontend quality checks. The concurrent-registration test runs against a real PostgreSQL database started by Testcontainers, because the EF Core in-memory provider does not enforce unique indexes. On a developer machine without Docker, setting `SPEKLAIKU_TEST_POSTGRES` to a connection string for an existing PostgreSQL server makes the fixture create and drop a throwaway database on that server instead; CI always uses Testcontainers. Frontend tests run in jsdom, so they check the CSS rules for the 320 px layout and touch-target sizes; the real size check is a manual quickstart step at 320 px.

**Target Platform**: Web application targeting the repository's supported browser and server environments

**Project Type**: Full-stack web application

**Performance Goals**: Registration must complete within the one-minute success target; no additional throughput target is specified

**Constraints**: Server-side validation, password secrecy, password minimum length of 8 with no maximum, case-insensitive uniqueness, no partial accounts, accessibility and 320 px layout requirements

**Scale/Scope**: Initial registration feature; no production user-volume target is specified

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- PASS: Uses ASP.NET Core Identity for authentication and user management.
- PASS: Keeps controllers thin and places business rules in application services.
- PASS: Uses ApplicationDbContext directly and requires an EF Core migration for the status change.
- PASS: Uses dependency injection for services and infrastructure dependencies.
- PASS: Uses asynchronous I/O for database operations.
- PASS: Keeps entities out of public API responses and uses DTOs with mapping.
- PASS: Adds automated backend and frontend tests, including authorization tests for protected operations.
- PASS: Uses deterministic tests; this feature calls no external services.
- PASS: Uses the repository's existing backend and frontend directory structure; no unnecessary abstractions or dependencies are planned. The SendGrid package and email-sender code added earlier for email confirmation are no longer needed and are removed by task T013A.
- PASS: New dependency justified (constitution VIII): `Testcontainers.PostgreSql` (test project only, latest stable release) is needed because FR-013 and SC-003 require proving that two simultaneous registrations create one account, and only a real PostgreSQL database enforces the unique email index. It needs Docker locally and in CI; GitHub-hosted Ubuntu runners provide Docker.
- PASS: New dependency justified (constitution VIII): `zustand` (frontend, latest stable release) is a project requirement (`docs/requirements.md`, Constraints) for shared and form submission state. The signed-in state is read by the navigation, the route guard and the register page, and a store removes the context provider that every render and test had to wrap.
- PASS: The new `GET /api/auth/me` endpoint returns a response DTO, never the entity, and has an authorization test for signed-in and signed-out requests.
- PASS: CORS (constitution IV): no cross-origin access is enabled; the frontend reaches the API through the same origin (the Vite proxy in development).

## Project Structure

### Documentation (this feature)

```text
specs/001-user-registration/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Technical decisions
├── data-model.md        # User Account data model
├── quickstart.md        # Validation steps
├── contracts/
│   └── registration-api.md  # Registration and current-user API contract
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
backend/
├── src/SpekLaiku.Api/
│   ├── Controllers/          # Registration and current-user (/api/auth/me) endpoints
│   ├── Data/                 # ApplicationDbContext and Identity configuration
│   ├── DTOs/
│   │   ├── Requests/          # Registration request DTO
│   │   └── Responses/         # Registration and current-user response DTOs
│   ├── Entities/             # ApplicationUser and account status
│   ├── Mapping/              # DTO mappings
│   └── Services/             # Registration business rules
└── tests/
    ├── SpekLaiku.UnitTests/   # Service and authorization tests
    └── SpekLaiku.IntegrationTests/ # API and database tests, including the Testcontainers PostgreSQL fixture

frontend/
└── src/
    ├── api/                   # Registration API client
    ├── components/            # registrationForm.tsx, the error summary, the shared layout with the skip link, the top navigation and the success banner
    ├── hooks/                 # usePageTitle
    ├── stores/                # Zustand stores: useCurrentUserStore and useRegistrationStore
    ├── pages/                 # HomePage.tsx (placeholder) and RegisterPage.tsx
    ├── helpers/               # Validation helpers and formatErrorMessage
    └── tests/                 # UI tests
```

**Structure Decision**: Use the repository's existing backend and frontend conventions. No new top-level project or dependency layer is added.

## Complexity Tracking

None. The Constitution Check has no violations to justify.
