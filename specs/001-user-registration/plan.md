# Implementation Plan: 001-user-registration

**Branch**: `001-user-registration` | **Date**: 2026-10-06 | **Spec**: [specs/001-user-registration/spec.md](specs/001-user-registration/spec.md)

**Input**: Feature specification from `/specs/001-user-registration/spec.md`

## Summary

Create a registration flow that accepts and validates an email and password, creates a Pending Verification Registered User, sends an email confirmation link, activates the account only after successful verification, and blocks protected access until activation. The implementation will use ASP.NET Core Identity, PostgreSQL, EF Core, a provider-neutral email sender abstraction, and the existing React/TypeScript frontend structure.

## Technical Context

**Language/Version**: C#/.NET latest stable, TypeScript/React, ASP.NET Core Identity, EF Core, PostgreSQL

**Primary Dependencies**: ASP.NET Core Identity, EF Core, PostgreSQL, React/TypeScript, an asynchronous email provider selected for production

**Storage**: PostgreSQL through ApplicationDbContext; persisted account status and Identity user records

**Testing**: xUnit and integration tests for backend behavior; Jest or the repository's configured frontend test runner; deterministic fake email sender and test database

**Target Platform**: Web application targeting the repository's supported browser and server environments

**Project Type**: Full-stack web application

**Performance Goals**: Registration and verification must complete within the one-minute success target; no additional throughput target is specified

**Constraints**: Server-side validation, password and token secrecy, case-insensitive uniqueness, no partial accounts, pending authorization, accessibility and 320 px layout requirements

**Scale/Scope**: Initial registration feature; no production user-volume target is specified

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- PASS: Uses ASP.NET Core Identity for authentication and user management.
- PASS: Keeps controllers thin and places business rules in application services.
- PASS: Uses ApplicationDbContext directly and requires an EF Core migration for the status change.
- PASS: Uses dependency injection for services and infrastructure dependencies.
- PASS: Uses asynchronous I/O for email delivery.
- PASS: Keeps entities out of public API responses and uses DTOs with mapping.
- PASS: Adds automated backend and frontend tests, including authorization tests for protected operations.
- PASS: Uses deterministic tests and fake external email delivery.
- PASS: Uses the repository's existing backend and frontend directory structure; no unnecessary abstractions or dependencies are planned.
- PASS: Email delivery provider selection will be documented before implementation because the current repository has no production mail configuration.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/SpekLaiku.Api/
│   ├── Clients/              # Email delivery provider implementation
│   ├── Controllers/          # Registration and verification endpoints
│   ├── Data/                 # ApplicationDbContext and Identity configuration
│   ├── DTOs/
│   │   ├── Requests/          # Registration and verification request DTOs
│   │   └── Responses/         # Registration and verification response DTOs
│   ├── Entities/             # ApplicationUser and account status
│   ├── Mapping/              # DTO mappings
│   └── Services/             # Registration and verification business rules
└── tests/
    ├── SpekLaiku.UnitTests/   # Service and authorization tests
    └── SpekLaiku.IntegrationTests/ # API and database tests

frontend/
└── src/
    ├── api/                   # Registration API client
    ├── components/            # Registration and verification UI components
    ├── hooks/                 # Registration state hooks
    ├── pages/                 # Registration and pending-verification pages
    ├── helpers/               # Validation helpers
    └── tests/                 # UI tests
```

**Structure Decision**: Use the repository's existing backend and frontend conventions. No new top-level project or dependency layer is added unless required by the selected production email provider.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
