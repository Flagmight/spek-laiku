# Implementation Plan: 007-nearby-places

**Branch**: `007-nearby-places` | **Date**: 2026-11-11 | **Spec**: [specs/007-nearby-places/spec.md](spec.md)

**Input**: Feature specification from `/specs/007-nearby-places/spec.md`

## Summary

On step 3, "Places and forecast", this feature shows the nearest named places for each activity from OpenStreetMap, found through the Overpass API with the category's map place tags. Each place has its name, distance, area and a map link. It flags an activity with no place, with **Remove** and **Change activity**, and handles the map data service being unavailable without showing any old or partial data. It also reorganizes the step: a plan overview table (every activity on every date, sunrise and sunset once per date), and each activity's forecast details closed at first.

**Backend**:

- A new `POST /api/plan-places` endpoint with the `PlanCreator` policy and the shared `PlanSetup` request limit (research section 1).
- The plan checks move out of `PlanForecastService` into a shared `PlanRecheckService`, used by both endpoints (research section 2).
- `PlanPlacesService` reads each category's tags from the database and works out the radius (the plan's maximum travel distance, at most 50 km). It then asks `NearbyPlacesService`, which:
  - reuses each category's places for up to 24 hours (research section 5);
  - otherwise asks the map data service **once** for all the missing categories;
  - splits the answer by tag, and keeps the named places within the radius, nearest first, at most 5 (`NearbyPlaceRules`, research sections 3 and 4).
- A new `OverpassMapPlacesClient` sends one Overpass QL query by `POST` through the shared `ExternalServiceJson`, and treats a `remark` with a runtime error as a failure (research section 7).
- `ApiExceptionHandler` answers `503` with `service: "places"`.
- The forecast gains `longestPeriod` per activity date, chosen on the server for the overview (research section 8).

**Frontend**:

- A places store, with a `retrying` status in both step 3 stores.
- A combined first-load message, then a status region with each service's "updated at" or error with Retry.
- `planOverview.tsx`: a table that becomes cards on phones.
- Activity sections with places, one settings line, the forecast summary and closed "Show forecast details".
- The no-place flag with Remove (no new request; focus moves to the next activity) and Change activity (focus on that activity in step 2) (research sections 10 to 12).

There is no database change, no migration and no new package.

## Technical Context

**Language/Version**: C# on .NET 10 (ASP.NET Core Web API); TypeScript with React 19, built with Vite. Unchanged.

**Primary Dependencies**: Existing only.

- Backend: ASP.NET Core (with the built-in rate limiting middleware), EF Core with Npgsql, AutoMapper, `IHttpClientFactory`, `IMemoryCache` and `TimeProvider` (through `ForecastPeriod`).
- Frontend: React, React Router and Zustand.
- Tests: xUnit, the EF Core in-memory provider (unit), `Microsoft.AspNetCore.Mvc.Testing` with Testcontainers PostgreSQL (integration), Vitest, React Testing Library and user-event.

**No new NuGet or npm package** (research section 14).

**External services**:

- OpenStreetMap Overpass API (new):
  - `POST https://overpass-api.de/api/interpreter`, at most one call per place request, only for categories not reused within 24 hours (research sections 4 and 5).
  - A 4-second timeout and the `User-Agent` `SpekLaiku/1.0`.
- Open-Meteo geocoding (existing): the location lookup in the plan check, normally answered from the one-hour location cache.
- Open-Meteo forecast (existing, unchanged calls).

Tests use `FakeMapPlacesClient`, `FakeForecastClient` and `FakeGeocodingClient`, never the live services.

**Authorization**:

- `[Authorize(Policy = AuthorizationPolicies.PlanCreator)]` on `PlanPlacesController`: anonymous or Active Registered User; others get `403`.
- `[EnableRateLimiting(RateLimitPolicies.PlanSetup)]` shares the 30-per-minute limit with location searches, setup checks and forecast requests.
- In the browser, `/plan/places` is already inside `PlanCreatorOnly`.

**Backend structure** (`backend/src/SpekLaiku.Api/`):

- **Clients**:
  - `Clients/ExternalService.cs` (changed): adds `MapData`.
  - `Clients/ExternalServiceJson.cs` (changed):
    - adds `PostFormAsync<T>`, which shares a private send-and-read method with `GetAsync<T>`;
    - the display name "Map data service".
  - `Clients/IMapPlacesClient.cs`, `MapElement.cs`, `OverpassMapPlacesClient.cs`, `OverpassResponse.cs` and `OverpassQuery.cs` (new): `data-model.md` (Client models).
    - Base address `https://overpass-api.de/`, path `api/interpreter`, timeout 4 seconds, `User-Agent` `SpekLaiku/1.0`.
- **Services**:
  - `Services/PlanRecheckService.cs` and `PlanRecheckResult.cs` (new): the setup and activity checks with the `setup.` prefix, moved out of `PlanForecastService`.
  - `Services/PlanForecastService.cs` (changed): uses `PlanRecheckService` and `ForecastPeriod.ToLithuanianMinute`. Its forecast-date check stays.
  - `Services/ForecastPeriod.cs` (changed): adds static `ToLithuanianMinute(DateTimeOffset)`.
  - `Services/SuitablePeriods.cs`, `ActivityDayForecast.cs` and `ActivityForecasts.cs` (changed): `Longest` and `LongestPeriod`.
  - `Services/PlacesOptions.cs` (new): section `Places`, validated at start (research section 6).
  - `Services/GeoDistance.cs`, `NearbyPlace.cs` and `NearbyPlaceRules.cs` (new): distance, matching, filtering and ordering.
  - `Services/CategoryTags.cs`, `ReceivedPlaces.cs` and `NearbyPlacesService.cs` (new): the per-category cache and the single client call.
  - `Services/CategoryPlaces.cs`, `PlanPlaces.cs`, `PlanPlacesResult.cs` and `PlanPlacesService.cs` (new): the order of checks, the tag lookup, the radius and the oldest `updatedAt`.
- **DTOs**:
  - `DTOs/Requests/PlanPlacesRequest.cs` (new): `PlanSetupCheckRequest? Setup`, `List<PlanActivityRequest>? Activities`.
  - `DTOs/Responses/PlanPlacesResponse.cs`, `CategoryPlacesResponse.cs` and `NearbyPlaceResponse.cs` (new): as in `contracts/plan-places-api.md`.
  - `DTOs/Responses/ActivityDayForecastResponse.cs` (changed): adds `LongestPeriod`.
- **Mapping**:
  - `Mapping/PlanPlacesMappingProfile.cs` (new): service models to responses. It leaves out `NearbyPlace.Key` and contains no rules.
  - `Mapping/PlanForecastMappingProfile.cs`: unchanged, because AutoMapper maps the new member by name.
- **Controller**: `Controllers/PlanPlacesController.cs` (new), `[Route("api/plan-places")]`, with one `POST` that returns `200`, or `400` `ValidationProblemDetails` with keys in the service's order. It follows `PlanForecastController`.
- **Other**:
  - `Errors/ApiExceptionHandler.cs` (changed): `MapData` gives `503`, "The map data service is unavailable. No places are shown.", `service: "places"`.
  - `RateLimiting/RateLimitPolicies.cs` (changed, comment only): names place requests.
  - `Program.cs` (changed):
    - `AddOptions<PlacesOptions>()` with validation;
    - `AddHttpClient<IMapPlacesClient, OverpassMapPlacesClient>` with the base address, timeout and `User-Agent`, and `.RemoveAllLoggers()`;
    - `AddScoped` for `PlanRecheckService`, `NearbyPlacesService` and `PlanPlacesService`.
  - `appsettings.json` (changed): `"Places": { "MaxRadiusKm": 50, "MaxPlacesPerActivity": 5, "MaxAgeHours": 24 }`.

**Error responses**:

- `400` `ValidationProblemDetails`;
- `403` from the policy;
- `429` from the rate limiter;
- `503` with `service` from `ApiExceptionHandler`;
- `500` for anything else.

**Frontend structure** (`frontend/src/`):

- **Types**:
  - `types/planPlaces.ts` (new): `data-model.md` (Frontend types).
  - `types/planForecast.ts` (changed): `longestPeriod`.
  - `types/navigationState.ts` (changed): `focusActivityId`.
- **API**: `api/planPlacesApi.ts` (new): `getPlanPlaces(request, signal)` with the outcomes in `contracts/plan-places-api.md`. It follows `planForecastApi.ts`.
- **Helpers**:
  - `helpers/checkedPlanRequest.ts`: renamed from `planForecastRequest.ts`, and used by both stores.
  - `helpers/timedRequest.ts`, `overviewCellText.ts`, `activitySettingsText.ts`, `placeText.ts` and `openStreetMapLink.ts` (new).
  - `helpers/formatPlanDate.ts` (changed): adds `formatPlanDateShort`.
- **Stores**:
  - `stores/usePlanPlacesStore.ts` (new, not persisted): `data-model.md`, research section 10.
  - `stores/usePlanForecastStore.ts` (changed): `retrying`, `removeActivity`, `timedRequest`.
  - `stores/usePlanActivitiesStore.ts` (changed): `removeChecked`.
- **Pages**:
  - `pages/PlacesAndForecastPage.tsx` (changed):
    - It loads both stores on mount. The effect depends only on whether a checked setup and checked activities exist (research section 10), and it resets both stores on unmount.
    - While either store is first loading, it shows only the status region. After that it shows the overview and the activities.
    - It keeps the heading, progress, setup summary, redirects and Back.
  - `pages/ActivitySelectionPage.tsx` (changed): focuses `activity-<id>-heading` once when router state has `focusActivityId`.
- **Components**:
  - `components/placesAndForecastStatus.tsx` (new, replaces `planForecastStatus.tsx`): one `role="status"` region with the first-load message, or the forecast and places lines, each "updated at", retrying or an error with its own Retry.
  - `components/planOverview.tsx` (new): the overview table. Each row is worked out by `overviewCellText`, and each cell has a hidden label for the phone cards.
  - `components/planActivitiesSummary.tsx` (changed):
    - each section has an `h2` with `tabIndex={-1}`, then `ActivityPlaces`, the settings line, then `ActivityForecast`;
    - it handles Remove (the store calls, focus after render, a hidden "<name> removed." status) and Change activity (navigate with `focusActivityId`).
  - `components/activityPlaces.tsx` (new): the "Places" `h3` with the list, the no-place flag with Remove and Change activity, "Not available" or "Getting nearby places…".
  - `components/placeListItem.tsx` (new): the name, distance, area and the "View on map" link.
  - `components/activityForecast.tsx` (changed): the summary line, then the "Show forecast details" disclosure (closed) holding the date entries.
  - `components/forecastDateEntry.tsx` (changed): no sunrise and sunset line.
- **Styles**: `styles.css` (changed):
  - the overview and its phone cards below the existing 40em breakpoint;
  - the places list and the no-place flag;
  - full-width buttons with 44 × 44 px targets on phones;
  - no horizontal scrolling at 320 px.
- **Test setup**: `tests/setup.ts` (changed) resets the places store.

**Origins and CSRF**: Unchanged. The new `POST` changes no stored state and accepts JSON only.

**Storage**:

- On the server, only the in-memory cache (research section 5).
- Nothing in the browser session: the places are requested each time step 3 opens (spec FR-023).
- Removing an activity on step 3 changes only the existing persisted activities store.
- **No migration.**

**Testing**: see `quickstart.md` for the full list.

- **Backend unit tests**:
  - `NearbyPlaceRules`, `GeoDistance`, `NearbyPlacesService`, `PlanPlacesService`, `PlanRecheckService`, `OverpassMapPlacesClient` (through `FakeHttpMessageHandler`), `SuitablePeriods.Longest`, `PlacesOptions`, the mapping profile and `ApiExceptionHandler`.
  - The feature 006 tests keep passing.
- **Backend integration tests**:
  - the authorization table, the shared request limit, the `200`, `400` and `503` contracts, failure logging, and reuse and freshness;
  - these run against PostgreSQL, with `FakeMapPlacesClient` registered in `PostgreSqlApiFactory`.
- **Frontend tests**: the list in `quickstart.md`, with `fetch` faked per path and fake timers.

**Target Platform**: Web application, the same browsers and server as before.

**Project Type**: Full-stack web application.

**Performance Goals**:

- SC-001: the places for 10 activities from 5 categories within 5 seconds.
- Worst case on the server: one uncached location lookup (≤ 5 s, normally cached), one Overpass call (≤ 4 s, usually 1–3 s, skipped when cached), and rule work over a few hundred elements. The rule work is negligible.
- Time budget (spec FR-009): the server gives up on Overpass after 4 s, so even with an uncached location lookup the place request ends within 9 s, before the page's 10-second limit. The location lookup is normally answered from the one-hour location cache filled by step 1, so the usual worst case is about 4 s. This is the same budget as the forecast request (feature 006).
- SC-001 is checked by hand in quickstart Manual Validation step 12.
- The answer is a few kilobytes: at most 10 categories × 5 places.

**Constraints**:

- Server-side authorization, validation and place rules; the page holds no rule.
- No invented, outdated or partial data (NFR-007, constitution External data).
- No coordinates, tags, dates or identities in logs.
- Polite use of the public Overpass service: one call per request, an identifying `User-Agent` without personal data, and 24-hour reuse.
- Accessibility and a 320 px layout.
- Every new C# class under 200 lines, and React files under about 200 lines.

**Scale/Scope**:

- One endpoint, one external client, about 15 small backend classes, 3 response DTOs, and one changed forecast DTO.
- One page changed and one page given a focus rule; five new components and three changed; one new store and two changed; seven helpers new or changed.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **PASS (I Code quality)**:
  - Each rule exists once:
    - The plan checks move into `PlanRecheckService`, shared by both endpoints.
    - The place rules are in `NearbyPlaceRules`, and the distance in `GeoDistance`.
    - The longest period is in `SuitablePeriods`.
    - The minute conversion is in `ForecastPeriod`.
    - The HTTP error handling is shared through `ExternalServiceJson`.
    - The 10-second timer is shared through `timedRequest`.
  - The settings are in `PlacesOptions`.
  - No Manager, Helper or Utils names. Each class has one responsibility and stays well under 200 lines.
- **PASS (II Architecture)**:
  - The controller only binds, calls `PlanPlacesService` and maps.
  - The rules are in services.
  - Overpass is called only through `IMapPlacesClient`, never from the browser. The "View on map" link is a page the user opens, not an API call.
  - Responses are DTOs mapped by AutoMapper, with no rules in the profile. No entity is returned.
  - There is no schema change, so no migration.
  - Frontend calls go only through `api/planPlacesApi.ts`.
  - Shared state is in Zustand stores. The "removed" announcement and the disclosure state are local component state.
- **PASS (III Testing)**:
  - Unit and integration tests cover every rule, boundary and status.
  - Frontend tests cover the loading, success, empty (no place found, "✗ None", "No hours left"), error and out-of-date states.
  - The endpoint has an authorization test for every caller type.
  - "One user cannot change another user's data" does not apply, because nothing is stored.
  - Overpass, Open-Meteo and geocoding are always fakes, and the time comes from `ForecastPeriod` on a `FixedTimeProvider`.
- **PASS (IV Security)**:
  - The existing policy enforces authorization on the server.
  - All input is validated again on the server. The position comes only from the location service, and the tags only from the database.
  - The tags are already restricted by `PlaceTagParser` and are escaped again in the query (injection).
  - The shared request limit runs before authorization. One address cannot use the endpoint to flood Overpass, because each request makes at most one call and categories are reused (OWASP unrestricted resource consumption).
  - No secrets. Logs hold only the service, kind and status. The `User-Agent` holds no personal data.
  - Failures are handled centrally, with no details in the answer.
- **PASS (V Version control)**: Work is on `007-nearby-places`, created from an updated `main` after the plan UI tweaks (PR #9) were merged.
- **PASS (VI Documentation)**: During implementation:
  - The README's Places and forecast section gets places, the overview, the no-place actions and the `Places` settings.
  - `docs/ux-design.md` gets the Places and Forecast states: the combined loading message, "Places updated at", the no-place row, the map data error and the overview layout.
  - `docs/architecture.md` adds the Overpass client to the `Clients/` row and `"places"` to the `Errors/` row.
- **PASS (VII AI use)**: The spec, its seven clarifications and this plan exist before implementation.
- **PASS (VIII Simplicity)**:
  - No new package, folder or table. The existing cache, rate limiting policy, check services, error handling and breakpoint are reused.
  - One Overpass call per request, not one per category or activity.
  - The page's two loading statuses (`loading`, `retrying`) are the smallest change that meets the Clarifications.

**Post-design re-check**: PASS.

- The data model, contracts and quickstart add no layer, package, migration or violation.
- The refactor to `PlanRecheckService` keeps the forecast endpoint's keys and tests.
- The forecast answer only gains `longestPeriod`.

## Project Structure

### Documentation (this feature)

```text
specs/007-nearby-places/
├── spec.md              # Feature specification (with Clarifications)
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1: client and service models, rules, frontend state
├── quickstart.md        # Phase 1: automated and manual validation
├── contracts/
│   ├── plan-places-api.md
│   └── plan-forecast-api-changes.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
backend/
├── src/SpekLaiku.Api/
│   ├── Clients/ExternalService.cs                        (changed)
│   ├── Clients/ExternalServiceJson.cs                    (changed)
│   ├── Clients/IMapPlacesClient.cs                       (new)
│   ├── Clients/MapElement.cs                             (new)
│   ├── Clients/OverpassMapPlacesClient.cs                (new)
│   ├── Clients/OverpassResponse.cs                       (new)
│   ├── Clients/OverpassQuery.cs                          (new)
│   ├── Controllers/PlanPlacesController.cs               (new)
│   ├── DTOs/Requests/PlanPlacesRequest.cs                (new)
│   ├── DTOs/Responses/PlanPlacesResponse.cs              (new)
│   ├── DTOs/Responses/CategoryPlacesResponse.cs          (new)
│   ├── DTOs/Responses/NearbyPlaceResponse.cs             (new)
│   ├── DTOs/Responses/ActivityDayForecastResponse.cs     (changed)
│   ├── Errors/ApiExceptionHandler.cs                     (changed)
│   ├── Mapping/PlanPlacesMappingProfile.cs               (new)
│   ├── RateLimiting/RateLimitPolicies.cs                 (changed, comment only)
│   ├── Services/PlanRecheckService.cs                    (new)
│   ├── Services/PlanRecheckResult.cs                     (new)
│   ├── Services/PlanForecastService.cs                   (changed)
│   ├── Services/ForecastPeriod.cs                        (changed)
│   ├── Services/SuitablePeriods.cs                       (changed)
│   ├── Services/ActivityDayForecast.cs                   (changed)
│   ├── Services/ActivityForecasts.cs                     (changed)
│   ├── Services/PlacesOptions.cs                         (new)
│   ├── Services/GeoDistance.cs                           (new)
│   ├── Services/NearbyPlace.cs                           (new)
│   ├── Services/NearbyPlaceRules.cs                      (new)
│   ├── Services/CategoryTags.cs                          (new)
│   ├── Services/ReceivedPlaces.cs                        (new)
│   ├── Services/NearbyPlacesService.cs                   (new)
│   ├── Services/CategoryPlaces.cs                        (new)
│   ├── Services/PlanPlaces.cs                            (new)
│   ├── Services/PlanPlacesResult.cs                      (new)
│   ├── Services/PlanPlacesService.cs                     (new)
│   ├── Program.cs                                        (changed)
│   └── appsettings.json                                  (changed)
└── tests/
    ├── SpekLaiku.UnitTests/NearbyPlaceRulesTests.cs              (new)
    ├── SpekLaiku.UnitTests/GeoDistanceTests.cs                   (new)
    ├── SpekLaiku.UnitTests/NearbyPlacesServiceTests.cs           (new)
    ├── SpekLaiku.UnitTests/PlanPlacesServiceTests.cs             (new)
    ├── SpekLaiku.UnitTests/PlanRecheckServiceTests.cs            (new)
    ├── SpekLaiku.UnitTests/OverpassMapPlacesClientTests.cs       (new)
    ├── SpekLaiku.UnitTests/PlacesOptionsTests.cs                 (new)
    ├── SpekLaiku.UnitTests/PlanPlacesMappingTests.cs             (new)
    ├── SpekLaiku.UnitTests/RecordingMapPlacesClient.cs           (new)
    ├── SpekLaiku.UnitTests/ForecastPeriodTests.cs                (changed)
    ├── SpekLaiku.UnitTests/PlanForecastMappingTests.cs           (changed)
    ├── SpekLaiku.UnitTests/SuitablePeriodsTests.cs               (changed)
    ├── SpekLaiku.UnitTests/ActivityForecastsTests.cs             (changed)
    ├── SpekLaiku.UnitTests/PlanForecastServiceTests.cs           (changed)
    ├── SpekLaiku.UnitTests/ApiExceptionHandlerTests.cs           (changed)
    ├── SpekLaiku.IntegrationTests/FakeMapPlacesClient.cs         (new)
    ├── SpekLaiku.IntegrationTests/PostgreSqlApiFactory.cs        (changed)
    ├── SpekLaiku.IntegrationTests/PlanPlacesEndpointTests.cs         (new)
    ├── SpekLaiku.IntegrationTests/PlanPlacesAuthorizationTests.cs    (new)
    ├── SpekLaiku.IntegrationTests/PlanPlacesFailureTests.cs          (new)
    ├── SpekLaiku.IntegrationTests/PlanForecastEndpointTests.cs       (changed: longestPeriod)
    └── SpekLaiku.IntegrationTests/PlanSetupRateLimitTests.cs     (changed: place requests count too)

frontend/src/
├── api/planPlacesApi.ts                    (new)
├── types/planPlaces.ts                     (new)
├── types/planForecast.ts                   (changed)
├── types/navigationState.ts                (changed)
├── helpers/checkedPlanRequest.ts           (renamed from planForecastRequest.ts)
├── helpers/timedRequest.ts                 (new)
├── helpers/overviewCellText.ts             (new)
├── helpers/activitySettingsText.ts         (new)
├── helpers/placeText.ts                    (new)
├── helpers/openStreetMapLink.ts            (new)
├── helpers/formatPlanDate.ts               (changed)
├── stores/usePlanPlacesStore.ts            (new)
├── stores/usePlanForecastStore.ts          (changed)
├── stores/usePlanActivitiesStore.ts        (changed)
├── pages/PlacesAndForecastPage.tsx         (changed)
├── pages/ActivitySelectionPage.tsx         (changed)
├── components/placesAndForecastStatus.tsx  (new, replaces planForecastStatus.tsx)
├── components/planOverview.tsx             (new)
├── components/planActivitiesSummary.tsx    (changed)
├── components/activitySection.tsx          (new, only if planActivitiesSummary.tsx would exceed about 200 lines)
├── components/activityPlaces.tsx           (new)
├── components/placeListItem.tsx            (new)
├── components/activityForecast.tsx         (changed)
├── components/forecastDateEntry.tsx        (changed)
├── styles.css                              (changed)
└── tests/                                  (new and extended test files, see quickstart.md)
```

**Structure Decision**: The existing web application layout (`backend/` and `frontend/`), as described in `docs/architecture.md`. No new folders.

## Complexity Tracking

No constitution violations to justify.
