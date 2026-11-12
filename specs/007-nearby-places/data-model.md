# Data Model: Nearby Places

Nothing is stored in the database: no entity, no schema change, no migration. The category's existing `PlaceTags` column (feature 003) is only read. The models below exist only while a request runs (backend), in the server's memory cache (received places), or while step 3 is open (frontend).

## Client models (`backend/src/SpekLaiku.Api/Clients/`)

### IMapPlacesClient

`Task<IReadOnlyList<MapElement>> FindAsync(double latitude, double longitude, int radiusKm, IReadOnlyList<string> tags, CancellationToken cancellationToken)`.

- It returns the named points, lines and areas within the radius that have at least one of the `key=value` tags. Each element appears once, and the order is not defined.
- It throws `ExternalServiceException(ExternalService.MapData, kind, status)` on every failure (research section 7).
- Tests replace it with `FakeMapPlacesClient` (integration) or `RecordingMapPlacesClient` (unit).

### MapElement (record)

| Field | Type | Notes |
|---|---|---|
| `Key` | `string` | `"node/123"`, `"way/456"` or `"relation/789"`. Unique in one answer; used only to order equal places and never sent to the browser. |
| `Latitude`, `Longitude` | `double` | A node's position, or the centre of a way or relation. Elements without either are left out by the client. |
| `Tags` | `IReadOnlyDictionary<string, string>` | All the element's tags as the service sent them. |

### OverpassResponse (internal)

The JSON shape read from the service: `remark` (`string?`) and `elements`. Each element has `type`, `id`, `lat`/`lon` (nodes), `center { lat, lon }` (ways and relations) and `tags`. A `remark` containing "runtime error" is a failure (research section 7).

### OverpassQuery (internal static)

`Build(latitude, longitude, radiusKm, tags)` returns the query text in research section 4: one `nwr["k"="v"]["name"](around:<metres>,<lat>,<lon>);` statement per distinct tag, `[out:json][timeout:4]`, and `out tags center qt;`. The coordinates have 5 decimal places in the invariant culture, and `\` and `"` are escaped.

### ExternalService (enum, changed)

`LocationSearch`, `Forecast`, `MapData` (new). Display name: "Map data service".

### ExternalServiceJson (changed)

It adds `PostFormAsync<T>(httpClient, path, fields, service, logger, cancellationToken)`. `GetAsync<T>` and `PostFormAsync<T>` share one private send-and-read method, so the timeout, network, status and JSON handling, and the single warning, stay in one place.

## Service models (`backend/src/SpekLaiku.Api/Services/`)

### PlacesOptions (section `Places`)

| Setting | Default | Rule (validated at start) |
|---|---|---|
| `MaxRadiusKm` | 50 | 1 ≤ value ≤ 200 |
| `MaxPlacesPerActivity` | 5 | 1 ≤ value ≤ 20 |
| `MaxAgeHours` | 24 | ≥ 1 |

### PlanRecheckService and PlanRecheckResult (new, shared)

`CheckAsync(PlanSetupCheckRequest? setup, List<PlanActivityRequest>? activities, CancellationToken)` returns one of two results:

- **Success**: `Setup` (`CheckedPlanSetup`) and `Activities` (`IReadOnlyList<CheckedPlanActivity>`).
- **Invalid**: `Errors`, in this order:
  1. a missing setup gives `setup`, "The request is invalid.";
  2. setup errors, each key prefixed `setup.`;
  3. otherwise the activity check's own keys.

`PlanForecastService` and `PlanPlacesService` both start with it (research section 2).

### NearbyPlace (record)

| Field | Type | Notes |
|---|---|---|
| `Name` | `string` | `name:lt` when present and not blank, else `name`; trimmed. |
| `Latitude`, `Longitude` | `double` | Rounded to 5 decimal places. |
| `DistanceKm` | `decimal` | Haversine distance from the plan's location, rounded to 1 decimal place (away from zero). |
| `Area` | `string?` | `addr:city`, trimmed; `null` when missing or blank. |
| `Key` | `string` | The element's key, used only to order ties. It is not mapped to the response. |

### GeoDistance (static)

`Kilometres(lat1, lon1, lat2, lon2)` returns the haversine distance with a mean Earth radius of 6,371.0088 km, as a `double`.

### NearbyPlaceRules (static, pure)

`For(IReadOnlyList<MapElement> elements, IReadOnlyList<string> categoryTags, PlaceLocation origin, int radiusKm, int maxPlaces)` returns `IReadOnlyList<NearbyPlace>`:

1. Keep the elements with at least one tag `key=value` that exactly equals one of `categoryTags`.
2. Keep the elements with a name that is not blank (as in `NearbyPlace.Name`).
3. Work out `DistanceKm` as described above, and keep `DistanceKm <= radiusKm` (a place on the edge is inside).
4. Each element appears once (by `Key`).
5. Order by `DistanceKm`, then `Name` (`lt-LT` culture comparison), then `Key` (ordinal).
6. Take the first `maxPlaces`.

### ReceivedPlaces (record)

`Places` (`IReadOnlyList<NearbyPlace>`, already ruled) and `ReceivedAt` (`DateTimeOffset`, from `ForecastPeriod.GetNow()`).

### NearbyPlacesService

`GetAsync(PlaceLocation location, int radiusKm, IReadOnlyList<CategoryTags> categories, CancellationToken)` returns one `ReceivedPlaces` per category, in the given order:

1. For each category, look up `places:<location.Id>:<radiusKm>:<sorted tags joined with ",">`. Use the entry while `now − ReceivedAt < MaxAgeHours`.
2. Gather the distinct tags of the categories without a usable entry. If there are any, call `IMapPlacesClient.FindAsync` **once** with them.
3. For each of those categories, apply `NearbyPlaceRules`, store a new `ReceivedPlaces(places, now)` with an expiry of `MaxAgeHours`, and return it.
4. A client failure is not caught and nothing new is stored: the `ExternalServiceException` reaches `ApiExceptionHandler`. Entries stored earlier stay valid.

A category with no tags gets an empty list, never touches the client and is not stored.

`CategoryTags` (record) holds `CategoryId` (`Guid`) and `Tags` (`IReadOnlyList<string>`).

### CategoryPlaces (record)

`CategoryId` (`Guid`) and `Places` (`IReadOnlyList<NearbyPlace>`). An empty list means "No place found" (spec FR-019).

### PlanPlaces (record)

| Field | Type | Notes |
|---|---|---|
| `UpdatedAt` | `TimeOnly` | The oldest `ReceivedAt` of the categories, in Lithuanian time to the minute (`ForecastPeriod.ToLithuanianMinute`, Clarifications). |
| `RadiusKm` | `int` | `min(setup.MaxTravelDistanceKm, MaxRadiusKm)`. |
| `Categories` | `IReadOnlyList<CategoryPlaces>` | One entry per distinct category of the checked activities, in order of first appearance. |

### PlanPlacesResult (record)

This is the same pattern as `PlanForecastResult`: `Succeeded` with `Places`, or `Errors` from `PlanRecheckResult`.

### PlanPlacesService

`GetAsync(PlanPlacesRequest request, CancellationToken)`:

1. `PlanRecheckService.CheckAsync`. On errors it returns them, and the map data service is not contacted.
2. Read `Id` and `PlaceTags` of the checked activities' distinct categories in one query (`AsNoTracking`). A category that disappeared in between gets no tags.
3. Work out the radius, then call `NearbyPlacesService.GetAsync` for the location.
4. Build `PlanPlaces`.

### ForecastPeriod (changed)

It adds static `TimeOnly ToLithuanianMinute(DateTimeOffset instant)`. `PlanForecastService` uses it in place of its private `ToMinute`.

### Forecast models (changed, feature 006)

- `SuitablePeriods.Longest(IReadOnlyList<SuitablePeriod> periods)` returns the period with the greatest `LengthHours`, the first such one in time order, or `null` when the list is empty.
- `ActivityDayForecast` gains `SuitablePeriod? LongestPeriod`, set by `ActivityForecasts.ForDay`.
- `PlanForecastService` starts with `PlanRecheckService` and keeps its forecast-date check.

## Validation rules (server)

| Rule | Where | Spec |
|---|---|---|
| Caller is a Visitor or an Active Registered User | `PlanCreator` policy | FR-001, FR-002 |
| At most 30 location, setup, forecast and place requests per minute per address | `PlanSetup` rate limit policy | FR-011 |
| Setup and activities valid now; position from the location service; tags from the database | `PlanRecheckService`, `PlanPlacesService` | FR-004 |
| Radius = min(max travel distance, 50 km); edge inside | `PlanPlacesService`, `NearbyPlaceRules` | FR-006 |
| Named, matching, de-duplicated, nearest first, ties by name, at most 5 | `NearbyPlaceRules` | FR-007 |
| Each category searched at most once; one call per request | `NearbyPlacesService` | FR-005 |
| Reused for at most 24 h; oldest receive time shown | `NearbyPlacesService`, `PlanPlacesService` | FR-012 |
| Any service failure fails the whole request | `OverpassMapPlacesClient`, `ApiExceptionHandler` | FR-009 |
| No tags or element ids in the answer | `PlanPlacesMappingProfile`, response DTOs | FR-013 |

## Frontend types (`frontend/src/types/planPlaces.ts`)

```ts
export interface NearbyPlace {
  name: string
  latitude: number
  longitude: number
  distanceKm: number
  area: string | null
}

export interface CategoryPlaces {
  categoryId: string
  // Empty: no place found within radiusKm.
  places: NearbyPlace[]
}

export interface PlanPlaces {
  updatedAt: string // "HH:mm", Lithuanian time
  radiusKm: number
  categories: CategoryPlaces[]
}

// The same body as the forecast request.
export type PlanPlacesRequest = PlanForecastRequest
```

`types/planForecast.ts` (changed): `ActivityDayForecast` gains `longestPeriod: SuitablePeriod | null`.

## Frontend state

### Plan places store (`stores/usePlanPlacesStore.ts`, new, not persisted)

| Field | Type | Notes |
|---|---|---|
| `status` | `"idle" \| "loading" \| "retrying" \| "loaded" \| "mapUnavailable" \| "tooManyRequests" \| "serverError" \| "setupOutdated" \| "activitiesOutdated"` | `loading` is the first load, and the page shows only the step message. `retrying` keeps the step and shows "Getting nearby places…" in the places areas. |
| `places` | `PlanPlaces \| null` | Set only when `loaded`. |
| `controller` | `AbortController \| null` | The running request. |
| `lastSetup`, `lastActivities` | checked values or `null` | What Retry sends. |

Actions:

- `load(setup, activities)`: ignored while `loading` or `retrying`.
- `retry()`: sets `retrying` and sends the last values.
- `removeActivity(id)`: drops it from `lastActivities`. The places themselves are kept by category.
- `reset()`: aborts and returns to `idle`.

**Outcome handling** (same as the forecast store):

- `setupOutdated` calls `usePlanSetupStore.markOutdated()`.
- `activitiesOutdated` calls `usePlanActivitiesStore.markOutdated()`.
- `forbidden` refreshes the current user and shows the server error.
- The 10-second timeout and late answers are handled through `helpers/timedRequest.ts`.

### Plan forecast store (changed)

- It adds the `retrying` status, which `retry()` sets, and `load` ignores calls while `retrying`.
- It adds `removeActivity(id)`, which drops the activity's entry from `forecast.activities` (matched by its position in `lastActivities`) and from `lastActivities`.
- It uses `helpers/timedRequest.ts`.

### Plan activities store (changed)

`removeChecked(id)` removes the activity from `activities` and from `checked`. It sets `checked` to `null` only when no activity is left (research section 11).

### NavigationState (changed)

It gains `focusActivityId?: string`, set by "Change activity" and read once by Activity selection.

## Helpers (`frontend/src/helpers/`)

| Helper | Output |
|---|---|
| `timedRequest.ts` (new) | Starts the 10-second abort timer for a request and clears it. Shared by both step 3 stores. |
| `checkedPlanRequest.ts` (renamed from `planForecastRequest.ts`) | The body for both step 3 requests. |
| `formatPlanDate.ts` (changed) | Adds `formatPlanDateShort("2026-11-14")`, which returns `"Sat 14 Nov"`. |
| `overviewCellText.ts` (new) | A date cell's text: `"★ 10:00–14:00 (4 h)"` (+ `", too short"`), `"✗ None"`, `"No hours left"`, `"Not available"` or `"Getting the forecast…"`. A place cell's text: the nearest name, `"✗ No place found"`, `"Not available"` or `"Getting nearby places…"`. |
| `activitySettingsText.ts` (new) | `"Outdoor · 2 h · Requires daylight · Wind up to 8 m/s · Rain up to 0.5 mm/h · 15 to 35 °C"`; Indoor gives `"Indoor · 1.5 h · No daylight needed"`. |
| `placeText.ts` (new) | `"3.4 km away"`, always with one decimal place (`toFixed(1)` on the server's already rounded value). |
| `openStreetMapLink.ts` (new) | `https://www.openstreetmap.org/?mlat=<lat>&mlon=<lon>#map=17/<lat>/<lon>`. |

Every helper only words or formats server values. No rule is decided in the browser.
