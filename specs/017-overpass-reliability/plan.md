# Implementation Plan: 017-overpass-reliability

**Branch**: `017-overpass-reliability` | **Date**: 2026-11-24 | **Spec**: [specs/017-overpass-reliability/spec.md](spec.md)

**Input**: Feature specification from `/specs/017-overpass-reliability/spec.md`

## Summary

Make nearby places and schedules survive a failing or slow OpenStreetMap Overpass server. The public server stopped answering on 2026-11-19 and was still not answering on 2026-11-24.

Build order (clarification Q1): **User Story 2 → User Story 4 → User Story 1 → User Story 3**.

1. **Configurable server (User Story 2, P1)**:
   - The address and waiting time of the main map data server, and of an optional fallback, come from a new `MapData` configuration section.
   - With no setting, the API uses `https://overpass-api.de/` as today.
   - Wrong settings stop the API at start-up with a message that names the setting and never shows its value.
   - Plain `http` is accepted only in Development, which is what the local copy needs.
2. **Local copy (User Story 4, P1)**:
   - A PowerShell script, `scripts/local-map-data.ps1`, runs the Overpass API in Docker with Geofabrik's Lithuania extract (214 MB).
   - It loads the data once, then serves on `http://127.0.0.1:12345/` with a 2 GB memory limit while running (clarification Q2).
   - It starts only on its own command (clarification Q3).
   - The README records the measured size, memory and loading time.
   - Plain http also avoids Windows 10's TLS 1.3 problem.
3. **Fallback (User Story 1, P2)**:
   - A new `MapPlacesSearchService` tries the main server, then the fallback, within the same request.
   - Each failed attempt is logged with its role (`main` or `fallback`), never the address.
4. **Deadline (User Story 3, P3)**:
   - Each server waits up to 6 s by default (1 to 8 s allowed).
   - Place and schedule requests end within 9 s of reaching the API, so the browser's 10-second limit always gets an answer.

**No database change, no migration, no frontend change, no new NuGet or npm package.** The only new dependency is the development-only Docker image `wiktorn/overpass-api`, pinned by digest (research section 1).

## Technical Context

**Language/Version**: C# on .NET 10 (ASP.NET Core Web API). Windows PowerShell 5.1 for the script, which is also compatible with PowerShell 7. The TypeScript and React frontend is unchanged.

**Primary Dependencies**: existing only (research section 1):

- `IHttpClientFactory` and the options pattern (`IValidateOptions<T>`, `ValidateOnStart`)
- `TimeProvider`, `IMemoryCache` and `ILogger<T>`
- Development only: Docker 29.8 and the image `wiktorn/overpass-api` (pinned digest), loaded from `https://download.geofabrik.de/europe/lithuania-latest.osm.pbf`.

**Storage**: PostgreSQL unchanged, **no migration**. The configuration lives in `appsettings.json` (defaults) and in environment variables (local values). The local copy's data is in a Docker volume on the developer's machine.

**Testing** (research section 12):

- **Backend unit tests** (`backend/tests/SpekLaiku.UnitTests/`):
  - `MapDataOptionsValidatorTests` (new): every FR-003 rule; http in Development versus Production; the 1 to 8 range; the trailing slash and letter case comparison; no message contains the value.
  - `MapDataOptionsTests` (new): `Servers()` order, roles and times; trailing slash added; a path kept.
  - `RequestDeadlineTests` (new): the time remaining with a moved `FixedTimeProvider`; never below zero.
  - `MapPlacesSearchServiceTests` (new):
    - main succeeds, so the fallback is never called;
    - main fails with each failure kind, so the fallback answers;
    - an empty main answer is a success;
    - both fail, so the last failure is thrown;
    - no fallback configured;
    - attempt time is min(waiting time, time left);
    - under 1 s left, the server is skipped with a warning;
    - a cancelled request is not retried;
    - each server is called at most once.
  - `OverpassMapPlacesClientTests` (changed):
    - sends to the given server's `api/interpreter`, including an address with a path;
    - the query's `[timeout:N]` follows the attempt time (this replaces the old `[timeout:4]` test, as SC-007 allows);
    - the attempt time is enforced;
    - the warning names the role and never the address.
  - Existing tests of `NearbyPlacesService` and the other users of the client: signature updates only.
- **Backend integration tests** (`backend/tests/SpekLaiku.IntegrationTests/`):
  - `FakeMapPlacesClient` gains failure scripting per server role and call counts per role. Its default behaviour is unchanged.
  - `MapDataFallbackTests` (new): steps 3 and 4 with a failing main server and a working fallback (including the "updated at" time); both failing (the existing `503`); main working (fallback not called); warnings with the role.
  - `MapDataConfigurationTests` (new): start-up refuses each kind of wrong setting and names it; the default and a configured main server are used. No test host runs in the Development environment (analysis R1).
  - `MapDataDeadlineTests` (new): the forecast or location lookup uses the time on the test clock; the map data server is not contacted, or gets only what is left.
  - `PlanSetupRateLimitTests` (changed if needed): a refused request makes no map data call.
- **Frontend**: no change, so no new tests. The existing suite must still pass.
- **Manual**: [quickstart.md](quickstart.md) Part 2, including the measured figures of the local copy.

**Target Platform**:

- The API runs on any host with .NET 10, unchanged.
- The local copy needs Docker. It was measured on Windows 10 Home with WSL 2, 8 GB RAM and Docker 29.8.

**Project Type**: Web application (ASP.NET Core API and React SPA); this feature changes only the backend, the documentation and a developer script.

**Performance Goals**:

- Place and schedule requests end within 9 s of reaching the API (FR-007, SC-002).
- A main server that answers within 6 s is used (SC-003).

**Constraints**:

- The browser's 10-second limit is unchanged.
- At most one attempt per server per request.
- No automatic retries.
- The local copy uses at most 2 GB while serving; its first load may use more.
- The local copy is reachable only from the developer's machine (bound to `127.0.0.1`) and from the `speklaiku-dev` Docker network.

**Scale/Scope**:

- 15 production C# files (7 new, 8 changed), each under 200 lines.
- `Program.cs` (172 lines) gets shorter: the registration moves to `AddMapData`.
- One PowerShell script.
- Documentation updates in the README and `docs/architecture.md`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | How this plan meets it |
|---|---|---|
| I. Code Quality | PASS | Small single-purpose classes: options, validator, deadline, search service, server record. Every class stays under 200 lines. The registration moves out of `Program.cs`. Names describe their job (`MapPlacesSearchService`, `RequestDeadline`); none is a Manager or Helper. |
| II. Architecture | PASS | The fallback order and deadline rules are in a service (`Services/MapPlacesSearchService`). The HTTP call stays in `Clients/OverpassMapPlacesClient`. Everything comes through DI. Everything is async. The browser still never calls Overpass. No controller, DTO or mapping change. |
| III. Testing | PASS | Unit and integration tests for every rule (Testing above). Deadline tests use `FixedTimeProvider`. Overpass is always faked, and no test uses the live service or the local copy (FR-017). No existing test is weakened: the one asserting `[timeout:4]` is replaced because FR-008 replaces that rule (SC-007). No new protected operation, so no new authorization test; the existing place and schedule authorization tests still apply. |
| IV. Security | PASS | Addresses come only from configuration, never from a request (FR-004), which prevents request forgery to other servers. `http` is allowed only in Development; production stays on HTTPS. Start-up messages and logs never contain an address, so a credential in an address never leaks. No user identity, position or tags are logged. The local copy is published on `127.0.0.1` only. Failures still go through `ApiExceptionHandler`. |
| V. Version Control | PASS | Branch `017-overpass-reliability` from an updated `main`. Commits in logical steps, one or more per story in build order. The PR follows the template, with AI review. |
| VI. Documentation | PASS | README: map data settings, the local copy section with measured figures, Windows 10 note, deployment notes. `docs/architecture.md`: `scripts/` and the configurable map data server. Row 017 is already added (FR-018). No local values are committed. |
| VII. AI-Assisted Development | PASS | The spec is clarified (3 answers); this plan, then tasks and analysis, come before any code. |
| VIII. Simplicity | PASS | No resilience library. One loop over at most two servers. The deadline is a tiny value type passed as an argument, not middleware. One script instead of Compose plus a script. No background updates for the local copy. The Docker image is justified in research section 1 and pinned by digest for reproducibility. |
| External data constraint | PASS | Place data still comes from the OpenStreetMap Overpass API: the local copy runs the same software with real OpenStreetMap data. When every server fails, the error is shown and no old places are shown (NFR-007). The local copy's snapshot is development-only. Its README section states the data date (shown by `status`) and how to refresh it. "Places updated at" shows when places were received, as before. |
| Repository structure | PASS | The new top-level `scripts/` folder is added to the repository structure in `docs/architecture.md` in the same branch. |

**Post-design re-check (after Phase 1)**: PASS. The data model and contracts add no endpoint, entity, migration or package. No exception to the constitution is needed, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/017-overpass-reliability/
├── spec.md              # Clarified 2026-11-24
├── plan.md              # This file
├── research.md          # Phase 0: decisions 1–13
├── data-model.md        # Phase 1: options, server, deadline, attempt rules, log record, Docker objects
├── quickstart.md        # Phase 1: automated checks and manual walkthrough in build order
├── contracts/
│   ├── map-data-configuration.md   # Settings, start-up messages, timing, log records
│   └── local-map-data-script.md    # Script commands, fixed values, readiness check
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 (/speckit-tasks; not created by this command)
```

### Source Code (repository root)

```text
backend/src/SpekLaiku.Api/
├── Program.cs                          # CHANGED: the map data registration becomes builder.Services.AddMapData(...)
├── appsettings.json                    # CHANGED: "MapData" section with the defaults (no local values)
├── Clients/
│   ├── IMapPlacesClient.cs             # CHANGED: FindAsync(server, timeout, …)
│   ├── OverpassMapPlacesClient.cs      # CHANGED: absolute address per server, attempt timeout, role in the warning
│   ├── OverpassQuery.cs                # CHANGED: [timeout:N] from the attempt time
│   ├── ExternalServiceJson.cs          # CHANGED: optional server role in the failure warning
│   ├── MapDataServer.cs                # NEW: address, role, waiting time
│   ├── MapDataServerRole.cs            # NEW: Main, Fallback
│   └── MapDataRegistration.cs          # NEW: AddMapData (options, validator, HTTP client, search service)
└── Services/
    ├── MapDataOptions.cs               # NEW: the MapData settings
    ├── MapDataOptionsValidator.cs      # NEW: start-up checks (FR-003)
    ├── RequestDeadline.cs              # NEW: 9-second deadline
    ├── MapPlacesSearchService.cs       # NEW: main then fallback within the deadline
    ├── NearbyPlacesService.cs          # CHANGED: uses MapPlacesSearchService, takes the deadline
    ├── PlanPlacesService.cs            # CHANGED: starts the deadline
    └── PlanScheduleService.cs          # CHANGED: starts the deadline

backend/tests/SpekLaiku.UnitTests/
├── MapDataOptionsValidatorTests.cs     # NEW
├── MapDataOptionsTests.cs              # NEW: Servers() and address normalisation
├── RequestDeadlineTests.cs             # NEW
├── MapPlacesSearchServiceTests.cs      # NEW
├── OverpassMapPlacesClientTests.cs     # CHANGED
├── RecordingMapPlacesClient.cs         # CHANGED: new signature
└── (existing NearbyPlacesService tests) # CHANGED: new signature only

backend/tests/SpekLaiku.IntegrationTests/
├── FakeMapPlacesClient.cs              # CHANGED: per-role scripting and counts
├── FakeForecastClient.cs               # CHANGED: optional BeforeAnswer hook (moves the clock)
├── FakeGeocodingClient.cs              # CHANGED: optional BeforeAnswer hook (moves the clock)
├── PlanPlacesFailureTests.cs           # CHANGED: builds the real client without a base address
├── PlanSetupRateLimitTests.cs          # CHANGED if needed: a refused request makes no map data call
├── MapDataFallbackTests.cs             # NEW
├── MapDataConfigurationTests.cs        # NEW
└── MapDataDeadlineTests.cs             # NEW

scripts/
└── local-map-data.ps1                  # NEW: start | status | stop | remove | refresh

README.md                               # CHANGED: settings, local copy, Windows 10, deployment notes
docs/architecture.md                    # CHANGED: scripts/ folder, map data server settings (row 017 already added)
```

**Structure Decision**:

- The existing web application layout is kept. Backend changes stay in `Clients/` (HTTP) and `Services/` (rules), as AGENTS.md requires.
- The one new top-level folder is `scripts/`, for developer scripts. It is documented in `docs/architecture.md`.
- No frontend file changes.

## Build order and phases (input for /speckit-tasks)

1. **Setup**: confirm the branch and run the baseline checks.
   - **Foundational**: `MapDataServer`, `MapDataServerRole`, the new client signature (`server`, `timeout`), the attempt timeout and the role in the warning, and the test fakes.
   - The places still go to the public server with 4 s, so behaviour is unchanged.
2. **User Story 2 (P1), configurable server**:
   - `MapDataOptions`, the validator, `MapDataServer`, `MapDataServerRole` and `AddMapData`.
   - The client sends to the configured main server.
   - Configuration and validator tests.
   - The README settings section.
   - At this point the API can already be pointed at another server, with the 4-second wait still in place.
3. **User Story 4 (P1), local copy**:
   - The script, its first real run on the development machine with the figures measured, and the README section.
   - `docs/architecture.md` gains `scripts/`.
   - Hands-on check with quickstart Part 2 section 2. This unblocks the pending manual checks of features 011 and 012.
4. **User Story 1 (P2), fallback**:
   - `MapPlacesSearchService`, the new client signature and the role in the warning.
   - Fake client roles, then unit and integration tests.
5. **User Story 3 (P3), waiting time and deadline**:
   - `RequestDeadline`, the attempt time and the `[timeout:N]` change; the 6-second defaults.
   - The deadline started in both services.
   - The timing tests.
6. **Polish**: full checks (quickstart Part 1), the README review, the walkthrough, code and security review, and the PR.

Story 3 comes last, so the waiting-time defaults stay at today's 4 seconds until step 5 raises them to 6 (data-model.md shows the final values).

- Between steps 2 and 4, a single server with 4 s behaves as today.
- Between steps 4 and 5, a configured fallback can make one request take longer than the browser's 10 seconds (up to 5 s location + 4 s main + 4 s fallback). The browser then shows its own timeout error.
- That gap exists only on the feature branch, and only with a fallback configured. The default configuration has none. Step 5 closes it before the PR.

## Complexity Tracking

No constitution violations. Nothing to justify.
