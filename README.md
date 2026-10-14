# Spėk laiku

Activity planning application for families and groups in Lithuania. Users create a list of possible activities (kayaking, cycling, outdoor heritage visits, picnics, indoor activities) and set acceptable weather conditions. The system uses hourly forecasts from Open-Meteo and nearby places from the OpenStreetMap Overpass API to find suitable time slots, and recalculates the plan when the forecast changes.

Status: in development.

## Technology

- Backend: ASP.NET Core Web API, Entity Framework Core, PostgreSQL, ASP.NET Core Identity
- Frontend: React with TypeScript
- External APIs: Open-Meteo (weather), OpenStreetMap Overpass (places)
- Development process: Spec Kit (spec-driven development) with GitHub Copilot

## Repository structure

- `backend/`: API and backend tests
- `frontend/`: React application
- `docs/`: requirements, UX design and architecture documents
- `specs/`: feature specifications, plans and task lists
- `.specify/`: Spec Kit files and the project constitution
- `AGENTS.md`: instructions for AI coding agents

## Prerequisites

- Git
- .NET 10 SDK
- Node.js and npm
- PostgreSQL (local or hosted)
- Docker (required to run the backend integration tests, which start PostgreSQL with Testcontainers)

## Setup, run and test

Configure the backend connection string through an environment variable; do not commit local credentials:

```powershell
$env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5432;Database=speklaiku;Username=<local-user>;Password=<local-password>"
```

Run the backend from the repository root:

```powershell
dotnet restore .\SpekLaiku.slnx
dotnet build .\SpekLaiku.slnx
dotnet format .\SpekLaiku.slnx --verify-no-changes
dotnet test .\SpekLaiku.slnx
dotnet run --project .\backend\src\SpekLaiku.Api
```

Run the frontend from `frontend/`:

```powershell
npm ci
npm run dev
npm run lint
npm run format:check
npm test
npm run build
```

## Development workflow

Every feature is developed in its own branch (for example `001-user-registration`), follows the Spec Kit steps (specification, clarification, plan, tasks, analysis, implementation), and is merged into `main` through a Pull Request. Commit messages follow Conventional Commits.