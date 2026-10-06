# User Registration Quickstart

## Prerequisites

- .NET SDK and current stable ASP.NET Core packages.
- PostgreSQL for the application database.
- An email delivery provider or configured SMTP endpoint.
- Frontend and backend dependencies installed from their manifests.

## Backend Validation

```text
backend/
dotnet restore
dotnet build
dotnet test
```

Run the registration tests and verify that they cover:

1. Valid registration creates a Pending Verification account.
2. Duplicate email handling is case-insensitive.
3. Invalid input produces field-level errors.
4. Verification activates the account.
5. Invalid or expired tokens do not activate the account.
6. Protected operations reject pending users.
7. Email delivery failures do not leave partial accounts.

## Frontend Validation

```text
frontend/
npm ci
npm run lint
npm test
npm run build
```

Verify the registration page, pending-verification state, validation messages, keyboard flow, screen-reader labels, and mobile layout at 320 px.

## End-to-End Validation

1. Register with a valid email and confirm that the account is Pending Verification.
2. Confirm that no protected feature is available before verification.
3. Open the verification link and confirm that the account becomes Active.
4. Confirm that a reused verification link fails.
5. Confirm that duplicate registration reports the specified error.
6. Confirm that the password and verification token never appear in logs or API responses.
