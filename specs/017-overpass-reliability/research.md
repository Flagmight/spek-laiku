# Research: Map Data Service Reliability

**Feature**: `017-overpass-reliability` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

Each section records a decision, why it was chosen, and the alternatives that were considered. Section numbers are referenced from `plan.md`, `data-model.md` and the contracts.

## 1. Dependencies

- **Decision**: no new NuGet or npm package. The backend uses what it already has: `IHttpClientFactory`, the options pattern with `IValidateOptions<T>` and `ValidateOnStart`, `TimeProvider` and `ILogger<T>`. The tests use xUnit, the existing `FixedTimeProvider`, `CapturingLoggerProvider`, fake HTTP handlers and `FakeMapPlacesClient`.
- **New development-only dependency**: the Docker image `wiktorn/overpass-api` (Docker Hub, the most widely used Overpass API image; only the `latest` tag is published). It is used only by the local copy script (User Story 4). It is not a NuGet or npm package, and it is not needed to build, test or run CI (spec FR-017). The script pins the image by its digest, so every developer gets the same image (constitution VIII, reproducible repository). The digest is read with `docker pull` and `docker inspect` when the script is written and recorded in the script; updating it is a deliberate change.
- **Map data source**: the public Geofabrik extract `https://download.geofabrik.de/europe/lithuania-latest.osm.pbf` (214 MB on 2026-11-24, updated daily, ODbL 1.0, no user metadata).
- **Alternatives considered**:
  - `Microsoft.Extensions.TimeProvider.Testing` (`FakeTimeProvider`) for the deadline tests. Rejected: the deadline only reads the current time, which the existing `FixedTimeProvider` already controls (section 4).
  - Polly or `Microsoft.Extensions.Http.Resilience` for the fallback and timeouts. Rejected: the spec forbids automatic retries (FR-014) and needs a shared deadline that those packages do not model. One loop over at most two servers is simpler (constitution VIII).
  - Building our own Overpass image from source. Rejected: much more work, and the image above already supports loading an extract.

## 2. Configuration: the `MapData` section

- **Decision**: a new options class `MapDataOptions` bound to the configuration section `MapData`, next to the existing `Places` and `Forecast` sections:

  | Setting | Default | Meaning |
  |---|---|---|
  | `MapData:MainServer` | `https://overpass-api.de/` | Address of the main map data server (FR-001). |
  | `MapData:MainTimeoutSeconds` | `6` | Waiting time for the main server (FR-006). |
  | `MapData:FallbackServer` | empty (no fallback) | Address of the optional fallback server (FR-002). |
  | `MapData:FallbackTimeoutSeconds` | `6` | Waiting time for the fallback server (FR-006). |

  The defaults are written in `appsettings.json` (empty `FallbackServer`) and in the class, so the API behaves as today with no setting at all (SC-007). Local values go into environment variables such as `MapData__MainServer`, or into the ignored `appsettings.Development.json`, never into a committed file (FR-005, constitution VI).
- **Address form**: an address is the server's root, and the client adds `api/interpreter`, as it does today. Mirrors that serve the API under a path are given with that path, for example `https://example.org/overpass/`. A missing trailing slash is added when the options are read, so `http://localhost:12345` and `http://localhost:12345/` mean the same thing and `new Uri(address, "api/interpreter")` never drops a path segment.
- **Validation at start-up** (FR-003): a `MapDataOptionsValidator : IValidateOptions<MapDataOptions>` gets `IHostEnvironment` through dependency injection and is registered with `ValidateOnStart()`, so a wrong setting stops the API before it accepts any request. It returns one message per wrong setting. Each message names the setting and the rule, never the value, so an address with a user name or password in it is never printed:
  - `MapData:MainServer must be an absolute http or https address.` (and the same for `FallbackServer` when it is not empty)
  - `MapData:MainServer may use http only in the Development environment.` (and the same for `FallbackServer`)
  - `MapData:FallbackServer must not be the same as MapData:MainServer.` Compared after adding the trailing slash, ignoring letter case.
  - `MapData:MainTimeoutSeconds must be 1 to 8.` (and the same for `FallbackTimeoutSeconds`)
- **"http" only in Development** (spec User Story 2 scenario 4): `IHostEnvironment.IsDevelopment()`. The integration tests run in the `Testing` environment with the https default, so they are not affected. The Windows 10 API container in the README already sets `ASPNETCORE_ENVIRONMENT=Development`.
- **Alternatives considered**:
  - `OptionsBuilder.Validate(func, message)` as `PlacesOptions` does. Rejected: it gives one fixed message, but FR-003 needs the message to name the wrong setting, and the http rule needs the environment.
  - Settings in seconds as decimals. Rejected: whole seconds are enough for the 1 to 8 range and match `Places` and `Forecast`.
  - Addresses that include `api/interpreter`. Rejected: today's constant is the root address, and a root is what operators copy from mirror lists.

## 3. Waiting time defaults and range

- **Decision**: 6 seconds per server by default, allowed range 1 to 8 seconds (FR-006). The values are the spec's informed defaults. 8 is the most a single server can use within the 9-second deadline when the location and forecast are reused.
- **Rationale**: feature 009 found 4 seconds too short for the busy public server. Anything above 8 could never be used in full.

## 4. The request deadline

- **Decision**: a small class `RequestDeadline` in `Services/` with:
  - `Limit = 9 seconds` and `ShortestAttempt = 1 second`, as constants (the spec fixes both; they are not settings).
  - `static RequestDeadline Start(ForecastPeriod clock)`, which notes `clock.GetNow()`.
  - `TimeSpan Remaining`, the time left before start + 9 s, never below zero.
- **Where it starts**: on the first line of `PlanPlacesService.GetAsync` (step 3) and `PlanScheduleService.GetAsync` (step 4). That is before the plan re-check (which includes the location lookup), the forecast and the places, so everything FR-007 lists is inside the deadline. The time between the request reaching the server and that line is routing, the rate limiter and authorization, which take milliseconds. The 1-second gap between 9 s and the browser's 10 s covers it.
- **Clock**: `ForecastPeriod.GetNow()`, the application's controlled clock. It reads the registered `TimeProvider`, and services already use it for "now".
  - The unit tests build `ForecastPeriod` with `FixedTimeProvider` and move `UtcNow`. The integration factory replaces only `ForecastPeriod` with its `Clock` (Identity and cookies keep the real clock), so the deadline follows `factory.Clock` there too.
  - Every deadline rule is therefore tested without waiting (constitution III).
- **Only map data attempts are cut by the deadline.** The location lookup (5 s timeout) and the forecast (4 s timeout) keep their own timeouts. If they use up the time, the map data server is not contacted and the request fails as a map data failure (FR-007). This keeps features 004 and 006 unchanged.
  - Worst cases on step 3 (the location lookup is not reused): 5 s for the location, then at most 4 s for the map data, which ends within 9 s.
  - Worst cases on step 4 (neither reused): 5 s for the location and 4 s for the forecast leave 0 s, so the map data is not contacted. The map data error is returned a few milliseconds after 9 s, still well before the browser's 10 s (spec FR-007, Assumptions "Waiting times").
- **Alternatives considered**:
  - A middleware that starts the deadline when the request arrives. Rejected: it would run for every request and needs a request-scoped holder, which is more moving parts for milliseconds of accuracy.
  - One `CancellationToken` that cancels everything at 9 s. Rejected: a cancelled location or forecast call would surface as a cancellation (a general error), not the map data error the spec requires, and the existing clients would need changes.
  - `TimeProvider.GetTimestamp()` (a monotonic clock). Rejected for now: `FixedTimeProvider` controls only `GetUtcNow()`, and a wall-clock jump during a 9-second request is negligible here.

## 5. Time for each attempt

- **Decision**: each attempt gets `min(server waiting time, deadline.Remaining)`. When that is under `ShortestAttempt` (1 s), the server is not contacted (FR-007).
  - The client enforces the time with a `CancellationTokenSource` linked to the request's token and `CancelAfter(time)`. When that source fires but the request itself was not cancelled, the client throws `ExternalServiceException(MapData, Timeout)` after its one warning.
  - The Overpass query's own `[timeout:N]` is the attempt time in whole seconds, rounded down and at least 1, so the server also stops working on an abandoned query.
  - The typed `HttpClient` keeps a fixed `Timeout` of 10 seconds as a backstop only.
- **Examples** (fallback configured, both 6 s):
  - The main server answers 502 after 0.3 s, with the location reused. The fallback gets min(6, 8.7) = 6 s.
  - The main server is silent. It gets 6 s. The fallback gets min(6, 3) = 3 s.
  - The location lookup took 5 s and the main server is silent. Main gets 4 s and the fallback gets 0 s, so it is not contacted.
- **Alternatives considered**:
  - One `HttpClient` per server with `HttpClient.Timeout` set to its waiting time. Rejected: `Timeout` is fixed per client, but the time left changes per request.
  - Changing `ExternalServiceJson` so that it maps the linked cancellation to `Timeout`. Rejected: the client can do it itself (it knows its own source fired), so the shared helper used by the Open-Meteo clients is not touched beyond the log text in section 8.

## 6. Where the fallback lives

- **Decision**: a new application service, `MapPlacesSearchService` (`Services/`), holds the order of servers and the deadline rules. `NearbyPlacesService` calls it instead of `IMapPlacesClient`.
  - It builds the list of servers from `MapDataOptions`: main, then the fallback when one is configured.
  - For each server it works out the attempt time (section 5) and calls `IMapPlacesClient.FindAsync` with the server and the time. The first successful answer is returned, including an answer with no elements (FR-010).
  - It catches only `ExternalServiceException` for `ExternalService.MapData` and moves on to the next server (FR-009). Every other exception, including a cancelled request, passes through unchanged.
  - When no server answered, it throws the last failure, so `ApiExceptionHandler` returns the existing map data `503` (FR-012). When no server could be contacted at all, it throws `ExternalServiceException(MapData, Timeout)`.
  - Each server is called at most once per request (FR-014).
- **`IMapPlacesClient` changes**: `FindAsync` gains two leading parameters, `MapDataServer server` (address and role) and `TimeSpan timeout`. The client stays a thin HTTP wrapper with no fallback logic, as AGENTS.md requires (rules in `Services/`, external calls in `Clients/`).
- **Reuse is unchanged**: `NearbyPlacesService` still caches per location, radius and tags. Places from either server are stored and reused the same way, and the browser is never told which server answered (FR-011).
- **Alternatives considered**:
  - The fallback inside `OverpassMapPlacesClient`. Rejected: it would put a business rule in a client and make the order and deadline rules hard to test with the existing fakes.
  - Two keyed `IMapPlacesClient` registrations ("main", "fallback"). Rejected: more DI machinery for the same result, and the per-call time is still needed.
  - A decorator around `IMapPlacesClient`. Rejected: the deadline would still have to be passed through, and a plain service is easier to read.

## 7. What counts as a failure

- **Fallback is tried** when the main server times out, cannot be reached, answers with a non-success status, sends an unreadable or incomplete answer, or answers 200 with an Overpass "runtime error" remark. These are all cases where the client already throws `ExternalServiceException(MapData, …)` today (feature 007 research).
- **Fallback is not tried**:
  - The main server answers with no matching places. That is a success (FR-010, edge case).
  - The user's request is cancelled, for example the browser gave up (`OperationCanceledException` with the request token cancelled). Nothing more is sent.
  - The request is refused by the application's own rate limiter. The limiter runs before the controller, so no server is contacted and nothing is logged as a server failure (FR-013).
- **All or nothing** stays as in feature 007: one query covers every category, so a failure covers every category, and the fallback is asked for all of them.

## 8. Failure records with the server role

- **Decision**: the existing single warning per failure gains the server role. `ExternalServiceJson.PostFormAsync` and `ExternalServiceJson.Failure` get an optional `string? server` argument:
  - With it, the template is `"{Service} failed: {FailureKind} {StatusCode} on the {Server} server"`, for example "Map data service failed: UnexpectedStatus 502 on the main server".
  - Without it (the Open-Meteo clients), the template stays exactly as today.
  - The role is `main` or `fallback`. The address is never logged, so a credential in an address can never reach the log (FR-003, constitution IV). Position, radius and tags stay out of the log as before.
- **No time left**: when `MapPlacesSearchService` skips a server because less than 1 second is left, it logs one warning, "Map data service not contacted: no time left for the {Server} server". That warning is not counted as a failed attempt, because no attempt was made.
- **Who reviews it**: these warnings are the failure records that feature 015 (Service Status and Error Log) will show. No database change is needed (spec Assumptions).
- **Alternatives considered**: a logging scope carrying the role. Rejected: the default console logger does not print scopes, so the role would be invisible.

## 9. The HTTP client

- **Decision**: one typed client, `OverpassMapPlacesClient`, registered with `AddHttpClient`, without a `BaseAddress`. Each call sends to the absolute address `new Uri(server.Address, "api/interpreter")`.
  - The identifying `User-Agent` is kept.
  - `RemoveAllLoggers()` is kept, because the request body holds the plan's position.
  - The 10-second backstop timeout is described in section 5.
  - The static `Configure(HttpClient)` method stays for the tests, but no longer sets a base address.
- The registration moves out of `Program.cs` into `Clients/MapDataRegistration.cs` (`AddMapData(IServiceCollection, IConfiguration)`): options, validator, client and `MapPlacesSearchService`. That follows the existing `AddPlanSetupRateLimit` pattern and keeps `Program.cs` (172 lines) below the 200-line limit.

## 10. The local copy: image settings and the two phases

- **Image and data**: `wiktorn/overpass-api@sha256:<pinned>` (section 1), loaded from the Lithuania extract. The image expects `.osm.bz2`, so the documented preprocess step converts the downloaded `.pbf` with `osmium`, which is inside the image:
  `OVERPASS_PLANET_PREPROCESS='mv /db/planet.osm.bz2 /db/planet.osm.pbf && osmium cat -o /db/planet.osm.bz2 /db/planet.osm.pbf && rm /db/planet.osm.pbf'`
- **Settings** (container environment):

  | Variable | Value | Why |
  |---|---|---|
  | `OVERPASS_MODE` | `init` | Load our own extract instead of cloning the whole world. |
  | `OVERPASS_PLANET_URL` | the Lithuania `.pbf` address | Lithuania only (FR-015). |
  | `OVERPASS_META` | `no` | Public extracts have no metadata, and the query does not use it. |
  | `OVERPASS_USE_AREAS` | `false` | The query uses `around`, not areas. Skipping area generation saves memory, disk and loading time. |
  | `OVERPASS_DIFF_URL` | not set | No background updates. The copy is a snapshot, and refreshing it is a deliberate command (spec Assumptions). This also keeps the running memory steady. |
  | `OVERPASS_STOP_AFTER_INIT` | `true` (default) | The container stops after loading, so the script can set the memory limit before serving. |
  | `OVERPASS_SPACE` | `1073741824` (1 GiB) | The memory the dispatcher shares among running queries. A query without `[maxsize]`, such as the application's, asks for 512 MiB. With 512 MiB in total, the first load on 2026-11-24 showed that the dispatcher refused every such query ("load shedded"); with 1 GiB they run. The 2 GB container limit still caps the real memory use. |
  | `OVERPASS_FASTCGI_PROCESSES` | `2` | One developer needs few workers. Fewer processes use less memory than the default 4. |
  | `OVERPASS_ALLOW_DUPLICATE_QUERIES` | `yes` | A "Retry" in the browser can repeat the same query while the first is still running. This is harmless locally. |
  | `OVERPASS_RATE_LIMIT` | `16` | Must be set. Without it the dispatcher's rate limit is 0, and it refuses every query that comes through the web server with a client address (found on 2026-11-24). 16 parallel queries per address is far more than one developer needs. |

- **Two phases in one container** (FR-015, clarification "2 GB while running"):
  1. **Load**: `docker run` (attached, so the developer sees progress) creates the container `speklaiku-overpass` with the named volume `speklaiku-overpass-db` at `/db` and no memory limit. It downloads, converts and indexes the data, then stops.
  2. **Serve**: the script checks the exit code. It then runs `docker update --memory 2g --memory-swap 2g speklaiku-overpass` and `docker start speklaiku-overpass`. The image's README documents `docker start` as the way to serve after loading. From then on the container cannot use more than 2 GB.
  - Later `start` commands find the existing container and only start it.
- **Ports and networks**:
  - The container publishes port 80 on `127.0.0.1:12345` only, so it is reachable from the developer's own machine and not from the local network. An API started with `dotnet run` uses `http://127.0.0.1:12345/`, not `localhost`: on Windows, `localhost` tries `::1` first, and the refused IPv6 attempt cost 2.0 to 2.5 s on the development machine (T031), which made the 4-second attempt time out. Plain http works on Windows 10, which avoids the TLS 1.3 problem (User Story 4 scenario 5).
  - The container also joins the Docker network `speklaiku-dev`. The Windows 10 API container from the README joins the same network and uses `http://speklaiku-overpass/`, so it does not depend on how Docker Desktop forwards `host.docker.internal` to ports bound to `127.0.0.1`.
- **Unknown until measured**: the image's README gives no figures for memory, disk or loading time. The implementation task runs the first load on the development machine (8 GB RAM, Docker 29.8 on Windows 10 Home with WSL 2). It records in the README the download size, the disk use of the volume, the peak memory while loading (`docker stats`), the memory while serving, and the loading time (FR-016).
  - If serving needs more than 2 GB with these settings, the task lowers the number of processes before anything else. `OVERPASS_SPACE` stays at 1 GiB, because 512 MiB refuses the application's queries. It does not raise the limit, which the clarification fixed.
  - If loading fails because Docker's virtual machine has too little memory, the README explains how to give WSL 2 more memory in `%UserProfile%\.wslconfig`.
- **Alternatives considered**:
  - Separate load and serve containers sharing the volume. Rejected: the image's README documents restarting the same container, and whether a new container would re-run the load on an existing volume is not documented.
  - A Compose file for the local copy. Rejected: the repository has no Compose file, a Compose service has one memory limit for both phases, and the script is needed anyway for the two phases (FR-015).
  - Converting the `.pbf` on the developer's machine. Rejected: it needs `osmium` installed on Windows, and the image already has it.
  - Background updates with Geofabrik's daily change files for Lithuania (`OVERPASS_DIFF_URL`). Rejected for now: the spec chose a snapshot with a refresh command, and updates add memory use while serving.

## 11. The script

- **Decision**: one PowerShell script, `scripts/local-map-data.ps1`. It is written for Windows PowerShell 5.1, which the development machine runs, and also works in PowerShell 7 on macOS and Linux. Its commands are `start`, `status`, `stop`, `remove` and `refresh`, as described in [contracts/local-map-data-script.md](contracts/local-map-data-script.md).
- `scripts/` is a new top-level folder. `docs/architecture.md`'s repository structure gains it, because the constitution requires every directory to be documented there.
- **Readiness check** (`status`): it sends the small query `[out:json][timeout:5];node(54.89,23.88,54.91,23.92)["name"];out 1;` (central Kaunas) and reports:
  - "ready" with the data date (`osm3s.timestamp_osm_base` in the answer) when an element comes back;
  - otherwise, whether the container is loading, stopped or missing.
- **Alternatives considered**:
  - A Bash script. Rejected: the development machine and the README use PowerShell.
  - Both a PowerShell and a Bash script. Rejected: two copies of the same logic (DRY). PowerShell 7 runs on every platform.

## 12. Testing approach

- **Unit tests** (`backend/tests/SpekLaiku.UnitTests/`):
  - `MapDataOptionsValidatorTests` (new): every FR-003 rule, including the trailing slash and letter case comparison, http in Development versus Production, the 1 to 8 range, and that no message contains the address.
  - `RequestDeadlineTests` (new): the time remaining with a moved `FixedTimeProvider`, and never below zero.
  - `MapPlacesSearchServiceTests` (new), using a scripted fake client that can move the `FixedTimeProvider`:
    - The main server answers, so the fallback is never called.
    - The main server fails with each failure kind, and the fallback answers.
    - An empty answer from the main server does not lead to the fallback.
    - Both fail, so the last failure is thrown.
    - No fallback configured: the failure is thrown at once.
    - Attempt times are min(waiting time, time left).
    - Less than 1 s left: the server is skipped and the "not contacted" warning is logged.
    - A cancelled request is not retried.
    - Each server is called at most once.
  - `OverpassMapPlacesClientTests` (changed):
    - It sends to the given server's `api/interpreter`, including an address with a path.
    - The query's `[timeout:N]` follows the attempt time. This replaces the test of the old fixed `[timeout:4]`, as SC-007 allows.
    - The attempt time is enforced with a short real timeout, as the existing timeout test already does.
    - The warning names the role and never the address.
  - `NearbyPlacesServiceTests` and other existing users of the client are updated for the new signature only.
- **Integration tests** (`backend/tests/SpekLaiku.IntegrationTests/`):
  - `FakeMapPlacesClient` can script a failure per server role and counts calls per role. Without role scripting it answers for any server, so the existing tests keep passing unchanged (SC-007).
  - New `MapDataFallbackTests`, with a fallback configured through the test host's configuration:
    - Step 3 and step 4 show the fallback's places when the main server fails (User Story 1, SC-001).
    - Both fail: the existing 503 map data error is returned.
    - The main server answers: the fallback is not called.
    - The failure warnings name the role.
    - A request refused by the rate limiter contacts no server.
  - New `MapDataConfigurationTests`: the API refuses to start with each kind of wrong setting, and the error names the setting (SC-005). The default configuration starts and uses the public address (User Story 2).
- **No test uses the live service or the local copy** (FR-017, constitution III). The script is checked by hand with [quickstart.md](quickstart.md).
- **Frontend**: no change, so no new frontend tests. The browser's 10-second limit and the existing error states are unchanged (FR-008).

## 13. Documentation

- **README**:
  - A "Map data server" configuration subsection: the four settings, their defaults and the environment variable names (FR-005).
  - A "Local map data copy" section that follows FR-016: prerequisites, the commands, the measured download size, disk use, memory and loading time, how to check that it is ready, how to point the API at it (with `dotnet run` and from the Windows 10 API container), how to stop, remove and refresh it, and a note that the data is a snapshot.
  - "Running the API on Windows 10" mentions the local copy as a second way around the TLS 1.3 problem.
  - The deployment notes on outgoing access and the cache mention that the server address is configurable.
- **`docs/architecture.md`**: `scripts/` in the repository structure, and the map data server settings and fallback in the external services description. Row 017 is already in the feature list (FR-018).
- The specifications of merged features (007 to 009) are not edited. This feature's FR-008 records that it replaces the 4-second wait.
