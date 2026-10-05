# AGENTS.md

Practical instructions for AI coding agents working in this repository ("Spėk laiku", a weather-aware activity planning application).

## Required references

- Follow the project constitution in `.specify/memory/constitution.md`. It defines the principles (architecture, testing, security, version control, documentation, AI use, simplicity). This file does not repeat them.
- Follow the General Project Rules where the constitution refers to them.
- Work only from an approved feature specification in `specs/`. If something is unclear or missing, ask, and update the specification before implementing.

## Project map

- `backend/src/SpekLaiku.Api/`: ASP.NET Core Web API.
  - `Controllers/`: thin HTTP endpoints.
  - `Services/`: application services where all business rules live.
  - `Clients/`: HTTP clients for Open-Meteo (forecast, geocoding) and Overpass.
  - `DTOs/Requests/`, `DTOs/Responses/`: API boundary types.
  - `Mapping/`: AutoMapper profiles.
  - `Entities/`, `Data/`, `Migrations/`: database model, `ApplicationDbContext` and EF Core migrations.
- `backend/tests/SpekLaiku.UnitTests/`, `backend/tests/SpekLaiku.IntegrationTests/`: backend tests.
- `frontend/src/`: React and TypeScript app (`pages/`, `components/`, `hooks/`, `helpers/`, `api/`, `types/`, `tests/`).
- `specs/`: Spec Kit feature folders, for example `specs/001-user-registration/` with `spec.md`, `plan.md` and `tasks.md`.
- `docs/`: requirements, UX design (flows and wireframes) and architecture.
- `.specify/`: Spec Kit files and the constitution.
- `.github/workflows/`: CI.

## Common commands

Backend (run from `backend/`):
- `dotnet restore`
- `dotnet build`
- `dotnet test`
- `dotnet format --verify-no-changes`
- Add a migration: `dotnet ef migrations add <DescriptiveName> --project src/SpekLaiku.Api`

Frontend (run from `frontend/`):
- `npm ci` (or `npm install` when dependencies change)
- `npm run lint`
- `npm test`
- `npm run build`

Database (once `docker-compose.yml` exists): `docker compose up -d` starts the local PostgreSQL database.

Some commands only work after the backend and frontend projects have been created by an approved task.

## Feature workflow

1. Start from an updated `main` and create a branch named after the feature, for example `001-user-registration`.
2. Use the feature's `spec.md`, `plan.md` and `tasks.md` in `specs/<feature>/`. Implement only the tasks in the list, in order.
3. Write or update tests together with the code. Include an authorization test for each protected operation.
4. Update the README or `docs/` when setup, behaviour or structure changes.
5. Commit in small logical steps with Conventional Commit messages (for example `feat(auth): add user registration`).

## Verifying your work

Before suggesting a commit or a Pull Request:
- Review `git diff` and confirm that only intended files changed.
- Run the backend build and tests and the frontend lint, tests and build.
- Remove debug code, temporary files and commented-out code.
- Confirm the tasks and acceptance scenarios in the specification are satisfied.
- Summarize what changed, which tests were run and any migrations added.

## Do not edit or commit

- Secrets and local settings: `.env*`, `appsettings.Development.json`, `appsettings.Local.json`, API keys, real connection strings.
- Build output and dependencies: `bin/`, `obj/`, `node_modules/`, `dist/`, `coverage/`.
- Merged EF Core migrations (create a new migration instead) and generated `*.Designer.cs` files.
- Files in `.specify/` and the Spec Kit agent files, unless the task is explicitly about the workflow.
- The constitution, unless the task is an approved constitution amendment.

## Repository conventions

- React files: pages in PascalCase (`PlanSetupPage.tsx`), components and helpers in camelCase (`planCard.tsx`, `formatDate.ts`), hooks start with `use` (`usePlans.ts`).
- Pages never call `fetch` directly; use the API client in `frontend/src/api/`.
- New business rules go in a service in `Services/`. New external API calls go in a client in `Clients/`.
- Return DTOs from controllers, never entities. Add mappings in `Mapping/`.
- Tests that touch Open-Meteo or Overpass use fake responses, never the live services.
- Keep each production C# class under 200 lines; split it by responsibility.

## Actions an agent must not perform

- Do not generate the whole application in one step, or implement anything outside the active specification.
- Do not add a NuGet or npm package unless the feature's technical plan justifies it.
- Do not commit to `main`, force-push, rewrite history or merge Pull Requests.
- Do not disable, delete or weaken tests, linters or CI checks to make them pass.
- Do not run commands that delete data or the database without explicit approval.
