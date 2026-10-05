# Spėk laiku Constitution

This constitution defines the stable, project-wide engineering principles for "Spėk laiku", a weather-aware activity planning application built with ASP.NET Core and React. It applies to every feature. It does not describe any individual feature; features are described in their own specifications under `specs/`.

## Core Principles

### I. Code Quality
- Code MUST follow SOLID, DRY, KISS and YAGNI. Duplicated business rules MUST be moved to one shared implementation.
- A production C# class MUST NOT exceed 200 lines (generated migration designer files are excluded). React pages and components SHOULD stay below about 200 lines and MUST be split when they hold more than one responsibility.
- Methods SHOULD be small and named after the action they perform. Deep nesting SHOULD be reduced with guard clauses and early returns.
- Names MUST describe responsibility. Generic names such as Manager, Helper, Processor, Utils or Data MUST NOT be used unless they describe a narrowly defined concept.
- .NET code MUST follow normal .NET naming conventions. React page files MUST use PascalCase, component and helper files camelCase, and hook files MUST start with `use`.
- Formatting and static analysis (`.editorconfig`, .NET analyzers, ESLint, Prettier) MUST pass. Warnings MUST be investigated, not hidden.

### II. Application Architecture
- Controllers MUST stay thin. They handle only HTTP concerns, the authenticated user, DTO translation and calling an application service.
- Business rules, calculations, reusable validation and database queries MUST be implemented in application services, never in controllers, in the database itself (for example stored procedures or triggers with logic), or in frontend components.
- Services MUST use `ApplicationDbContext` directly. Custom repository or unit-of-work layers over Entity Framework Core MUST NOT be created.
- Dependencies (DbContext, ILogger, IMapper, HTTP clients, clock) MUST be provided through dependency injection. Services MUST NOT create infrastructure dependencies with `new`.
- Calls to external services (Open-Meteo, OpenStreetMap Overpass) MUST go through dedicated client classes in the backend. The browser MUST NOT call them directly.
- I/O operations MUST be asynchronous. Blocking calls MUST NOT be used on request paths.
- Entities MUST NOT be returned from public API endpoints. API input MUST use request DTOs and output MUST use response DTOs. Non-trivial mapping MUST use AutoMapper, and mapping configuration MUST NOT contain business rules.
- Every database schema change MUST be an Entity Framework Core migration committed in the same branch. Merged migrations MUST NOT be deleted or rewritten without a written justification.
- Frontend API communication MUST be centralized in the API layer. Pages are route-level screens; reusable interface parts belong in components.

### III. Testing (NON-NEGOTIABLE)
- Every feature MUST include automated backend tests for its business logic and API behaviour, and automated frontend tests for its relevant screens.
- Every protected operation MUST have an authorization test, including a test that one user cannot change another user's data.
- Tests MUST be deterministic. They MUST NOT depend on production data, the current time without control, or the live Open-Meteo and Overpass services; external services MUST be replaced with fake responses.
- Test names MUST describe the behaviour and the scenario.
- Relevant screens MUST implement and test loading, success, empty, validation-error and server-error states.
- A failing CI check is a real failure. Tests MUST NOT be disabled, deleted or weakened to make a build pass.

### IV. Security
- Authentication and user management MUST use ASP.NET Core Identity. Custom password hashing, homemade authentication or custom cryptography MUST NOT be implemented.
- Every protected operation MUST enforce authorization on the backend, including ownership and role checks. Hiding a frontend control is not authorization.
- All untrusted input MUST be validated on the server, even when the frontend also validates it.
- Passwords, tokens, API keys, production credentials and real connection strings MUST NOT be committed to Git or written to logs.
- Production traffic MUST use HTTPS, and CORS MUST be limited to the required origins.
- Expected failures MUST be handled in one central place. Stack traces and database error details MUST NOT be shown to users.
- Backend logging MUST use `ILogger<T>`. `Console.WriteLine` MUST NOT be used for logging.
- Security work MUST consider the applicable OWASP risks, especially broken access control, injection, security misconfiguration and vulnerable dependencies.

### V. Version Control
- Every Spec Kit feature MUST be implemented in its own branch, created from an updated `main` and not from another unfinished feature branch. Unrelated features MUST NOT share a branch.
- Every significant feature MUST enter `main` through a Pull Request that references the feature specification, summarizes the change, lists the tests performed, mentions migrations, and includes screenshots for UI changes.
- Commit messages MUST follow Conventional Commits (`type(scope): description`). Commits MUST be logical steps; a whole feature MUST NOT appear as one final commit.
- The diff MUST be reviewed before every commit and before the Pull Request. Debug code, temporary files, unrelated formatting changes and secrets MUST NOT be committed.
- A Pull Request MUST NOT be merged while required checks fail or while review findings block correctness, security or specification compliance. Merged feature branches MUST be deleted.

### VI. Documentation
- Code MUST correspond to an approved specification. New behaviour found during implementation MUST be added to the specification, and to the requirements when affected, before the feature is complete.
- The README MUST stay current with the purpose, prerequisites, local setup, backend and frontend startup, database setup, migrations, test commands, required configuration and deployment information.
- Documentation changes MUST be part of the same Pull Request as the code that makes them necessary.
- Configuration MUST be environment-specific. Local settings and secrets MUST NOT be committed.

### VII. AI-Assisted Development
- A feature MUST have its own approved specification, plan and tasks before AI-generated implementation begins. AI MUST NOT be asked to generate the complete application at once.
- The student is responsible for all AI output. AI-generated changes MUST be inspected, understood, cleaned of debug code and secrets, and verified by build and tests before they are committed.
- Every Pull Request MUST receive a separate AI-assisted review after implementation. The review tool, important findings, changes made and findings not applied (with a short reason) MUST be recorded in the Pull Request. AI suggestions MUST NOT be accepted blindly.
- `AGENTS.md` MUST contain practical instructions for AI agents and MUST reference this constitution instead of copying it.

### VIII. Simplicity and Maintainability
- The simplest design that satisfies the approved specification MUST be preferred. Unnecessary layers, patterns, generic base classes, message buses and abstractions MUST NOT be added without a concrete need.
- Features or extension points MUST NOT be implemented because they might be useful later.
- A new dependency (NuGet or npm package) MUST be justified by a concrete need written in the feature's technical plan. Stable releases MUST be preferred, and a suggestion from an AI assistant is not a justification.
- The repository MUST stay reproducible: a fresh clone MUST build, run and pass tests by following the README.

## Additional Constraints

- **Technology baseline:** the backend uses the latest stable .NET and ASP.NET Core, Entity Framework Core and PostgreSQL. The frontend uses React with TypeScript. Preview versions MUST NOT be used.
- **External data:** weather data MUST come from Open-Meteo and place data from the OpenStreetMap Overpass API. When a service is unavailable, the application MUST report the error and MUST NOT display invented or outdated data as current.
- **Accessibility:** interactive controls MUST have meaningful labels, important actions SHOULD be keyboard accessible, and validation errors MUST NOT be communicated by colour alone.
- **Repository structure:** source code, tests, specifications, documentation, workflows and configuration MUST stay in their own directories as documented in the architecture documentation.

## Development Workflow and Quality Gates

- Each significant feature MUST follow this order: specification, clarification, technical plan, tasks, consistency analysis, implementation, verification, Pull Request with AI review.
- A feature is done only when: the specification, plan and tasks are satisfied; the build, tests and linters pass; authorization tests exist for protected operations; migrations and documentation are committed; no secrets are present; the diff was reviewed; the Pull Request records the AI review; and the CI checks are green.
- CI MUST run on Pull Requests: backend restore, build and tests, and frontend install, lint, test and build.

## Governance

- This constitution takes precedence over other practices in this repository. Where the General Project Rules and this constitution differ, the stricter rule applies.
- **Amendments:** the constitution MAY be changed only through a Pull Request that states the reason for the change and updates the version and the Last Amended date. Dependent files (`AGENTS.md`, templates) MUST be updated in the same Pull Request when affected.
- **Versioning:** the version uses MAJOR.MINOR.PATCH. MAJOR is for removing or redefining a principle, MINOR for adding a principle or section or materially extending one, and PATCH for clarifications and wording fixes.
- **Compliance:** every Pull Request MUST be checked against this constitution by the author and by the AI-assisted review. The consistency analysis before implementation MUST report any conflict between a plan or task list and this constitution.
- **Exceptions:** an exception is allowed only when a rule cannot reasonably be met, and MUST be written in the feature's technical plan with the rule, the reason, the smallest possible scope and the date, before implementation. Exceptions MUST NOT be made for secrets handling, backend authorization or server-side validation.
- Runtime guidance for AI agents is in `AGENTS.md`.

**Version**: 1.0.0 | **Ratified**: 2026-10-05 | **Last Amended**: 2026-10-05
