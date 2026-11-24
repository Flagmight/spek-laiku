# Tasks: Map Data Service Reliability

**Input**: Design documents from `specs/017-overpass-reliability/`

**Prerequisites**: plan.md ✓, spec.md ✓ (clarified 2026-11-24), research.md ✓, data-model.md ✓, contracts/map-data-configuration.md ✓, contracts/local-map-data-script.md ✓, quickstart.md ✓

**Tests**: Required. Constitution III makes automated backend tests mandatory for every feature. Each story phase includes its tests. There is no frontend change, so no frontend test is added, but the frontend checks must still pass.

**Organization**:

- Phase 1 is setup.
- Phase 2 is the foundation:
  - the server types;
  - the new client signature (server and attempt time);
  - the role in the failure warning;
  - the test fakes.

  After it, the API behaves as before: the public server, 4 seconds.
- Phases 3 to 6 follow the clarified build order (spec Clarifications Q1):
  - US2 Configurable server (P1);
  - US4 Local copy (P1);
  - US1 Fallback (P2);
  - US3 Waiting time and deadline (P3).
- Phase 7 is polish.

Each phase ends at a reviewable checkpoint. Stop after each phase for a diff review; commit and push only on request.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on other incomplete tasks in this phase)
- **[Story]**: Which user story this task belongs to ([US1] to [US4])

## Shared notes

- **Paths**: `Api/` means `backend/src/SpekLaiku.Api/`, `UnitTests/` means `backend/tests/SpekLaiku.UnitTests/` and `IntegrationTests/` means `backend/tests/SpekLaiku.IntegrationTests/`.
- **Running checks**: run each check on its own, in the foreground. A full background run was killed for low memory before. CI also runs `npm run format:check`, so include it.
  - From the repository root: `dotnet build SpekLaiku.slnx`, `dotnet format SpekLaiku.slnx --verify-no-changes` and `dotnet test SpekLaiku.slnx`.
  - From `frontend/`: `npm run lint`, `npm run format:check`, `npm test` and `npm run build`.
  - The first `npm test` of a session may fail with "Failed to start forks worker". Re-run it before investigating.
- **Spec Kit scripts**: `.specify/feature.json` (git-ignored) still points at feature 012. Before running a Spec Kit script, set `$env:SPECIFY_FEATURE_DIRECTORY = 'specs/017-overpass-reliability'` and `$env:SPECIFY_FEATURE_NO_PERSIST = '1'`. Do not edit `.specify/`.
- **Integration tests** share one `PostgreSqlApiFactory`.
  - Its `Clock` drives `ForecastPeriod`, so it also drives the request deadline (research section 4).
  - Its `MapPlaces` is the `FakeMapPlacesClient`.
  - A test that needs other settings uses `factory.WithWebHostBuilder(builder => builder.UseSetting(...))`, as `PlanPlacesFailureTests` does.
  - Places are cached per location for 24 hours in a cache shared by the test collection, so every test uses its own location id and position.
- **Logs**: never log a map data server address, the user's identity, the position, the radius or the tags (spec FR-003, FR-013; research section 8).

---

## Phase 1: Setup

**Purpose**: Branch ready, baseline green.

- [X] T001 Confirm that the branch `017-overpass-reliability` is based on the current `origin/main`:
  - Run `git fetch`, then `git log origin/main..HEAD` and `git log HEAD..origin/main`. Both should be empty.
  - Run `git status`. It should show only `docs/architecture.md` (row 017) as modified and the untracked folder `specs/017-overpass-reliability/`.
  - Result (2026-11-24): both logs are empty (the branch is at `98bf12a`, the merge of PR #17). `git status` shows only `docs/architecture.md` and `specs/017-overpass-reliability/`.
- [X] T002 Run the baseline checks (Shared notes) before changing any code, and record the test counts here for comparison in T055.
  - Expected after feature 012 (2026-11-22): backend 739 unit and 428 integration tests; frontend 91 files and 1320 tests.
  - Result (2026-11-24), each step run on its own in the foreground:
    - **Backend**: build with 0 warnings and 0 errors; `dotnet format --verify-no-changes` clean; 739 unit and 428 integration tests pass.
    - **Frontend**: lint clean; `format:check` clean; build clean. Test result: 91 files and 1320 tests pass.
    - The first `npm test` run hit the known "Failed to start forks worker" problem for 3 files (88 files, 1224 tests, no failing test). The re-run passed in full.

**Checkpoint**: Branch is current, all checks green.

---

## Phase 2: Foundational (server types, client signature, failure role, fakes)

**Purpose**: Give the client a server and an attempt time per call, so the later stories only choose which server and how long. Behaviour stays the same: the public server, 4 seconds.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Create `Api/Clients/MapDataServerRole.cs`:
  - `public enum MapDataServerRole { Main, Fallback }`.
  - A static class `MapDataServerRoles` with `public static string ToLogName(this MapDataServerRole role)`, which returns `"main"` or `"fallback"`.
  - Doc comment: only this name is ever logged, never the address.
- [X] T004 [P] Create `Api/Clients/MapDataServer.cs`: `public sealed record MapDataServer(Uri Address, MapDataServerRole Role, TimeSpan Timeout);`. Doc comment: "Address is absolute and ends with `/`; the client sends to `new Uri(Address, "api/interpreter")`" (data-model.md).
- [X] T005 [P] In `Api/Clients/ExternalServiceJson.cs`:
  - Add an optional last parameter `string? server = null` to `PostFormAsync`, to the private `SendAsync`, and to `Failure`.
  - Pass it through to every `Failure` call in `SendAsync`.
  - In `Failure`, when `server` is not null, log `"{Service} failed: {FailureKind} {StatusCode} on the {Server} server"`. Otherwise log the existing template, unchanged.
  - `GetAsync` and the Open-Meteo clients do not change.
- [X] T006 [P] In `Api/Clients/OverpassQuery.cs`:
  - Remove the constant `TimeoutSeconds`.
  - Add a parameter `int timeoutSeconds` to `Build` and use it in `[out:json][timeout:{timeoutSeconds}]`.
  - Update the doc comment: it is the attempt time in whole seconds (research section 5).
- [X] T007 Change `Api/Clients/IMapPlacesClient.cs` and `Api/Clients/OverpassMapPlacesClient.cs` (research sections 5 and 9; depends on T003 to T006):
  - New signature: `Task<IReadOnlyList<MapElement>> FindAsync(MapDataServer server, TimeSpan timeout, double latitude, double longitude, int radiusKm, IReadOnlyList<string> tags, CancellationToken cancellationToken)`. Update the interface doc comment: the server and time are chosen by the caller.
  - Remove `BaseAddress`, `Path` stays `"api/interpreter"`.
  - `Timeout` becomes a 10-second backstop: `public static readonly TimeSpan BackstopTimeout = TimeSpan.FromSeconds(10);`. `Configure(HttpClient)` sets only that timeout and the user agent.
  - In `FindAsync`:
    - Build the query with `OverpassQuery.Build(..., Math.Max(1, (int)timeout.TotalSeconds))`.
    - Create `using var attempt = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken); attempt.CancelAfter(timeout);`.
    - Call `ExternalServiceJson.PostFormAsync` with the absolute address `new Uri(server.Address, Path).ToString()`, `attempt.Token` and `server: server.Role.ToLogName()`.
    - Catch `OperationCanceledException` `when (attempt.IsCancellationRequested && !cancellationToken.IsCancellationRequested)` and throw `ExternalServiceJson.Failure(ExternalService.MapData, logger, FailureKind.Timeout, null, inner: exception, server: server.Role.ToLogName())`. Pass `server` as a named argument in every call, because it is the last optional parameter (T005).
    - The runtime-error remark and the missing-elements checks also pass the role.
    - A cancelled request (`cancellationToken` cancelled) still throws `OperationCanceledException`.
  - Update the class doc comment.
- [X] T008 Change `Api/Services/NearbyPlacesService.cs` to call the new signature with a private `static readonly MapDataServer PublicServer = new(new Uri("https://overpass-api.de/"), MapDataServerRole.Main, TimeSpan.FromSeconds(4));` and `PublicServer.Timeout`. T018 replaces this field with the `MapData` settings.
- [X] T009 [P] Update `UnitTests/RecordingMapPlacesClient.cs` to the new signature:
  - `Calls` also records `MapDataServer Server` and `TimeSpan Timeout` (as the first two tuple members).
  - Its behaviour is otherwise unchanged.
- [X] T010 [P] Update `IntegrationTests/FakeMapPlacesClient.cs` to the new signature:
  - Without role scripting it answers for any server, exactly as today.
  - Add `public MapDataServer? LastServer { get; }`, set on every call, so T021 can see which address was used.
- [X] T011 Update `UnitTests/OverpassMapPlacesClientTests.cs` for the new signature, with a helper server `new MapDataServer(new Uri("https://overpass.test/"), MapDataServerRole.Main, TimeSpan.FromSeconds(4))`:
  - Replace the expected `[out:json][timeout:4]` with the timeout given in the call. This is the only existing assertion that changes; SC-007 allows it because FR-008 replaces the fixed wait.
  - New `FindAsync_PostsToTheServersInterpreter`: the request URI is `https://overpass.test/api/interpreter`.
  - New `FindAsync_KeepsThePathOfAnAddressWithAPath`: the address `https://mirror.test/overpass/` gives `https://mirror.test/overpass/api/interpreter`.
  - New `FindAsync_PutsTheAttemptTimeInTheQuery`: 3 s gives `[timeout:3]`, and 1.5 s gives `[timeout:1]`.
  - Change `NoAnswerWithinTimeout_ThrowsTimeout` so that it passes a short attempt time (for example 200 ms) instead of shortening `HttpClient.Timeout`.
  - New `SlowAnswerWithinTheAttemptTime_IsUsed`: the handler answers after 300 ms with valid elements, the attempt time is 2 s, and the elements are returned (spec SC-003 and User Story 3 scenario 1, scaled down).
  - New `CancelledRequest_IsNotATimeout`: a cancelled `cancellationToken` gives `OperationCanceledException`, and no warning is logged.
  - New `FailureWarning_NamesTheRoleAndNeverTheAddress`: for a 502 on a fallback server with the address `https://secret-user:secret-pass@mirror.test/`, the single warning contains "on the fallback server", and it contains neither "mirror.test" nor "secret".
  - Result (2026-11-24): **no existing assertion changed.** The helper server keeps a 4-second time, so the existing `[timeout:4]` expectation is still right as written. `NoAnswerWithinTimeout_ThrowsTimeout` now passes a 200 ms attempt time; its assertions are the same. `FindAsync_PutsTheAttemptTimeInTheQuery` also covers 400 ms giving `[timeout:1]`.
  - `RecordingMapPlacesClient` (T009) records each call as a small `Call` record instead of a tuple, because the six-member tuple did not fit `dotnet format`. Its users read the members by name and needed no change.
- [X] T012 Update `IntegrationTests/PlanPlacesFailureTests.cs`: the client built with `OverpassMapPlacesClient.Configure(httpClient)` now needs no base address. No assertion changes.
  - Result (2026-11-24): no edit was needed. The test only calls `Configure`, which still exists, and the client now sends to absolute addresses.
- [X] T013 Run all checks (Shared notes). Everything passes. The test counts grow only by the new tests of T011.
  - Result (2026-11-24), each step in the foreground:
    - **Backend**: build with 0 warnings; `dotnet format` clean; 747 unit tests (T002: 739, +8, all from T011) and 428 integration tests (unchanged).
    - **Frontend**: lint, `format:check` and build clean; 91 files and 1320 tests.

**Checkpoint**: Same behaviour as before. The client takes a server and a time, and the warnings name the role.

---

## Phase 3: User Story 2 - Point the application at another map data server without a code change (Priority: P1) 🎯 MVP part 1

**Goal**: The main server, an optional fallback and their waiting times come from the `MapData` settings. Wrong settings stop the API at start-up.

**Independent Test**:
- Start with `MapData__MainServer` set to a fake server, and the place requests reach it.
- Start with no setting, and the public address is used.
- Start with an invalid address, and the API refuses to start with a message that names the setting.

- [X] T014 [P] [US2] Create `Api/Services/MapDataOptions.cs` (data-model.md "MapDataOptions"):
  - `public const string SectionName = "MapData";`
  - `public const int ShortestTimeoutSeconds = 1;` and `public const int LongestTimeoutSeconds = 8;`
  - `public string MainServer { get; init; } = "https://overpass-api.de/";`
  - `public int MainTimeoutSeconds { get; init; } = 4;` (T048 raises it to 6)
  - `public string? FallbackServer { get; init; }`
  - `public int FallbackTimeoutSeconds { get; init; } = 4;` (T048 raises it to 6)
  - `public IReadOnlyList<MapDataServer> Servers()`. It returns the main server, then the fallback when `FallbackServer` is not empty or white space. Each address gets a trailing `/` when it has none. Call it only after validation.
  - `public static Uri ToAddress(string text)`, which adds the trailing `/` and returns the `Uri`. The validator and `Servers()` share it.
  - Doc comment like `PlacesOptions`: the settings can be changed with environment variables such as `MapData__MainServer`.
- [X] T015 [P] [US2] Create `Api/Services/MapDataOptionsValidator.cs`: `public sealed class MapDataOptionsValidator(IHostEnvironment environment) : IValidateOptions<MapDataOptions>` (research section 2).
  - Collect every failure and return `ValidateOptionsResult.Fail(failures)`, or `Success`.
  - Messages, verbatim, with `<Setting>` being `MainServer` or `FallbackServer` (the latter only when it is not empty):
    - `MapData:<Setting> must be an absolute http or https address.`: the value is not an absolute URI, or its scheme is not `http` or `https`.
    - `MapData:<Setting> may use http only in the Development environment.`: the scheme is `http` and `!environment.IsDevelopment()`.
    - `MapData:FallbackServer must not be the same as MapData:MainServer.`: both addresses are valid and equal after `ToAddress`, compared with `StringComparison.OrdinalIgnoreCase`.
    - `MapData:MainTimeoutSeconds must be 1 to 8.` and `MapData:FallbackTimeoutSeconds must be 1 to 8.`: the value is outside `ShortestTimeoutSeconds` to `LongestTimeoutSeconds`. The fallback's time is checked even without a fallback.
  - No message ever contains a configured value.
- [X] T016 [US2] Create `Api/Clients/MapDataRegistration.cs`: `public static class MapDataRegistration` with `public static IServiceCollection AddMapData(this IServiceCollection services, IConfiguration configuration)`:
  - `services.AddOptions<MapDataOptions>().Bind(configuration.GetSection(MapDataOptions.SectionName)).ValidateOnStart();`
  - `services.AddSingleton<IValidateOptions<MapDataOptions>, MapDataOptionsValidator>();`
  - The existing `AddHttpClient<IMapPlacesClient, OverpassMapPlacesClient>(OverpassMapPlacesClient.Configure).RemoveAllLoggers()`, with its comment.
  - In `Api/Program.cs`, replace the map data client registration with `builder.Services.AddMapData(builder.Configuration);`. Keep the `PlacesOptions` registration where it is.
- [X] T017 [P] [US2] In `Api/appsettings.json`, add after `"Places"`: `"MapData": { "MainServer": "https://overpass-api.de/", "MainTimeoutSeconds": 4, "FallbackServer": "", "FallbackTimeoutSeconds": 4 }` (T048 raises both times to 6). No local value.
- [X] T018 [US2] In `Api/Services/NearbyPlacesService.cs`:
  - Remove the `PublicServer` field (T008).
  - Inject `IOptions<MapDataOptions> mapDataOptions`.
  - Call the client with `mapDataOptions.Value.Servers()[0]` and its `Timeout`.
  - Update the class doc comment.
  - Result (2026-11-24): done. The new constructor parameter meant `NearbyPlacesServiceTests` and `PlanPlacesServiceTests` had to pass `Options.Create(new MapDataOptions())` already now, not in T038. Only their construction lines changed; no assertion changed.
- [X] T019 [P] [US2] Create `UnitTests/MapDataOptionsValidatorTests.cs`, with one test per rule and names that describe the scenario:
  - the defaults are valid in Production;
  - a relative address, `ftp://` and `not an address` fail with the address message;
  - `http://localhost:12345` is valid in Development and fails in Production with the http message, for both the main and the fallback setting;
  - an empty or white-space fallback is valid (no fallback);
  - `http://localhost:12345` and `HTTP://LOCALHOST:12345/` as main and fallback fail with the "same" message;
  - 0 and 9 fail and 1 and 8 pass, for both waiting times;
  - several wrong settings give one message each;
  - no message contains the configured value (use an address with `secret-user:secret-pass@`).

  Use a small `IHostEnvironment` stub with `EnvironmentName` set.
- [X] T020 [P] [US2] Create `UnitTests/MapDataOptionsTests.cs`:
  - `Servers()` gives only the main server when there is no fallback, and main then fallback when there is one, with the right roles and timeouts.
  - Addresses without a trailing `/` get one, and an address with a path keeps it.
- [X] T021 [US2] Create `IntegrationTests/MapDataConfigurationTests.cs` (SC-004, SC-005):
  - `DefaultSettings_UseThePublicServer`: a place request (copy the request shape from `PlanPlacesEndpointTests`) reaches `factory.MapPlaces` with `LastServer.Address == https://overpass-api.de/` and role `Main`.
  - `ConfiguredMainServer_IsUsedForPlaceRequests`: with `UseSetting("MapData:MainServer", "https://overpass.example.test/")`, `LastServer.Address` is that address.
  - `[Theory] WrongSetting_StopsTheApiAtStartUpAndNamesIt`, for:
    - `MainServer = "not an address"`;
    - `FallbackServer = MainServer`;
    - `MainTimeoutSeconds = "12"`;
    - `MainServer = "http://localhost:12345/"` in the `Testing` environment.

    Creating a client throws an exception whose message (including inner exceptions) contains the setting's name and not the value.
  - Do not start the test host in the Development environment. It would load the git-ignored `appsettings.Development.json` and user secrets, so the result would depend on the developer's machine (constitution III). "http is accepted in Development" is covered by the unit tests of T019, with a stub environment.
  - Result (2026-11-24): 6 tests. The configured address is given without a trailing `/` (`https://overpass.example.test`), so the test also shows that the slash is added. The value check is skipped for `12`, because two digits can appear in unrelated text.
- [X] T022 [US2] Add the "Map data server" subsection to `README.md`, after the "Run the application" steps. Include:
  - the table of the four settings with defaults and environment variable names, taken from `contracts/map-data-configuration.md` (show the waiting times as 4 for now; T052 changes them);
  - that addresses are the server's root;
  - that `http` is allowed only in Development;
  - that the API refuses to start on a wrong setting and names it;
  - that local values go in environment variables, never in a committed file (FR-005).
- [X] T023 [US2] Run all checks (Shared notes).
  - Result (2026-11-24), each step in the foreground:
    - **Backend**: build with 0 warnings; `dotnet format` clean; 786 unit tests (T013: 747, +39 from T019 and T020) and 434 integration tests (T013: 428, +6 from T021).
    - **Frontend**: unchanged; lint, `format:check` and build clean; 91 files and 1320 tests.

**Checkpoint**: The API can be pointed at another server by configuration alone, which is the precondition for US4.

---

## Phase 4: User Story 4 - Run a local copy of the map data service for Lithuania (Priority: P1) 🎯 MVP part 2

**Goal**: One script starts a local Overpass API with Lithuania's map data. It serves within 2 GB of memory, and the API can use it over http. This unblocks manual playtesting.

**Independent Test**: Without the public server, follow the README to start the local copy, set `MapData__MainServer=http://127.0.0.1:12345/`, open step 3 for a Kaunas plan with Museum and Cycling, and see places listed (SC-006).

- [X] T024 [US4] Pin the image:
  - Run `docker pull wiktorn/overpass-api:latest` and `docker inspect --format "{{index .RepoDigests 0}}" wiktorn/overpass-api:latest`.
  - Record the full `wiktorn/overpass-api@sha256:…` reference here. It is used in T025.
  - **Result**: `wiktorn/overpass-api@sha256:ab893eeac8fa8525fc2227bd29024c239c31da106281c7a5992429c5f00d49a5` (image 423 MB, Overpass API 0.7.62.11).
- [X] T025 [US4] Create `scripts/local-map-data.ps1` with its parameters, fixed values and simple commands (`contracts/local-map-data-script.md`; research sections 10 and 11):
  - **Compatibility**: Windows PowerShell 5.1 and PowerShell 7. No PowerShell 7-only syntax (`&&`, `??`, ternary).
  - **Parameter**: `param([Parameter(Position = 0)][string]$Command)`, and `$ErrorActionPreference = 'Stop'`.
  - **Fixed values at the top**:
    - the pinned image (T024);
    - the data address `https://download.geofabrik.de/europe/lithuania-latest.osm.pbf`;
    - the container `speklaiku-overpass`, the volume `speklaiku-overpass-db` and the network `speklaiku-dev`;
    - the host port `12345` on `127.0.0.1`;
    - the memory limit `2g`.
  - **Help**: a comment-based help block, and a usage table printed for a missing or unknown command (exit code 1).
  - **State function**: a function that returns `missing`, `loading`, `stopped`, `failed` or `running`, based on `docker container inspect` (State.Status, State.ExitCode) and on whether the memory limit is set (`HostConfig.Memory`).
  - **Readiness function**: sends the query from the contract with `Invoke-RestMethod` and a 10-second timeout. It returns the element count and `osm3s.timestamp_osm_base`.
  - **`status`**: prints the state; when `running` and the readiness check succeeds, prints `ready`, the data date and the memory limit. Exit code 0 only when ready.
  - **`stop`**: `docker stop` when the container exists. Exit code 0.
  - **`remove`**: removes the container, the volume and the network when each exists. Exit code 0.
  - Check `$LASTEXITCODE` after every `docker` call, and stop with a clear message when Docker is not running.
  - **Deviation**: `$ErrorActionPreference = 'Continue'` instead of `'Stop'`. Windows PowerShell 5.1 turns a program's stderr into an error record when the output is redirected, and the loading log is written to stderr; every `docker` call checks its exit code instead (`Invoke-Docker`). The reason is a comment in the script.
- [X] T026 [US4] Add `start` and `refresh` to `scripts/local-map-data.ps1`:
  - **`start`, first time** (state `missing`):
    1. Pull the pinned image, and create the network and the volume.
    2. `docker run --name speklaiku-overpass --network speklaiku-dev -p 127.0.0.1:12345:80 -v speklaiku-overpass-db:/db` with the environment variables of research section 10 (the PREPROCESS command verbatim), attached and without a memory limit, so progress is shown.
    3. When it exits, check the exit code. When it is not 0, print the last 30 log lines, say "Loading failed. Run remove, then start again.", and exit with code 1.
    4. `docker update --memory 2g --memory-swap 2g speklaiku-overpass`, then `docker start speklaiku-overpass`.
    5. Wait up to 2 minutes for the readiness check, then print "Local map data copy is ready at http://127.0.0.1:12345/".
  - **`start`, later** (state `stopped` or `running`): if the memory limit is missing, apply step 4; otherwise only `docker start`. Then wait for readiness.
  - **`start`, state `failed`**: print the reason and exit with code 1.
  - **`refresh`**: `remove`, then `start`.
- [X] T027 [US4] Check the script without Docker work:
  - It parses in Windows PowerShell 5.1: `powershell -NoProfile -Command "$null = [System.Management.Automation.Language.Parser]::ParseFile('scripts/local-map-data.ps1', [ref]$null, [ref]$e); $e"` prints no errors.
  - No command prints the usage and exits with code 1.
  - `status` prints `missing` and exits with code 1.
  - **Result (2026-11-24)**: parses with 0 errors in Windows PowerShell 5.1; a missing and an unknown command exit with code 1; `status` printed `failed` after the failed first load, `stopped` after a WSL restart and `ready` while serving, each with the right exit code. `missing` was seen before the first load in an earlier session; not repeated, because it needs `remove`.
- [X] T028 [US4] First real run on the development machine (8 GB RAM, Docker 29.8, Windows 10 Home, WSL 2). Run `.\scripts\local-map-data.ps1 start`, and measure and record here:
  - the download size;
  - the loading time (from start to "ready");
  - the peak memory while loading (`docker stats speklaiku-overpass` in a second terminal);
  - the memory while serving after a few place queries;
  - the volume size (`docker system df -v`).

  Then confirm:
  - `status` shows `ready`, the data date and the 2 GB limit;
  - `stop` followed by `start` serves again without downloading.

  If serving goes over 2 GB, lower `OVERPASS_FASTCGI_PROCESSES` and re-measure; keep `OVERPASS_SPACE` at 1 GiB (research section 10). Never raise the limit (clarification Q2). If loading fails for lack of memory, note the WSL 2 memory needed for the README.

  **Result (2026-11-24)**:
  - First attempt with Docker's default WSL 2 memory (3.8 GB): `update_database` was killed for lack of memory after about 24 minutes, during the nodes (`OOMKilled=true`). The script reported `failed` and `remove` cleaned up.
  - Second attempt with a temporary `.wslconfig` of `memory=6GB` (deleted afterwards): download 214 MB (about 3 minutes); loading time about 1 h 56 min (16:30 to 18:26, start to loaded); peak memory while loading 5.07 GiB (`docker stats`, may include some file cache); volume 4.44 GB; map data from 2026-11-23T19:49:12Z.
  - After loading, the copy refused every query until two settings were added (research section 10 updated): `OVERPASS_RATE_LIMIT=16` (without it the dispatcher's limit is 0 and blocks every client address) and `OVERPASS_SPACE` raised from 512 MiB to 1 GiB (a query without `[maxsize]` asks for 512 MiB and was load-shed). The `start` timeout path also exited with code 0 because the log lines leaked into the return value of `Wait-Ready`; fixed with `Out-Host`. The container was recreated with the new settings on the same volume, without loading again.
  - Serving: readiness query 0.08 s; a museum and cycling query around Kaunas (10 km) returned 154 elements in 0.6 to 0.8 s; memory about 28 MiB idle after these queries, limit 2 GB.
  - `status` shows `ready at http://localhost:12345/`, the data date and `memory limit 2.0 GB`. After `wsl --shutdown` and a Docker restart, `status` showed `stopped`, and `start` was ready again in 11 s without downloading.
- [X] T029 [US4] Add the "Local map data copy" section to `README.md`, following FR-016 and `contracts/local-map-data-script.md`. It covers:
  - what the local copy is for (development and outages), and that it is never used by the tests or CI;
  - the prerequisites (Docker);
  - the five commands;
  - the measured figures from T028: download size, disk space, the 2 GB limit while serving, the peak while loading, and the loading time;
  - how to check that it is ready;
  - setting `MapData__MainServer` or `MapData__FallbackServer` to `http://localhost:12345/` for `dotnet run`, or to `http://speklaiku-overpass/` with `--network speklaiku-dev` for the Windows 10 API container;
  - how to stop, remove and refresh it;
  - that the data is a snapshot whose date `status` shows;
  - how to give WSL 2 more memory if loading needs it.

  In "Running the API on Windows 10", add that the local copy over http is a second way around the TLS 1.3 limit. Add `--network speklaiku-dev` as an optional line in the container command, with a short explanation.

  **Result**: done, except the `MapData__FallbackServer` sentence, which moved to T041 because the fallback is built in Phase 5. The container option is described as two extra lines in the text below the command, not in the command itself, so the command stays copy-paste ready without the copy.
- [X] T030 [P] [US4] In `docs/architecture.md`, add `scripts/` (developer scripts, such as the local map data copy) to the repository structure. In the external services description, add that the map data server is configurable, with an optional fallback and a local copy for development. Change nothing else.
- [X] T031 [US4] Hands-on check with the user: `quickstart.md` Part 2, section 2, steps 5 to 8 (the API with `MapData__MainServer=http://127.0.0.1:12345/`, step 3 and the schedule for a Kaunas plan with Museum and Cycling). Record each step's result here. Steps that need the browser are done by the user.

  **Result (2026-11-24)**:
  - Step 5, first try with `MapData__MainServer=http://localhost:12345/`: step 3 for Kaunas (Museum, Cycling) showed "Error: The map data service is unavailable." The API logged `Timeout` on the main server; the copy ran the query in about 2 s (cold data) and logged `499`. Cause: on Windows, connecting to `localhost` tries `::1` first, which the copy does not listen on, and the refused connection costs about 2 s (measured 2.0 to 2.5 s) before `127.0.0.1` is used.
  - Step 5 with `MapData__MainServer=http://127.0.0.1:12345/`: places listed with no error (the copy answered `200`, 37 KB, about 1 s), and the generated schedule used them. Passed (user).
  - Step 6: after `stop`, step 3 for Vilnius (Picnic) showed "Error: The map data service is unavailable. No places are shown." (user); the API logged `Network` on the main server (connection refused, at once). `start` was ready again in 5 s without downloading. Passed.
  - Step 7 (Windows 10 API container): not done; the API ran with `dotnet run`.
  - Step 8: done as T032.
  - Follow-up: the documented address changed from `localhost` to `127.0.0.1` in the script, README, contracts, plan.md, quickstart.md and research section 10, with the reason in the README.
- [X] T032 [US4] Run all checks (Shared notes) with the local copy running and again with it stopped. The results are the same (FR-017).
  - **Result (2026-11-24)**, each step in the foreground, first with the local copy running (`status` ready), then stopped (`status` stopped):
    - **Backend**: build with 0 warnings and 0 errors; `dotnet format --verify-no-changes` clean; 786 unit and 434 integration tests pass (same counts as T023), both times.
    - **Frontend**: lint clean; `format:check` clean; 91 files and 1320 tests pass; build clean, both times.
    - The results are the same with and without the copy (FR-017).

**Checkpoint**: Places and schedules work against the local copy. The pending manual checks of features 011 (T072, T075) and 012 (T067, T070) can now be done on `main` after this feature is merged; they are outside this feature.

---

## Phase 5: User Story 1 - Get places when the main map data server is down (Priority: P2)

**Goal**: When the main server fails and a fallback is configured, the same request is sent to the fallback before any error is shown.

**Independent Test**: A fake main server fails with 502 and a fake fallback has three museums near Kaunas. Step 3 lists them with no error, and the schedule uses them.

- [X] T033 [P] [US1] Extend `UnitTests/RecordingMapPlacesClient.cs`:
  - `public void Fail(MapDataServerRole role, FailureKind kind)`, so only calls to that role fail. The existing `Fail(FailureKind)` keeps failing every call.
  - `public Action<MapDataServer>? OnCall { get; set; }`, invoked at the start of each call. US3 uses it to move the clock; a test can also throw from it.
- [X] T034 [P] [US1] Extend `IntegrationTests/FakeMapPlacesClient.cs`:
  - `ScriptFailure(double latitude, double longitude, FailureKind kind, MapDataServerRole role)`, so only that role fails at that position. The existing overloads keep failing every role.
  - `public int CallsFor(MapDataServerRole role)`.
- [X] T035 [US1] Create `Api/Services/MapPlacesSearchService.cs`: `public sealed class MapPlacesSearchService(IMapPlacesClient client, IOptions<MapDataOptions> options)` with `Task<IReadOnlyList<MapElement>> FindAsync(double latitude, double longitude, int radiusKm, IReadOnlyList<string> tags, CancellationToken cancellationToken)`. It follows data-model.md "Attempt rules", without the deadline for now (each attempt gets `server.Timeout`; T045 adds the deadline):
  - Try `options.Value.Servers()` in order, and return the first successful answer, even an empty one (FR-010).
  - Catch only `ExternalServiceException` with `Service == ExternalService.MapData`, and move on to the next server (FR-009). Everything else passes through, including `OperationCanceledException`.
  - After the last server, rethrow the last failure (FR-012).
  - Each server is called at most once (FR-014).
  - The doc comment cites spec FR-009 to FR-014 and research sections 6 and 7.
- [X] T036 [US1] Wire it up:
  - Register `services.AddScoped<MapPlacesSearchService>();` in `Api/Clients/MapDataRegistration.cs`.
  - Change `Api/Services/NearbyPlacesService.cs` to depend on `MapPlacesSearchService` instead of `IMapPlacesClient` and `IOptions<MapDataOptions>`, and to call `FindAsync` on it.
  - Update the class doc comment: places from either server are cached the same way (FR-011).
- [X] T037 [US1] Create `UnitTests/MapPlacesSearchServiceTests.cs` with `RecordingMapPlacesClient` and options with a fallback (`https://main.test/`, `https://fallback.test/`):
  - `MainAnswers_FallbackIsNotCalled`.
  - `[Theory] MainFails_FallbackAnswers` for `Timeout`, `Network`, `UnexpectedStatus` and `InvalidResponse`. The calls go main then fallback, each once.
  - `MainAnswersWithNoPlaces_IsASuccessAndFallbackIsNotCalled`.
  - `BothFail_TheFallbacksFailureIsThrown`.
  - `NoFallbackConfigured_MainFailureIsThrownAtOnce`: one call.
  - `CancelledRequest_IsNotSentToTheFallback`: `OnCall` throws `OperationCanceledException` on the main call; the exception propagates and there is one call.
  - `OtherException_IsNotSentToTheFallback`: an `InvalidOperationException` from the main call propagates.
  - **Result**: 13 tests, the listed ones plus `EachAttempt_GetsItsServersWaitingTime`, `OtherServicesFailure_IsNotSentToTheFallback` and `Search_PassesThePositionRadiusAndTagsToEachServer`.
- [X] T038 [US1] Update `UnitTests/NearbyPlacesServiceTests.cs` and `UnitTests/PlanPlacesServiceTests.cs` to build `NearbyPlacesService` through `new MapPlacesSearchService(client, options)`, using options without a fallback. No assertion changes.
- [X] T039 [US1] Create `IntegrationTests/MapDataFallbackTests.cs`, with `factory.WithWebHostBuilder(builder => builder.UseSetting("MapData:FallbackServer", "https://fallback.example.test/"))` and its own positions:
  - `PlacesStep_MainFails_ShowsTheFallbacksPlaces`: main `UnexpectedStatus` at the position; `200` with the scripted museums; `CallsFor(Main) == 1` and `CallsFor(Fallback) == 1`. The response's `updatedAt` is `factory.Clock`'s minute in Lithuania, asserted the same way `PlanPlacesEndpointTests` does: the time the fallback's answer was received (User Story 1 scenarios 1 and 2, SC-001).
  - `ScheduleStep_MainFails_UsesTheFallbacksPlaces`: the schedule's scheduled activities use the scripted places (copy the request and forecast setup from `PlanScheduleEndpointTests`).
  - `BothFail_ReturnTheExistingMapDataError`: the same `503` body as `PlanPlacesFailureTests` asserts (scenario 4).
  - `MainAnswers_FallbackIsNotContacted` (scenario 3).
  - `ResponseDoesNotSayWhichServerAnswered`: the body contains neither "fallback" nor the address (scenario 2).
  - `EachFailedAttempt_IsLoggedWithItsRole`: with `CapturingLoggerProvider` as in `PlanPlacesFailureTests`, using the real `OverpassMapPlacesClient` with a fake handler that answers 502 for both addresses. There are two warnings, "… on the main server" and "… on the fallback server", and neither contains the address, the position or the tags (scenario 6, FR-013).
- [X] T040 [US1] In `IntegrationTests/PlanSetupRateLimitTests.cs`, confirm that a place request refused with `429` makes no `IMapPlacesClient` call. Add that assertion if it is missing (FR-013, edge case).
  - **Result**: already covered. `PlaceRequests_ShareTheLimitWithSearchesChecksAndForecasts` asserts `Assert.Equal(searches, mapPlaces.Calls)` after the refused request; no change.
- [X] T041 [US1] Update `README.md`:
  - In "Map data server", add how the fallback works: it is tried once, after a main server failure, within the same request; the user is not told which server answered; each failed attempt is a warning with its role.
  - In the "Places and forecast" failure bullet, add that a configured fallback is tried first.
  - In "Local map data copy", add that `MapData__FallbackServer` can point at the copy instead, so the public server stays the main one (left out in T029 because the fallback did not exist yet).
  - In the deployment notes, mention `MapData:MainServer` and `MapData:FallbackServer` next to the outgoing access and the note about a busy deployment needing its own Overpass instance.
- [X] T042 [US1] Hands-on check with the user: `quickstart.md` Part 2, section 3. Record the results here.
  - **Result (2026-11-24)**, with `MapData__MainServer=http://127.0.0.1:9/` (nothing listens) and the local copy as the fallback (`http://127.0.0.1:12345/`):
    - Steps 1 to 4: step 3 for Klaipėda (Museum) listed places with no error and no sign of which server answered, and the schedule used them (user). The log had one `Map data service failed: Network (null) on the main server` warning without the address, position or tags; the copy answered once (`200`).
    - Step 5: with the copy stopped, step 3 for Šiauliai showed "Error: The map data service is unavailable. No places are shown." (user); the log had one warning ending "on the main server" and one ending "on the fallback server".
    - Step 6: without a fallback, step 3 for Panevėžys showed the map data error quickly (user); one main-server warning and no fallback attempt. A refused connection on Windows takes about 2 s, so "at once" is about 2 s here.
- [X] T043 [US1] Run all checks (Shared notes).
  - **Result (2026-11-24)**: backend build with 0 warnings; `dotnet format` clean; 799 unit tests (T032: 786, +13 from T037) and 440 integration tests (T032: 434, +6 from T039). Frontend unchanged: lint and `format:check` clean, 91 files and 1320 tests, build clean.
  - One unit run in this phase failed `OverpassMapPlacesClientTests.SlowAnswerWithinTheAttemptTime_IsUsed` (300 ms answer, 2 s attempt time) once; the class passed 3 times on its own and the full suite passed in the next 3 runs. Watch for it in CI (T055).

**Checkpoint**: A failing main server no longer blocks places when a fallback is configured. Until Phase 6, the times are 4 + 4 s without a deadline (plan.md "Build order").

---

## Phase 6: User Story 3 - Wait long enough for a slow server, but never past the page's limit (Priority: P3)

**Goal**: Waiting times are 6 s by default, and every place and schedule request ends within 9 s of reaching the API.

**Independent Test**:
- A main server answering after 5 s is used.
- With a silent main server and a silent fallback, the request ends with the map data error within 9 s.

- [X] T044 [P] [US3] Create `Api/Services/RequestDeadline.cs` (data-model.md "RequestDeadline"):
  - `public sealed class RequestDeadline`.
  - `public static readonly TimeSpan Limit = TimeSpan.FromSeconds(9);` and `public static readonly TimeSpan ShortestAttempt = TimeSpan.FromSeconds(1);`
  - A private constructor that takes the `ForecastPeriod` clock and the start time.
  - `public static RequestDeadline Start(ForecastPeriod clock)`.
  - `public TimeSpan Remaining`: `start + Limit - clock.GetNow()`, never below `TimeSpan.Zero`.
  - The doc comment cites FR-007 and research section 4 (why it starts in the services, and why it uses `ForecastPeriod`).
- [X] T045 [US3] Change `Api/Services/MapPlacesSearchService.cs` (data-model.md "Attempt rules"):
  - Add the parameter `RequestDeadline deadline` before the `CancellationToken`.
  - Inject `ILogger<MapPlacesSearchService>`.
  - Each attempt gets `time = min(server.Timeout, deadline.Remaining)`.
  - When `time < RequestDeadline.ShortestAttempt`, log `"Map data service not contacted: no time left for the {Server} server"` with `server.Role.ToLogName()`, and stop trying.
  - When no server was contacted, throw `new ExternalServiceException(ExternalService.MapData, FailureKind.Timeout)`. Otherwise rethrow the last failure.
- [X] T046 [US3] Pass the deadline through:
  - `Api/Services/NearbyPlacesService.cs`: `GetAsync(location, radiusKm, categories, RequestDeadline deadline, cancellationToken)`, which passes it to `MapPlacesSearchService.FindAsync`.
  - `Api/Services/PlanPlacesService.cs`: inject `ForecastPeriod`, and make `var deadline = RequestDeadline.Start(forecastPeriod);` the first line of `GetAsync`.
  - `Api/Services/PlanScheduleService.cs`: the same first line, using its existing `forecastPeriod`.
  - Update both doc comments: the 9-second deadline covers the location lookup, the forecast and the map data (FR-007).
- [X] T047 [P] [US3] Create `UnitTests/RequestDeadlineTests.cs` with `new ForecastPeriod(new FixedTimeProvider(...))`:
  - `Remaining_IsNineSecondsAtStart`.
  - `Remaining_ShrinksAsTheClockMoves`: 2.5 s later it is 6.5 s.
  - `Remaining_IsNeverBelowZero`: 12 s later it is 0.
- [X] T048 [P] [US3] Raise the default waiting times from 4 to 6:
  - `MainTimeoutSeconds` and `FallbackTimeoutSeconds` in `Api/Services/MapDataOptions.cs` and in `Api/appsettings.json` (FR-006).
  - Update `UnitTests/MapDataOptionsTests.cs` (T020) if it asserts the default times.
  - **Result**: the defaults test now expects 6 s, and `FallbackWithoutAWaitingTime_GetsTheDefaultSixSeconds` was added.
- [X] T049 [US3] Add timing tests to `UnitTests/MapPlacesSearchServiceTests.cs`:
  - Use a `FixedTimeProvider` with `ForecastPeriod`, start the deadline in the test, and move the clock from `RecordingMapPlacesClient.OnCall` or between calls.
  - Update the existing tests to pass a fresh deadline.
  - `AttemptTime_IsTheServersWaitingTimeWhenEnoughTimeIsLeft`: main gets 6 s.
  - `MainFailsQuickly_FallbackGetsItsFullTime`: main "fails" after the clock moves 0.3 s, and the fallback gets 6 s.
  - `MainUsesItsTime_FallbackGetsOnlyWhatIsLeft`: the clock moves 6 s on the main call, and the fallback gets 3 s.
  - `LessThanOneSecondLeft_FallbackIsNotContactedAndAWarningIsLogged`: the clock moves 8.5 s on the main call; there is one call, the main failure is thrown, and the warning says "no time left for the fallback server".
  - `NoTimeLeftAtStart_NoServerIsContactedAndTheFailureIsATimeout`: the clock is already 8.5 s past the start; there are no calls and `ExternalServiceException(MapData, Timeout)` is thrown.
  - `AttemptTime_IsCappedAtNineSecondsInTotal`: across main and fallback, the sum of the attempt times plus the time already used never exceeds 9 s.
  - **Result**: 9 new test cases; `AttemptTime_IsCappedAtNineSecondsInTotal` is a theory for 0, 2, 5 and 7.5 s already used, with both servers silent at the longest waiting time (8 s). The test class also checks that the "not contacted" warning holds no address.
- [X] T050 [US3] Update `UnitTests/NearbyPlacesServiceTests.cs` and `UnitTests/PlanPlacesServiceTests.cs` for the new parameters: a deadline started on the test clock, and `ForecastPeriod` for `PlanPlacesService`. No assertion changes.
- [X] T051 [US3] Create `IntegrationTests/MapDataDeadlineTests.cs`:
  - Add an optional hook `public Action? BeforeAnswer { get; set; }` to `IntegrationTests/FakeForecastClient.cs` and `IntegrationTests/FakeGeocodingClient.cs` (the `GetAsync` used for the plan's location), called at the start of the call.
  - `ScheduleStep_ForecastUsesTheTime_MapDataIsNotContactedAndTheMapDataErrorIsShown`: `BeforeAnswer` moves `factory.Clock` 8.5 s. The response is the map data `503`, and `factory.MapPlaces` gets no new call (User Story 3 scenario 3, SC-002).
  - `PlacesStep_LocationLookupUsesFiveSeconds_MapDataStillGetsTheRest`: geocoding moves the clock 5 s, so the map data call happens and the places are shown.
  - Restore `factory.Clock` and clear the hooks in a `finally` block.
  - **Result**: the two listed tests plus `ScheduleStep_LookupAndForecastLeaveEnoughTime_TheScheduleUsesThePlaces` (3 s + 3 s used, the schedule uses the places).
- [X] T052 [US3] Update `README.md`:
  - Change the waiting times in "Map data server" to 6.
  - Add that place and schedule requests end within 9 seconds, so the page shows places or the map data error before its 10-second limit.
  - Search `README.md` and `docs/architecture.md` for the old 4-second map data wait ("4 seconds", "4 s") and correct only those statements.
- [X] T053 [US3] Run all checks (Shared notes).
  - **Result (2026-11-24)**: backend build with 0 warnings; `dotnet format` clean; 812 unit tests (T043: 799, +13 from T047 to T049) and 443 integration tests (T043: 440, +3 from T051). Frontend unchanged: lint and `format:check` clean, 91 files and 1320 tests, build clean.

**Checkpoint**: All four stories are complete. Requests end within 9 s in every combination tested.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, full verification, review. No new behaviour.

- [X] T054 [P] Re-read `README.md` and `docs/architecture.md` against the implementation and the contracts:
  - the settings, the messages, the log lines, the script commands and the fixed values match;
  - the feature list row 017 is present (FR-018).

  Change only what is wrong.
  - **Result (2026-11-24)**: the settings, messages, script commands and fixed values match. Added the "Map data service not contacted: no time left for the … server" warning to the README "Time limit" bullet, and to the `Clients/` row of `docs/architecture.md` that `MapPlacesSearchService` tries the main server and then the fallback within the 9-second `RequestDeadline`. Row 017 is in the feature list.
- [X] T055 Run all checks (Shared notes) and compare the test counts with T002. The only existing assertion allowed to change is the `[timeout:4]` expectation in `OverpassMapPlacesClientTests` (T011). The other existing test changes are signatures and construction only:
  - `RecordingMapPlacesClient`, `FakeMapPlacesClient`, `FakeForecastClient`, `FakeGeocodingClient`;
  - `NearbyPlacesServiceTests`, `PlanPlacesServiceTests`, `PlanPlacesFailureTests`;
  - the optional assertion in `PlanSetupRateLimitTests` (T040).

  List them in the PR description (constitution III), and record the results here.
  - **Result (2026-11-24)**, after the T058 fixes, each step in the foreground: backend build with 0 warnings; `dotnet format` clean; 812 unit tests (T002: 739, +73) and 443 integration tests (T002: 428, +15), all passing. Frontend unchanged: lint and `format:check` clean, 91 files and 1320 tests (as T002), build clean.
  - **No existing assertion changed**, not even `[timeout:4]` (see T011). The existing test files changed only in signatures, construction and fakes: `RecordingMapPlacesClient`, `FakeMapPlacesClient`, `FakeForecastClient`, `FakeGeocodingClient`, `NearbyPlacesServiceTests`, `PlanPlacesServiceTests`, `OverpassMapPlacesClientTests` (helpers and new tests; `NoAnswerWithinTimeout_ThrowsTimeout` passes a short attempt time instead of shortening `HttpClient.Timeout`). `PlanPlacesFailureTests` and `PlanSetupRateLimitTests` needed no change.
- [X] T056 Walk through `quickstart.md` Part 2, sections 1 to 4, with the user, in the running app with the local copy. Record which scenarios passed and any that could not be done.
  - **Result (2026-11-24)**:
    - **Section 1 (configuration)**: passed 5 of 5, run by Claude with `dotnet run --no-build`. No `MapData` variables: the API starts and listens. `MainTimeoutSeconds=12`: refuses with `MapData:MainTimeoutSeconds must be 1 to 8.`. `MainServer="not an address"`: refuses with `MapData:MainServer must be an absolute http or https address.`. The same server as main and fallback (one with a trailing `/`): refuses with `MapData:FallbackServer must not be the same as MapData:MainServer.`. Production with an http main server: refuses with `MapData:MainServer may use http only in the Development environment.`. No setting value appeared in any output. The addresses used `127.0.0.1` (see T031).
    - **Section 2 (local copy)**: passed in T028 and T031.
    - **Section 3 (fallback)**: passed, see T042.
    - **Section 4 (deadline)**: step 1 passed. With the default settings, step 3 for Alytus showed "Error: The map data service is unavailable. No places are shown." (user), not "Something went wrong"; the log shows `Timeout` on the main server (the public server did not answer within 6 s), and a later attempt got `502`. Optional step 2 (1-second waiting time) was not done.
- [X] T057 Review `git diff main...HEAD` and confirm:
  - only the files in plan.md "Source Code", plus `README.md`, `docs/architecture.md` and this feature's spec files, changed;
  - there is no debug code, commented-out code or temporary file;
  - every new or changed C# class is under 200 lines (record the counts for `OverpassMapPlacesClient`, `ExternalServiceJson`, `MapPlacesSearchService`, `MapDataOptionsValidator`, `NearbyPlacesService`, `PlanScheduleService` and `Program`);
  - no migration and no frontend file changed;
  - `appsettings.json` holds only defaults;
  - no address or credential appears in a log template;
  - no request DTO, route value or query value feeds the `MapData` addresses: they are read only through `IOptions<MapDataOptions>` (spec FR-004, User Story 2 scenario 5);
  - no file outside `scripts/`, `README.md`, `docs/architecture.md` and this feature's spec files mentions the container `speklaiku-overpass`, the volume or the Lithuania download address, so no other setup step starts the local copy (spec FR-015).

  - **Result (2026-11-24)**, on `git diff main` including the uncommitted Phases 5 and 6: only the planned source and test files, `scripts/local-map-data.ps1`, `README.md`, `docs/architecture.md` and this feature's spec files changed; no migration and no frontend file. No debug code, commented-out code or temporary file. Class sizes: `OverpassMapPlacesClient` 91, `ExternalServiceJson` 156, `MapPlacesSearchService` 59, `MapDataOptionsValidator` 75, `NearbyPlacesService` 89, `PlanScheduleService` 81, `Program` 170 lines. `appsettings.json` holds only the defaults. The log templates name the service, the kind, the status and the role, never an address. `MapDataServer` is created only in `MapDataOptions.Servers()`, read through `IOptions<MapDataOptions>`. The container, volume and download address appear only in `scripts/`, `README.md` and this feature's spec files.
  Record the result here.
- [X] T058 Run a separate AI-assisted review of the branch: `/code-review`, and `/security-review`, because this feature changes outgoing calls to configured addresses, start-up validation and a script that runs containers. Record:
  - the tool;
  - the important findings;
  - the changes made;
  - the findings not applied, each with a short reason.

  These go in the Pull Request description (constitution VII). Apply the accepted fixes and re-run T055.
  - **Result (2026-11-24)**:
    - **Tools**: `/code-review` (medium) and `/security-review` in Claude Code, on `git diff main` including the uncommitted Phases 5 and 6.
    - **Security review**: no finding with confidence 8 or more. Checked: no request value reaches the server host or scheme (SSRF); the only new query value is the attempt time, an integer; logs hold no address, position or tags; no certificate bypass; the script's only input is checked against a fixed list, and Docker arguments are constants passed as an array.
    - **Applied**: the request address is now `new Uri(server.Address, Path).AbsoluteUri` instead of `ToString()`, so percent-encoded characters in a configured address are kept. The README "Time limit" bullet now says the 9 seconds start when the API starts working on the request, not when it reaches the API.
    - **Not applied, by design**:
      - A schedule request can end shortly after 9 s when the location lookup and the forecast use their full timeouts: research section 4 and FR-007 accept "9 s + processing", well before the browser's 10 s.
      - With 6 + 6 s waiting times, a fallback gets at most what is left of 9 s after a silent main server: the spec fixes the defaults (FR-006) and the 9-second limit (FR-007).
      - `FallbackTimeoutSeconds` is checked even with no fallback: data-model.md chose this so a wrong value is never hidden.
      - The deadline starts in the services, not in middleware: research section 4.
    - **Not applied, out of scope**:
      - Addresses with a user name and password are not sent as a login (HttpClient does not turn the address's user part into an Authorization header). The spec only requires that such an address is never logged; public and local Overpass servers need no login.
      - An address with a query string or fragment is accepted but would be resolved wrongly; the README defines an address as the server's root.
      - Two addresses that differ only in the case of their path count as the same server; real Overpass addresses do not differ like that.
      - `throw lastFailure` keeps the exception but not its original stack trace; the client has already logged the failure, and `ApiExceptionHandler` logs only the type.
- [X] T059 Prepare the Pull Request description for the user. Include:
  - a link to `specs/017-overpass-reliability/spec.md`;
  - a summary by story, in build order;
  - the tests and checks run (T055, T056);
  - "no migration, no frontend change";
  - the new `MapData` settings and the local copy script;
  - the measured local copy figures (T028);
  - the spec changes made during clarification and planning (Q1 to Q3, the corrected memory limit and Compose wording);
  - the changed test assertion (T011);
  - the AI review record from T058.

  There are no screenshots, because the user interface does not change. The user opens and merges the Pull Request (no `gh` CLI: push with git and give the PR link).
  - **Result (2026-11-24)**: description prepared and given to the user in the conversation.

**Checkpoint**: All checks green, docs current, review recorded, PR description ready. Ready for commit and Pull Request on request.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** comes first.
- **Foundational (Phase 2)** depends on Setup and blocks every story.
- **US2 (Phase 3)** depends on Phase 2.
- **US4 (Phase 4)**:
  - The script (T024 to T028) depends only on Docker, so it can start in parallel with Phase 3.
  - Using it from the API (T031) needs US2, because `http` and the address come from US2's settings.
- **US1 (Phase 5)** depends on US2: the fallback comes from the `MapData` settings.
- **US3 (Phase 6)** depends on US1: the deadline is added to `MapPlacesSearchService`.
- **Polish (Phase 7)** depends on all stories.

### User Story Dependencies

- **US2**: none beyond the foundation.
- **US4**: the script stands alone; using it from the API needs US2.
- **US1**: US2 (settings).
- **US3**: US1 (the search service it extends). Without US1 it would apply to a single server, but the build order puts it last.

### Within Each Story

- Types and options before services, services before wiring, and wiring before the integration tests.
- Each story ends with "Run all checks", then a stop for diff review.

---

## Parallel Opportunities

- **Phase 2**: T003, T004, T005 and T006 (different files), then T009 and T010 after T007.
- **Phase 3**: T014, T015 and T017; then T019 and T020 after T014 and T015.
- **Phase 4**: T024 to T028 can run alongside Phase 3. T030 can run alongside T029.
- **Phase 5**: T033 and T034.
- **Phase 6**: T044, T047 and T048.

### Parallel Example: User Story 2

```text
Task: "T014 Create Api/Services/MapDataOptions.cs"
Task: "T015 Create Api/Services/MapDataOptionsValidator.cs"
Task: "T017 Add the MapData section to Api/appsettings.json"
# then
Task: "T019 MapDataOptionsValidatorTests"
Task: "T020 MapDataOptionsTests"
```

### Parallel Example: User Story 4

```text
Task: "T024 Pin the image digest"            # can start while Phase 3 is in progress
Task: "T030 docs/architecture.md scripts/ folder"
```

---

## Implementation Strategy

### MVP first (US2 + US4)

1. Phase 1 and Phase 2: behaviour unchanged.
2. Phase 3 (US2): the server is configurable.
3. Phase 4 (US4): the local copy runs and the API uses it. **STOP and VALIDATE** with the user (T031). This is the MVP the user asked for: manual playtesting no longer depends on the public server.

### Incremental delivery

4. Phase 5 (US1): the fallback, so a deployed application survives a main server outage.
5. Phase 6 (US3): longer waits within a 9-second deadline. This closes the temporary over-10-second case of Phase 5.
6. Phase 7: review and the Pull Request. All phases go into one Pull Request.

---

## Notes

- Tasks marked [P] touch different files and do not depend on unfinished tasks in the same phase.
- Stop after each phase for a diff review. Commit and push only when the user asks.
- Do not add a NuGet or npm package. The Docker image is the only new dependency, it is for development only, and it is pinned (T024).
- Never use the live Overpass service or the local copy in an automated test (constitution III, FR-017).
