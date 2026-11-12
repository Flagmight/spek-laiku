---

description: "Task list for feature 007 Nearby Places"
---

# Tasks: Nearby Places

**Input**: Design documents from `/specs/007-nearby-places/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/plan-places-api.md, contracts/plan-forecast-api-changes.md, quickstart.md

**Tests**: Required. Constitution principle III requires:

- backend tests for business logic and API behaviour;
- frontend tests for the relevant screens;
- an authorization test for every protected operation;
- fake responses instead of the live Overpass and Open-Meteo services.

Within each story, write the tests first and confirm they fail before the implementation tasks.

**Organization**: Tasks are grouped by user story, so each story can be implemented and tested on its own. The P1 stories come first, in the order their dependencies need:

- US1: nearby places per activity;
- US2: no place found, with Remove and Change activity;
- US3: the overview and the closed forecast details;
- US4: the map data service unavailable, Retry and the shared request limit (it needs the US3 overview);
- US5: the checks before the search;
- US6: access.

Then the P2 story US7: keyboard, screen reader and phone.

Commands are in `AGENTS.md`. Backend commands run from the repository root with `.\SpekLaiku.slnx`; frontend commands run from `frontend/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: The user story the task belongs to (US1 to US7, as numbered in `spec.md`)
- Paths are from the repository root. Short forms used below:
  - `Api/` is `backend/src/SpekLaiku.Api/`;
  - `UnitTests/` is `backend/tests/SpekLaiku.UnitTests/`;
  - `IntegrationTests/` is `backend/tests/SpekLaiku.IntegrationTests/`;
  - `web/` is `frontend/src/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the starting point. No new package, no migration and no new folder.

- [X] T001 Confirm the baseline after feature 006 and the plan UI tweaks (PR #9) passes before any change.
  - From the repository root, run `dotnet build .\SpekLaiku.slnx` and `dotnet test .\SpekLaiku.slnx`.
  - From `frontend/`, run `npm run lint`, `npm test` and `npm run build`.
  - Record the test counts and any pre-existing failure in this task, instead of fixing it in this feature.
  - If the first `npm test` fails with "Failed to start forks worker", re-run it once before investigating.
  - **Result (2026-11-12, commit `b7c0ace`)**: no pre-existing failure.
    - Backend build: 0 warnings, 0 errors.
    - Backend tests: 480 unit and 224 integration tests passed, none failed or skipped.
    - Frontend: lint clean, 59 test files with 767 tests passed, build succeeded.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Everything the stories share:

- the map data client and its shared error handling;
- the `503` answer;
- the place rules, distance and options;
- the shared plan check;
- the test fakes;
- the frontend types and helpers.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Backend: shared client code and the 503 answer

- [X] T002 Extend the shared client code (research section 7, `data-model.md` ExternalServiceJson).
  - In `Api/Clients/ExternalService.cs`, add `MapData` with the comment "The OpenStreetMap Overpass API (feature 007)", and update the class comment.
  - In `Api/Clients/ExternalServiceJson.cs`:
    - Move the body of `GetAsync<T>` into a private `SendAsync<T>(HttpClient httpClient, HttpRequestMessage request, ExternalService service, ILogger logger, bool badRequestMeansNotFound, CancellationToken cancellationToken)`. Keep the timeout, network, status, JSON and empty-body handling exactly as now.
    - Make `GetAsync<T>` build a `GET` request and call it.
    - Add `public static Task<T?> PostFormAsync<T>(HttpClient httpClient, string path, IEnumerable<KeyValuePair<string, string>> fields, ExternalService service, ILogger logger, CancellationToken cancellationToken) where T : class`. It sends `POST` with `FormUrlEncodedContent(fields)` and `badRequestMeansNotFound: false`.
    - Add the display name `ExternalService.MapData => "Map data service"`.
  - Every existing test must pass unchanged, especially `UnitTests/OpenMeteoGeocodingClientTests.cs`, `OpenMeteoForecastClientTests.cs` and the integration failure tests.
- [X] T003 [P] Change `Api/Errors/ApiExceptionHandler.cs` so that `ExternalService.MapData` gives `503` with `Title` "Service unavailable.", `Detail` "The map data service is unavailable. No places are shown." and `Extensions["service"] = "places"`.
  - Make the `switch` name `LocationSearch` explicitly, so no service falls to it by default. An unknown value keeps the location search answer.
  - Update the class comment.
  - Extend `UnitTests/ApiExceptionHandlerTests.cs`: `MapData` gives the status, detail and `service: "places"`; the existing `forecast` and `locationSearch` cases still pass.

### Backend: the map data client

- [X] T004 [P] Create `Api/Clients/IMapPlacesClient.cs` and `Api/Clients/MapElement.cs` (`data-model.md`, Client models).
  - `IMapPlacesClient`: `Task<IReadOnlyList<MapElement>> FindAsync(double latitude, double longitude, int radiusKm, IReadOnlyList<string> tags, CancellationToken cancellationToken)`.
    - Comment that it returns the named points, lines and areas with at least one of the `key=value` tags within the radius, each once, in no defined order.
    - Comment that it throws `ExternalServiceException` for `ExternalService.MapData` on every failure.
    - Comment that the interface exists so tests replace the external service with fake responses (constitution III).
  - `MapElement`: `public sealed record MapElement(string Key, double Latitude, double Longitude, IReadOnlyDictionary<string, string> Tags)`. `Key` is `"node/123"`, `"way/456"` or `"relation/789"`; comment that it is never sent to the browser.
- [X] T005 Create `Api/Clients/OverpassQuery.cs`, `Api/Clients/OverpassResponse.cs` and `Api/Clients/OverpassMapPlacesClient.cs` (research sections 4 and 7). This depends on T002 and T004.
  - **`OverpassQuery`** (`internal static`), `Build(double latitude, double longitude, int radiusKm, IReadOnlyList<string> tags)`:
    - The text starts with `[out:json][timeout:4];`.
    - Then `(`, then for each distinct tag (split once at `=`) `nwr["<key>"="<value>"]["name"](around:<radiusKm * 1000>,<lat>,<lon>);`, then `);`, then `out tags center qt;`.
    - Use the invariant culture, and write latitude and longitude with exactly 5 decimal places (`F5`).
    - Escape `\` as `\\` and `"` as `\"` in keys and values. Comment that `PlaceTagParser` already allows no quotes and this is a second guard against injection.
  - **`OverpassResponse`** (`internal` records with `[JsonPropertyName]`):
    - `remark` (`string?`) and `elements` (`List<OverpassElement>?`);
    - each `OverpassElement` has `type`, `id` (`long`), `lat` and `lon` (`double?`), `center` (`{ lat, lon }?`) and `tags` (`Dictionary<string, string>?`).
  - **`OverpassMapPlacesClient(HttpClient httpClient, ILogger<OverpassMapPlacesClient> logger) : IMapPlacesClient`**:
    - Constants: `BaseAddress = new("https://overpass-api.de/")`, `Path = "api/interpreter"`, `Timeout = TimeSpan.FromSeconds(4)` (comment: the page waits 10 s; an uncached location lookup may take 5), and `UserAgent = "SpekLaiku/1.0"` (comment: the Overpass usage policy asks for an identifying agent; it holds no personal data).
    - It calls `ExternalServiceJson.PostFormAsync<OverpassResponse>` with the field `data` = the query.
    - A `remark` containing "runtime error" fails through `ExternalServiceJson.Failure(...)` with status 200: `FailureKind.Timeout` when the remark contains "timed out" (case-insensitive), otherwise `FailureKind.InvalidResponse`.
    - A missing `elements` array is `InvalidResponse`.
    - Each element becomes a `MapElement` with key `"<type>/<id>"`, the node's `lat`/`lon` or else the `center`, and its tags (an empty dictionary when none). An element with no position is skipped.
    - It never logs the position, radius or tags. Keep it under 200 lines.
  - In `Api/Program.cs`:
    - `AddHttpClient<IMapPlacesClient, OverpassMapPlacesClient>(client => { client.BaseAddress = …; client.Timeout = …; client.DefaultRequestHeaders.UserAgent.ParseAdd(OverpassMapPlacesClient.UserAgent); })`;
    - `.RemoveAllLoggers()`, with the comment "The request body holds the plan's position; only the client's own warning is logged."
- [X] T006 Add `UnitTests/OverpassMapPlacesClientTests.cs` with `FakeHttpMessageHandler` and `CapturingLoggerProvider`, following `OpenMeteoForecastClientTests.cs`. Cover:
  - **The request**:
    - a `POST` to `api/interpreter` with a form field `data`;
    - for latitude 54.8972, longitude 23.8861, radius 30 and the tags `leisure=slipway`, `sport=canoe` and `leisure=slipway`, the exact query text with two statements, `around:30000,54.89720,23.88610`, `["name"]` and `out tags center qt;`;
    - the `User-Agent` header `SpekLaiku/1.0` when the client is built as in `Program.cs`;
    - `"` and `\` in a tag escaped.
  - **The answer**:
    - a node with `lat`/`lon` and a way with `center` both parsed, with keys `node/1` and `way/2` and their tags;
    - a relation without a centre is skipped;
    - an element without `tags` gets an empty dictionary.
  - **Failures**:
    - a `remark` "runtime error: Query timed out in \"query\" at line 3 after 4 seconds." gives `Timeout`, and "runtime error: Query run out of memory" gives `InvalidResponse`, each with one warning;
    - a timeout, a network error, status `429`, status `504`, invalid JSON and a body without `elements` each give their kind and exactly one warning;
    - no warning contains the coordinates, the radius or a tag.

### Backend: options, distance and place rules

- [X] T007 [P] Create `Api/Services/PlacesOptions.cs` (research section 6), following `ForecastOptions.cs`:
  - `SectionName = "Places"`;
  - `MaxRadiusKm` = 50: "1 ≤ value ≤ 200";
  - `MaxPlacesPerActivity` = 5: "1 ≤ value ≤ 20";
  - `MaxAgeHours` = 24: "≥ 1";
  - `static bool IsValid(PlacesOptions)` and `InvalidMessage` = "Places:MaxRadiusKm must be 1 to 200, MaxPlacesPerActivity 1 to 20 and MaxAgeHours at least 1."
  - Add `"Places": { "MaxRadiusKm": 50, "MaxPlacesPerActivity": 5, "MaxAgeHours": 24 }` to `Api/appsettings.json`.
  - Register it in `Api/Program.cs` with `AddOptions<PlacesOptions>().Bind(...).Validate(PlacesOptions.IsValid, PlacesOptions.InvalidMessage).ValidateOnStart()`.
  - Add `UnitTests/PlacesOptionsTests.cs`: the defaults are valid, each bound is valid, and 0 and 201 km, 0 and 21 places, and 0 hours are invalid.
- [X] T008 [P] Create `Api/Services/GeoDistance.cs`: `public static double Kilometres(double latitude1, double longitude1, double latitude2, double longitude2)` using haversine and `EarthRadiusKm = 6371.0088` (research section 3).
  - Add `UnitTests/GeoDistanceTests.cs`:
    - zero for the same point;
    - 0.01° of latitude along a meridian ≈ 1.112 km (±0.001);
    - a pair of fixed positions checked against an independently computed value to within 0.01 km;
    - symmetry.
- [X] T009 Create `Api/Services/NearbyPlace.cs` and `Api/Services/NearbyPlaceRules.cs` (`data-model.md` NearbyPlace and NearbyPlaceRules; research sections 3 and 4). This depends on T004 and T008.
  - **`NearbyPlace`**: `public sealed record NearbyPlace(string Name, double Latitude, double Longitude, decimal DistanceKm, string? Area, string Key)`.
  - **`NearbyPlaceRules.For(IReadOnlyList<MapElement> elements, IReadOnlyList<string> categoryTags, PlaceLocation origin, int radiusKm, int maxPlaces)`**:
    1. Keep elements where some `$"{key}={value}"` of its tags exactly equals one of `categoryTags` (ordinal).
    2. The name is `name:lt` when present and not blank, otherwise `name`, trimmed; skip the element when it is blank.
    3. The area is `addr:city`, trimmed, or `null` when missing or blank.
    4. `DistanceKm = Math.Round((decimal)GeoDistance.Kilometres(origin…, element…), 1, MidpointRounding.AwayFromZero)`; keep `DistanceKm <= radiusKm`.
    5. Keep one element per `Key`.
    6. Order by `DistanceKm`, then `Name` with `CultureInfo.GetCultureInfo("lt-LT").CompareInfo`, then `Key` (ordinal).
    7. Take `maxPlaces`.
    8. Round the latitude and longitude to 5 decimal places (`Math.Round(…, 5, MidpointRounding.AwayFromZero)`).
  - Comment that the shown distance is the one compared and ordered (research section 3). Keep it under 200 lines.
- [X] T010 Add `UnitTests/NearbyPlaceRulesTests.cs` with hand-built `MapElement` lists and an origin `PlaceLocation`. Cover:
  - **Edge of the circle**: places inside, exactly on the edge (a position whose rounded distance equals the radius) and just outside (rounded distance radius + 0.1).
  - **Names**:
    - an element without `name`;
    - `name:lt` preferred over `name`;
    - a blank `name:lt` falls back to `name`;
    - a blank `name` is skipped.
  - **Matching**:
    - one element matching two of the category's tags is listed once;
    - an element matching no tag of the category is left out;
    - `leisure=slipway` does not match `leisure=slipway_extra` or a tag `leisurex=slipway`.
  - **Order and count**:
    - 7 matches keep the 5 nearest;
    - two places at the same rounded distance are ordered by name in Lithuanian order ("Cukrus" before "Čiurlionis" before "Dainava");
    - equal name and distance are ordered by `Key`;
    - two places with the same name at different positions are both listed.
  - **Values**: the area from `addr:city`, missing or blank; distance and position rounding.

### Backend: shared plan check and clock

- [X] T011 Add to `Api/Services/ForecastPeriod.cs` `public static TimeOnly ToLithuanianMinute(DateTimeOffset instant)` (the conversion now private in `PlanForecastService.ToMinute`).
  - Make `PlanForecastService` use it and delete `ToMinute`.
  - Extend `UnitTests/ForecastPeriodTests.cs`: 12:05:59 UTC in winter gives 14:05, and in summer gives 15:05.
- [X] T012 Create `Api/Services/PlanRecheckResult.cs` and `Api/Services/PlanRecheckService.cs` (research section 2, `data-model.md` PlanRecheckService). This depends on T011 because it touches `PlanForecastService`.
  - **The result**: `Succeeded` (with `[MemberNotNullWhen(true, nameof(Setup))]`), `Setup` (`CheckedPlanSetup?`), `Activities`, and `Errors`. It follows `PlanForecastResult.cs`.
  - **`PlanRecheckService(PlanSetupService, PlanActivityService)`**, `CheckAsync(PlanSetupCheckRequest? setup, List<PlanActivityRequest>? activities, CancellationToken)`. The logic moves from `PlanForecastService` unchanged:
    1. a missing setup gives `("setup", "The request is invalid.")`;
    2. setup errors come back with every key prefixed `setup.`, and nothing else runs;
    3. activity errors come back unchanged;
    4. otherwise success.
  - Move the constants `SetupKey` and `MissingSetupMessage` to it.
  - Change `PlanForecastService` to take `PlanRecheckService` instead of the two services, call it first, and keep its forecast-date check after the forecast.
  - Register `AddScoped<PlanRecheckService>()` in `Api/Program.cs`.
  - Add `UnitTests/PlanRecheckServiceTests.cs` as new tests: the three error cases and their key order, and success with the checked setup and activities in request order.
  - In `UnitTests/PlanForecastServiceTests.cs`, change only how the service is built (pass a `PlanRecheckService`). Keep every existing test, including the error-path tests and their check that the weather client is not called. Do not move or remove any of them (constitution III). Every `PlanForecast*` integration test must also pass unchanged.

### Backend: test fakes

- [X] T013 [P] Create `UnitTests/RecordingMapPlacesClient.cs`, following `RecordingForecastClient.cs`:
  - it records each call's latitude, longitude, radius and tags;
  - it returns a scripted element list, or throws a scripted `ExternalServiceException(ExternalService.MapData, kind)`.
- [X] T014 [P] Create `IntegrationTests/FakeMapPlacesClient.cs`, following `FakeForecastClient.cs`:
  - answers are scripted per position (`Script(latitude, longitude, IReadOnlyList<MapElement>)`), and the client returns only the scripted elements that have at least one of the requested tags;
  - `ScriptFailure(latitude, longitude, FailureKind)` and `ScriptRecovery(...)`;
  - an unscripted position throws `InvalidResponse`;
  - `Calls` and `LastTags` for assertions;
  - a static helper `Element(string key, double latitude, double longitude, params (string Key, string Value)[] tags)`.

  Comment that the cache is shared by the test collection, so every test uses its own place id and position. In `IntegrationTests/PostgreSqlApiFactory.cs`, add `public FakeMapPlacesClient MapPlaces { get; } = new();` and replace `IMapPlacesClient` in `ConfigureTestServices` next to the other fakes.

### Frontend

- [X] T015 [P] Create `web/types/planPlaces.ts` with `NearbyPlace`, `CategoryPlaces`, `PlanPlaces` and `type PlanPlacesRequest = PlanForecastRequest`, exactly as in `data-model.md` (Frontend types).
- [X] T016 [P] Rename `web/helpers/planForecastRequest.ts` to `web/helpers/checkedPlanRequest.ts`, and the function to `checkedPlanRequest`.
  - Comment that it builds the body of both step 3 requests.
  - Rename `web/tests/planForecastRequest.test.ts` to `web/tests/checkedPlanRequest.test.ts`.
  - Update the import in `web/stores/usePlanForecastStore.ts`. No behaviour changes.
- [X] T017 Create `web/helpers/timedRequest.ts`. This depends on T016 because it touches `usePlanForecastStore.ts`.
  - It exports `planRequestTimeoutMs = 10_000` and `startTimeout(controller: AbortController): () => void`, which starts a timer that aborts the controller after `planRequestTimeoutMs` and returns a function that clears it.
  - Make `web/stores/usePlanForecastStore.ts` use it. Keep `planForecastTimeoutMs` as a re-export only if existing tests import it; otherwise update them.
  - Add `web/tests/timedRequest.test.ts` with fake timers: it aborts at 10 s, and does not abort when cleared earlier.
  - `web/tests/usePlanForecastStore.test.ts` must pass unchanged in behaviour.
- [X] T018 [P] Create `web/helpers/placeText.ts` and `web/helpers/openStreetMapLink.ts`, with `web/tests/placeText.test.ts` and `web/tests/openStreetMapLink.test.ts`.
  - `placeDistanceText(distanceKm)` returns `"3.4 km away"`, always one decimal place (`3` gives `"3.0 km away"`).
  - `openStreetMapLink(latitude, longitude)` returns `https://www.openstreetmap.org/?mlat=<lat>&mlon=<lon>#map=17/<lat>/<lon>` with the numbers as given.

**Checkpoint**: These pieces exist and are tested: the client, the shared JSON handling, the `503` for places, the options, distance, place rules, shared plan check, fakes, types and helpers. Every feature 006 test still passes.

---

## Phase 3: User Story 1 - See nearby places for each activity (Priority: P1) 🎯 MVP

**Goal**: Step 3 gets the places for the checked plan at the same time as the forecast. It shows "Getting the forecast and nearby places…" until both have arrived, then each activity's "Places" list (name, distance, area, "View on map") and "Places updated at HH:MM".

**Independent Test**:

1. Use a checked setup in Kaunas, and checked activities Kayaking (`leisure=slipway`, `sport=canoe`) and Museum (`tourism=museum`).
2. Make the fake map data service return three matching places for each.
3. Open step 3. Each activity lists its places, nearest first, with name, distance and area.

### Tests for User Story 1 ⚠️

- [X] T019 [P] [US1] Add `UnitTests/NearbyPlacesServiceTests.cs` with `RecordingMapPlacesClient`, a real `MemoryCache` and a `ForecastPeriod` built on `FixedTimeProvider`. Cover:
  - **One call**: two uncached categories with overlapping tags give one client call with the distinct tags, at the location's position and radius, and each category gets only its own matches.
  - **No call when cached**: a second call within 23 h 59 min makes no client call and returns the same `ReceivedAt`. At 24 h it calls again.
  - **Partly cached**: one cached and one new category asks the client only for the new category's tags.
  - **The key**:
    - the same tags in another order share one entry;
    - a different radius or location id does not;
    - a category's changed tags ask again.
  - **No tags**: a category with no tags gets an empty list without a call.
  - **Failures**: a failure is not cached, and the next call reaches the client.
- [X] T020 [P] [US1] Add `UnitTests/PlanPlacesServiceTests.cs`. Build `PlanRecheckService` with `RecordingGeocodingClient` and the EF Core in-memory database, as in `PlanForecastServiceTests.cs`, and seed categories with `PlaceTags`. Use `NearbyPlacesService` with `RecordingMapPlacesClient`. Cover the success path:
  - `Categories` has one entry per distinct category in order of first appearance;
  - two activities of the same category give one entry;
  - the tags come from the database;
  - `RadiusKm` is the plan's maximum travel distance (10 gives 10) and is capped by `MaxRadiusKm` (80 gives 50);
  - `UpdatedAt` is the oldest `ReceivedAt` in Lithuanian time to the minute (one category received at 09:00, then a new one at 10:30, gives 09:00).

  The error paths come in US5 (T062).
- [X] T021 [P] [US1] Add `UnitTests/PlanPlacesMappingTests.cs`:
  - build the configuration with both `PlanPlacesMappingProfile` and `PlanForecastMappingProfile`, because the one `TimeOnly` to `"HH:mm"` conversion lives in the forecast profile (T029);
  - the configuration is valid;
  - a `PlanPlaces` maps to `PlanPlacesResponse` with `updatedAt` as `"HH:mm"`, `radiusKm`, `categoryId`, and each place's `name`, `latitude`, `longitude`, `distanceKm` and `area` (including `null`);
  - `NearbyPlace.Key` is not in the response type.
- [X] T022 [P] [US1] Add `IntegrationTests/PlanPlacesEndpointTests.cs` (collection `PostgreSqlCollection`).
  - Use your own place id and position, scripted in `FakeGeocodingClient` and `FakeMapPlacesClient`, and your own categories with `UniqueCategoryName` and their own tags.
  - Set `Clock` to a fixed time and set it back at the end.
  - As a Visitor, cover the `200` contract in `contracts/plan-places-api.md`:
    - places nearest first, with rounded `distanceKm` and 5-decimal positions;
    - `area` from `addr:city` or `null`;
    - an unnamed element left out;
    - at most 5 places;
    - two activities of one category give one `categories` entry;
    - a category without a match gives `places: []`;
    - `radiusKm` 10 for a 10 km plan and 50 for an 80 km plan;
    - `updatedAt` `"HH:mm"` in Lithuanian time;
    - the raw JSON has only the documented keys (no `tags`, `key` or element ids).
- [X] T023 [P] [US1] Add `web/tests/planPlacesApi.test.ts` and `web/tests/usePlanPlacesStore.test.ts` (loading part), with `routeFetch`, following the forecast tests. Cover:
  - `getPlanPlaces` sends `POST /api/plan-places` with the body from `checkedPlanRequest` and maps `200` to `{ kind: "places" }`;
  - any other status not yet handled throws `ApiError`;
  - the store goes `loading` → `loaded` with `places`;
  - a second `load` while loading sends no request;
  - `reset` aborts and drops a late answer;
  - a thrown error sets `serverError`.
- [X] T024 [P] [US1] Extend `web/tests/PlacesAndForecastPage.test.tsx` (places part).
  - Add a shared `placesRoutes` answer for `POST /api/plan-places` in a new `web/tests/placesFixtures.ts`, next to `forecastFixtures.ts`.
  - Add it to the route stubs of every older test file that passes through step 3: `ActivitySelectionPage`, `keyboard`, `responsive`, `accessibility`, `planCreatorOnly` and `layout`. Where a test counts every `POST`, make it count only its own path. Do not remove or weaken any assertion.
  - Cover:
    - "Getting the forecast and nearby places…" in the status region;
    - nothing else (no overview, places or forecast) shown until both answers arrive, with the places answering first in one test and the forecast first in another;
    - exactly one request to each endpoint;
    - leaving step 3 (Back) and opening it again sends a new request to `/api/plan-places` (spec FR-023);
    - no `sessionStorage` entry holds any place name after the places are shown (spec FR-023);
    - both bodies built from the checked values;
    - under each activity a "Places" heading and list with name, "3.4 km away" and area (or none);
    - "View on map" with `href` from `openStreetMapLink` and `target="_blank"`;
    - two activities of the same category list the same places;
    - "Places updated at 14:05" and "Forecast updated at 14:05";
    - the forecast errors from feature 006 still show with Retry.

### Implementation for User Story 1

- [X] T025 [US1] Create `Api/Services/CategoryTags.cs` (`record CategoryTags(Guid CategoryId, IReadOnlyList<string> Tags)`), `Api/Services/ReceivedPlaces.cs` (`record ReceivedPlaces(IReadOnlyList<NearbyPlace> Places, DateTimeOffset ReceivedAt)`) and `Api/Services/NearbyPlacesService.cs`. The service takes `IMapPlacesClient`, `IMemoryCache`, `ForecastPeriod` and `IOptions<PlacesOptions>`, and no `TimeProvider`.
  - `GetAsync(PlaceLocation location, int radiusKm, IReadOnlyList<CategoryTags> categories, CancellationToken)` follows `data-model.md` (NearbyPlacesService) exactly:
    - the key is `places:<location.Id>:<radiusKm>:<string.Join(",", tags.Order(StringComparer.Ordinal))>`;
    - an entry is used while `forecastPeriod.GetNow() − ReceivedAt < MaxAgeHours`;
    - one client call with the distinct tags of the categories that need one;
    - `NearbyPlaceRules.For` per category, and the entry is stored with `AbsoluteExpirationRelativeToNow = MaxAgeHours`;
    - failures pass through and nothing new is stored;
    - a category with no tags gets an empty list, with no call and no entry.
  - Register `AddScoped<NearbyPlacesService>()`. Keep it under 200 lines.
- [X] T026 [P] [US1] Create the request and service records:
  - `Api/DTOs/Requests/PlanPlacesRequest.cs`: `record PlanPlacesRequest(PlanSetupCheckRequest? Setup, List<PlanActivityRequest>? Activities)`, with a comment that it is the same body as the forecast request (research section 1);
  - `Api/Services/CategoryPlaces.cs`: `record CategoryPlaces(Guid CategoryId, IReadOnlyList<NearbyPlace> Places)`;
  - `Api/Services/PlanPlaces.cs`: `record PlanPlaces(TimeOnly UpdatedAt, int RadiusKm, IReadOnlyList<CategoryPlaces> Categories)`;
  - `Api/Services/PlanPlacesResult.cs`, following `PlanForecastResult.cs`.
- [X] T027 [US1] Create `Api/Services/PlanPlacesService.cs`. It takes `PlanRecheckService`, `ApplicationDbContext`, `NearbyPlacesService` and `IOptions<PlacesOptions>`, and follows `data-model.md` (PlanPlacesService):
  1. Recheck; return its errors unchanged.
  2. Read `Id` and `PlaceTags` for the distinct checked category ids in one `AsNoTracking` query. A missing category gets no tags.
  3. `radiusKm = Math.Min(setup.MaxTravelDistanceKm, MaxRadiusKm)`.
  4. `NearbyPlacesService.GetAsync` for `setup.Location`, with the categories in order of first appearance.
  5. `UpdatedAt = ForecastPeriod.ToLithuanianMinute(oldest ReceivedAt)`.

  Register `AddScoped<PlanPlacesService>()`. Keep it under 200 lines.
- [X] T028 [P] [US1] Create the response DTOs in `Api/DTOs/Responses/` as in `contracts/plan-places-api.md`:
  - `PlanPlacesResponse(string UpdatedAt, int RadiusKm, IReadOnlyList<CategoryPlacesResponse> Categories)`;
  - `CategoryPlacesResponse(Guid CategoryId, IReadOnlyList<NearbyPlaceResponse> Places)`;
  - `NearbyPlaceResponse(string Name, double Latitude, double Longitude, decimal DistanceKm, string? Area)`.
- [X] T029 [US1] Create `Api/Mapping/PlanPlacesMappingProfile.cs`: `PlanPlaces`, `CategoryPlaces` and `NearbyPlace` to their responses. No rules.
  - Do **not** add a second `CreateMap<TimeOnly, string>()`. The existing one in `PlanForecastMappingProfile` applies to every profile, because `AddAutoMapper` loads them all into one configuration. A duplicate map would fail configuration validation.
  - Add a comment pointing to it.
- [X] T030 [US1] Create `Api/Controllers/PlanPlacesController.cs`, following `PlanForecastController.cs`:
  - `[ApiController]`, `[Route("api/plan-places")]`, `[Authorize(Policy = AuthorizationPolicies.PlanCreator)]`, `[EnableRateLimiting(RateLimitPolicies.PlanSetup)]` and `[ProducesResponseType(StatusCodes.Status403Forbidden)]`;
  - one `[HttpPost]` returning `200` with `mapper.Map<PlanPlacesResponse>(result.Places)`, or `400` `ValidationProblemDetails` (keys in result order);
  - `ProducesResponseType` for `200`, `400`, `429` and `503`.

  In `Api/RateLimiting/RateLimitPolicies.cs`, change the comment to "Location searches, plan setup checks, forecast requests and place requests together".
- [X] T031 [US1] Create `web/api/planPlacesApi.ts` with `getPlanPlaces(request: PlanPlacesRequest, signal?: AbortSignal)`. `200` gives `{ kind: "places"; places }`, and every other status throws `ApiError(status)` for now (US4 to US6 add the other kinds). Follow `planForecastApi.ts`.
- [X] T032 [US1] Create `web/stores/usePlanPlacesStore.ts` (not persisted, `data-model.md` Plan places store), following `usePlanForecastStore.ts` and using `checkedPlanRequest` and `startTimeout`.
  - For now the statuses are `idle`, `loading`, `loaded` and `serverError`.
  - `load` is ignored while `loading`.
  - `reset()` aborts and drops a late answer.
  - Export `initialPlanPlacesState` and reset the store in `web/tests/setup.ts`.
- [X] T033 [P] [US1] Create `web/components/placeListItem.tsx` and `web/components/activityPlaces.tsx` (research section 12).
  - **`PlaceListItem`** (`place: NearbyPlace`) renders an `<li>` with:
    - the name;
    - `placeDistanceText` and, when there is one, the area (for example "Nemuno slipway · 3.4 km away · Kaunas");
    - an `<a href={openStreetMapLink(…)} target="_blank" rel="noopener noreferrer">View on map</a>`. US7 adds the accessible name.
  - **`ActivityPlaces`** (`places: NearbyPlace[] | undefined`) renders `<h3>Places</h3>` and a `<ul className="places-list">` of `PlaceListItem`. Nothing is rendered when `places` is `undefined`. US2 adds the empty case, and US4 adds "Not available" and "Getting nearby places…".
- [X] T034 [US1] Create `web/components/placesAndForecastStatus.tsx` to replace `web/components/planForecastStatus.tsx`, which is deleted along with its imports (research section 12). It is one `<div role="status" aria-label="Places and forecast" className="forecast-status">`:
  - **First load**: while either store is `idle` or `loading`, only "Getting the forecast and nearby places…".
  - **Afterwards**, the forecast line and then the places line:
    - "Forecast updated at HH:MM" or the feature 006 forecast error with its Retry, unchanged in wording and behaviour;
    - "Places updated at HH:MM" when the places store is `loaded`. US4 adds the places errors.
  - Move any test that targeted `PlanForecastStatus` to the new component, without weakening it. Keep it under about 200 lines.
- [X] T035 [US1] Change `web/components/planActivitiesSummary.tsx`:
  - add an optional prop `places?: PlanPlaces`;
  - in each section, render `<ActivityPlaces>` right after the `<h2>`, with the places of the `categories` entry whose `categoryId` equals the activity's `categoryId`;
  - keep everything else as it is (US3 changes the settings and the forecast).
- [X] T036 [US1] Change `web/pages/PlacesAndForecastPage.tsx` (research section 10):
  - The effect depends on `hasSetup` and `hasActivities` (booleans), and reads the checked values with `getState()` inside the effect. It calls `load` on both stores and `reset` on both in the cleanup.
  - While either store is `idle` or `loading`, render only the heading, progress, setup summary, `PlacesAndForecastStatus` and Back.
  - Then render the activities with `forecast` (when `loaded`) and `places` (when `loaded`).
  - Keep the title, `h1`, the redirects in their order, and Back. Update the top comment. Keep it under about 200 lines.

**Checkpoint**: A visitor sees, under each activity, the nearest places found on the server from a fake map data service, after one combined loading message.

---

## Phase 4: User Story 2 - Know what to do when no place is found (Priority: P1)

**Goal**: An activity without a place shows "✗ No place found within <radius> km." with Remove and Change activity:

- **Remove** takes it out without a new request and moves focus.
- **Change activity** opens Activity selection on that activity.

**Independent Test**:

1. Make the fake map data service return no place for Kayaking, and open step 3.
2. Kayaking shows "No place found within 30 km." with Remove and Change activity.
3. Select Remove. Kayaking is gone and the other activities stay.

### Tests for User Story 2 ⚠️

- [X] T037 [P] [US2] Extend the store tests.
  - `web/tests/usePlanActivitiesStore.test.ts`: `removeChecked(id)` removes the activity from `activities` and from `checked`, keeps the others checked and in order, persists, and sets `checked` to `null` only when the last one is removed.
  - `web/tests/usePlanForecastStore.test.ts`: `removeActivity(id)` drops the matching `forecast.activities` entry and the `lastActivities` entry, so Retry sends the shorter list.
  - `web/tests/usePlanPlacesStore.test.ts`: `removeActivity(id)` drops the `lastActivities` entry and keeps `places`.
- [X] T038 [P] [US2] Extend `web/tests/PlacesAndForecastPage.test.tsx` (no place part), with a places answer whose Kayaking category has `places: []` and `radiusKm: 30`. Cover:
  - "✗ No place found within 30 km." with buttons "Remove" and "Change activity", whose accessible names are "Remove, Kayaking" and "Change activity, Kayaking";
  - **Remove**:
    - "Kayaking removed." in a status region, and focus on the next activity's `h2` (the previous one when Kayaking was last);
    - the other activities keep their places and forecast, and no new request goes to either endpoint;
    - Activity selection no longer lists Kayaking;
  - removing the only activity leads to `/plan/activities` with "No activities added yet. Select at least one category to continue.";
  - **Change activity** leads to `/plan/activities` with every activity kept and focus on Kayaking's heading;
  - an activity the user keeps stays flagged after a reload of step 3.
- [X] T039 [P] [US2] Extend `web/tests/ActivitySelectionPage.test.tsx`: with router state `{ focusActivityId }`, the page focuses `activity-<id>-heading` once after it renders. Without the state, focus is unchanged. An unknown id does nothing.

### Implementation for User Story 2

- [X] T040 [US2] Add `removeChecked(id)` to `web/stores/usePlanActivitiesStore.ts`, as in research section 11 and `data-model.md` (Plan activities store). Comment that the existing `remove(id)` also unchecks the list, which step 3 must not do (spec FR-020).
- [X] T041 [P] [US2] Add `removeActivity(id)` to `web/stores/usePlanForecastStore.ts` and to `web/stores/usePlanPlacesStore.ts`, as in `data-model.md`. Both find the index in `lastActivities` by `id` and do nothing when it is not there.
- [X] T042 [US2] Extend `web/components/activityPlaces.tsx`.
  - Add the props `radiusKm`, `activityName`, `onRemove` and `onChange`.
  - When `places` is an empty array, render `<p>✗ No place found within {radiusKm} km.</p>` and two `<button type="button">`: "Remove" with `aria-label="Remove, <name>"`, and "Change activity" with `aria-label="Change activity, <name>"`.
- [X] T043 [US2] Change `web/components/planActivitiesSummary.tsx`:
  - give each `<h2>` `tabIndex={-1}`;
  - pass `radiusKm`, the shown name and the handlers to `ActivityPlaces`;
  - **Remove**:
    - remember the next activity's id (or the previous one when last);
    - call `usePlanActivitiesStore.getState().removeChecked(id)`, `usePlanForecastStore.getState().removeActivity(id)` and `usePlanPlacesStore.getState().removeActivity(id)` in the same handler;
    - set a local `removedMessage` ("<name> removed.") shown in a visually hidden `<p role="status">` inside the list;
    - focus the remembered heading in an effect after the render.
  - **Change activity**: `navigate("/plan/activities", { state: { focusActivityId: id } })`.
  - Keep it under about 200 lines. Move the section body into `web/components/activitySection.tsx` if needed.
- [X] T044 [P] [US2] Add `focusActivityId?: string` to `web/types/navigationState.ts`, with a comment. In `web/pages/ActivitySelectionPage.tsx`, read it with `useLocation()`, and in an effect after the activities render, focus `document.getElementById(\`activity-${id}-heading\`)` once.

**Checkpoint**: Activities without a place are flagged with the reason, and the user can remove or change them without losing the rest of the step.

---

## Phase 5: User Story 3 - See every activity on every date at a glance (Priority: P1)

**Goal**: Step 3 starts with a "Plan overview" table:

- one row per activity, a "Place" column, and one column per date;
- each date heading shows its sunrise and sunset once;
- each cell shows the longest suitable period.

Each activity section has one settings line, its summary, and closed forecast details.

**Independent Test**:

1. Use 3 activities, 2 dates and a fake forecast, and open step 3.
2. The overview has 3 rows and 2 date columns.
3. Each date heading shows its sunrise and sunset once.
4. Each cell shows the longest suitable period or "✗ None".

### Tests for User Story 3 ⚠️

- [X] T045 [P] [US3] Extend the backend forecast tests (`contracts/plan-forecast-api-changes.md` section 1):
  - `UnitTests/SuitablePeriodsTests.cs`: `Longest` of an empty list is `null`; a single period; 08–10 and 12–16 give 12–16; 08–10 and 12–14 give 08–10 (the earliest on equal length); the longest last.
  - `UnitTests/ActivityForecastsTests.cs`: each day has `LongestPeriod`; it is `null` without periods.
  - `UnitTests/PlanForecastMappingTests.cs`: `longestPeriod` is mapped, including `null`.
  - `IntegrationTests/PlanForecastEndpointTests.cs`: each activity date has `longestPeriod` in the JSON, and an Indoor activity without daylight gets 06:00–22:00 (16 h).
- [X] T046 [P] [US3] Add helper tests:
  - `web/tests/overviewCellText.test.ts`:
    - "★ 10:00–14:00 (4 h)";
    - "★ 10:00–11:00 (1 h), too short";
    - "✗ None" (no longest period, hours left);
    - "No hours left" (no hours);
    - the place cell gives the nearest name or "✗ No place found".
  - `web/tests/activitySettingsText.test.ts`: the Outdoor line "Outdoor · 2 h · Requires daylight · Wind up to 8 m/s · Rain up to 0.5 mm/h · 15 to 35 °C", and the Indoor lines with and without daylight.
  - Extend `web/tests/formatPlanDate.test.ts`: `formatPlanDateShort("2026-11-14")` is "Sat 14 Nov".
- [X] T047 [P] [US3] Extend `web/tests/PlacesAndForecastPage.test.tsx` (overview part). Cover:
  - **The table**:
    - a table with the caption "Plan overview" above the activities;
    - column headings "Activity", "Place" and one per date ("Sat 14 Nov · Sunrise 07:42 · Sunset 16:21") in date order;
    - a row heading per activity in plan order with the shown name ("Cycling 1", "Cycling 2");
    - the cell texts from T046, the Indoor no-daylight row "★ 06:00–22:00 (16 h)", and the Place cell.
  - **The sections**:
    - no "Sunrise" text inside the activity sections;
    - each section has its one settings line and summary, and a "Show forecast details" button with `aria-expanded="false"` and the accessible name "Show forecast details, Kayaking";
    - opening it shows the date entries and their "Show hours" buttons, and closing hides them;
    - there is no "Generate schedule" button.
  - Update the feature 006 page tests that read the date entries so they open the details first. Do not weaken any assertion.

### Implementation for User Story 3

- [X] T048 [US3] Change the backend forecast models:
  - Add `public static SuitablePeriod? Longest(IReadOnlyList<SuitablePeriod> periods)` to `Api/Services/SuitablePeriods.cs`: the first period with the greatest `LengthHours`, or `null`.
  - Add `SuitablePeriod? LongestPeriod` to `Api/Services/ActivityDayForecast.cs`, and set it in `ActivityForecasts.ForDay`.
  - Add `SuitablePeriodResponse? LongestPeriod` to `Api/DTOs/Responses/ActivityDayForecastResponse.cs`. AutoMapper maps it by name; confirm with T045.
- [X] T049 [P] [US3] In `web/types/planForecast.ts`, add `longestPeriod: SuitablePeriod | null` to `ActivityDayForecast`, with a comment that the server picks it. Update `web/tests/forecastFixtures.ts` so every activity date has the right `longestPeriod`.
- [X] T050 [P] [US3] Create the helpers:
  - add `formatPlanDateShort` to `web/helpers/formatPlanDate.ts` (weekday, day and short month; no year);
  - create `web/helpers/overviewCellText.ts` with `dateCellText(day: ForecastDay, activityDay: ActivityDayForecast)` (", too short" comes from the server's `shorterThanDuration`, not from comparing with the duration) and `placeCellText(places: NearbyPlace[])`, as in `data-model.md` (Helpers);
  - create `web/helpers/activitySettingsText.ts`.

  They only word server values.
- [X] T051 [US3] Create `web/components/planOverview.tsx` (research section 12).
  - **Props**: `activities`, `names`, `forecast?: PlanForecast`, `places?: PlanPlaces`.
  - **Table**: `<table className="plan-overview">` with `<caption>Plan overview</caption>`.
    - `<thead>`: `<th scope="col">Activity</th>`, `<th scope="col">Place</th>`, then one `<th scope="col">` per `forecast.days` entry: "`formatPlanDateShort` · Sunrise HH:MM · Sunset HH:MM".
    - `<tbody>`: one row per activity, with `<th scope="row">` holding the shown name, then the place cell and the date cells.
  - **Cell labels**: each cell starts with a `<span className="cell-label">` ("Place: ", "Sat 14 Nov: ") that is visually hidden on desktop, as in `forecastHoursTable.tsx`.
  - US4 adds the states without a forecast or places. Keep it under about 200 lines.
- [X] T052 [US3] Change `web/components/activityForecast.tsx` and `web/components/forecastDateEntry.tsx`.
  - **`activityForecast.tsx`**:
    - Keep the summary line or the indoor message.
    - Add a `<button type="button" aria-expanded aria-controls>`. Its visible text is "Show forecast details" or "Hide forecast details", and its `aria-label` is the visible text followed by ", <name>". It is closed at first (local state).
    - The date list is rendered inside its controlled element only while open.
  - **`forecastDateEntry.tsx`**: remove the "Sunrise HH:MM · Sunset HH:MM" line (spec FR-017).
- [X] T053 [US3] In `web/components/planActivitiesSummary.tsx` (or `activitySection.tsx`), replace the two settings paragraphs with one `<p>{activitySettingsText(activity)}</p>`, placed after the places and before the forecast (spec FR-017).
- [X] T054 [US3] In `web/pages/PlacesAndForecastPage.tsx`, render `<PlanOverview>` between the status region and the activities, after the first load. Pass the same `forecast` and `places` as the activities get.

**Checkpoint**: The step answers "which activity suits which day, and where" at a glance, and the details stay closed until opened.

---

## Phase 6: User Story 4 - Know when the map data service is unavailable (Priority: P1)

**Goal**: A failure of the map data service hides every place. It shows one error with Retry, and "Not available" in the Place cells, while a forecast that arrived is still shown. A forecast failure shows "Not available" in the date cells. Retry keeps the step and loads only its own part. Place requests share the request limit, and each failure is recorded.

**Independent Test**:

1. Make the fake map data service fail while the fake weather service answers, and open step 3.
2. The places error and Retry are shown, no places are listed, and the forecast is shown.
3. Make the service answer and select Retry. The places appear.

### Tests for User Story 4 ⚠️

- [X] T055 [P] [US4] Add `IntegrationTests/PlanPlacesFailureTests.cs` (collection `PostgreSqlCollection`, `CapturingLoggerProvider`). Cover:
  - each `FailureKind` scripted in `FakeMapPlacesClient` gives `503` with `detail` "The map data service is unavailable. No places are shown." and `service: "places"`;
  - **all or nothing**: with one category cached and a second new category whose call fails, the answer is `503` with no places;
  - each failure writes exactly one warning containing "Map data service failed" and the kind, and no coordinates, tags or location id;
  - a failure is not cached: after `ScriptRecovery` the next request reaches the client and answers `200`;
  - a geocoding failure during the setup check (uncached location) gives `service: "locationSearch"`, and the map client is not called.
- [X] T056 [P] [US4] Extend `IntegrationTests/PlanSetupRateLimitTests.cs`:
  - location searches, setup checks, forecast requests and place requests from one address together get `429` on the 31st request in the window;
  - a refused place request does not reach `FakeMapPlacesClient` and is not logged as a service failure.
- [X] T057 [P] [US4] Extend `web/tests/planPlacesApi.test.ts` and `web/tests/usePlanPlacesStore.test.ts` (error part), and `web/tests/usePlanForecastStore.test.ts`. Cover:
  - `429` gives `{ kind: "tooManyRequests" }`;
  - `503` with `service: "places"` gives `{ kind: "mapUnavailable" }`;
  - a `503` with another service, a `500` and an unreadable `503` body throw `ApiError`;
  - **the places store**:
    - the statuses `mapUnavailable`, `tooManyRequests` and `serverError` (also after the 10-second timeout with fake timers);
    - `retry()` sets `retrying` and sends the last values;
    - a second `retry()` while `retrying` sends nothing;
    - a late answer after `reset()` is dropped;
  - **the forecast store**: `retry()` sets `retrying` (not `loading`), and `load` is ignored while `retrying`.
- [X] T058 [P] [US4] Extend `web/tests/PlacesAndForecastPage.test.tsx` (error part). Cover:
  - **The map data service unavailable**:
    - "Error: The map data service is unavailable. No places are shown." once above the overview, with Retry;
    - no "Places" lists and no "No place found";
    - every Place cell "Not available", every places area "Not available";
    - the forecast and date cells shown.
  - **Places Retry**:
    - the overview and forecast stay;
    - "Getting nearby places…" in the Place cells and the places areas, and announced in the status region;
    - then the places appear, with no new forecast request;
    - two quick Retry clicks send one request.
  - **Weather unavailable, places loaded**:
    - the overview stays, every date cell "Not available", date headings with only "Sat 14 Nov";
    - the forecast error with Retry above the overview;
    - the places shown.
  - **Forecast Retry**: date cells show "Getting the forecast…" until the answer.
  - **Both failing**: both errors, each with its own Retry, and the overview with "Not available" everywhere.
  - **Other places errors**: "Error: Too many requests. Wait a minute and try again." and "Error: Something went wrong. Try again." (also after 10 s), each with Retry.
  - **Leaving the page**: an answer arriving after leaving step 3 is ignored.

### Implementation for User Story 4

- [X] T059 [US4] Extend `web/api/planPlacesApi.ts` and `web/stores/usePlanPlacesStore.ts`, and change `web/stores/usePlanForecastStore.ts`.
  - **The API**: `429` gives `tooManyRequests`, and `503` with `service: "places"` gives `mapUnavailable`, reading the body as `planForecastApi.ts` does. Anything else throws.
  - **The places store**:
    - add `retrying`, `mapUnavailable` and `tooManyRequests`;
    - `retry()` sets `retrying` and is ignored while `loading` or `retrying`;
    - places are held only while `loaded`.
  - **The forecast store**:
    - `retry()` sets `retrying` instead of `loading`, and `load` is ignored while `retrying` too;
    - update `PlanForecastStatus`'s union type and comments.
    - **Done early in US1 (T034, T036)**: without it, a forecast Retry after the first load would hide the whole step behind the first-load message and break the feature 006 Retry test. `usePlanForecastStore.test.ts` has a test for it, and the status region already shows "Getting the forecast…" while `retrying`.
- [X] T060 [US4] Extend `web/components/placesAndForecastStatus.tsx`.
  - **The places line**:
    - "Getting nearby places…" while `retrying`;
    - otherwise "Error: The map data service is unavailable. No places are shown.", "Error: Too many requests. Wait a minute and try again." or "Error: Something went wrong. Try again.", each in a `server-error` block with its own Retry calling `usePlanPlacesStore.getState().retry()`.
  - **The forecast line**: "Getting the forecast…" while `retrying`.
  - Use `formatErrorMessage` as now. Both errors can show together.
- [X] T061 [US4] Show the states without data (spec FR-009, FR-015, FR-016).
  - In `web/components/activityPlaces.tsx`, add a `state` prop: `"loaded"`, `"retrying"` ("Getting nearby places…") or `"unavailable"` ("Not available"). The no-place flag is shown only when `"loaded"`.
  - In `web/components/planOverview.tsx` and `web/helpers/overviewCellText.ts`:
    - without places, the Place cells show "Not available", or "Getting nearby places…" while `retrying`;
    - without a forecast, the date headings come from the checked setup's dates and show only `formatPlanDateShort`;
    - the date cells show "Not available", or "Getting the forecast…" while `retrying`.
  - In `web/pages/PlacesAndForecastPage.tsx` and `web/components/planActivitiesSummary.tsx`, pass these states from the two stores.

**Checkpoint**: No failure ever shows places, partial places or old places as current. Each service has its own error and Retry, and the shared limit counts place requests.

---

## Phase 7: User Story 5 - Places match the checked plan (Priority: P1)

**Goal**: The server checks the setup and activities again before searching. It takes the position from the location service and the tags from the database, and never sends the tags back. An out-of-date plan sends the user back with the "checked again" notice.

**Independent Test**: Send a place request directly to the server with:

- an unknown location id;
- a date in the past;
- an unknown category;
- made-up tags.

Each is refused or ignored as described, and the map data service is not contacted for a refused request.

### Tests for User Story 5 ⚠️

- [X] T062 [P] [US5] Extend `UnitTests/PlanPlacesServiceTests.cs` (error paths):
  - a missing setup gives `setup`;
  - a past date gives `setup.dates[0]`, an unknown location gives `setup.locationId`, and no activity check runs;
  - an invalid wind limit gives `activities[0].maxWindMs`, and an unknown category gives `activities[0]`;
  - in every case `RecordingMapPlacesClient` has no call;
  - a category removed from the database between the check and the tag query gets an empty list.
- [X] T063 [P] [US5] Extend `IntegrationTests/PlanPlacesEndpointTests.cs` (`400` and tags):
  - the `400` keys above;
  - a string for a number gives `request`;
  - `FakeMapPlacesClient.Calls` is unchanged after each refused request;
  - a request body with an extra `"placeTags": ["amenity=bench"]` on an activity is answered with the stored tags (`LastTags`), and the JSON has no `placeTags`;
  - after an administrator changes the category's tags through `PUT /api/admin/categories/{id}`, the next request asks the client for the new tags.
- [X] T064 [P] [US5] Extend `web/tests/planPlacesApi.test.ts`, `web/tests/usePlanPlacesStore.test.ts` and `web/tests/PlacesAndForecastPage.test.tsx`:
  - a `400` with a `setup…` key gives `setupOutdated`, calls `usePlanSetupStore.markOutdated()` and leads to Plan setup with "Your plan setup needs to be checked again. Select Continue.";
  - a `400` with an `activities…` key gives `activitiesOutdated`, calls `usePlanActivitiesStore.markOutdated()` and leads to Activity selection with "Your activities need to be checked again. Select Continue.";
  - a `400` with only `request` throws `ApiError`;
  - no places are shown in any of these cases;
  - after the maximum travel distance is changed on Plan setup (the setup is no longer checked, feature 004 FR-026), opening step 3 leads back to Plan setup and sends no request to `/api/plan-places` (spec Edge Cases).

### Implementation for User Story 5

- [X] T065 [US5] Move the private `outdatedPart` and `failedService` functions from `web/api/planForecastApi.ts` into a new `web/api/planStepAnswer.ts`, exported, so both step 3 APIs read `400` and `503` bodies the same way (DRY). Use them in both files.
  - In `web/api/planPlacesApi.ts`, map `400` to `setupOutdated` or `activitiesOutdated`.
  - In `web/stores/usePlanPlacesStore.ts`, handle them as the forecast store does: call `markOutdated()` and set the status. The page guards then redirect.
  - `web/tests/planForecastApi.test.ts` must pass unchanged.

**Checkpoint**: Places always belong to a valid plan and to the server's own data.

---

## Phase 8: User Story 6 - Only visitors and active registered users can get places (Priority: P1)

**Goal**: The same people who may plan may get places. Everyone else is refused on the server without contacting the map data service.

**Independent Test**: Request places for a valid plan as each of these callers. Only the first two get them:

- a Visitor;
- an Active Registered User;
- an Active Administrator;
- a Suspended Administrator;
- a Suspended Registered User;
- a signed-in user whose account was deleted.

### Tests for User Story 6 ⚠️

- [X] T066 [P] [US6] Add `IntegrationTests/PlanPlacesAuthorizationTests.cs`, following `PlanForecastAuthorizationTests.cs`: every row of the table in `contracts/plan-places-api.md`. For each refused caller, `FakeMapPlacesClient.Calls` and the geocoding calls are unchanged.
- [X] T067 [P] [US6] Extend `web/tests/planPlacesApi.test.ts`, `web/tests/usePlanPlacesStore.test.ts` and `web/tests/planCreatorOnly.test.tsx`:
  - `403` gives `{ kind: "forbidden" }`, and the store refreshes the current user and shows the server error with Retry;
  - an Active Administrator opening `/plan/places` sees Access denied, a Suspended user sees Account suspended, and neither page sends a request to `/api/plan-places`.

### Implementation for User Story 6

- [X] T068 [US6] Map `403` to `{ kind: "forbidden" }` in `web/api/planPlacesApi.ts`. In `web/stores/usePlanPlacesStore.ts`, call `useCurrentUserStore.getState().refresh()` and set `serverError`, as the forecast store does. The server side needs no change: T030 already applies the `PlanCreator` policy. Confirm it with T066.

**Checkpoint**: Access is enforced on the server and shown correctly in the browser.

---

## Phase 9: User Story 7 - Use places and the overview with keyboard, screen reader and on a phone (Priority: P2)

**Goal**: The overview, places and forecast details can be read and used with only the keyboard and a screen reader, and at 320 px without horizontal scrolling.

**Independent Test**: At 320 px width, using only the keyboard:

1. read the overview;
2. open one activity's forecast details;
3. follow a "View on map" link;
4. remove an activity with no place.

There is no horizontal scrolling at any point.

### Tests for User Story 7 ⚠️

- [ ] T069 [P] [US7] Extend `web/tests/responsive.test.tsx`:
  - below the 40em breakpoint, the overview rows are cards (the `plan-overview` table uses the card class rules) and the cell labels are visible ("Place: Nemuno slipway", "Sat 14 Nov: ★ 10:00–14:00 (4 h)");
  - the places list, Remove, Change activity, Retry and "Show forecast details" are full width with a minimum height and width of 44 px;
  - no element is wider than 320 px.

  Follow the existing card checks for the hours table.
- [ ] T070 [P] [US7] Extend `web/tests/accessibility.test.tsx` and `web/tests/keyboard.test.tsx`. Cover:
  - **Structure**:
    - one `h1`;
    - the overview is a table with a caption, column headers and row headers;
    - each activity is a region named after it, with an `h3` "Places";
  - **Accessible names**:
    - "View on map, Nemuno slipway (opens in a new tab)", starting with the visible text;
    - "Remove, Kayaking" and "Change activity, Kayaking";
    - "Show forecast details, Kayaking" with `aria-expanded`;
  - **Announcements**: the loading, "updated at", error, retrying and "removed" messages are in status regions, and focus does not move when they appear;
  - **Not colour alone**: ★ and ✗ always come with words;
  - **Keyboard**: tabbing reaches the map links, Remove, Change activity and the details button in page order; Enter and Space open the details; Enter on Remove removes the activity and focus lands on the next heading.

### Implementation for User Story 7

- [ ] T071 [US7] Change `web/components/placeListItem.tsx`: the link's `aria-label` is "View on map, <name> (opens in a new tab)" (spec FR-018). Check that every other name from T070 is in place, and fix any that is not.
- [ ] T072 [US7] Update `frontend/src/styles.css`.
  - **The overview**: `.plan-overview` as a table on desktop; below the existing 40em breakpoint, each row a card with the `th` as its title and each cell as "Label: value" with the `.cell-label` shown. Reuse the `forecast-hours` card rules where possible instead of copying them.
  - **The places**: `.places-list` with no bullets and the distance and area on the line under the name, and the no-place flag.
  - **Buttons**: on phones, Remove, Change activity, Retry and the details button are full width, with `min-height` and `min-width` of 44px.
  - **Overflow**: long place names wrap (`overflow-wrap: anywhere`), so there is no horizontal scrolling at 320 px.
  - Reuse the existing variables and breakpoint.

**Checkpoint**: All stories work for keyboard, screen reader and phone users.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T073 [P] Update `README.md`'s "Places and forecast" section:
  - **Places**: the nearest named places per activity from the OpenStreetMap Overpass API, the 50 km cap on the maximum travel distance, 5 places, and the 24-hour reuse with "Places updated at";
  - **The step**: the overview table, the closed forecast details, and the no-place flag with Remove and Change activity;
  - **Settings**: the `Places` section (`MaxRadiusKm`, `MaxPlacesPerActivity`, `MaxAgeHours`), changeable with environment variables such as `$env:Places__MaxRadiusKm = "20"`;
  - **Limits**: place requests share the `RateLimiting:PlanSetup` limit, and each opening of step 3 is two requests;
  - **Internet**: the running API needs internet access to `overpass-api.de`.

  Replace "Places come in a later feature." Add to the status line that feature 007 is implemented. No migration step is needed.
- [ ] T074 [P] Update `docs/ux-design.md`, Places and Forecast states (section 6) and layout (section 8):
  - the Loading state "Getting the forecast and nearby places…" (no Generate schedule yet: feature 008);
  - "Places updated at HH:MM";
  - the "✗ No place found within <radius> km." row with Remove and Change activity;
  - the map data service error with "Not available" in the Place cells;
  - "Getting nearby places…" and "Getting the forecast…" on Retry;
  - the overview table with sunrise and sunset in the date headings, and the closed "Show forecast details";
  - each overview row and place becomes a card on phones.

  Check the traceability rows for Places and Forecast (FR-010, FR-036), and fix any difference (constitution VI).
- [ ] T075 [P] Update `docs/architecture.md`:
  - the `Clients/` row: the Overpass client, `ExternalServiceJson` shared by all three clients, and the 24-hour per-category place cache;
  - the `Errors/` row: `"places"` among the `service` values;
  - the `RateLimiting/` row: place requests.
- [ ] T076 [P] Check sizes (constitution I):
  - every new or changed C# class is under 200 lines, especially `OverpassMapPlacesClient.cs`, `NearbyPlaceRules.cs`, `NearbyPlacesService.cs`, `PlanPlacesService.cs` and `ExternalServiceJson.cs`;
  - every new or changed React page or component is under about 200 lines, especially `PlacesAndForecastPage.tsx`, `planActivitiesSummary.tsx`, `planOverview.tsx` and `placesAndForecastStatus.tsx`.

  Split by responsibility if not.
- [ ] T077 Run all the checks, and fix any failure without weakening tests or checks.
  - From the repository root: `dotnet format .\SpekLaiku.slnx --verify-no-changes`, `dotnet build .\SpekLaiku.slnx` and `dotnet test .\SpekLaiku.slnx`.
  - From `frontend/`: `npm run lint`, `npm run format:check`, `npm test` and `npm run build`. Run the frontend tests on their own, not at the same time as the backend tests.
- [ ] T078 Review `git diff main...HEAD`. Check that:
  - there are no unintended files (no `bin/`, `obj/`, `node_modules/`, `frontend/src/node_modules/`, local settings or debug code);
  - there is no migration and no new package;
  - `appsettings.Development.json` is unchanged;
  - no test calls a live Overpass or Open-Meteo address.

  Then list the quickstart Manual Validation steps for the user to run before the Pull Request.
- [ ] T079 Run a separate AI-assisted review of the branch (for example `/code-review` and `/security-review`), and apply or reject each finding with a short reason. Record the result in this task. Then prepare the Pull Request description for the user (constitution V, VII and Quality Gates). It must include:
  - a link to `specs/007-nearby-places/spec.md` and a summary of the change;
  - the tests and checks run (T077 and the manual quickstart steps), and "no migration";
  - screenshots of Places and forecast at desktop and 320 px: the overview, places, an open forecast details, a no-place flag, and the map data service error;
  - the review tool, important findings, changes made and findings not applied.

  The user opens and merges the Pull Request.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks every story.
  - T002 comes before T005.
  - T004 comes before T005 and T009.
  - T008 comes before T009, and T009 before T010.
  - T005 comes before T006.
  - T011 comes before T012.
  - T016 comes before T017.
- **User stories**: Each depends on Foundational.
- **Polish (Phase 10)**: Depends on all stories.

### User Story Dependencies

- **US1 (Phase 3)**:
  - Depends on Foundational.
  - Backend: T025 and T026 before T027; T027 and T028 before T029; T029 before T030.
  - Frontend: T031 before T032; T032 and T033 before T034 and T035; T034 and T035 before T036.
- **US2 (Phase 4)**: Depends on US1 (the places area and store). T040 and T041 before T043; T042 before T043.
- **US3 (Phase 5)**:
  - Depends on US1 (the page layout).
  - It can run alongside US2: T048 to T052 touch different files from US2. T053 touches `planActivitiesSummary.tsx`, so do it after T043.
- **US4 (Phase 6)**: Depends on US1 and US3 (the overview cells). T059 before T060 and T061.
- **US5 (Phase 7)**:
  - Depends on US1.
  - It touches `planPlacesApi.ts` and `usePlanPlacesStore.ts` after US4; if both run together, do T059 before T065.
- **US6 (Phase 8)**: Depends on US1 (the endpoint and store). T068 after T065 when both touch the same files.
- **US7 (Phase 9)**: Depends on US1 to US4 (the tests check the final step).

### Within Each User Story

- Tests are written first and must fail before the implementation tasks.
- Backend order: models → service → mapping → controller.
- Frontend order: helper → API → store → component → page.

### Parallel Opportunities

- **Foundational**:
  - T003, T004, T007, T008, T013, T014, T015, T016 and T018 touch different files.
  - After T004 and T008, T009 can run while T005 is written.
- **US1**: T019 to T024 (tests) in parallel; T026, T028 and T033 alongside the services.
- **US2**: T037 to T039 in parallel; T041 and T044 in parallel.
- **US3**: T045 to T047 in parallel; T049 and T050 in parallel.
- **US4**: T055 to T058 in parallel.
- **US5**: T062 to T064 in parallel.
- **US6**: T066 and T067 in parallel.
- **US7**: T069 and T070 in parallel.
- **Polish**: T073 to T076 in parallel, then T077, T078 and T079 in order.

---

## Parallel Example: User Story 1

```text
# All tests for User Story 1 together:
Task: "T019 NearbyPlacesServiceTests in backend/tests/SpekLaiku.UnitTests/NearbyPlacesServiceTests.cs"
Task: "T020 PlanPlacesServiceTests in backend/tests/SpekLaiku.UnitTests/PlanPlacesServiceTests.cs"
Task: "T021 PlanPlacesMappingTests in backend/tests/SpekLaiku.UnitTests/PlanPlacesMappingTests.cs"
Task: "T022 PlanPlacesEndpointTests in backend/tests/SpekLaiku.IntegrationTests/PlanPlacesEndpointTests.cs"
Task: "T023 planPlacesApi and usePlanPlacesStore tests in frontend/src/tests/"
Task: "T024 PlacesAndForecastPage places tests in frontend/src/tests/PlacesAndForecastPage.test.tsx"

# Independent pieces together:
Task: "T026 request and service records in backend/src/SpekLaiku.Api/"
Task: "T028 response DTOs in backend/src/SpekLaiku.Api/DTOs/Responses/"
Task: "T033 placeListItem and activityPlaces in frontend/src/components/"
```

## Parallel Example: User Story 4

```text
Task: "T055 PlanPlacesFailureTests in backend/tests/SpekLaiku.IntegrationTests/PlanPlacesFailureTests.cs"
Task: "T056 shared limit in backend/tests/SpekLaiku.IntegrationTests/PlanSetupRateLimitTests.cs"
Task: "T057 planPlacesApi and store error tests in frontend/src/tests/"
Task: "T058 PlacesAndForecastPage error tests in frontend/src/tests/PlacesAndForecastPage.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2. The client, rules, options, shared check, fakes, types and helpers are in place and tested.
2. Complete Phase 3 (US1). Step 3 shows each activity's nearest places after one combined loading message.
3. **STOP and VALIDATE** with the US1 independent test, then review the diff.

### Incremental Delivery

1. **US1**: places per activity (MVP).
2. **US2**: the no-place flag, Remove and Change activity.
3. **US3**: the overview and the closed details.
4. **US4**: map data failures, Retry without reloading the step, and the shared limit.
5. **US5**: server re-checks and the "checked again" notices for places.
6. **US6**: access on the endpoint.
7. **US7**: keyboard, screen reader and 320 px cards.
8. **Polish**: documentation, size check, full checks, diff review, AI review and the Pull Request description.

Implement one phase at a time and stop after each phase for a diff review. Commit only when asked, with Conventional Commit messages such as `feat(nearby-places): add overpass places client`.

---

## Notes

- [P] tasks touch different files and do not depend on unfinished tasks.
- There is no migration and no new package. The only new external call is the Overpass API, always faked in tests.
- The API caches places per location, radius and tag set for 24 hours, and locations per id, in a cache shared by the integration test collection. Each test uses its own place id, position and categories.
- Every place rule (matching, names, distance, radius, order, count) and the longest period are decided on the server. The browser only words and formats server values.
- API messages have no "Error: " prefix; the frontend adds it.
