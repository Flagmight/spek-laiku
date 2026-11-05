---

description: "Task list for feature 004 Plan Location and Dates"
---

# Tasks: Plan Location and Dates

**Input**: Design documents from `/specs/004-plan-location-dates/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/plan-setup-api.md, quickstart.md

**Tests**: Required. Constitution principle III requires backend tests for business logic and API behaviour, frontend tests for the relevant screens, an authorization test for every protected operation, fake responses instead of the live Open-Meteo service, and a controlled clock. Within each story, write the tests first and confirm they fail before the implementation tasks.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested on its own. Phases follow the spec priorities: the P1 stories (US1, US2, US4, US6) first, then the P2 stories (US3, US5, US7). Commands are in `AGENTS.md`. Backend commands run from the repository root with `.\SpekLaiku.slnx`; frontend commands run from `frontend/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: The user story the task belongs to (US1 to US7, as numbered in `spec.md`)
- Paths are from the repository root. `Api/` below is short for `backend/src/SpekLaiku.Api/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the starting point is green.

- [X] T001 From the repository root, run `dotnet build .\SpekLaiku.slnx` and `dotnet test .\SpekLaiku.slnx`. From `frontend/`, run `npm run lint`, `npm test` and `npm run build`. This confirms the baseline after feature 003 passes before any change. Record any pre-existing failure instead of fixing it in this feature.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The external client, the shared rules, the authorization and rate limiting policies, the test fakes and the frontend plan setup store that every story uses.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### External service client (backend)

- [X] T002 [P] Create the shared failure types in `backend/src/SpekLaiku.Api/Clients/`:
  - `ExternalService.cs`: `public enum ExternalService { LocationSearch }`.
  - `FailureKind.cs`: `public enum FailureKind { Timeout, Network, UnexpectedStatus, InvalidResponse }`.
  - `ExternalServiceException.cs`: `public sealed class ExternalServiceException(ExternalService service, FailureKind kind, int? statusCode = null, Exception? inner = null) : Exception`, exposing `Service`, `Kind` and `StatusCode`. Its message names only the service, the kind and the status, never request text.
  - Comment that features 006 and 007 reuse these types (research section 4).
- [X] T003 [P] Create the geocoding client contract in `backend/src/SpekLaiku.Api/Clients/`:
  - `GeocodingPlace.cs`: `public sealed record GeocodingPlace(long Id, string Name, double Latitude, double Longitude, string CountryCode, string? Admin1, string? Admin2)`.
  - `IGeocodingClient.cs`: `Task<IReadOnlyList<GeocodingPlace>> SearchAsync(string text, CancellationToken cancellationToken)` and `Task<GeocodingPlace?> GetAsync(long id, CancellationToken cancellationToken)`. Add a comment that the interface exists so tests can replace the external service (research section 4).
- [X] T004 Implement the Open-Meteo client in `backend/src/SpekLaiku.Api/Clients/`.
  - **JSON shapes** (`OpenMeteoGeocodingResponse.cs`): internal records for the search response (`List<OpenMeteoPlace>? Results`) and for one place (`id`, `name`, `latitude`, `longitude`, `country_code`, `admin1`, `admin2`, mapped with `[JsonPropertyName]`; other fields ignored).
  - **Client** (`OpenMeteoGeocodingClient.cs`): `public sealed class OpenMeteoGeocodingClient(HttpClient httpClient, ILogger<OpenMeteoGeocodingClient> logger) : IGeocodingClient`, with `public static readonly Uri BaseAddress = new("https://geocoding-api.open-meteo.com/")` and `public static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5)`.
  - `SearchAsync` requests `v1/search?name={Uri.EscapeDataString(text)}&count=10&language=en&countryCode=LT&format=json`. A missing `results` returns an empty list. A place without `id`, `name` or `country_code` is skipped.
  - `GetAsync` requests `v1/get?id={id}&language=en`. HTTP `400` returns `null` ("Location ID not found.", research section 1); `200` returns the place.
  - Every other failure throws `ExternalServiceException(ExternalService.LocationSearch, kind, status)`:
    - `TaskCanceledException` when the caller's token was not cancelled → `Timeout`;
    - `HttpRequestException` → `Network`;
    - any other status → `UnexpectedStatus`;
    - unreadable or `null` JSON → `InvalidResponse`.
  - A cancellation requested by the caller is re-thrown unchanged.
  - Before throwing, log exactly one warning: `logger.LogWarning("Location search service failed: {FailureKind} {StatusCode}", kind, status)`. Never log the search text or id (spec FR-008).
- [X] T005 [P] Add `backend/tests/SpekLaiku.UnitTests/FakeHttpMessageHandler.cs`, a handler that returns a scripted `HttpResponseMessage` or throws, and records the requested URIs. Add `backend/tests/SpekLaiku.UnitTests/OpenMeteoGeocodingClientTests.cs` with these tests:
  - the search URI has the escaped text (for example `Šiauliai` and `a&b`), `count=10`, `language=en` and `countryCode=LT`;
  - the sample JSON from research section 1 parses into two `GeocodingPlace`s with their admin fields;
  - `{"generationtime_ms":0.06}` gives an empty list;
  - a place without `country_code` is skipped;
  - `GetAsync` parses the bare place object, and HTTP `400` with `{"error":true,"reason":"Location ID not found."}` gives `null`;
  - `500`, a thrown `HttpRequestException`, a timeout (handler delay longer than a 50 ms `HttpClient.Timeout`) and the body `not json` each throw `ExternalServiceException` with the matching `FailureKind`;
  - a caller-cancelled token throws `OperationCanceledException`, not `ExternalServiceException`;
  - using the existing `CapturingLoggerProvider`, each failure logs one warning that contains the kind and never the search text.
- [X] T006 In `backend/src/SpekLaiku.Api/Errors/ApiExceptionHandler.cs`, when the exception is `ExternalServiceException`, answer `503` with problem details: `Title = "Service unavailable."`, `Detail = "Location search is unavailable. Try again later."`. It must not log again, because the client already logged it. Keep the existing `500` path for every other exception. Extend `backend/tests/SpekLaiku.UnitTests/ApiExceptionHandlerTests.cs` with a test for the `503` body and status, and a test that other exceptions still give `500` (research section 10).

### Shared rules and results (backend)

- [X] T007 [P] Create `backend/src/SpekLaiku.Api/Services/ForecastPeriod.cs`: `public sealed class ForecastPeriod(TimeProvider timeProvider)` with `public const int Days = 7`, `public const string TimeZoneId = "Europe/Vilnius"`, and `public (DateOnly FirstDate, DateOnly LastDate) GetCurrent()`. That method converts `timeProvider.GetUtcNow()` with `TimeZoneInfo.FindSystemTimeZoneById(TimeZoneId)` and returns today in Lithuania and today + 6 (research section 6). Comment that it is the only place the period is worked out; the page gets it through `GET /api/plan-setup/period`.
- [X] T008 [P] Add `backend/tests/SpekLaiku.UnitTests/FixedTimeProvider.cs` (`TimeProvider` subclass with a settable `DateTimeOffset UtcNow` returned by `GetUtcNow()`). Add `backend/tests/SpekLaiku.UnitTests/ForecastPeriodTests.cs` with these cases:
  - `2026-11-04T21:59:59Z` → 2026-11-04 to 2026-11-10;
  - `2026-11-04T22:00:00Z` → 2026-11-05 to 2026-11-11 (Vilnius is UTC+2 in winter);
  - `2026-07-01T20:59:59Z` and `21:00:00Z` (UTC+3 in summer);
  - the night of the 2027-03-28 daylight-saving change;
  - the last date is always the first date + 6.
- [X] T009 [P] Create `backend/src/SpekLaiku.Api/Services/LocationAreaName.cs`, a static class with `For(string name, string? admin1, string? admin2)` (research section 3):
  - return `admin2` when it is not empty and differs from `name` (ignoring case);
  - otherwise return `admin1 + " County"` when `admin1` is not empty;
  - otherwise return `"Lithuania"`.
- [X] T010 [P] Add `backend/tests/SpekLaiku.UnitTests/LocationAreaNameTests.cs` with these cases: `Kaunas`/`Kaunas`/`Kaunas` → "Kaunas County"; `Kauniai`/`Panevėžys`/`Biržai District Municipality` → "Biržai District Municipality"; `kaunas` with `admin2 = "Kaunas"` → uses `admin1`; empty or `null` admins → "Lithuania"; only `admin1` → "<admin1> County".
- [X] T011 [P] Create the service records in `backend/src/SpekLaiku.Api/Services/` (see `data-model.md`):
  - `PlaceLocation.cs`: `public sealed record PlaceLocation(long Id, string Name, string Area, double Latitude, double Longitude)`.
  - `CheckedPlanSetup.cs`: `public sealed record CheckedPlanSetup(PlaceLocation Location, IReadOnlyList<DateOnly> Dates, int MaxTravelDistanceKm)`.
  - `LocationSearchResult.cs`: `Success(IReadOnlyList<PlaceLocation>)` or `Invalid(IReadOnlyDictionary<string, string>)`, following `LoginResult`.
  - `PlanSetupResult.cs`: `Success(CheckedPlanSetup)` or `Invalid(errors)`.
- [X] T012 [P] Create `backend/src/SpekLaiku.Api/DTOs/Requests/PlanSetupCheckRequest.cs`: `public sealed record PlanSetupCheckRequest(long? LocationId, List<DateOnly>? Dates, decimal? MaxTravelDistanceKm)`. Comment why `MaxTravelDistanceKm` is `decimal?`: so `12.5` gets the field message instead of a generic request error (research section 9).
- [X] T013 Create the plan setup validator in `backend/src/SpekLaiku.Api/Services/`.
  - **Result** (`PlanSetupValidationResult.cs`): the ordered errors (`IReadOnlyList<KeyValuePair<string, string>>`), the distinct sorted dates, and the distance as an `int`.
  - **Validator** (`PlanSetupValidator.cs`, static): constants `MaxDates = 7`, `MinTravelDistanceKm = 1`, `MaxTravelDistanceKm = 200`, `DefaultTravelDistanceKm = 30`, and `Validate(PlanSetupCheckRequest request, DateOnly firstDate, DateOnly lastDate)`.
  - Add errors in this order. Messages have no "Error: " prefix:
    - `locationId` missing or `<= 0` → "Select a location in Lithuania from the list.";
    - `dates` null or empty → "Add at least one date.";
    - more than 7 entries → "You can add up to 7 dates.", with no per-date checks;
    - otherwise, for each index `i` in request order, `dates[i]`:
      - "This date is already added." when it equals an earlier entry;
      - else "Dates cannot be in the past." when `< firstDate`;
      - else "Forecast is not available that far ahead." when `> lastDate`;
    - `maxTravelDistanceKm` not null and either not whole (`value != decimal.Truncate(value)`) or outside 1 to 200 → "Enter a whole number between 1 and 200." A null distance becomes 30.
  - Comment that feature 009 reads the distance constants.
- [X] T014 Add `backend/tests/SpekLaiku.UnitTests/PlanSetupValidatorTests.cs` covering every message in `data-model.md` (Validation rules), plus these cases:
  - an empty request returns `locationId` and `dates` in that order;
  - `firstDate` and `lastDate` are accepted; `firstDate - 1` and `lastDate + 1` are refused;
  - `[d1, d2, d1]` reports only `dates[2]`;
  - 8 valid dates give only the `dates` count message;
  - distances 1, 200 and null (→ 30) are accepted; 0, 201, 12.5 and -5 are refused;
  - a valid request returns dates sorted ascending and without duplicates.

### Authorization and request limit (backend)

- [X] T015 Add the `PlanCreator` policy in `backend/src/SpekLaiku.Api/Authorization/` (research section 8).
  - In `AuthorizationPolicies.cs` add `public const string PlanCreator = "PlanCreator"`, with a comment saying it allows Visitors and Active Registered Users.
  - Create `PlanCreatorRequirement.cs` (`IAuthorizationRequirement`).
  - Create `PlanCreatorHandler.cs` (`AuthorizationHandler<PlanCreatorRequirement>` with `UserManager<ApplicationUser>`):
    - if `context.User.Identity?.IsAuthenticated != true`, succeed;
    - otherwise load the account with `GetUserAsync` and succeed only when it exists, `Role == "Registered User"` and `AccountStatus == AccountStatus.Active`.
  - In `backend/src/SpekLaiku.Api/Program.cs`, add `.AddPolicy(AuthorizationPolicies.PlanCreator, policy => policy.AddRequirements(new PlanCreatorRequirement()))` to the existing authorization builder **without** `RequireAuthenticatedUser`, and register `AddScoped<IAuthorizationHandler, PlanCreatorHandler>()`.
- [X] T016 [P] Add `backend/tests/SpekLaiku.UnitTests/PlanCreatorHandlerTests.cs` (using `IdentityTestHost`) with these tests: the requirement succeeds for an anonymous principal and an Active Registered User; it does not succeed for a Suspended Registered User, an Active Administrator, a Suspended Administrator, or a signed-in principal whose account was deleted.
- [X] T017 Add the request limit in `backend/src/SpekLaiku.Api/RateLimiting/` (research section 14, spec FR-027).
  - `RateLimitPolicies.cs`: `public const string PlanSetup = "PlanSetup"`.
  - `PlanSetupRateLimitOptions.cs`: `public int PermitLimit { get; init; } = 30`, `public int WindowSeconds { get; init; } = 60`, and `public const string SectionName = "RateLimiting:PlanSetup"`.
  - `PlanSetupRateLimit.cs`, a static class with `AddPlanSetupRateLimit(this IServiceCollection services, IConfiguration configuration)`:
    - bind the options with `AddOptions<PlanSetupRateLimitOptions>().Bind(...).Validate(o => o.PermitLimit > 0 && o.WindowSeconds > 0, "RateLimiting:PlanSetup:PermitLimit and WindowSeconds must be positive.").ValidateOnStart()`;
    - call `services.AddRateLimiter(...)` with `RejectionStatusCode = 429`;
    - add a policy `PlanSetup` that partitions with `RateLimitPartition.GetFixedWindowLimiter(httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown", ...)`, reading the bound options from `httpContext.RequestServices` (`PermitLimit`, `Window = TimeSpan.FromSeconds(WindowSeconds)`, `QueueLimit = 0`);
    - `OnRejected`: set `Retry-After` from `MetadataName.RetryAfter` when present, then write problem details with status 429, title "Too many requests." and detail "Too many requests. Wait a minute and try again." through `IProblemDetailsService`. Log nothing beyond the middleware's own logs.
  - In `backend/src/SpekLaiku.Api/appsettings.json` add `"RateLimiting": { "PlanSetup": { "PermitLimit": 30, "WindowSeconds": 60 } }`.
  - In `Program.cs` call `builder.Services.AddPlanSetupRateLimit(builder.Configuration)` and add `app.UseRateLimiter()` between `app.UseAuthentication()` and `app.UseAuthorization()`, with a comment explaining why it comes before authorization.

### Responses, mapping and registrations (backend)

- [X] T018 [P] Create the response DTOs in `backend/src/SpekLaiku.Api/DTOs/Responses/`:
  - `LocationResponse.cs`: `(long Id, string Name, string Area, double Latitude, double Longitude)`.
  - `LocationSearchResponse.cs`: `(IReadOnlyList<LocationResponse> Locations)`.
  - `CheckedPlanSetupResponse.cs`: `(LocationResponse Location, IReadOnlyList<DateOnly> Dates, int MaxTravelDistanceKm)`.

  Create `backend/src/SpekLaiku.Api/Mapping/PlanSetupMappingProfile.cs` mapping `PlaceLocation` → `LocationResponse` and `CheckedPlanSetup` → `CheckedPlanSetupResponse`, with no rules. Extend the AutoMapper configuration test so `AssertConfigurationIsValid` covers the profile, and add a test that a `CheckedPlanSetup` maps to the expected response.
- [X] T019 In `backend/src/SpekLaiku.Api/Program.cs` register:
  - `AddMemoryCache()`;
  - `TryAddSingleton(TimeProvider.System)`;
  - `AddSingleton<ForecastPeriod>()`;
  - `AddHttpClient<IGeocodingClient, OpenMeteoGeocodingClient>(client => { client.BaseAddress = OpenMeteoGeocodingClient.BaseAddress; client.Timeout = OpenMeteoGeocodingClient.Timeout; })`.

  Keep `Program.cs` readable. If it grows past about 150 lines, move the new registrations into a small `AddPlanSetup(this IServiceCollection)` extension in `backend/src/SpekLaiku.Api/Services/PlanSetupServiceCollectionExtensions.cs`.

### Test fakes

- [X] T020 [P] Add the integration test fakes in `backend/tests/SpekLaiku.IntegrationTests/`.
  - **`FakeGeocodingClient.cs`** (`IGeocodingClient`):
    - search results and get results are scripted per text and per id (with `Script(text, places)`, `ScriptFailure(text, kind)`, `ScriptPlace(place)`, `ScriptGetFailure(id, kind)`), and unscripted inputs give an empty list or `null`;
    - it counts `SearchCalls` and `GetCalls`;
    - it throws `ExternalServiceException` for scripted failures.
  - **`FixedTimeProvider.cs`**, the same small class as in the unit tests.
  - **`PostgreSqlApiFactory.cs`**:
    - expose `public FakeGeocodingClient Geocoding { get; } = new()` and `public FixedTimeProvider Clock { get; }`, starting at the real current time;
    - in `ConfigureWebHost`, add `builder.UseSetting("RateLimiting:PlanSetup:PermitLimit", "10000")`;
    - in `ConfigureTestServices`, replace `IGeocodingClient` with `Geocoding` and replace the `ForecastPeriod` registration with `new ForecastPeriod(Clock)`. Only the forecast period gets the fixed clock; the cookie and Identity keep the real `TimeProvider`.
  - Comment that every test must use its own search texts and place ids, because the API's memory cache is shared by the collection (research section 5).

### Frontend foundation

- [X] T021 [P] Create `frontend/src/types/planSetup.ts` with:
  - `PlanLocation` (`id`, `name`, `area`, `latitude`, `longitude`);
  - `PlanSetupCheckRequest` (`locationId: number | null`, `dates: string[]`, `maxTravelDistanceKm: number | null`);
  - `CheckedPlanSetup` (`location`, `dates: string[]`, `maxTravelDistanceKm: number`);
  - `PlanSetupFieldKey = "locationId" | "dates" | "maxTravelDistanceKm" | `` `dates[${number}]` ``;
  - `PlanSetupFieldErrors = Partial<Record<PlanSetupFieldKey, string>>`;
  - `PlanPeriod` (`firstDate: string`, `lastDate: string`, `maxDates: number`), exactly as sent by `GET /api/plan-setup/period`.
- [X] T022 Create the frontend side of the date limits (research section 6). The frontend computes no dates and has no time-zone code.
  - **API:** `frontend/src/api/planSetupApi.ts` with `getPlanPeriod(signal?: AbortSignal): Promise<PlanPeriod>` (`GET /api/plan-setup/period`). `200` returns the body; any other status throws `ApiError(status)`; network and abort errors pass through. US4 adds `checkPlanSetup` to this file.
  - **Store:** `frontend/src/stores/usePlanPeriodStore.ts` (not persisted):
    - `status: "loading" | "loaded" | "error"`, `period: PlanPeriod | null`, `controller`;
    - `load()` aborts any earlier load, sets `loading`, and calls `getPlanPeriod` with a `planPeriodTimeoutMs = 10_000` abort; `loaded` on success, `error` on any failure; only the latest load is applied;
    - `reset()`.
  - Reset the store in `frontend/src/tests/setup.ts`.
  - **Tests:** `frontend/src/tests/usePlanPeriodStore.test.ts` (fake timers, `routeFetch`) covering loading, loaded with the server's values unchanged, `500`, a network error and the 10 s timeout → `error`, `load()` again after an error (Retry), and an older answer arriving after a newer load being ignored.
- [X] T023 [P] Create `frontend/src/helpers/formatPlanDate.ts`: `formatPlanDate("2026-11-07")` returns `"Sat 7 Nov 2026"`. Build it from `Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).formatToParts` and join the parts with single spaces, so locale punctuation does not leak in (research section 11). Add `frontend/src/tests/formatPlanDate.test.ts` covering a weekday, a single-digit day and a year change.
- [X] T024 Create `frontend/src/stores/usePlanSetupStore.ts`, a Zustand store **without persistence yet** (persistence comes in US5).
  - **State:** `locationText: string` (`""`), `location: PlanLocation | null`, `dates: string[]` (`[]`), `maxTravelDistanceText: string` (`"30"`), `checked: CheckedPlanSetup | null`.
  - **Actions:**
    - `setLocationText(text)` also clears `location`;
    - `chooseLocation(location)` sets `location` and `locationText` to `"<name>, <area>"`;
    - `addDate(date)` inserts and keeps the list sorted with no duplicates;
    - `removeDate(date)`;
    - `setMaxTravelDistanceText(text)`;
    - `setChecked(setup)`;
    - `clear()` resets to the initial state.
  - Every action that changes the location, dates or distance sets `checked` to `null` (spec FR-019).
  - Export `initialPlanSetupState`, and reset the store in `frontend/src/tests/setup.ts`.
  - Add `frontend/src/tests/usePlanSetupStore.test.ts` covering each action, sorted insertion, the `checked` reset after every change, and `clear()`.

**Checkpoint**: The client, rules, policies and fakes are tested; the frontend has its types, date helpers and store.

---

## Phase 3: User Story 1 - Choose a location in Lithuania (Priority: P1) 🎯 MVP

**Goal**: A visitor opens "Create plan", searches for a place in Lithuania and chooses it from accessible suggestions.

**Independent Test**: A visitor opens "Create plan", types "Kaun", sees "Kaunas, Kaunas County", selects it, and the field shows the chosen place.

### Tests for User Story 1

- [X] T025 [P] [US1] Add `backend/tests/SpekLaiku.UnitTests/LocationSearchServiceTests.cs`, using a fake `IGeocodingClient` with call counting and a real `MemoryCache`, with these cases:
  - text trimmed to fewer than 2 or more than 100 characters, or `null`, returns `Invalid` with `query` = "Enter between 2 and 100 characters." and no client call;
  - places are mapped with `LocationAreaName`, and a non-`LT` place is dropped;
  - at most 10 places are returned, in the client's order;
  - a second search for the same text with different letter case or spaces is answered from the cache, so the client is called once;
  - `"Kaunas, Kaunas Count"` calls the client with `"Kaunas"`; `", abc"` and `"K, Kaunas"` return an empty list without a client call; `"Kaunas"` and `"Kaunas, Kaunas County"` share one cache entry (research section 1);
  - a failure (`ExternalServiceException`) is re-thrown and not cached, so the next search calls the client again;
  - `FindAsync(id)` returns a place cached by an earlier search without calling `GetAsync`, otherwise calls `GetAsync`;
  - `FindAsync` returns `null` for an unknown id and for a non-`LT` place.
- [X] T026 [P] [US1] Add `backend/tests/SpekLaiku.IntegrationTests/LocationsEndpointTests.cs` (collection `PostgreSqlCollection`, scripting `factory.Geocoding` with a unique text per test), as a Visitor:
  - `GET /api/locations?query=<text>` returns `200` with the contract body (`id`, `name`, `area`, `latitude`, `longitude`);
  - a scripted non-`LT` place is not returned, and an empty script gives `{"locations":[]}`;
  - `query=<unique>%2C%20Kaunas%20Count` returns the places scripted for `<unique>` (the text before the comma);
  - `query` of `a`, three spaces, 101 characters, or missing gives `400` with `errors.query`;
  - scripted `Timeout`, `Network`, `UnexpectedStatus` and `InvalidResponse` failures each give `503` with title "Service unavailable." and detail "Location search is unavailable. Try again later.", and no place data.
- [X] T027 [P] [US1] Add `frontend/src/tests/locationsApi.test.ts` and `frontend/src/tests/useLocationSearchStore.test.ts` (fake timers, `routeFetch`). Cover:
  - `searchLocations` sends `GET /api/locations?query=<encoded>` and returns the list;
  - non-200 statuses throw `ApiError` with the status;
  - `queryChanged` waits 300 ms before sending, and typing again within 300 ms sends only the last text;
  - fewer than 2 characters after trimming gives `idle` and sends nothing;
  - `loading` while pending;
  - `loaded` with results, and `empty` for an empty list;
  - `ApiError` 429 → `tooManyRequests`; `503`, any other error, a network error or 10 s without an answer → `unavailable`;
  - a newer search aborts the older one, and a late older answer never replaces newer results;
  - `reset()` aborts and returns to `idle`.
- [X] T028 [P] [US1] Add `frontend/src/tests/PlanSetupPage.test.tsx` (location part) with `renderApp("/plan/setup")` and `routeFetch`. Every page test also answers `GET /api/plan-setup/period` with a fixed period, for example `{ "firstDate": "2026-11-04", "lastDate": "2026-11-10", "maxDates": 7 }`. Cover:
  - one `<h1>` "Plan setup", title "Plan setup - Spėk laiku", and the progress bar showing step 1 of 4 with `aria-current="step"` on "Plan setup";
  - typing "Kaun" shows and announces "Searching locations…" in a `role="status"` region, then the options "Kaunas, Kaunas County" and "Kauniai, Biržai District Municipality";
  - choosing by click, and by ArrowDown + Enter, closes the list and puts "Kaunas, Kaunas County" in the input;
  - Escape closes the list and keeps the text;
  - typing after choosing clears the choice;
  - an empty answer shows "No location found. Check the spelling or try a larger town.";
  - `503` shows "Error: Location search is unavailable. Try again later." in `role="alert"`, with no options;
  - `429` shows "Error: Too many requests. Wait a minute and try again." with no options;
  - the input has `maxLength` 100.
- [X] T029 [P] [US1] Extend `frontend/src/tests/topNavigation.test.tsx` and `frontend/src/tests/HomePage.test.tsx` with tests that a visitor sees a "Create plan" link to `/plan/setup` in the navigation (between Home and Log in) and a "Create plan" link on Home, and that following either opens the Plan setup page.

### Implementation for User Story 1

- [X] T030 [US1] Create `backend/src/SpekLaiku.Api/Services/LocationSearchService.cs` (`IGeocodingClient`, `IMemoryCache`), with `public const int MinQueryLength = 2`, `MaxQueryLength = 100` and `MaxResults = 10`.
  - **`SearchAsync(string? query, CancellationToken)`:**
    - trim; if the length is outside 2 to 100, return `Invalid` with `query` = "Enter between 2 and 100 characters.";
    - take the trimmed text before the first comma, because Open-Meteo reads text after a comma as an exact area filter (research section 1). When fewer than 2 characters remain, return `Success` with an empty list without calling the client. Use this text for the call and the cache key;
    - read from or store to the cache under `"location-search:" + text.ToLowerInvariant()` for 1 hour;
    - keep `CountryCode == "LT"` (ignoring case), take 10, and map with `LocationAreaName.For`;
    - cache each `PlaceLocation` under `"location:" + id` for 1 hour.
  - **`FindAsync(long id, CancellationToken)`:** read the cache by id; otherwise call `GetAsync`, keep it only when `LT`, map and cache it; return `null` otherwise.
  - Failures are not caught, so they reach `ApiExceptionHandler`.
  - Register it with `AddScoped<LocationSearchService>()` in `Program.cs` (or in the T019 extension).
- [X] T031 [US1] Create `backend/src/SpekLaiku.Api/Controllers/LocationsController.cs`:
  - attributes: `[ApiController]`, `[Route("api/locations")]`, `[Authorize(Policy = AuthorizationPolicies.PlanCreator)]`, `[EnableRateLimiting(RateLimitPolicies.PlanSetup)]`;
  - `[HttpGet] Search([FromQuery] string? query, CancellationToken)` calls the service and returns `200` with `LocationSearchResponse` (mapped with `IMapper`), or `400` with `ValidationProblemDetails` in the same shape as `AuthController`;
  - `ProducesResponseType` for 200, 400, 403, 429 and 503. No business rules.
- [X] T032 [P] [US1] Create `frontend/src/api/locationsApi.ts`: `searchLocations(query: string, signal?: AbortSignal): Promise<PlanLocation[]>` using `apiFetch(`/api/locations?query=${encodeURIComponent(query)}`)`. `200` returns `body.locations`; any other status throws `ApiError(status)`; network and abort errors pass through.
- [X] T033 [US1] Create `frontend/src/stores/useLocationSearchStore.ts` (research section 11):
  - **State:** `status: "idle" | "loading" | "loaded" | "empty" | "unavailable" | "tooManyRequests"`, `results: PlanLocation[]`, `controller`, and a pending pause timer.
  - **`queryChanged(text)`:** clears the pause timer and aborts any request. If the trimmed text is shorter than 2, it sets `idle` with no results. Otherwise, after `locationSearchPauseMs = 300`, it sets `loading` and calls `searchLocations` with a `locationSearchTimeoutMs = 10_000` abort.
  - **Result:** only the latest request's result is applied. `ApiError` with status 429 → `tooManyRequests`; anything else → `unavailable`. Results are always empty on failure.
  - **`reset()`.**
  - Reset it in `frontend/src/tests/setup.ts`.
- [X] T034 [US1] Create `frontend/src/components/locationSearchField.tsx`, an ARIA 1.2 combobox (research section 11), under about 200 lines.
  - **Input:** visible label "Location"; `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` pointing at the listbox, `aria-activedescendant` for the highlighted option; `maxLength={100}`; `autoComplete="off"`.
  - **Options:** `role="listbox"` with `role="option"` items "<name>, <area>" and `aria-selected` on the highlighted item.
  - **Keys and mouse:** ArrowDown and ArrowUp move the highlight; Enter chooses; Escape closes; clicking chooses (prevent the input blur on `mousedown`); blur closes.
  - **Store wiring:** typing calls `usePlanSetupStore.setLocationText` and `useLocationSearchStore.queryChanged`; choosing calls `chooseLocation` and closes the list.
  - **Messages:**
    - a `role="status"` region announcing "Searching locations…", "1 location found" or "<n> locations found", and "No location found. Check the spelling or try a larger town.";
    - a `role="alert"` region for "Error: Location search is unavailable. Try again later." and "Error: Too many requests. Wait a minute and try again.";
    - an optional `error` prop for the field error from Continue, shown under the input and linked with `aria-describedby` and `aria-invalid`.
- [X] T035 [P] [US1] Create `frontend/src/components/planProgress.tsx`: `PlanProgress({ current }: { current: 1 | 2 | 3 | 4 })` renders `<nav aria-label="Plan progress">` with an ordered list of "Plan setup", "Activities", "Places and forecast" and "Schedule".
  - The current step has `aria-current="step"`.
  - Earlier steps are links (step 1 → `/plan/setup`; steps 2 to 4 become links only when later features add their routes, so for now only step 1 can be a link).
  - Later steps are plain text, not selectable.
  - Also render a compact "Step n of 4: <name>" element with `aria-hidden="true"`, shown only on narrow screens by CSS, so screen readers read the list once (spec FR-020).
- [X] T036 [US1] Create `frontend/src/pages/PlanSetupPage.tsx` with `usePageTitle("Plan setup")`, one `<h1>` "Plan setup", `<PlanProgress current={1} />` and `LocationSearchField`. On mount, call `usePlanPeriodStore.getState().load()`; US2 uses the result. On unmount, reset `useLocationSearchStore` and `usePlanPeriodStore` but not `usePlanSetupStore`. In `frontend/src/components/appRoutes.tsx` add the route `plan/setup` → `PlanSetupPage` (the guard comes in US6).
- [X] T037 [US1] In `frontend/src/components/topNavigation.tsx`, add a `NavLink` "Create plan" to `/plan/setup` after Home. Show it when the status is `"signedOut"` or `"error"` (a visitor), or when signed in with `role === "Registered User"` and `accountStatus === "Active"`. Update the top comment. In `frontend/src/pages/HomePage.tsx`, add a `Link` "Create plan" to `/plan/setup` with a button class, under the same rule. Put the rule in one exported function `canCreatePlan(status, user)` in `frontend/src/helpers/canCreatePlan.ts`, used by both and by the guard in US6.

**Checkpoint**: A visitor can open Plan setup and choose a place in Lithuania; the server already enforces the policy and the request limit.

---

## Phase 4: User Story 2 - Choose the dates to plan (Priority: P1)

**Goal**: The user adds 1 to 7 dates within the forecast period as date chips and removes them.

**Independent Test**: The user adds Saturday and Sunday of the coming weekend, sees both chips in date order, removes Sunday, and only Saturday is left.

### Tests for User Story 2

- [X] T038 [P] [US2] Add `frontend/src/tests/planDateRules.test.ts`. With a server-style period `{ firstDate: "2026-11-04", lastDate: "2026-11-10", maxDates: 7 }`, `checkNewDate(date, existing, period)` returns the messages below. Add one test with `maxDates: 3` to show the limit comes from the period, not from a constant:
  - "Choose a date first." for `""` and an unreadable value;
  - "This date is already added." for a repeat;
  - "Dates cannot be in the past." for `firstDate - 1`;
  - "Forecast is not available that far ahead." for `lastDate + 1`;
  - "You can add up to 7 dates." when `maxDates` dates are already added (the number in the message is `maxDates`);
  - `null` for `firstDate` and `lastDate`.

  `checkKeptDate(date, period)` returns the past message for a passed date.
- [X] T039 [P] [US2] Extend `frontend/src/tests/PlanSetupPage.test.tsx` (dates part, with `GET /api/plan-setup/period` answering `{ "firstDate": "2026-11-04", "lastDate": "2026-11-10", "maxDates": 7 }`). Cover:
  - while the period is loading, the date input and "Add date" are disabled and "Loading available dates…" is announced in `role="status"`, while Location still works;
  - a `500`, a network error or 10 s without an answer shows "Error: Available dates could not be loaded. Try again." in `role="alert"` with Retry, and Retry loads it again;
  - the date input has `min="2026-11-04"` and `max="2026-11-10"`, taken from the server's answer (a second test with a different answer gives different values, whatever the system time);
  - adding 2026-11-08 then 2026-11-07 shows the chips "Sat 7 Nov 2026" and "Sun 8 Nov 2026" in that order inside a group named "Dates", with "2 dates added";
  - each chip has a button named "Remove Sat 7 Nov 2026"; removing a chip focuses the date input and announces the removal;
  - each message from T038 appears next to the date input with the "Error: " prefix and nothing is added;
  - all 7 days can be added.
- [X] T040 [P] [US2] Add `backend/tests/SpekLaiku.IntegrationTests/PlanPeriodEndpointTests.cs` (collection `PostgreSqlCollection`; set `factory.Clock.UtcNow` in each test). Cover:
  - `GET /api/plan-setup/period` as a Visitor at `2026-11-04T21:59:59Z` returns `200` with `{"firstDate":"2026-11-04","lastDate":"2026-11-10","maxDates":7}`, and at `2026-11-04T22:00:00Z` with `2026-11-05` to `2026-11-11`;
  - an Active Registered User gets `200`;
  - more requests than the request limit never give `429`, because the endpoint has `[DisableRateLimiting]`. Assert it on the low-limit host from the request-limit tests, or by checking the endpoint metadata.

### Implementation for User Story 2

- [X] T041 [US2] Create `backend/src/SpekLaiku.Api/DTOs/Responses/PlanPeriodResponse.cs` (`public sealed record PlanPeriodResponse(DateOnly FirstDate, DateOnly LastDate, int MaxDates)`) and `backend/src/SpekLaiku.Api/Controllers/PlanSetupController.cs`:
  - attributes: `[ApiController]`, `[Route("api/plan-setup")]`, `[Authorize(Policy = AuthorizationPolicies.PlanCreator)]`, `[EnableRateLimiting(RateLimitPolicies.PlanSetup)]` on the class;
  - `[HttpGet("period")]` with `[DisableRateLimiting]` returns `new PlanPeriodResponse(first, last, PlanSetupValidator.MaxDates)` from `ForecastPeriod.GetCurrent()`, and has `ProducesResponseType` for 200 and 403. No rules in the controller. US4 adds the check action.
- [X] T042 [P] [US2] Create `frontend/src/helpers/planDateRules.ts` with `checkNewDate(date, existing, period: PlanPeriod)` and `checkKeptDate(date, period: PlanPeriod)`, returning the messages from T038 without the "Error: " prefix, or `null`.
  - The functions only compare against `period.firstDate`, `period.lastDate` and `period.maxDates` from the server; they hold no limits or dates of their own (constitution I, research section 6).
  - `yyyy-MM-dd` strings compare correctly as text.
  - A date is "unreadable" when it does not match `^\d{4}-\d{2}-\d{2}$`.
- [X] T043 [US2] Create `frontend/src/components/planDatesField.tsx`, under about 200 lines.
  - **Structure:** a `<fieldset>` with `<legend>` "Dates"; a labelled `<input type="date">` "Date" with `min`/`max` from `usePlanPeriodStore`'s `period`; an "Add date" button.
  - **Period states:** while the store is `loading`, the input and "Add date" are disabled and "Loading available dates…" is shown in `role="status"`. On `error`, they stay disabled and "Error: Available dates could not be loaded. Try again." is shown in `role="alert"` with a Retry button calling `load()`.
  - **Adding:** "Add date" runs `checkNewDate` and either shows the error under the input (`aria-describedby`, `aria-invalid`, "Error: " prefix) or calls `usePlanSetupStore.addDate`, then clears the input and the error.
  - **Chips:** a list of chips with `formatPlanDate` text and a "Remove <date>" button. Removing calls `removeDate` and moves focus to the date input.
  - **Count and announcements:** a count text "<n> date(s) added", and a `role="status"` region announcing "<date> added." and "<date> removed.".
  - **Errors from props:** a field error for `dates` and per-chip errors for `dates[i]`, which US4 passes in.

  Add it to `PlanSetupPage.tsx` after the location field.

**Checkpoint**: Location and dates can be entered; the page gives immediate feedback on each date.

---

## Phase 5: User Story 4 - Continue to the next step with a valid setup (Priority: P1)

**Goal**: Continue checks the setup on the server, shows errors in place and in a summary, and opens the first version of the Activity selection step.

**Independent Test**: Continue with an empty form shows both errors; with a chosen location and one valid date it opens Activity selection with the location and date kept.

### Tests for User Story 4

- [X] T044 [P] [US4] Add `backend/tests/SpekLaiku.UnitTests/PlanSetupServiceTests.cs` (fake `IGeocodingClient`, real `MemoryCache`, `ForecastPeriod` with `FixedTimeProvider`) with these cases:
  - a valid request returns `Success` with the server's location data, sorted dates, and distance 30 for null;
  - an unknown id or a non-`LT` place adds `locationId` "Select a location in Lithuania from the list." as the **first** error, with the validator's errors after it in order;
  - a missing or non-positive id does not call the client;
  - a client failure is re-thrown.
- [X] T045 [P] [US4] Add `backend/tests/SpekLaiku.IntegrationTests/PlanSetupCheckEndpointTests.cs` (set `factory.Clock.UtcNow` at the start of each test; use a unique place id per test). Cover:
  - `POST /api/plan-setup/check` as a Visitor with a scripted place and dates `["2026-11-08","2026-11-07"]` returns `200` with sorted dates, the name, area and position of the scripted place (the request sends only the id), and `maxTravelDistanceKm` 30 when null;
  - every message from `data-model.md`, with keys in contract order and all failing fields returned together;
  - the boundaries at `2026-11-04T21:59Z` versus `22:00Z`;
  - `[d, d]` reports `dates[1]`, and 8 dates give only `dates`;
  - distance 12.5 gives the distance message;
  - an unscripted id and a scripted `LV` place give the location message;
  - `{"maxTravelDistanceKm":"30"}`, `{"dates":["7/11/2026"]}` and a non-JSON body give `errors.request`;
  - a scripted get failure gives `503`.
- [X] T046 [P] [US4] Add `backend/tests/SpekLaiku.IntegrationTests/PlanSetupRateLimitTests.cs` in collection `PostgreSqlCollection`, for the shared database. It must not use the shared host's high limit: each test builds its own host with `factory.WithWebHostBuilder(b => b.UseSetting("RateLimiting:PlanSetup:PermitLimit", "3"))`, with a fresh `FakeGeocodingClient` registered through `ConfigureTestServices`, and disposes it at the end. Cover:
  - three requests (search, check, search) succeed and the fourth (search or check) gets `429` with title "Too many requests.", detail "Too many requests. Wait a minute and try again.", and a `Retry-After` header when present;
  - the refused search does not increase `SearchCalls`;
  - a Visitor and a signed-in Registered User on the same test server share the count;
  - a host built with `PermitLimit` `0` fails to start with the options validation message.
- [X] T047 [P] [US4] Add `frontend/src/tests/planSetupApi.test.ts` and `frontend/src/tests/usePlanSetupCheckStore.test.ts` (fake timers, `routeFetch`). Cover:
  - `checkPlanSetup` posts JSON to `/api/plan-setup/check`;
  - `200` → `checked`; `400` with known keys (including `dates[1]`) → `invalid` with the first message per key; `403` → `forbidden`; `429` → `tooManyRequests`; other statuses throw `ApiError`;
  - the store: `pending` while waiting; a second submit is ignored; `checked` calls `usePlanSetupStore.setChecked` and resolves `true`; `invalid` keeps the errors; `tooManyRequests` and `serverError` (5xx, network, 10 s timeout) keep `lastRequest` for `retry()`; `forbidden` calls `useCurrentUserStore.refresh()`; `reset()` aborts.
- [X] T048 [P] [US4] Extend `frontend/src/tests/PlanSetupPage.test.tsx` (Continue part). Cover:
  - Continue with nothing entered shows "Error: Select a location in Lithuania from the list." and "Error: Add at least one date." next to their fields, plus an error summary listing both with links that move focus. Focus moves to the Location input, and no request is sent;
  - typed text with no chosen place gives the location error and keeps the text;
  - a valid setup shows and announces "Checking your plan setup…", disables Continue, then navigates to `/plan/activities`;
  - a server `dates[0]` error marks that chip with the message, and the summary entry reads "Sat 7 Nov 2026: Dates cannot be in the past.";
  - `500`, a network error and the 10 s timeout show "Error: Something went wrong. Try again." with Retry, which sends the same body;
  - `429` shows "Error: Too many requests. Wait a minute and try again." with Retry.
- [X] T049 [P] [US4] Add `frontend/src/tests/ActivitySelectionPage.test.tsx`. Cover:
  - with a checked setup in the store, `/plan/activities` shows one `<h1>` "Activity selection" and the title "Activity selection - Spėk laiku";
  - the progress bar shows step 2 current and step 1 as a link to `/plan/setup`;
  - the summary reads "Kaunas, Kaunas County · Sat 7 Nov 2026, Sun 8 Nov 2026 · Maximum travel distance: 30 km";
  - "Back" and the step 1 link open Plan setup with the same values;
  - without `checked`, or after a change on Plan setup, `/plan/activities` redirects to `/plan/setup`.

### Implementation for User Story 4

- [X] T050 [US4] Create `backend/src/SpekLaiku.Api/Services/PlanSetupService.cs` (`LocationSearchService`, `ForecastPeriod`). `CheckAsync(PlanSetupCheckRequest, CancellationToken)` works like this:
  - get the period;
  - run `PlanSetupValidator.Validate`;
  - when `LocationId > 0`, call `FindAsync` and, if it returns `null`, put `locationId` "Select a location in Lithuania from the list." **first** in a new ordered error list, followed by the validator's errors;
  - return `Invalid` when there are any errors, otherwise `Success(new CheckedPlanSetup(place, dates, distance))`.

  Register it with `AddScoped<PlanSetupService>()`.
- [X] T051 [US4] Extend `backend/src/SpekLaiku.Api/Controllers/PlanSetupController.cs` (created in US2, with the policy and the request limit on the class):
  - `[HttpPost("check")]` returns `200` with `CheckedPlanSetupResponse`, or `400` `ValidationProblemDetails` built from the ordered errors (keys and order as in the contract);
  - `ProducesResponseType` for 200, 400, 403, 429 and 503. No business rules.
- [X] T052 [P] [US4] Add to `frontend/src/api/planSetupApi.ts` (created in T022): `checkPlanSetup(request, signal)` returns `PlanSetupCheckOutcome = { kind: "checked"; setup } | { kind: "invalid"; errors } | { kind: "forbidden" } | { kind: "tooManyRequests" }`. A `400` reads the first message for `locationId`, `dates`, `maxTravelDistanceKm` and every `dates[<n>]` key, and a `400` without known keys throws. Other statuses throw `ApiError`, following `activityCategoriesApi.ts`.
- [X] T053 [US4] Create `frontend/src/stores/usePlanSetupCheckStore.ts` following `useLoginStore`/`useCategoryFormStore`:
  - state: `status: "idle" | "pending" | "invalid" | "serverError" | "tooManyRequests"`, `errors`, `lastRequest`, `controller`;
  - `submit(request)`: `planSetupCheckTimeoutMs = 10_000`; second submits ignored through `get()`; on `checked` call `usePlanSetupStore.getState().setChecked(setup)` and resolve `true`; on `forbidden` call `useCurrentUserStore.getState().refresh()`;
  - `retry()` and `reset()`.

  Reset it in `frontend/src/tests/setup.ts`.
- [X] T054 [US4] Extend `frontend/src/pages/PlanSetupPage.tsx` with "Continue".
  - **Checks before sending:** no chosen location → `locationId` "Select a location in Lithuania from the list."; no dates → `dates` "Add at least one date.". In either case show them without sending.
  - **Sending:** otherwise build `{ locationId, dates, maxTravelDistanceKm: null }` (the distance field comes in US3) and call `submit`.
  - **While pending:** show "Checking your plan setup…" in `role="status"` and disable Continue.
  - **Failed check:** show the existing `ErrorSummary` at the top of the form (per-date entries as "<formatted date>: <message>", each linking to the date input), field errors in `LocationSearchField` and `PlanDatesField` with the "Error: " prefix, and move focus to the first invalid field in the order Location, date input, distance.
  - **Server error and too many requests:** show "Error: Something went wrong. Try again." or "Error: Too many requests. Wait a minute and try again." in `role="alert"` with a Retry button calling `retry()`.
  - **Success:** `navigate("/plan/activities")`.
  - **Size:** if the page passes about 200 lines, move the form into `frontend/src/components/planSetupForm.tsx`.
- [X] T055 [P] [US4] Create `frontend/src/components/planSetupSummary.tsx`. It renders, from a `CheckedPlanSetup`, "<name>, <area>", the formatted dates joined with ", ", and "Maximum travel distance: <n> km", in a description list or a paragraph separated by " · ".
- [X] T056 [US4] Create `frontend/src/pages/ActivitySelectionPage.tsx` (first version, spec FR-024 to FR-026):
  - `usePageTitle("Activity selection")`, one `<h1>` "Activity selection", `<PlanProgress current={2} />`, `PlanSetupSummary`, and a "Back" link to `/plan/setup` styled as a button;
  - with `checked === null`, render `<Navigate to="/plan/setup" replace />`;
  - add a comment that feature 005 adds activity selection here.

  In `frontend/src/components/appRoutes.tsx`, add the route `plan/activities` → `ActivitySelectionPage`.

**Checkpoint**: The full P1 flow from location and dates to Activity selection works, with server-side checks and the request limit.

---

## Phase 6: User Story 6 - Only visitors and active registered users can set up a plan (Priority: P1)

**Goal**: Administrators and suspended users can neither see nor use plan setup, in the browser or on the server.

**Independent Test**: Open Plan setup as a visitor, an Active Registered User, an Active Administrator and a Suspended user; only the first two can use it.

### Tests for User Story 6

- [X] T057 [P] [US6] Add `backend/tests/SpekLaiku.IntegrationTests/PlanSetupAuthorizationTests.cs`, a theory over all three endpoints (`GET /api/locations?query=<unique>`, `GET /api/plan-setup/period` and `POST /api/plan-setup/check` with a valid body) and every caller in the contract's authorization table:
  - a Visitor and an Active Registered User are not `401`/`403`;
  - a Suspended Registered User, an Active Administrator and a Suspended Administrator get `403` with no location data and no call to the fake client;
  - a signed-in user whose account is deleted after signing in gets `403`;
  - a Registered User whose status is set to `Suspended` in the database after signing in gets `403` on the next request.
- [X] T058 [P] [US6] Add `frontend/src/tests/planCreatorOnly.test.tsx` and extend `frontend/src/tests/topNavigation.test.tsx` and `frontend/src/tests/HomePage.test.tsx`. Cover:
  - `/plan/setup` and `/plan/activities` render nothing while the current user loads;
  - both open for a visitor and an Active Registered User;
  - an Active Administrator sees the Access Denied page at the same address and no request is sent to `/api/locations` or `/api/plan-setup/period`;
  - a Suspended Registered User and a Suspended Administrator are sent to `/account-suspended`;
  - "Create plan" is in the navigation and on Home for a visitor and an Active Registered User, and absent for an Active Administrator, a Suspended Registered User and a Suspended Administrator;
  - a Continue answered with `403` refreshes the current user, and the page then shows Access Denied.
- [X] T059 [P] [US6] Add `frontend/src/tests/canCreatePlan.test.ts` with one case per status, role and account status combination, including `"loading"` → `false` and `"error"` → `true`.

### Implementation for User Story 6

- [X] T060 [US6] Create `frontend/src/components/planCreatorOnly.tsx` (research section 8):
  - render nothing while the status is `"loading"`;
  - a signed-in user with `accountStatus === "Suspended"` gets `<Navigate to="/account-suspended" replace />`;
  - a signed-in user whose role is not `"Registered User"` gets `AccessDeniedPage`;
  - otherwise render the children.

  Comment that the server checks the same rule on every request. In `frontend/src/components/appRoutes.tsx`, wrap both `plan/setup` and `plan/activities` in `PlanCreatorOnly`, without `SignedInOnly`, because Visitors are allowed.

**Checkpoint**: All P1 stories are complete.

---

## Phase 7: User Story 3 - Set the maximum travel distance (Priority: P2)

**Goal**: The user sets a maximum travel distance (1 to 200 km, default 30) that is checked and kept with the setup.

**Independent Test**: The user changes the distance from 30 to 50, continues, and Activity selection shows "Maximum travel distance: 50 km".

### Tests for User Story 3

- [X] T061 [P] [US3] Add `frontend/src/tests/parseTravelDistance.test.ts`. Cover:
  - `""` and `"   "` → `{ kind: "default" }` (sent as `null`);
  - `"45"`, `" 45 "` and `"045"` → `{ kind: "number", value: 45 }`;
  - `"12.5"` → `{ kind: "number", value: 12.5 }`, so the server refuses it;
  - `"abc"`, `"1e3"`, `"12,5"` and `"-"` → `{ kind: "invalid" }`.
- [X] T062 [P] [US3] Extend `frontend/src/tests/PlanSetupPage.test.tsx` (distance part). Cover:
  - a new plan shows "Maximum travel distance (km)" with the value 30 and the hint "Whole number from 1 to 200" linked through `aria-describedby`;
  - "abc" shows "Error: Enter a whole number between 1 and 200." next to the field and in the summary without sending a request;
  - a server error for `maxTravelDistanceKm` (for 0, 201 or 12.5) is shown the same way, with focus on the field when it is the first invalid one;
  - an empty field sends `null`, and after a successful Continue shows 30 again;
  - 50 is sent and shown on Activity selection.

### Implementation for User Story 3

- [X] T063 [P] [US3] Create `frontend/src/helpers/parseTravelDistance.ts` with `parseTravelDistance(text)` returning the outcomes in T061. Accept `^\d+(\.\d+)?$` after trimming; whole-number and range checks stay on the server (FR-016).
- [X] T064 [US3] In `frontend/src/pages/PlanSetupPage.tsx` (or `planSetupForm.tsx`):
  - add the existing `TextField` "Maximum travel distance (km)" with `type="text"`, `inputMode="numeric"`, the hint "Whole number from 1 to 200", and the value from `usePlanSetupStore.maxTravelDistanceText`;
  - on Continue, an `invalid` parse adds the local `maxTravelDistanceKm` error; otherwise send the number or `null`;
  - after a successful check, set `maxTravelDistanceText` to the returned `maxTravelDistanceKm` as text, so an empty field shows 30 again (spec User Story 3, scenario 4). Setting the text must not clear `checked`: add a `setChecked(setup)` variant that also sets this text, or set both in one store update.

**Checkpoint**: The distance is entered, checked and shown on the next step.

---

## Phase 8: User Story 5 - Keep the setup while planning in this session (Priority: P2)

**Goal**: The setup survives leaving the page, reloads and logging in within the same tab, and is cleared on logout or when the tab closes.

**Independent Test**: Choose a location and two dates, reload, and both are still shown; after logging out the Plan setup page is empty.

### Tests for User Story 5

- [X] T065 [P] [US5] Extend `frontend/src/tests/usePlanSetupStore.test.ts`. Cover:
  - after actions, `sessionStorage["spek-laiku-plan-setup"]` holds the location, location text, dates, distance text and `checked`, with `version` 1;
  - a store recreated from that storage (call `usePlanSetupStore.persist.rehydrate()`) has the same values;
  - unreadable stored JSON or an unknown version starts from the initial state;
  - `clear()` empties the stored values.
- [X] T066 [P] [US5] Add `frontend/src/tests/planSetupSession.test.tsx`. Cover:
  - leaving Plan setup for Home and returning shows the same location, dates and distance;
  - a remount after rehydration (simulating a reload) shows them too;
  - a visitor who logs in through the Log in page in the same session still sees the setup on "Create plan";
  - a visitor who registers through the Register page in the same session also still sees it (spec User Story 5, scenario 5);
  - a successful logout clears the setup, so Plan setup is empty;
  - a failed logout keeps it;
  - with a kept date earlier than the `firstDate` in the `GET /api/plan-setup/period` answer, opening Plan setup shows that chip marked "Error: Dates cannot be in the past." without removing it (spec FR-018).

### Implementation for User Story 5

- [X] T067 [US5] In `frontend/src/stores/usePlanSetupStore.ts`, wrap the store in Zustand's `persist` middleware (from `zustand/middleware`, part of the existing package):
  - `name: "spek-laiku-plan-setup"`, `version: 1`, `storage: createJSONStorage(() => sessionStorage)`;
  - `partialize` keeps only the five data fields;
  - a `migrate` that returns the initial state for any other version.

  Comment why `sessionStorage` is used (research section 7). In `frontend/src/tests/setup.ts`, call `sessionStorage.clear()` after each test.
- [X] T068 [US5] In `frontend/src/stores/useLogoutStore.ts`, after a successful logout, call `usePlanSetupStore.getState().clear()` next to `setSignedOut()`, with a comment citing spec FR-017. In `frontend/src/components/planDatesField.tsx`, once `usePlanPeriodStore` is `loaded`, mark each chip whose date fails `checkKeptDate(date, period)` with that message when no server error is shown for it (spec FR-018).

**Checkpoint**: The setup behaves as a session-only plan.

---

## Phase 9: User Story 7 - Set up a plan with keyboard, screen reader and on a phone (Priority: P2)

**Goal**: Plan setup and Activity selection work with a keyboard, a screen reader and at 320 px.

**Independent Test**: Complete Plan setup with the keyboard only, and use the page at 320 px wide without horizontal scrolling.

### Tests for User Story 7

- [X] T069 [P] [US7] Extend `frontend/src/tests/keyboard.test.tsx` with tests that on Plan setup the tab order is:
  1. the skip link;
  2. the navigation;
  3. the progress bar (no focusable later steps);
  4. Location;
  5. the date input;
  6. "Add date";
  7. each chip's "Remove" button;
  8. Maximum travel distance;
  9. Continue.

  Also test that a location can be chosen and a date added, and that the user can continue using only the keyboard.
- [X] T070 [P] [US7] Extend `frontend/src/tests/accessibility.test.tsx` and `frontend/src/tests/layout.test.tsx`. Cover:
  - Plan setup and Activity selection each have exactly one `<h1>`, their titles, and "Skip to main content" as the first focusable item;
  - every field has a visible label;
  - the combobox has `role="combobox"`, `aria-expanded`, `aria-controls` and `aria-activedescendant` while an option is highlighted;
  - Dates is a `group` named "Dates";
  - loading and count messages are in `role="status"`, and errors in `role="alert"` or linked through `aria-describedby` with `aria-invalid="true"`;
  - error texts start with "Error: " (not colour alone).
- [X] T071 [P] [US7] Extend `frontend/src/tests/responsive.test.tsx` with tests that the CSS puts the distance and date fields side by side with chips in a row on desktop. Below the existing mobile breakpoint, check that:
  - fields are stacked, chips wrap, and buttons are full width;
  - the progress list labels are hidden and the "Step n of 4" element is shown;
  - buttons, chip remove buttons and options are at least 44 × 44 px, and inputs use at least 16 px text.

### Implementation for User Story 7

- [X] T072 [US7] In `frontend/src/styles.css`, add the Plan setup and Activity selection styles, reusing the existing form, button and breakpoint rules instead of copying them:
  - the combobox list (positioned under the input, highlighted option visible without relying on colour alone, for example an outline);
  - the date chips (row on desktop, wrapping on phones);
  - the distance and date fields side by side on desktop, stacked on phones;
  - the progress bar (four labelled steps on desktop; "Step n of 4" with four segments on phones);
  - the summary line;
  - 44 × 44 px targets and 16 px input text.

**Checkpoint**: All user stories are complete.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T073 [P] Update `README.md`:
  - a "Plan setup" section: the pages `/plan/setup` and `/plan/activities`, who can use them, and that the setup lives only in the browser tab (session storage) and is cleared on logout;
  - that the API needs outgoing HTTPS access to `geocoding-api.open-meteo.com` and that the tests never call it;
  - the `RateLimiting:PlanSetup` settings and how to change them with environment variables (`RateLimiting__PlanSetup__PermitLimit`);
  - in the deployment section, that the forwarded-headers middleware must be configured for a trusted reverse proxy, or all users share one limit (research section 14).

  No migration step is needed.
- [X] T074 [P] Check that `docs/requirements.md` (FR-046, FR-049), `docs/ux-design.md` (Plan Setup states and traceability) and `docs/architecture.md` (`Authorization/`, `RateLimiting/`, `Clients/`, `Errors/`), which were updated during planning, still match the implemented behaviour and file names. Fix any difference (constitution VI).
- [X] T075 [P] Check that every new or changed C# class is under 200 lines (constitution I), especially `OpenMeteoGeocodingClient.cs`, `LocationSearchService.cs`, `PlanSetupRateLimit.cs` and `Program.cs`. Check that every new React page or component is under about 200 lines, especially `PlanSetupPage.tsx`, `locationSearchField.tsx` and `planDatesField.tsx`. Split by responsibility if not.
- [X] T076 Run `dotnet format .\SpekLaiku.slnx --verify-no-changes`, `dotnet build .\SpekLaiku.slnx` and `dotnet test .\SpekLaiku.slnx` from the repository root. Run `npm run lint`, `npm run format:check`, `npm test` and `npm run build` from `frontend/`. Fix any failure without weakening tests or checks. Confirm no test calls the live Open-Meteo service: with the network disconnected, the tests still pass.
- [X] T077 Review `git diff main...HEAD`. Check that:
  - there are no unintended files (no `bin/`, `obj/`, `node_modules/`, local settings or debug code);
  - there is no migration and no new package;
  - `appsettings.Development.json` is unchanged.

  Then list the quickstart Manual Validation steps for the user to run before the Pull Request.
- [X] T078 Run a separate AI-assisted review of the branch (for example `/code-review` and `/security-review`) and apply or reject each finding with a short reason. Then prepare the Pull Request description for the user (constitution V, VII and Quality Gates). It must include:
  - a link to `specs/004-plan-location-dates/spec.md` and a summary of the change;
  - the tests and checks run (T076 and the manual quickstart steps), and "no migration";
  - screenshots of Plan setup (desktop and 320 px) with suggestions, with errors and with too many requests, and of the Activity selection step;
  - the review tool, important findings, changes made and findings not applied.

  The user opens and merges the Pull Request.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories. Inside it:
  - T002 and T003 before T004; T004 before T005; T002 before T006;
  - T007 before T008; T009 before T010;
  - T011 and T012 before T013; T013 before T014;
  - T015 before T016; T017 after T015 (both edit `Program.cs`); T019 after T017;
  - T020 after T007 and T003;
  - T021 before T022 and T024.
- **US1 (Phase 3)**: Depends on Foundational.
- **US2 (Phase 4)**: Depends on US1 (the page).
- **US4 (Phase 5)**: Depends on US1 and US2 (the location and date fields). The backend tasks T044, T045 and T050 need only Foundational and T030 (`FindAsync`); T051 also needs T041 (the controller).
- **US6 (Phase 6)**: Depends on US4 (both routes and endpoints exist). T057 needs both controllers.
- **US3 (Phase 7)**: Depends on US4 (Continue and the summary).
- **US5 (Phase 8)**: Depends on US2 (chips) and US4 (`checked`). It can run alongside US3, but T068 and T064 touch different files, so there is no conflict.
- **US7 (Phase 9)**: Depends on US1 to US6 and US3 (the tests check the final page).
- **Polish (Phase 10)**: Depends on all stories.

### Within Each User Story

- Tests are written first and must fail before the implementation tasks.
- Backend: service → controller.
- Frontend: helper → API → store → component → page → route.

### Parallel Opportunities

- Foundational: T002/T003, T007/T008, T009/T010, T011, T012, T016, T018, T020, T021 and T023 touch different files; T022 follows T021.
- US1: T025 to T029 (all tests) in parallel; then T032 and T035 alongside the backend tasks T030 and T031.
- US2: T038, T039 and T040 in parallel; T041 alongside T042; T042 before T043.
- US4: T044 to T049 in parallel; T052 and T055 alongside T050 and T051.
- US6: T057 to T059 in parallel.
- US3: T061 to T063 in parallel.
- US5: T065 and T066 in parallel.
- US7: T069 to T071 in parallel.
- Polish: T073 to T075 in parallel; then T076, T077 and T078 in order.

---

## Parallel Example: User Story 1

```text
# All tests for User Story 1 together:
Task: "T025 LocationSearchServiceTests in backend/tests/SpekLaiku.UnitTests/LocationSearchServiceTests.cs"
Task: "T026 LocationsEndpointTests in backend/tests/SpekLaiku.IntegrationTests/LocationsEndpointTests.cs"
Task: "T027 locationsApi and useLocationSearchStore tests in frontend/src/tests/"
Task: "T028 PlanSetupPage location tests in frontend/src/tests/PlanSetupPage.test.tsx"
Task: "T029 Create plan navigation tests in frontend/src/tests/topNavigation.test.tsx and HomePage.test.tsx"

# Independent pieces together:
Task: "T030 LocationSearchService in backend/src/SpekLaiku.Api/Services/LocationSearchService.cs"
Task: "T032 locationsApi in frontend/src/api/locationsApi.ts"
Task: "T035 planProgress in frontend/src/components/planProgress.tsx"
```

## Parallel Example: User Story 4

```text
Task: "T044 PlanSetupServiceTests in backend/tests/SpekLaiku.UnitTests/PlanSetupServiceTests.cs"
Task: "T045 PlanSetupCheckEndpointTests in backend/tests/SpekLaiku.IntegrationTests/PlanSetupCheckEndpointTests.cs"
Task: "T046 PlanSetupRateLimitTests in backend/tests/SpekLaiku.IntegrationTests/PlanSetupRateLimitTests.cs"
Task: "T047 planSetupApi and usePlanSetupCheckStore tests in frontend/src/tests/"
Task: "T048 PlanSetupPage Continue tests in frontend/src/tests/PlanSetupPage.test.tsx"
Task: "T049 ActivitySelectionPage tests in frontend/src/tests/ActivitySelectionPage.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2. The client, rules, policies, request limit and fakes are in place and tested.
2. Complete Phase 3 (US1): a visitor searches and chooses a place in Lithuania.
3. **STOP and VALIDATE** with the US1 independent test, then review the diff.

### Incremental Delivery

1. US1 → location search (MVP).
2. US2 → dates.
3. US4 → Continue, server check and the Activity selection step.
4. US6 → browser-side access rules and navigation per role.
5. US3 → maximum travel distance.
6. US5 → session storage and clearing on logout.
7. US7 → keyboard, screen reader and 320 px.
8. Polish → documentation, size check, full checks, diff review, AI review and Pull Request description.

Implement one phase at a time and stop after each phase for a diff review. Commit only when asked, with Conventional Commit messages such as `feat(plan-setup): add Open-Meteo geocoding client`.

---

## Notes

- [P] tasks touch different files and do not depend on unfinished tasks.
- No migration and no new package. The geocoding service is always faked in tests (`FakeHttpMessageHandler` in unit tests, `FakeGeocodingClient` in integration tests).
- Integration tests share one API host with one memory cache and one request-limit partition. Each test uses its own search texts and place ids, and the shared factory's limit is 10 000. Only `PlanSetupRateLimitTests` uses a low limit, on its own host.
- Only `ForecastPeriod` gets the fixed test clock. Cookies and Identity keep the real `TimeProvider`, so moving the test clock never signs anyone out.
- API messages have no "Error: " prefix; the frontend adds it.
