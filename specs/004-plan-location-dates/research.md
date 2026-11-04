# Research: Plan Location and Dates

Technical decisions for `specs/004-plan-location-dates/spec.md`. Each section gives the decision, the reason and the alternatives considered.

## 1. Location search service (spec FR-004, FR-005)

**Decision**: Use the Open-Meteo geocoding API, called only by the backend.

- Search: `GET https://geocoding-api.open-meteo.com/v1/search?name=<text>&count=10&language=en&countryCode=LT&format=json`.
- Look up one place by id: `GET https://geocoding-api.open-meteo.com/v1/get?id=<id>&language=en`.

Responses observed on 2026-11-04:

- Search with matches: `{"results":[{"id":598316,"name":"Kaunas","latitude":54.90156,"longitude":23.90909,"country_code":"LT","admin1":"Kaunas","admin2":"Kaunas",...}],"generationtime_ms":...}`.
- Search with no matches: `{"generationtime_ms":...}`. The `results` key is missing, not empty, and the documentation says "Empty fields are not returned."
- Get by id: the bare place object, with the same fields as a search result.
- Get with an unknown id: HTTP 400 with `{"error":true,"reason":"Location ID not found."}`.
- The documentation says single-character text returns nothing, 2 characters match exact names only, 3 or more use prefix matching, and matching ignores letter case and diacritics. So "Siauliai" finds "Šiauliai".
- The documentation also says that text after a comma is an exact country or county filter: "Only the text between the first and second commas is used as the qualifier", and "The qualifier must match exactly". A chosen place shows as "Kaunas, Kaunas County", so an edited text such as "Kaunas, Kaunas Count" would find nothing. **Decision:** `LocationSearchService` searches only the trimmed text before the first comma. When fewer than 2 characters remain, it returns an empty list without calling the service (spec edge case). The cache key uses the same shortened text.

**Rationale**: `docs/architecture.md` already names this service for plan setup. It is free, needs no API key, and filters by country, so no secret is involved. The forecast (feature 006) also comes from Open-Meteo, so its coordinates match those of the chosen place.

**Alternatives considered**: OpenStreetMap Nominatim, which has a stricter usage policy, needs an identifying User-Agent and is not in the architecture. Calling the service from the browser, which constitution II forbids.

## 2. Trusting only the service's place id (spec FR-006, FR-012)

**Decision**: The check request sends only the place `locationId`. The server looks the place up again: first in the in-memory cache filled by recent searches, otherwise with `/v1/get?id=`. It refuses the request when the place is unknown or its `country_code` is not `LT`. The name, area and coordinates in the answer always come from the server's lookup, never from the request.

**Rationale**: A client cannot make up a place or move it outside Lithuania, because the server trusts nothing but the id. No signing or server-side session storage is needed.

**Alternatives considered**:
- Sending the name and coordinates, then checking that the point is inside a Lithuania polygon. This needs a border data set and still allows invented names.
- Signing the search results with a key. This adds key management for no extra benefit.
- Keeping search results in a server session. Visitors have no session, and it would need state on the server.

## 3. Area shown with each place (spec FR-004)

**Decision**: The area is `admin2` (the municipality) when it is present and differs from the place name. Otherwise it is `admin1` followed by " County" when `admin1` is present. Otherwise it is "Lithuania". The suggestion and the summary show "<name>, <area>". This gives "Kaunas, Kaunas County" (both admin fields are "Kaunas") and "Kauniai, Biržai District Municipality". The rule lives in one static class, `Services/LocationAreaName.cs`.

**Rationale**: It produces the spec's example, tells apart villages with the same name (each is in a different municipality), and avoids "Kaunas, Kaunas".

**Alternatives considered**: Always `admin1`, which does not distinguish villages that share a name. Showing every admin level, which is too long for a phone.

## 4. HTTP client, timeout and failures (spec FR-007, FR-008)

**Decision**:
- `Clients/OpenMeteoGeocodingClient.cs` is a typed `HttpClient` registered with `AddHttpClient<IGeocodingClient, OpenMeteoGeocodingClient>()`. It has a fixed base address and `Timeout = 5 s`.
- `IGeocodingClient` exists so service and integration tests can substitute a fake.
- The client throws `Clients/ExternalServiceException` (with `ExternalService.LocationSearch` and a `FailureKind`: `Timeout`, `Network`, `UnexpectedStatus`, `InvalidResponse`) for every failure, except a 400 from `/v1/get`, which means "not found" and returns `null`.
- On each failure the client logs one warning through `ILogger<OpenMeteoGeocodingClient>`: `"Location search service failed: {FailureKind}"`, plus the status code when there is one. The log never includes the search text or the user.
- The default `IHttpClientFactory` request logging is switched off for this client with `RemoveAllLoggers()`. At the default Information level it writes every request address, and the address holds the search text (spec FR-008). Found during implementation of T019.

**Rationale**: `IHttpClientFactory` is in the ASP.NET Core shared framework and is what the architecture names, so no package is needed. Five seconds on the server is well inside the frontend's 10 seconds, so the user gets the service message rather than a generic timeout. Leaving the search text out of the log keeps personal data out (constitution IV). The log is how failures are "recorded so that they can be reviewed later" until feature 015 adds the error list (project FR-043).

**Alternatives considered**: Polly or `Microsoft.Extensions.Http.Resilience` for retries. That is a new package, and the user can simply search again. Writing the failures to a database table, which is feature 015's scope.

## 5. Caching (spec SC-002)

**Decision**: `IMemoryCache` (`AddMemoryCache()`, shared framework) in `LocationSearchService`:
- Search results are cached for 1 hour, keyed by the lower-case searched text (the trimmed text before the first comma, section 1).
- Each returned place is cached by id for 1 hour, so Continue usually needs no external call.
- Failures are never cached.

**Rationale**: `docs/architecture.md` names an in-memory cache to reduce calls to the public APIs. Place names and coordinates practically never change. Each keystroke pause would otherwise send a new request.

**Alternatives considered**: No cache, which calls the public service more and makes Continue depend on it every time. A distributed cache, which needs extra infrastructure that is not needed.

## 6. Today in Lithuania and the forecast period (spec FR-010, edge cases)

**Decision**:
- **Backend:** `Services/ForecastPeriod.cs` takes `TimeProvider` (registered as `TimeProvider.System`). It converts the current UTC time to `Europe/Vilnius` with `TimeZoneInfo.FindSystemTimeZoneById` and returns `FirstDate` (today) and `LastDate` (today + 6) as `DateOnly`. The constants are `Days = 7` and `TimeZoneId = "Europe/Vilnius"`.
- **Endpoint:** `GET /api/plan-setup/period` returns `{ firstDate, lastDate, maxDates }` from `ForecastPeriod` and `PlanSetupValidator.MaxDates`. It is behind the `PlanCreator` policy and is not rate limited, because it makes no external call.
- **Frontend:** `stores/usePlanPeriodStore.ts` loads the period when the Plan setup page opens, with a 10 s timeout and Retry. It is not persisted, so a reopened page always gets a fresh period. The date picker's `min` and `max` and the add-date checks in `helpers/planDateRules.ts` use only these server values. The frontend does no date arithmetic and has no time-zone code.
- **On Continue:** the server checks again, so a page left open past midnight is still caught (spec User Story 4, scenario 8).

**Rationale**:
- Constitution principle I says duplicated business rules MUST be moved to one shared implementation. The forecast period and the date limit are business rules, so they live only in the backend. The page compares a picked date with limits it receives, as it uses `min` and `max` on the input.
- `TimeProvider` is built into .NET and lets tests fix the time with a small `FixedTimeProvider : TimeProvider` test class, so no `Microsoft.Extensions.TimeProvider.Testing` package is needed.
- IANA zone ids work on Linux and, through ICU, on Windows 10 1903 and later.
- The cost is one small request, and a loading and an error state on the date field, which the spec now defines (FR-010, User Story 2 scenario 9).

**Alternatives considered**:
- **Computing the period in the browser with `Intl` and the `Europe/Vilnius` zone:** no extra request, but it duplicates the rule (found by `/speckit-analyze`, finding C1).
- **No date checks until Continue:** User Story 2 requires messages when a date is added.
- **A formal constitution exception in this plan:** the rule can reasonably be met, so an exception is not allowed.
- **The server's local time zone:** wrong on a UTC server.

## 7. Where the plan setup lives (spec FR-017 to FR-019)

**Decision**: `stores/usePlanSetupStore.ts` uses Zustand's built-in `persist` middleware with `createJSONStorage(() => sessionStorage)`, under the key `spek-laiku-plan-setup` with `version: 1`. It holds:
- `location` (the chosen place, or null),
- `locationText`,
- `dates` (ISO `yyyy-MM-dd` strings, sorted),
- `maxTravelDistanceText`,
- `checked` (the last server-checked setup, or null).

Every change to the location, dates or distance sets `checked` to null. `clear()` empties the store and is called by `useLogoutStore` after a successful logout.

**Rationale**:
- `sessionStorage` matches the spec exactly: it survives a reload and a login in the same tab, and is gone when the tab closes.
- `persist` is part of the existing `zustand` package.
- AGENTS.md puts shared state in Zustand stores, not context.
- Nothing is stored on the server, so this feature has no migration.

**Alternatives considered**:
- `localStorage`, which survives closing the tab, against FR-017.
- A server-side draft, which visitors cannot have and which is feature 010's saving.
- Memory only, which loses the setup on reload.

## 8. Who may use plan setup (spec FR-001 to FR-003, FR-025, FR-026)

**Decision**: A new policy `AuthorizationPolicies.PlanCreator`, with `Authorization/PlanCreatorRequirement.cs` and `Authorization/PlanCreatorHandler.cs`.
- The policy does not require a signed-in user.
- The handler succeeds for an anonymous request (a Visitor).
- For a signed-in request it loads the account through `UserManager.GetUserAsync` and succeeds only for `Role == "Registered User"` with `AccountStatus.Active`.
- A signed-in Administrator, a Suspended user, or a cookie whose account no longer exists gets `403` through the existing cookie events.
- The policy is on both new controllers, so location search and the check follow the same rule.
- On the frontend, `components/planCreatorOnly.tsx` shows nothing while the current user loads, sends a Suspended user to `/account-suspended`, shows `AccessDeniedPage` to an Administrator, and otherwise shows the page. It does not require signing in.

**Rationale**:
- Reading the account on each request follows the same pattern as `ActiveAdministratorHandler` (feature 003, research section 1), so a suspension applies at once.
- Applying one policy to all three endpoints matches FR-003 (allowed for Visitors and Active Registered Users, refused for everyone else) and needs one authorization table.

**Alternatives considered**:
- `[AllowAnonymous]` on location search. It is simpler, but then the server rule differs from the page rule.
- Role-based `[Authorize(Roles=...)]`, which cannot express "anonymous or Active Registered User", and the role is not a claim in this project.

## 9. Request shape and validation (spec FR-010 to FR-013, FR-016)

**Decision**:
- `POST /api/plan-setup/check` takes `{ locationId: number | null, dates: string[] | null, maxTravelDistanceKm: number | null }`. `dates` binds to `List<DateOnly>?`, and `maxTravelDistanceKm` to `decimal?`.
- `Services/PlanSetupValidator.cs` (static) returns errors keyed `locationId`, `dates`, `dates[<index>]` and `maxTravelDistanceKm`, in that order. Indexes refer to the request array.
- The date rules are:
  - none → `dates`: "Add at least one date."
  - more than 7 → `dates`: "You can add up to 7 dates.", and no further date checks.
  - a repeat of an earlier entry → `dates[i]`: "This date is already added."
  - before the first date of the period → "Dates cannot be in the past."
  - after the last date of the period → "Forecast is not available that far ahead."
- Distance: null means 30. Otherwise it must be a whole number from 1 to 200, or the answer is "Enter a whole number between 1 and 200."
- A malformed body, such as a date that is not `yyyy-MM-dd` or a string where a number belongs, is refused with the existing `request` error ("The request is invalid.").
- Messages have no "Error: " prefix; the frontend adds it, as in feature 003.

**Rationale**:
- `decimal?` lets the server refuse 12.5 with the field message instead of a generic body error.
- Index keys let the page mark exactly the affected date chip (User Story 4, scenario 8).
- Strict number handling is already configured in `Program.cs`.

**Alternatives considered**:
- `int?` for the distance, which turns 12.5 into a generic request error.
- Keys by date value, which breaks when the same date appears twice.

## 10. Service failures in the API (spec FR-007, FR-014)

**Decision**: `Errors/ApiExceptionHandler.cs` maps `ExternalServiceException` to `503` problem details: title "Service unavailable.", detail "Location search is unavailable. Try again later." It logs nothing more, because the client already logged the kind of failure. Every other exception keeps the existing `500` answer.
- The search endpoint's `503` makes the page show the FR-007 message.
- On the check, the page treats `503` like any other server error ("Error: Something went wrong. Try again.").

**Rationale**: Constitution IV requires expected failures to be handled in one central place, and controllers stay free of try and catch.

**Alternatives considered**: Result objects with an "unavailable" case in each service, which repeats the same translation in every controller.

## 11. Frontend structure (spec FR-004 to FR-026)

**Decision**:
- **Pages**: `PlanSetupPage.tsx` (route `/plan/setup`) and `ActivitySelectionPage.tsx` (route `/plan/activities`, first version), both inside `PlanCreatorOnly`.
- **Components**:
  - `locationSearchField.tsx`: an ARIA 1.2 combobox, meaning an input with `role="combobox"`, `aria-expanded`, `aria-controls` and `aria-activedescendant`, a `listbox` of `option`s, a `role="status"` region announcing "Searching locations…" or "<n> locations found", and `role="alert"` for the service error. The arrow keys, Enter and Escape work.
  - `planDatesField.tsx`: a `fieldset` with the legend "Dates", `<input type="date" min max>`, "Add date", and chips each with a "Remove <date>" button. Adding or removing a date is announced in a status region.
  - `planProgress.tsx`: the four steps as an ordered list, with `aria-current="step"`; completed steps are links. On narrow screens it shows "Step n of 4: <name>".
  - `planCreatorOnly.tsx`: the guard from section 8.
  - `planSetupSummary.tsx`: the location, dates and distance line on the Activity selection step.
  - The existing `TextField` serves the distance field, with the hint "Whole number from 1 to 200", and the existing `ErrorSummary` serves the error summary.
- **Stores**:
  - `usePlanSetupStore.ts` (section 7).
  - `useLocationSearchStore.ts`: `status` (`idle`, `loading`, `loaded`, `empty`, `unavailable`, `tooManyRequests`), `results`, `queryChanged(text)` with a 300 ms pause, at least 2 characters after trimming, a 10 s timeout, the latest request winning with older ones aborted, and `reset()`.
  - `usePlanPeriodStore.ts`: `status` (`loading`, `loaded`, `error`), `period` (`firstDate`, `lastDate`, `maxDates` from the server), `load()` with a 10 s timeout, `reset()`. Not persisted (section 6).
  - `usePlanSetupCheckStore.ts`: `idle`, `pending`, `invalid`, `serverError` or `tooManyRequests`, with `errors`, `lastRequest`, `submit()`, `retry()`, `reset()`, a 10 s timeout and double submits ignored, the same pattern as `useLoginStore`. On `forbidden` it calls `useCurrentUserStore.getState().refresh()`.
- **API**: `api/locationsApi.ts` (`searchLocations(query, signal)`, which throws `ApiError`, with status 429 or 503 telling the store which message to show) and `api/planSetupApi.ts` (`getPlanPeriod(signal)`, and `checkPlanSetup(request, signal)` returning `checked`, `invalid`, `forbidden` or `tooManyRequests`, or throwing `ApiError`).
- **Helpers**:
  - `formatPlanDate.ts`, which builds "Sat 7 Nov 2026" from `Intl.DateTimeFormat("en-GB", { timeZone: "UTC" }).formatToParts`, so the format does not depend on the locale's punctuation. This is display only, not a rule.
  - `planDateRules.ts`: the add-date checks. They compare the picked date and the number of dates with the period and `maxDates` received from the server, and hold no limits of their own (section 6).
  - `parseTravelDistance.ts`: empty becomes null; a number becomes that number; text such as "abc" is refused locally with the FR-016 message, because it cannot be sent as a JSON number.
- **Types**: `types/planSetup.ts`.
- **Navigation**: `topNavigation.tsx` shows "Create plan" (to `/plan/setup`) for a visitor and an Active Registered User. `HomePage.tsx` shows a "Create plan" link styled as a button under the same rule.

**Rationale**:
- The file and store naming follows AGENTS.md (`PlanSetupPage.tsx` is the example given there).
- Native date inputs and a hand-written combobox meet the accessibility rules without a UI library.
- Splitting the work across components keeps each file under about 200 lines.

**Alternatives considered**:
- A combobox or date-picker package. This would be a new npm package, and the plan cannot justify it.
- One large store for values and submission state, which mixes persisted data with request state that must not be persisted.

## 12. Logging (spec FR-008)

**Decision**: Only geocoding failures are logged (section 4). Successful searches and checks are not logged.

**Rationale**: Logging successes adds nothing that is needed and could expose search text.

## 13. Dependencies

**Decision**: No new NuGet or npm package.
- `IHttpClientFactory`, `IMemoryCache`, `TimeProvider`, the rate limiting middleware and `DateOnly` JSON support are in the .NET 10 shared framework.
- Zustand's `persist` and `createJSONStorage` ship with `zustand` 5.
- `Intl` is built into the browser and Node.
- Tests use a hand-written `HttpMessageHandler` fake, a fake `IGeocodingClient` and `FixedTimeProvider`.

## 14. Request limit (spec FR-027)

**Decision**: Use ASP.NET Core's built-in rate limiting middleware (`Microsoft.AspNetCore.RateLimiting`, shared framework).
- One named policy, `RateLimitPolicies.PlanSetup`, partitioned by `HttpContext.Connection.RemoteIpAddress`. A missing address uses the partition key `"unknown"`.
- Each partition gets a fixed-window limiter: `PermitLimit = 30`, `Window = 60 s`, `QueueLimit = 0`. A request over the limit is refused at once, not queued.
- The values come from the configuration section `RateLimiting:PlanSetup` (`PermitLimit`, `WindowSeconds`), bound to `RateLimiting/PlanSetupRateLimitOptions.cs`, with the defaults in `appsettings.json`.
- `RateLimiting/PlanSetupRateLimit.cs` has an `AddPlanSetupRateLimit(IServiceCollection, IConfiguration)` extension, so `Program.cs` stays short.
- Both new controllers carry `[EnableRateLimiting(RateLimitPolicies.PlanSetup)]`, so searches and checks share one count.
- `app.UseRateLimiter()` runs after `UseAuthentication()` and before `UseAuthorization()`. A refused request then never reaches the authorization handler's account lookup, the cache or the geocoding service.
- `OnRejected` answers `429` with problem details (title "Too many requests.", detail "Too many requests. Wait a minute and try again.") and, when the limiter provides it, a `Retry-After` header in seconds.
- Rejections are not logged as service failures (FR-027). The middleware's own debug-level log is left as it is.
- **Frontend:** `429` from search gives the location search store the status `tooManyRequests`, and from the check gives the check store the status `tooManyRequests` (with Retry). Both show "Error: Too many requests. Wait a minute and try again."

**Rationale**:
- The middleware ships with ASP.NET Core, so no package is needed (constitution VIII).
- A limit per network address works for Visitors, who have no account.
- A fixed window is the simplest limiter that matches the spec's "30 per minute".
- Configuration lets an operator change the limit without a code change, and lets tests use their own limits.
- 30 per minute is far above normal use: a search starts only after a 300 ms pause, so even a fast typist sends a few searches per place.

**Deployment note**: Behind a reverse proxy, every request arrives from the proxy's address, so every user would share one limit. Deployment must enable the forwarded-headers middleware for the trusted proxy. The README records this, and deployment itself is not part of this feature.

**Testing**: The test server has no remote address, so all integration tests share the `"unknown"` partition. `PostgreSqlApiFactory` therefore sets `RateLimiting:PlanSetup:PermitLimit` high (10 000), so ordinary tests never reach the limit. A dedicated test class builds the factory with `WithWebHostBuilder(b => b.UseSetting("RateLimiting:PlanSetup:PermitLimit", "3"))` and checks that the fourth request gets `429` without calling the fake geocoding client, and that searches and checks share the count. The window resetting is not tested with real time; it is the framework's own behaviour.

**Alternatives considered**:
- **A limit per signed-in user:** Visitors have no identity, and they are the main users of the endpoint.
- **A single global limit:** one heavy user would block everyone.
- **Sliding window or token bucket limiters:** more settings, with no need shown in the spec.
- **The `AspNetCoreRateLimit` package:** a new dependency for something the framework already provides.
- **Relying on the cache alone:** different texts still reach the service.
