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
- .NET SDK (latest stable)
- Node.js and npm
- Docker (for the local PostgreSQL database)

## Setup, run and test

Instructions for the database, migrations, backend, frontend and tests will be added as each part of the project is built.

## Development workflow

Every feature is developed in its own branch (for example `001-user-registration`), follows the Spec Kit steps (specification, clarification, plan, tasks, analysis, implementation), and is merged into `main` through a Pull Request. Commit messages follow Conventional Commits.