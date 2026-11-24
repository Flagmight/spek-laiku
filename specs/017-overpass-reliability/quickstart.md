# Quickstart: Map Data Service Reliability

**Feature**: `017-overpass-reliability` | **Spec**: [spec.md](spec.md) | **Contracts**: [map-data-configuration.md](contracts/map-data-configuration.md), [local-map-data-script.md](contracts/local-map-data-script.md)

How to prove the feature works. Part 1 runs the automated checks. Part 2 walks through the stories in their build order (User Story 2, 4, 1, 3).

## Prerequisites

- The normal local setup from the README: .NET 10 SDK, Node.js, your own PostgreSQL with the migrations applied, and the development certificate trusted.
- Docker running, with at least 4 GB of free disk space (the measured figure goes in the README).
- No internet access to `overpass-api.de` is needed for Part 2. Access to `download.geofabrik.de` and Docker Hub is needed once, for the first `start`.

## Part 1: Automated checks

From the repository root:

```powershell
dotnet build .\SpekLaiku.slnx
dotnet format .\SpekLaiku.slnx --verify-no-changes
dotnet test .\SpekLaiku.slnx
```

From `frontend/` (no frontend change is expected, so this only confirms nothing broke):

```powershell
npm run lint
npm run format:check
npm test
npm run build
```

Expected:

- Everything passes.
- The new tests are listed:
  - unit tests `MapDataOptionsValidatorTests`, `MapDataOptionsTests`, `RequestDeadlineTests` and `MapPlacesSearchServiceTests`;
  - integration tests `MapDataFallbackTests`, `MapDataConfigurationTests` and `MapDataDeadlineTests`.
- No test contacts Overpass or the local copy. The tests pass with Docker's local copy stopped and without a network connection (apart from Testcontainers' PostgreSQL).

## Part 2: Manual walkthrough

Use a Kaunas plan with the categories **Museum** and **Cycling** in every scenario that opens step 3.

### 1. Configuration (User Story 2)

1. With no `MapData__*` variables set, start the API (`dotnet run --project .\backend\src\SpekLaiku.Api --launch-profile https`). It starts as before.
2. Stop it. Set `$env:MapData__MainTimeoutSeconds = "12"` and start it again. It refuses to start, and the error says `MapData:MainTimeoutSeconds must be 1 to 8.`. Remove the variable.
3. Set `$env:MapData__MainServer = "not an address"`. It refuses to start and names `MapData:MainServer`, without printing the value. Remove the variable.
4. Set both `MapData__MainServer` and `MapData__FallbackServer` to `http://localhost:12345`, one of them with a trailing `/`. It refuses to start: `MapData:FallbackServer must not be the same as MapData:MainServer.`. Remove both.
5. In a terminal with `$env:ASPNETCORE_ENVIRONMENT = "Production"` and `$env:MapData__MainServer = "http://localhost:12345/"`, start the API with `--no-launch-profile`. It refuses: `MapData:MainServer may use http only in the Development environment.`. Close that terminal.

### 2. Local copy (User Story 4)

1. `.\scripts\local-map-data.ps1 status` shows `missing`.
2. `.\scripts\local-map-data.ps1 start`. Note the download size, the loading time, and the peak memory from `docker stats speklaiku-overpass` (in a second terminal) while it loads. It ends with "Local map data copy is ready at http://127.0.0.1:12345/". The README must state figures that match what you saw (FR-016).
3. `.\scripts\local-map-data.ps1 status` shows `ready`, the data date and a 2 GB limit.
4. `docker stats --no-stream speklaiku-overpass` shows a limit of 2 GiB and usage below it.
5. In the API terminal, set `$env:MapData__MainServer = "http://127.0.0.1:12345/"` and start the API with `dotnet run` (on Windows 10 too). Open step 3 for the Kaunas plan. Museums and cycling places are listed, with "Places updated at HH:MM" and no error. Generate the schedule. It uses those places.
6. `.\scripts\local-map-data.ps1 stop`, then open step 3 for a **new** location (places for Kaunas are reused for 24 hours). It shows "Error: The map data service is unavailable. No places are shown." within 10 seconds. `.\scripts\local-map-data.ps1 start` makes it ready again without downloading.
7. Windows 10 API container only: start the container from the README with `--network speklaiku-dev` and `-e "MapData__MainServer=http://speklaiku-overpass/"`. Step 3 lists places.
8. Run Part 1 again with the local copy running and with it stopped. The results are the same (FR-017).

### 3. Fallback (User Story 1)

1. API terminal: `$env:MapData__MainServer = "http://127.0.0.1:9/"` (nothing listens there, so it fails at once) and `$env:MapData__FallbackServer = "http://127.0.0.1:12345/"`. Start the API with the local copy running.
2. Open step 3 for a location not used before. Places are listed without an error, and the page does not say which server answered.
3. The API log shows one "Map data service failed: Network" warning that ends with "on the main server", without the address, the position or the tags.
4. Generate the schedule. It uses the fallback's places.
5. Stop the local copy and open step 3 for another new location. It shows the map data error with **Retry**, and the log shows one warning for the main server and one for the fallback.
6. Clear `MapData__FallbackServer` and restart the API. With the main server still at `http://127.0.0.1:9/`, the error appears at once, without extra waiting.

### 4. Waiting time and deadline (User Story 3)

The timing rules are proven by `MapPlacesSearchServiceTests` and `RequestDeadlineTests` with a controlled clock. By hand:

1. With the default settings (public server), open step 3 for a new location. Whether the public server answers or not, the page shows places or the map data error within 10 seconds, never "Something went wrong" from the browser's own limit.
2. Optional: set `$env:MapData__MainTimeoutSeconds = "1"` with the public server. Slow answers now end in the map data error after about 1 second.

### Clean up

- Remove the `MapData__*` variables, or close the terminals.
- Keep the local copy for later (`stop`), or remove it and its data with `.\scripts\local-map-data.ps1 remove`.
