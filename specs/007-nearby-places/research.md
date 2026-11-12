# Research: Nearby Places

These decisions settle the open points of the Technical Context in `plan.md`. Nothing is left as NEEDS CLARIFICATION.

## 1. One place request, separate from the forecast (spec FR-003, FR-009, User Story 4)

- **Decision**: A new `POST /api/plan-places` endpoint, called by step 3 at the same time as the existing `POST /api/plan-forecast`. Both take the same body: the checked setup and activities.
- **Rationale**:
  - The spec needs a places "Retry" that does not ask for the forecast again (US4 scenario 3).
  - It also needs a forecast that is shown when only the map data service failed, and the other way round (US4 scenarios 2 and 5).
  - Two independent requests give both for free. Each one succeeds or fails on its own, with its own status and Retry.
  - One opening of step 3 is now 2 requests towards the shared limit of 30 per minute, which still leaves plenty of room (spec Assumptions).
- **Alternatives considered**:
  - Adding places to the forecast response. Rejected: one failure would hide both results, and a places Retry would fetch the forecast again.
  - One endpoint with a "what to fetch" flag. Rejected: it is two contracts in one, which is harder to test and to read.

## 2. Checking the plan again, shared by both endpoints (spec FR-004, User Story 5)

- **Decision**: The first two steps of `PlanForecastService.GetAsync` move into a new `PlanRecheckService.CheckAsync(setup, activities)`:
  1. the setup check, with every error key prefixed `setup.`;
  2. the activity check, with its own `activities…` keys.

  It returns `PlanRecheckResult`: either the checked setup and activities, or the keys in the order of the check that failed. `PlanForecastService` and the new `PlanPlacesService` both call it, so the order of checks and the `400` keys are the same for both endpoints. The page then treats a `400` from either endpoint the same way, through the existing `markOutdated()` of the setup and activities stores.
- **Rationale**: Constitution I (DRY). Copying the check into the places service would duplicate the key prefixes and the order of checks. The forecast service's own check of the forecast dates (midnight passing during the request) stays in `PlanForecastService`, because it belongs to the forecast.
- **Map place tags**: `PlanActivityService` reads only the id, name and type of each category. `PlanPlacesService` reads the tags of the checked activities' categories in one more query (`Id` and `PlaceTags`). The tags are never taken from the request (spec FR-004) and never sent back (FR-013).

## 3. Search area and distance (spec FR-006, FR-007, Edge cases)

- **Decision**:
  - The radius is `min(setup.MaxTravelDistanceKm, Places:MaxRadiusKm)` in whole kilometres (default cap 50).
  - The distance is the great-circle (haversine) distance from the location's position to the place, with a mean Earth radius of 6,371.0088 km. A line or an area uses the centre the map data service gives (`out center`).
  - The distance is rounded once to one decimal place (`decimal`, `MidpointRounding.AwayFromZero`). That rounded value is shown ("3.4 km away"), compared with the radius (`<=`, so a place on the edge is inside) and used for ordering.
  - Places are ordered by rounded distance, then by name (Lithuanian culture, `lt-LT`), then by element id so the order is always the same. The first `Places:MaxPlacesPerActivity` (5) are kept.
- **Rationale**:
  - This follows feature 006 research section 5: the user sees the same number the rule used. A place shown as "30.0 km away" is never left out of a 30 km search.
  - Ties "at the same distance" are the ties the user can see.
  - The map data service's own `around` filter counts a way when any part of it is in the circle. Checking again against the centre makes the edge rule exact and testable.
- **Alternatives considered**:
  - Comparing raw distances. Rejected for the reason above.
  - Projected (flat) distances. Rejected: haversine is simple and correct at Lithuania's latitude.

## 4. The map data service request (spec FR-005, FR-007, Assumptions)

- **Decision**: One call per place request, only for the categories not already reused (section 5). The call is `POST https://overpass-api.de/api/interpreter` with a form field `data` holding an Overpass QL query:

  ```text
  [out:json][timeout:4];
  (
    nwr["leisure"="slipway"]["name"](around:30000,54.89720,23.88610);
    nwr["sport"="canoe"]["name"](around:30000,54.89720,23.88610);
    nwr["tourism"="museum"]["name"](around:30000,54.89720,23.88610);
  );
  out tags center qt;
  ```

  - There is one statement per distinct tag over all the uncached categories, so each tag is searched once.
  - `["name"]` makes the service send only named places. `nwr` covers points, lines and areas.
  - `out tags center` gives each element's tags and, for lines and areas, a centre point.
  - The service takes each element once, even when it matches several statements.
- **Splitting the answer**: The answer is one list of elements. The server gives each category the elements with at least one of its exact `key=value` tags (feature 003 FR-009). One call therefore serves every category, and activities of the same category get the same places (FR-005).
- **Names and areas**:
  - The name is `name:lt` when present and not blank, otherwise `name`. An element whose chosen name is blank is skipped.
  - The area is `addr:city` when present (spec Assumptions: "the place's own address"), otherwise none.
  - A relation without a centre has no position and is skipped.
- **Positions**: The latitude and longitude are rounded to 5 decimal places in the query and in the answer to the browser (about 1 m), which is enough for a map link.
- **Injection**: The tags have already passed `PlaceTagParser` (letters, digits, `_`, `:` and `-` only), so they cannot hold a quote. The query builder still escapes `\` and `"` in keys and values (OWASP injection), and the numbers are written with the invariant culture.
- **Rationale**:
  - The public Overpass service gives each address only a few request slots at a time, so one call per request is the polite and reliable choice.
  - `POST` is used because a plan with 10 categories and long tag lists can make the query several kilobytes long.
- **Alternatives considered**:
  - One call per category. Rejected: up to 10 calls at a time would hit the service's slot limit (`429`) and make partial failures possible.
  - `GET ?data=`. Rejected: the address could become too long.
  - Searching without `["name"]` and filtering on the server. Rejected: unnamed places are never shown (FR-007), so this would only make the answer bigger.
  - An `around` search with a limit on the number of results. Rejected: the service does not order by distance, so a limit could cut the nearest places.

## 5. Reuse, freshness and "Places updated at" (spec FR-012, Clarifications)

- **Decision**:
  - `NearbyPlacesService` keeps each category's result in the existing `IMemoryCache` under `places:<locationId>:<radiusKm>:<tags>`, where `<tags>` is the category's tags sorted and joined with commas.
  - The stored value is a `ReceivedPlaces`: the category's ordered places (already filtered and cut to the maximum) and the instant they were received.
  - An entry is used only while `now − receivedAt` is less than `Places:MaxAgeHours` (24). The entry expires after the same time. "Now" and the received time come from `ForecastPeriod.GetNow()`, the clock the tests control (feature 006 research section 3).
  - Failures are not cached.
  - The step's `updatedAt` is the **oldest** receive time among the categories in the answer (Clarifications), in Lithuanian time to the minute.
- **Rationale**:
  - The key holds the tags rather than the category id, so a tag change by an administrator takes effect at once (spec Edge cases). Two categories with the same tags share one entry.
  - The location id identifies the position, because the position always comes from the location search service (spec FR-004).
  - Caching per category means a plan that adds one category asks the service only for that category.
- **Received time helper**: The "Lithuanian time to the minute" conversion that `PlanForecastService` does privately moves to `ForecastPeriod.ToLithuanianMinute(DateTimeOffset)`, and both services use it (DRY).
- **Alternatives considered**:
  - One cache entry for the whole request. Rejected: any change in the activity list would ask the service again for every category.
  - A database table. Rejected: the spec stores nothing, and it would need a migration.

## 6. Configuration (spec FR-006, Assumptions)

- **Decision**: A new `Places` section with `PlacesOptions`, validated at start like `ForecastOptions` and changeable with environment variables such as `Places__MaxRadiusKm`:

  | Setting | Default | Rule |
  |---|---|---|
  | `MaxRadiusKm` | 50 | 1 to 200 (the largest maximum travel distance, feature 004) |
  | `MaxPlacesPerActivity` | 5 | 1 to 20 |
  | `MaxAgeHours` | 24 | at least 1 |

- **Rationale**: The spec calls the 50 km cap, the 5 places and the 24 hours defaults that can be changed without a code change.

## 7. Failures, the 503 answer and failure records (spec FR-009 to FR-011)

- **Decision**:
  - `ExternalService` gets `MapData`. `ExternalServiceJson` gets a `PostFormAsync<T>` beside `GetAsync<T>`; both share one private send-and-read method. The warning names the service "Map data service".
  - `OverpassMapPlacesClient`:
    - It has a 4-second timeout.
    - It sends the `User-Agent` `SpekLaiku/1.0`, as the Overpass usage policy asks. It holds no personal or project contact details.
    - Its HTTP client uses `RemoveAllLoggers()`, because the request body holds the position.
  - The service can answer `200` with a `remark` and only part of the elements when its own time or memory limit is hit. A `remark` that contains "runtime error" is therefore a failure: `Timeout` when it says "timed out", otherwise `InvalidResponse`. Any other non-success status, including the service's `429` and `504`, is `UnexpectedStatus`.
  - `ApiExceptionHandler` answers `503` for `MapData` with `detail` "The map data service is unavailable. No places are shown." and `service: "places"`.
  - A failure of the location search service during the setup check is still `service: "locationSearch"`, and the page shows the general error for it, as in feature 006.
  - The request limit is the existing `PlanSetup` policy on `PlanPlacesController`. A refused request (`429`) reaches neither service and is not logged.
- **Rationale**:
  - One call per request means a failure always hides every category's places. This is the all-or-nothing rule from the Clarifications, with no extra code.
  - The warning is the failure record that features 004, 006 and 015 rely on: time and kind, with no identity, position or tags.
  - The timeout budget is the same as the forecast's: up to 5 s for an uncached location lookup plus 4 s for the map data service, under the page's 10 s.
- **Alternatives considered**: Accepting a partial answer with a remark. Rejected: it could show some places as if they were all the places (NFR-007).

## 8. Longest suitable period per date, decided on the server (spec FR-016)

- **Decision**:
  - `ActivityDayForecast` gets `LongestPeriod`: the longest of the date's periods, the earliest when two are equally long, or `null` when there is none. It is worked out by a new `SuitablePeriods.Longest(periods)`.
  - The forecast response's `ActivityDayForecastResponse` gains `longestPeriod`, an addition to the feature 006 contract (`contracts/plan-forecast-api-changes.md`).
  - The overview cell only words it: "★ 10:00–14:00 (4 h)", plus ", too short" from the period's existing `shorterThanDuration`.
  - "✗ None" is shown when it is `null` and the date has hours. "No hours left" is shown when the date has no hours.
- **Rationale**: Choosing the best period is a rule, so it belongs on the server (constitution II). An Indoor activity without a daylight requirement has every hour suitable, so its longest period is the whole window left on that date (FR-016). No special case is needed.

## 9. The answer to the browser (spec FR-013, FR-018)

- **Decision**: The answer has `updatedAt`, `radiusKm` and `categories`. `categories` has one entry per distinct category of the request, in order of first appearance, each with its `categoryId` and up to 5 `places`. Each place has `name`, `latitude`, `longitude`, `distanceKm` and `area` (or `null`). The page finds an activity's places by its `categoryId`.
- **Rationale**:
  - Places belong to a category, not to an activity (FR-005). Matching by category id means removing an activity on step 3 needs no change to the places (FR-020).
  - The category id is public: the browser sent it in the request.
  - No tags, element ids or other map data are included (FR-013).
- **The map link**: The page builds `https://www.openstreetmap.org/?mlat=<lat>&mlon=<lon>#map=17/<lat>/<lon>` from the position. This is a link the user opens, not a call to the map data service from the browser (spec Assumptions, constitution II).

## 10. Frontend state, first load and Retry (spec FR-003, FR-009, FR-020, FR-023, Clarifications)

- **Decision**:
  - A new, not persisted `usePlanPlacesStore` follows `usePlanForecastStore`.
    - Its statuses are `idle`, `loading`, `retrying`, `loaded`, `mapUnavailable`, `tooManyRequests`, `serverError`, `setupOutdated` and `activitiesOutdated`.
    - It holds `places`, the `AbortController` and the last setup and activities.
    - It aborts after 10 seconds and drops a late answer after `reset()`.
    - `load` and `retry` are ignored while a request runs.
  - `usePlanForecastStore` gets the same `retrying` status: `retry()` sets `retrying` instead of `loading`.
  - The 10-second timer and the late-answer check move into a small shared helper, `helpers/timedRequest.ts`, used by both stores.
  - **First load**: The page shows only the one status message "Getting the forecast and nearby places…" while either store is `idle` or `loading`. It then shows everything at once (FR-003).
  - **Retry**: A `retrying` store leaves the rest of the step in place. The places area and "Place" cells show "Getting nearby places…", the date cells show "Getting the forecast…", and the status region announces the same text (FR-009, Clarifications).
  - **Loading once**: The page's load effect depends only on whether a checked setup and checked activities exist, not on the lists themselves. Removing an activity on step 3 therefore starts no new request (FR-020). Opening the page again does (FR-023).
- **Rationale**: Two statuses for "loading" are the smallest change that lets the page tell the first load (whole step) from a Retry (one area). They also keep feature 006's "only one request at a time" rule.

## 11. Removing an activity and "Change activity" (spec FR-019 to FR-021)

- **Decision**:
  - **Removing**:
    - `usePlanActivitiesStore` gets `removeChecked(id)`. It removes the activity from both `activities` and `checked`, so the remaining checked activities stay checked. When none is left, `checked` becomes `null`, and the existing step guard sends the user to Activity selection with its "No activities added yet" text.
    - The forecast and places stores get `removeActivity(id)`. It drops the activity's forecast entry, which is matched by position, and removes it from the lists a later Retry sends.
    - All three are called in the same click handler, so React renders them together.
  - **Focus and announcement**:
    - After the render, focus moves to the next activity's `h2`, or the previous one when the removed activity was last. Each `h2` has `tabIndex={-1}`.
    - "<name> removed." is announced in a visually hidden status region kept inside the activity list. It is local component state, because nothing else reads it.
  - **"Change activity"**:
    - It navigates to `/plan/activities` with router state `{ focusActivityId }`. `NavigationState` gets that field.
    - Activity selection focuses `activity-<id>-heading`, the existing `h3` with `tabIndex={-1}`, once after it renders.
    - The activities and their checked state are not changed.
- **Rationale**: The existing `remove(id)` sets `checked` to `null`, which would send the user back to step 2 and make them check the activities again. The spec says the others stay as they are (FR-020).

## 12. Step 3 layout and accessibility (spec FR-014 to FR-018, FR-024, FR-025)

- **Decision**:
  - **Order on the page**: the heading, progress, setup summary, the status region, the overview, then the activity sections, then Back.
  - **Status region**:
    - `placesAndForecastStatus.tsx` replaces `planForecastStatus.tsx`. It is one `role="status"` region.
    - It shows the first-load message, or the forecast line and the places line. Each line is "… updated at HH:MM", the retrying message, or its error with its own Retry.
    - Both errors can show at once (US4 scenario 4).
  - **Overview** (`planOverview.tsx`):
    - A `<table>` with the caption "Plan overview". Its column headings are "Activity", "Place" and one per date, for example "Sat 14 Nov · Sunrise 07:42 · Sunset 16:21". The date is formatted by a new `formatPlanDateShort`. Without a forecast, only the date is shown (FR-015).
    - Each row starts with a row heading (`<th scope="row">`) holding the activity's shown name.
    - Below the existing 40em breakpoint, CSS shows each row as a card. Each cell has a visually hidden label that becomes visible, giving "Place: Nemuno slipway" and "Sat 14 Nov: ★ 10:00–14:00 (4 h)". This is the same technique as `forecastHoursTable.tsx`.
  - **Activity sections** (`planActivitiesSummary.tsx`, changed): each is a `<section aria-labelledby>` with an `h2` name, and contains:
    - the places (`activityPlaces.tsx`): an `h3` "Places" and a list, or the no-place flag with Remove and Change activity, or "Not available", or "Getting nearby places…";
    - one settings line, worded by a new `activitySettingsText` helper;
    - the forecast summary;
    - a "Show forecast details" / "Hide forecast details" button with `aria-expanded` and `aria-controls`, closed at first, whose accessible name is the visible text followed by the activity ("Show forecast details, Kayaking");
    - when open, the date entries, now without sunrise and sunset.
  - **Each place** (`placeListItem.tsx`):
    - The name, "3.4 km away" and the area when there is one.
    - A "View on map" link with `target="_blank"` and `rel="noopener noreferrer"`. Its accessible name is "View on map, Nemuno slipway (opens in a new tab)", which starts with the visible text (WCAG 2.5.3).
    - The text is worded by `placeText.ts` and the address built by `openStreetMapLink.ts`.
  - **Remove** and **Change activity**: their accessible names add the activity ("Remove, Kayaking").
- **Rationale**: Native tables, buttons and links give keyboard and screen reader support without a new library. The card layout reuses the page's breakpoint and keeps table semantics on desktop (`docs/ux-design.md` sections 8 and 9).

## 13. Tests without the live service (constitution III)

- **Decision**:
  - **Unit tests**:
    - `OverpassMapPlacesClient` is tested through the existing `FakeHttpMessageHandler`: the query text, the form body, the `User-Agent`, parsing nodes and ways with a centre, the remark failure, timeout, network error, an error status and invalid JSON.
    - `NearbyPlaceRules` and `GeoDistance` are pure and table-tested.
    - `NearbyPlacesService` and `PlanPlacesService` use a `RecordingMapPlacesClient`.
  - **Integration tests**: A `FakeMapPlacesClient` is registered in `PostgreSqlApiFactory` next to the other fakes. Its answers are scripted per position, as in `FakeForecastClient`, because the cache is shared by the test collection.
  - **Frontend tests**: They fake `fetch` per path (`/api/plan-forecast`, `/api/plan-places`) and use fake timers for the timeout. `tests/setup.ts` resets the places store.

## 14. Dependencies

- **Decision**: No new NuGet or npm package. The client uses `HttpClient` through `IHttpClientFactory`, `FormUrlEncodedContent` and `System.Net.Http.Json`, all already available. The distance is a few lines of `Math`.
- **Rationale**: Constitution VIII.
