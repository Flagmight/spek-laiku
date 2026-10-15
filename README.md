# Spėk laiku

Activity planning application for families and groups in Lithuania. Users create a list of possible activities (kayaking, cycling, outdoor heritage visits, picnics, indoor activities) and set acceptable weather conditions. The system uses hourly forecasts from Open-Meteo and nearby places from the OpenStreetMap Overpass API to find suitable time slots, and recalculates the plan when the forecast changes.

Status: in development. Implemented so far: user registration (feature `001-user-registration`).

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
- The EF Core command-line tool, for applying migrations: `dotnet tool install --global dotnet-ef`
- Node.js and npm
- PostgreSQL (local or hosted)
- Docker (required to run the backend integration tests, which start PostgreSQL with Testcontainers), or a local PostgreSQL server for those tests as described below

Without Docker, point the integration tests at an existing PostgreSQL server. Each test run creates a throwaway database with a random `speklaiku_test_` name on that server and drops it afterwards. Set the variable once for your Windows user (it takes effect in new terminals):

```powershell
[Environment]::SetEnvironmentVariable("SPEKLAIKU_TEST_POSTGRES", "Host=localhost;Port=5432;Database=postgres;Username=<local-user>;Password=<local-password>", "User")
```

The user needs permission to create databases. When the variable is not set, the tests start PostgreSQL with Testcontainers, as CI does.

## Setup, run and test

### Build and test

Run the backend checks from the repository root, as CI does:

```powershell
dotnet restore .\SpekLaiku.slnx
dotnet build .\SpekLaiku.slnx
dotnet format .\SpekLaiku.slnx --verify-no-changes
dotnet test .\SpekLaiku.slnx
```

Run the frontend checks from `frontend/`:

```powershell
npm ci
npm run lint
npm run format:check
npm test
npm run build
```

On Windows with `core.autocrlf=true`, `npm run format:check` may report files that were checked out with CRLF line endings; Git stores them with LF, so CI is not affected.

### Run the application

1. Set the backend connection string through an environment variable in the terminal you run the backend from. Do not commit local credentials:

   ```powershell
   $env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5432;Database=speklaiku;Username=<local-user>;Password=<local-password>"
   ```

2. Create or update the database by applying the migrations (from the repository root, in the same terminal):

   ```powershell
   dotnet ef database update --project .\backend\src\SpekLaiku.Api
   ```

3. Trust the ASP.NET Core development certificate once per machine. The sign-in cookie is `Secure`, so the API runs over https:

   ```powershell
   dotnet dev-certs https --trust
   ```

4. Start the API with the https profile, which listens on `https://localhost:7254`:

   ```powershell
   dotnet run --project .\backend\src\SpekLaiku.Api --launch-profile https
   ```

5. In a second terminal, start the frontend from `frontend/`:

   ```powershell
   npm ci
   npm run dev
   ```

   Open the address Vite prints (usually `http://localhost:5173`). The Vite dev server forwards every `/api` request to `https://localhost:7254`, so the browser sees one origin and the sign-in cookie works without CORS.

## Development workflow

Every feature is developed in its own branch (for example `001-user-registration`), follows the Spec Kit steps (specification, clarification, plan, tasks, analysis, implementation), and is merged into `main` through a Pull Request. Commit messages follow Conventional Commits.