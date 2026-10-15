# User Registration Quickstart

## Prerequisites

- .NET SDK and current stable ASP.NET Core packages.
- PostgreSQL for the application database.
- Docker, for the Testcontainers PostgreSQL database used by the integration tests. Without Docker, set `SPEKLAIKU_TEST_POSTGRES` to a connection string for an existing PostgreSQL server (see `README.md`).
- Frontend and backend dependencies installed from their manifests.

## Backend Validation

Run these from the repository root, where `SpekLaiku.slnx` is, as CI does:

```powershell
dotnet restore .\SpekLaiku.slnx
dotnet build .\SpekLaiku.slnx
dotnet format .\SpekLaiku.slnx --verify-no-changes
dotnet test .\SpekLaiku.slnx
```

Run the registration tests and verify that they cover:

1. Valid registration creates an Active Registered User account.
2. Duplicate email handling is case-insensitive.
3. Invalid input produces field-level errors.
4. A password shorter than 8 characters is rejected, and a long password (for example 200 characters) is accepted.
5. Account-creation failures do not leave partial accounts.
6. Two simultaneous registrations with the same email create exactly one account (Testcontainers PostgreSQL).
7. `GET /api/auth/me` returns 200 for a signed-in user and 401 otherwise.
8. A registration request from a signed-in user returns 403 and creates no account.

## Frontend Validation

Run these from `frontend/`:

```powershell
npm ci
npm run lint
npm test
npm run build
```

Verify the registration page, validation messages, keyboard flow, screen-reader labels, and mobile layout at 320 px.

## Running Locally

Start the API with the https profile (`dotnet run --project backend/src/SpekLaiku.Api --launch-profile https`) and the frontend with `npm run dev` in `frontend/`. Open the Vite address; API calls go through the `/api` proxy.

## End-to-End Validation

1. Register with a valid email and confirm that "Creating your account…" appears while waiting, the account is created as an Active Registered User, you are signed in, and the home page shows "✓ Success: Account created." until you dismiss it.
2. Reload the page and confirm that opening the registration page still sends you to the home page.
3. Set the browser window to 320 px wide and confirm that there is no horizontal scrolling, every button and link is at least 44 × 44 px, and input text is at least 16 px. This is the real size check; the automated tests only check the CSS rules.
4. Confirm that duplicate registration reports the specified error.
5. Confirm that the password never appears in logs or API responses.
