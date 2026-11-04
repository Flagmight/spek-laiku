# Implementation Plan: 004-plan-location-dates

**Branch**: `004-plan-location-dates` | **Date**: 2026-11-04 | **Spec**: [specs/004-plan-location-dates/spec.md](spec.md)

**Input**: Feature specification from `/specs/004-plan-location-dates/spec.md`

## Summary

Let a Visitor or an Active Registered User start a plan: choose a place in Lithuania from location search, add 1 to 7 dates within a 7-day forecast period (today in Lithuania + 6), set a maximum travel distance (1 to 200 km, default 30), and continue to a first, minimal version of the Activity selection step.

**Backend**:
- The first external client, `OpenMeteoGeocodingClient` (typed `HttpClient`, 5 s timeout, failures logged without search text).
- `LocationSearchService` with an in-memory cache. It keeps only `LT` places and works out a readable area name.
- `ForecastPeriod` based on `TimeProvider`.
- `PlanSetupValidator` and `PlanSetupService`, which look the location up again by id, so the client cannot invent a place.
- A `PlanCreator` authorization policy: anonymous callers or Active Registered Users.
- Two thin controllers: `GET /api/locations`, `GET /api/plan-setup/period` (the forecast period and the date limit, so the page holds no date rules) and `POST /api/plan-setup/check`.
- `ApiExceptionHandler` maps service failures to `503`.
- A built-in rate limit shared by location search and the plan setup check: 30 requests per minute per network address, configurable, answered with `429`.

**Frontend**:
- A Plan setup page with an accessible combobox, date chips and the distance field.
- A session-stored Zustand plan setup store.
- Location search and check stores.
- The Activity selection step page (summary and Back only), a progress bar, a `PlanCreatorOnly` guard, and "Create plan" in the navigation and on Home.

No database change and no new package.

## Technical Context

**Language/Version**: C# on .NET 10 (ASP.NET Core Web API); TypeScript with React 19, built with Vite. Unchanged.

**Primary Dependencies**: Existing only.
- Backend: ASP.NET Core Identity (`UserManager` for the policy), `IHttpClientFactory`, `IMemoryCache`, `TimeProvider`, the rate limiting middleware (all shared framework), and AutoMapper.
- Frontend: React, React Router, Zustand (including its built-in `persist` middleware).
- Tests: xUnit, `Microsoft.AspNetCore.Mvc.Testing`, Testcontainers PostgreSQL, Vitest, React Testing Library, user-event.

**No new NuGet or npm package** (research section 13).

**External service**: The Open-Meteo geocoding API (`/v1/search` and `/v1/get`), called only by the backend (research sections 1 to 5). Base address `https://geocoding-api.open-meteo.com/` as a constant in the client: it is public and needs no key, so no configuration entry or secret is involved.

**Authorization**: The policy `AuthorizationPolicies.PlanCreator` (`Authorization/PlanCreatorRequirement.cs`, `Authorization/PlanCreatorHandler.cs`). It is registered in `Program.cs` next to `ActiveAdministrator`, without `RequireAuthenticatedUser`, plus `AddScoped<IAuthorizationHandler, PlanCreatorHandler>()`.
- The handler succeeds for an anonymous caller.
- For a signed-in caller it succeeds only when the account exists, has `Role == "Registered User"` and `AccountStatus.Active`.
- A refusal becomes `403` through the existing cookie events.
- The policy is set on both new controllers (research section 8).

**Request limit** (spec FR-027, research section 14):
- One rate limiting policy, `RateLimitPolicies.PlanSetup`: a fixed window per client network address, by default 30 requests per 60 s, with no queue.
- The values are configured under `RateLimiting:PlanSetup` in `appsettings.json`.
- Both new controllers carry `[EnableRateLimiting(RateLimitPolicies.PlanSetup)]`.
- A refusal answers `429` with problem details and `Retry-After`, before authorization, the cache or the geocoding service runs.

**Backend structure** (`backend/src/SpekLaiku.Api/`):
- `Clients/IGeocodingClient.cs` (new): `SearchAsync(string text, CancellationToken)` returns `IReadOnlyList<GeocodingPlace>`; `GetAsync(long id, CancellationToken)` returns `GeocodingPlace?`.
- `Clients/OpenMeteoGeocodingClient.cs` (new):
  - Builds the query string with `Uri.EscapeDataString`: `count=10`, `language=en`, `countryCode=LT`.
  - Reads `results`; a missing `results` means an empty list.
  - Treats `400` from `/v1/get` as not found.
  - Turns timeouts, network errors, other statuses and unreadable JSON into `ExternalServiceException`, and logs one warning with the failure kind and status code only.
  - JSON shapes live in `Clients/OpenMeteoGeocodingResponse.cs` (new, internal records).
- `Clients/GeocodingPlace.cs`, `Clients/ExternalServiceException.cs`, `Clients/ExternalService.cs` and `Clients/FailureKind.cs` (new): see `data-model.md`.
- `Services/PlaceLocation.cs`, `CheckedPlanSetup.cs`, `PlanSetupResult.cs` and `LocationSearchResult.cs` (new): result records as in `data-model.md`.
- `Services/LocationAreaName.cs` (new, static): the area rule (research section 3).
- `Services/ForecastPeriod.cs` (new): `Days`, `TimeZoneId`, and `GetCurrent()` returning `(DateOnly FirstDate, DateOnly LastDate)` from the injected `TimeProvider`. It is registered as a singleton.
- `Services/PlanSetupValidator.cs` (new, static): `Validate(PlanSetupCheckRequest, firstDate, lastDate)` returns the ordered errors, the distinct sorted dates and the distance (30 when null). It holds `MaxDates = 7`, `MinTravelDistanceKm = 1`, `MaxTravelDistanceKm = 200`, `DefaultTravelDistanceKm = 30`. Feature 009 reads the distance limits from here.
- `Services/LocationSearchService.cs` (new):
  - `SearchAsync(query)` trims the text and checks 2 to 100 characters. It then searches only the text before the first comma: fewer than 2 characters there means an empty result without an external call (research section 1). It uses the cache by that lower-case text for 1 hour, keeps only `LT` places, maps them to `PlaceLocation`, and caches each by id.
  - `FindAsync(id)` uses the cache by id, then `GetAsync`, and returns null when the place is not found or not `LT`.
  - It uses `IGeocodingClient` and `IMemoryCache`.
- `Services/PlanSetupService.cs` (new): `CheckAsync(request)` runs the validator, calls `LocationSearchService.FindAsync` when the id is present and positive, and adds the location error when that returns null. It returns `PlanSetupResult`.
- `DTOs/Requests/PlanSetupCheckRequest.cs` (new): `long? LocationId`, `List<DateOnly>? Dates`, `decimal? MaxTravelDistanceKm`.
- `DTOs/Responses/LocationResponse.cs`, `LocationSearchResponse.cs` and `CheckedPlanSetupResponse.cs` (new): as in `contracts/plan-setup-api.md`.
- `Mapping/PlanSetupMappingProfile.cs` (new): `PlaceLocation` to `LocationResponse`, and `CheckedPlanSetup` to `CheckedPlanSetupResponse`, with dates written as `yyyy-MM-dd` by the default `DateOnly` converter. No rules.
- `Controllers/LocationsController.cs` (new): `[Route("api/locations")]`, `GET` with `[FromQuery] string? query`, returning `200` or `400`.
- `Controllers/PlanSetupController.cs` (new): `[Route("api/plan-setup")]`.
  - `GET period` returns `200` with `PlanPeriodResponse` (`firstDate`, `lastDate`, `maxDates`) from `ForecastPeriod.GetCurrent()` and `PlanSetupValidator.MaxDates`. It has `[DisableRateLimiting]`, because it makes no external call.
  - `POST check` returns `200`, or `400` (`ValidationProblemDetails`, the same shape as `AuthController`).
- `DTOs/Responses/PlanPeriodResponse.cs` (new): `(DateOnly FirstDate, DateOnly LastDate, int MaxDates)`.
- Both controllers carry `[Authorize(Policy = AuthorizationPolicies.PlanCreator)]` and `[EnableRateLimiting(RateLimitPolicies.PlanSetup)]`.
- `RateLimiting/RateLimitPolicies.cs` (new): the policy name constant, following `AuthorizationPolicies`.
- `RateLimiting/PlanSetupRateLimitOptions.cs` (new): `PermitLimit` (default 30) and `WindowSeconds` (default 60), bound from `RateLimiting:PlanSetup` and validated on start (both positive).
- `RateLimiting/PlanSetupRateLimit.cs` (new): the `AddPlanSetupRateLimit(this IServiceCollection, IConfiguration)` extension. It registers `AddRateLimiter` with the partitioned fixed-window policy (key: `RemoteIpAddress`, or `"unknown"` when there is none), `RejectionStatusCode = 429`, and `OnRejected` writing the problem details and `Retry-After`.
- `appsettings.json` (changed): the section `"RateLimiting": { "PlanSetup": { "PermitLimit": 30, "WindowSeconds": 60 } }`. Nothing is added to `appsettings.Development.json`.
- `Errors/ApiExceptionHandler.cs` (changed): `ExternalServiceException` becomes `503` "Service unavailable." with the location search message. Other exceptions stay as they are.
- `Program.cs` (changed): `AddMemoryCache()`, `AddSingleton(TimeProvider.System)`, `AddSingleton<ForecastPeriod>()`, `AddHttpClient<IGeocodingClient, OpenMeteoGeocodingClient>()` with the base address and timeout, the policy and its handler, `AddScoped` for both services, and `AddPlanSetupRateLimit(builder.Configuration)`. In the pipeline, `app.UseRateLimiter()` goes between `UseAuthentication()` and `UseAuthorization()`.

**Error responses**: `400` `ValidationProblemDetails` (keys in contract order), `403` from the policy, `429` from the request limit, `503` service unavailable, `500` from the existing handler. Details are in `contracts/plan-setup-api.md`.

**Frontend structure** (`frontend/src/`):
- `types/planSetup.ts` (new): `PlanLocation`, `PlanSetupCheckRequest`, `CheckedPlanSetup`, and `PlanSetupFieldErrors` (keys `locationId`, `dates`, `` `dates[${number}]` ``, `maxTravelDistanceKm`).
- `api/locationsApi.ts` (new): `searchLocations(query, signal)`. It returns `PlanLocation[]`; any non-200 status, including `429` and `503`, throws `ApiError` with that status.
- `api/planSetupApi.ts` (new): `getPlanPeriod(signal)` returns `PlanPeriod`; any non-200 status throws `ApiError`. `checkPlanSetup(request, signal)` returns `{ kind: "checked", setup } | { kind: "invalid", errors } | { kind: "forbidden" } | { kind: "tooManyRequests" }`; other statuses throw `ApiError`, following `activityCategoriesApi.ts`.
- `helpers/formatPlanDate.ts`, `planDateRules.ts`, `parseTravelDistance.ts` and `canCreatePlan.ts` (new): research sections 6 and 11. `planDateRules.ts` compares against the server's period and holds no limits.
- `stores/usePlanPeriodStore.ts` (new, not persisted): `status: "loading" | "loaded" | "error"`, `period`, `load()` with a 10 s timeout, `reset()` (research section 6).
- `stores/usePlanSetupStore.ts` (new, `persist` to `sessionStorage`): data-model section "Plan setup store".
- `stores/useLocationSearchStore.ts` (new): 300 ms pause, latest request wins, 10 s timeout, `reset()`. `ApiError` 429 sets `tooManyRequests`; any other failure sets `unavailable`.
- `stores/usePlanSetupCheckStore.ts` (new): the `useLoginStore` pattern with a 10 s timeout. On `checked` it calls `usePlanSetupStore.getState().setChecked(setup)` and resolves true. On `forbidden` it refreshes the current user. On `tooManyRequests` it sets that status, keeping Retry.
- `stores/useLogoutStore.ts` (changed): calls `usePlanSetupStore.getState().clear()` after a successful logout (spec FR-017).
- `pages/PlanSetupPage.tsx` (new):
  - `usePageTitle("Plan setup")`, `<h1>` "Plan setup", `PlanProgress` at step 1.
  - `ErrorSummary`, `LocationSearchField`, `PlanDatesField`, the distance `TextField` and "Continue".
  - Server field errors are shown per field, and focus moves to the first invalid field.
  - On success it navigates to `/plan/activities`.
  - On unmount it resets the search and check stores (not the plan setup store).
- `pages/ActivitySelectionPage.tsx` (new, first version): `usePageTitle("Activity selection")`, `<h1>` "Activity selection", `PlanProgress` at step 2, `PlanSetupSummary` and "Back". Without `checked` it renders `<Navigate to="/plan/setup" replace />`.
- `components/locationSearchField.tsx`, `planDatesField.tsx`, `planProgress.tsx`, `planSetupSummary.tsx` and `planCreatorOnly.tsx` (new): research section 11.
- `components/appRoutes.tsx` (changed): `plan/setup` and `plan/activities`, each wrapped in `PlanCreatorOnly`.
- `components/topNavigation.tsx` (changed): "Create plan" between Home and the visitor or user links, for a visitor and an Active Registered User.
- `pages/HomePage.tsx` (changed): a "Create plan" link styled as a button under the same rule.
- `styles.css` (changed):
  - the combobox list, date chips in a row that wrap below the existing breakpoint, and distance and date fields side by side on desktop, stacked on phones;
  - progress bar with four labelled steps on desktop, and "Step n of 4" with segments on phones;
  - 44 × 44 px targets and 16 px input text.
- `tests/setup.ts` (changed): resets the three new stores and clears `sessionStorage` after each test.

**Origins and CSRF**: Unchanged from features 002 and 003. The new `POST` changes no stored state and accepts JSON only.

**Storage**: None on the server. The browser keeps the plan setup in `sessionStorage` (research section 7). **No migration.**

**Testing**:
- **Backend unit tests**: `ForecastPeriod` (with a `FixedTimeProvider` test class), `PlanSetupValidator`, `LocationAreaName`, `LocationSearchService` (with a fake `IGeocodingClient` and a real `MemoryCache`), `PlanSetupService`, `PlanCreatorHandler`, `OpenMeteoGeocodingClient` (with a fake `HttpMessageHandler` and the existing `CapturingLoggerProvider` to prove the log has no search text), and `ApiExceptionHandler` `503`.
- **Backend integration tests**:
  - `PostgreSqlApiFactory` with `ConfigureTestServices` replacing `IGeocodingClient` with a fake that returns scripted places or throws, and `TimeProvider` with a fixed time.
  - The factory sets `RateLimiting:PlanSetup:PermitLimit` to 10 000, because all test requests share the `"unknown"` address partition. A separate request-limit test class uses a limit of 3 (research section 14).
  - The authorization table for all three endpoints, using the existing test sign-in.
  - Every contract status and message.
  - No test calls the live service (constitution III).
- **Frontend tests** with Vitest, faked `fetch` and `vi.setSystemTime`: the list in `quickstart.md`.

**Target Platform**: Web application, the same browsers and server as before. The API host needs outgoing HTTPS to the geocoding service.

**Project Type**: Full-stack web application.

**Performance Goals**:
- Suggestions within 2 seconds for 95% of searches while the service works (SC-002). The 300 ms pause plus a typical service answer of under 1 s fits, and repeated searches come from the cache.
- Setup in under 1 minute (SC-001).

**Constraints**:
- Server-side validation and authorization on all three endpoints.
- The browser never calls Open-Meteo.
- No invented or stale suggestions after a failure (constitution, External data).
- Accessibility and a 320 px layout.
- Every new C# class under 200 lines, and React files under about 200 lines.

**Scale/Scope**: Three endpoints, two pages (one minimal), five components, four stores and four helpers.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **PASS (I Code quality)**: Date and distance rules are in one place on the server (`PlanSetupValidator`), and the area rule is in `LocationAreaName`. The forecast period and the date limit are worked out only by the backend and sent to the page through `GET /api/plan-setup/period`. The frontend `planDateRules.ts` only compares against those values and holds no rule of its own (research section 6, analysis finding C1). Classes have one responsibility each and stay under 200 lines. No Manager, Helper or Utils names.
- **PASS (II Architecture)**:
  - Controllers only bind, call a service and translate the result.
  - Rules and the location lookup are in services.
  - The external call goes through `Clients/OpenMeteoGeocodingClient` via `IHttpClientFactory`, never from the browser.
  - All I/O is async with `CancellationToken`.
  - Responses are DTOs mapped by AutoMapper with no rules in the profile.
  - There is no schema change, so no migration.
  - Frontend calls go only through `api/locationsApi.ts` and `api/planSetupApi.ts`.
- **PASS (III Testing)**:
  - Unit and integration tests for every rule and endpoint, and frontend tests for loading, success, empty, validation-error and server-error states.
  - All three endpoints have authorization tests for every caller type.
  - The "one user cannot change another user's data" rule does not apply: nothing is stored, and every caller sees only their own browser session.
  - The geocoding service is always faked, and the clock is fixed through `TimeProvider` and `vi.setSystemTime`.
- **PASS (IV Security)**:
  - Authorization is enforced on the server by a policy that reads the current role and status.
  - All input is validated on the server: the location is trusted only by id and looked up again, and dates and distance are checked against fixed rules.
  - The search text is URL-escaped and the base address is fixed, so a request cannot reach another host (OWASP injection and SSRF).
  - No secrets.
  - Logs contain no search text or user identity.
  - Service failures are handled centrally in `ApiExceptionHandler`.
  - The public endpoints are protected against unrestricted resource consumption (OWASP API4) by the request limit in spec FR-027. It is checked before any database lookup, cache or external call. The cache and the 2-character minimum reduce outgoing calls further.
  - **Residual risk:** behind a reverse proxy without forwarded headers, every user shares one limit. The README's deployment section will say to configure them (research section 14).
- **PASS (V Version control)**: Work is on `004-plan-location-dates`, created from an updated `main` after 003 was merged.
- **PASS (VI Documentation)**:
  - Done during planning: `docs/requirements.md` FR-046 states the forecast period (today + 6 days, in Lithuania) and the new FR-049 states the request limit; `docs/architecture.md` lists the `PlanCreator` policy, the `RateLimiting/` folder, the first client in `Clients/` and the `503` mapping in `Errors/`.
  - During implementation, the README gets the Plan setup flow, the outgoing access to the geocoding service, the fact that the plan lives only in the browser tab, the `RateLimiting:PlanSetup` settings, and the deployment note about forwarded headers. These describe code that does not exist yet.
- **PASS (VII AI use)**: The spec, clarifications and plan exist before implementation.
- **PASS (VIII Simplicity)**:
  - No new package; the request limit uses the framework's own middleware with one fixed-window policy.
  - `IGeocodingClient` is the only interface, needed to fake the external service.
  - No server state.
  - The forecast period is computed instead of fetched.
  - The Activity selection step contains only what the spec requires.

**Post-design re-check**: PASS. The data model, contract and quickstart add no layer, package, migration or violation. Re-checked after adding the request limit (spec FR-027): it adds one folder of startup configuration, two settings and no package.

## Project Structure

### Documentation (this feature)

```text
specs/004-plan-location-dates/
├── spec.md                 # Feature specification
├── plan.md                 # This file
├── research.md             # Technical decisions
├── data-model.md           # Service models, validation rules, frontend state (no database change)
├── quickstart.md           # Validation steps
├── contracts/
│   └── plan-setup-api.md   # Location search and plan setup check API
├── checklists/
│   └── requirements.md     # Spec quality checklist
└── tasks.md                # Created by /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── src/SpekLaiku.Api/
│   ├── Authorization/
│   │   ├── AuthorizationPolicies.cs              # + PlanCreator
│   │   ├── PlanCreatorRequirement.cs             # new
│   │   └── PlanCreatorHandler.cs                 # new
│   ├── Clients/
│   │   ├── IGeocodingClient.cs                   # new
│   │   ├── OpenMeteoGeocodingClient.cs           # new
│   │   ├── OpenMeteoGeocodingResponse.cs         # new, JSON shapes
│   │   ├── GeocodingPlace.cs                     # new
│   │   ├── ExternalServiceException.cs, ExternalService.cs, FailureKind.cs   # new
│   ├── Controllers/LocationsController.cs, PlanSetupController.cs           # new
│   ├── DTOs/Requests/PlanSetupCheckRequest.cs                                # new
│   ├── DTOs/Responses/LocationResponse.cs, LocationSearchResponse.cs, PlanPeriodResponse.cs,
│   │                 CheckedPlanSetupResponse.cs                             # new
│   ├── Errors/ApiExceptionHandler.cs                                         # + 503 mapping
│   ├── Mapping/PlanSetupMappingProfile.cs                                    # new
│   ├── RateLimiting/
│   │   ├── RateLimitPolicies.cs                  # new, policy names
│   │   ├── PlanSetupRateLimitOptions.cs          # new, bound from RateLimiting:PlanSetup
│   │   └── PlanSetupRateLimit.cs                 # new, AddPlanSetupRateLimit extension
│   ├── Services/
│   │   ├── ForecastPeriod.cs                     # new
│   │   ├── LocationAreaName.cs                   # new
│   │   ├── LocationSearchService.cs, LocationSearchResult.cs                 # new
│   │   ├── PlanSetupValidator.cs, PlanSetupValidationResult.cs              # new
│   │   ├── PlanSetupService.cs, PlanSetupResult.cs                           # new
│   │   └── PlaceLocation.cs, CheckedPlanSetup.cs                             # new
│   ├── appsettings.json                          # + RateLimiting:PlanSetup defaults
│   └── Program.cs                                # cache, clock, client, policy, rate limit, services
└── tests/
    ├── SpekLaiku.UnitTests/                       # rules, client, services, handler tests (+ FixedTimeProvider)
    └── SpekLaiku.IntegrationTests/                # endpoint, authorization and failure tests with a fake client

frontend/src/
├── api/locationsApi.ts, planSetupApi.ts                                       # new
├── types/planSetup.ts                                                         # new
├── helpers/formatPlanDate.ts, planDateRules.ts, canCreatePlan.ts,
│          parseTravelDistance.ts                                              # new
├── stores/usePlanSetupStore.ts, useLocationSearchStore.ts,
│         usePlanSetupCheckStore.ts, usePlanPeriodStore.ts                     # new
├── stores/useLogoutStore.ts                                                   # clears the plan setup
├── pages/PlanSetupPage.tsx, ActivitySelectionPage.tsx                         # new
├── pages/HomePage.tsx                                                         # + Create plan button
├── components/locationSearchField.tsx, planDatesField.tsx, planProgress.tsx,
│             planSetupSummary.tsx, planCreatorOnly.tsx                        # new
├── components/appRoutes.tsx, topNavigation.tsx                                # changed
├── styles.css                                                                 # changed
└── tests/                                         # page, component, store, helper, guard, navigation tests
```

**Structure Decision**: Use the existing backend and frontend layout. `backend/src/SpekLaiku.Api/Clients/` (already documented and present but empty) gets its first files; features 006 and 007 add the forecast and Overpass clients next to them and reuse `ExternalServiceException`. One new folder, `backend/src/SpekLaiku.Api/RateLimiting/`, holds the rate limiting policy, its options and its registration, in the same way `Authorization/` holds the authorization policies. Features 006 and 007 can add their own policies there. `docs/architecture.md` already lists it.

## Complexity Tracking

None. The Constitution Check has no violations to justify.
