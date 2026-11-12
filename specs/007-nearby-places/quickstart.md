# Nearby Places Quickstart

## Prerequisites

The prerequisites are the same as in `specs/006-hourly-forecast/quickstart.md`:

- the .NET SDK;
- PostgreSQL for the application database (the `speklaiku-db` container);
- Docker (or `SPEKLAIKU_TEST_POSTGRES`) for the integration tests;
- installed frontend and backend dependencies.

Manual validation also needs internet access, because the running API calls the live Overpass, Open-Meteo forecast and geocoding services. Automated tests never call them (constitution III).

This feature adds **no package** and **no migration** (`data-model.md`).

## Automated Validation

From the repository root:

```powershell
dotnet build .\SpekLaiku.slnx
dotnet format .\SpekLaiku.slnx --verify-no-changes
dotnet test .\SpekLaiku.slnx
```

From `frontend/`:

```powershell
npm run lint
npm run format:check
npm test
npm run build
```

### Backend tests

The backend tests must cover:

1. **Authorization**: every row of the table in `contracts/plan-places-api.md`. A refused caller reaches neither the fake geocoding client nor the fake map places client.
2. **Request limit**:
   - Location searches, plan setup checks, forecast requests and place requests from one address together get `429` on the 31st request in the window (`PlanSetupRateLimitTests`, extended).
   - The refused place request does not reach the fake map places client and is not logged.
3. **`200`**, against `FakeMapPlacesClient` and the factory's `FixedTimeProvider`:
   - places for each category, nearest first, with name, rounded distance, position and area;
   - two activities of the same category give one `categories` entry;
   - a category with no matching named place gives an empty list;
   - `radiusKm` is the plan's maximum travel distance (10 gives 10), capped at 50 (80 gives 50);
   - no tags or element ids in the JSON;
   - `updatedAt` in Lithuanian time.
4. **`400`**:
   - A past date gives `setup.dates[0]`, an unknown location gives `setup.locationId`, and a missing `setup` gives `setup`.
   - An unknown category gives `activities[0]`, and a string for a number gives `request`.
   - In every case the fake map places client is not called.
   - Made-up tags in the request body are ignored, because the stored tags are used.
5. **`503`**:
   - Each map failure kind gives `service: "places"` with the map data detail.
   - A failure while some categories are cached still gives `503` and no places (all or nothing).
   - Each failure writes exactly one warning with the kind and status, and no coordinates, tags or location id (`CapturingLoggerProvider`).
   - A geocoding failure during the setup check gives `service: "locationSearch"`.
6. **Reuse and freshness**:
   - A second request within 23 h 59 min uses the cache (no client call) and keeps `updatedAt`.
   - At 24 h the client is called again.
   - Adding a category asks the client only for the new category's tags, and `updatedAt` is the older time.
   - A changed tag list for a category asks the client again.
   - A failure is not cached.
7. **The forecast endpoint still passes** all of feature 006's tests after the move to `PlanRecheckService`, and each activity date has `longestPeriod`.
8. **Unit tests**:
   - **`NearbyPlaceRules`**:
     - places inside, exactly on (rounded distance equals the radius) and just outside the edge;
     - unnamed places, `name:lt` over `name`, a blank `name:lt`;
     - one element matching two tags, listed once;
     - an element matching no tag of the category;
     - more than 5 matches, keeping the 5 nearest;
     - equal distances ordered by name (Lithuanian letters, for example "Č" after "C"), then by key;
     - `addr:city` present, missing or blank.
   - **`GeoDistance`**: distances between fixed positions checked against an independent calculation (to within 0.01 km), 1 km along a meridian, and zero distance.
   - **`NearbyPlacesService`**:
     - the cache key with sorted tags;
     - one client call for several uncached categories, with distinct tags only;
     - no call when everything is cached;
     - a category without tags;
     - the age rule.
   - **`PlanPlacesService`**: the order of checks, the radius, the oldest `updatedAt`, and the categories in order of first appearance.
   - **`PlanRecheckService`**: the key prefixes and the order; `PlanForecastServiceTests` still pass.
   - **`OverpassMapPlacesClient`** (through `FakeHttpMessageHandler`):
     - the query text (one statement per tag, `["name"]`, `around` in metres, 5 decimal places, `out tags center qt`) and the form body;
     - the `User-Agent`;
     - escaping of `"` and `\`;
     - nodes and ways with a centre, and a relation without a centre left out;
     - a `remark` with "runtime error: Query timed out" giving `Timeout`, and another runtime error giving `InvalidResponse`;
     - a timeout, a network error, `429` and `504`, and invalid JSON.
   - **`SuitablePeriods.Longest`**: an empty list, a single period, two of equal length (earliest wins) and the longest last.
   - **Other**: `PlacesOptions` validation, the mapping profile, and `ApiExceptionHandler` with `service: "places"`.

### Frontend tests

The frontend tests must cover:

- **First load**:
  - "Getting the forecast and nearby places…" is announced.
  - Nothing else is shown until both answers arrive, in either order.
  - There is one request to each endpoint even when the page renders twice.
  - Both bodies are built from the checked values.
- **Loaded overview**:
  - The table has the caption "Plan overview", a row heading per activity in plan order, a "Place" column, and one column per date with "Sat 14 Nov · Sunrise 07:42 · Sunset 16:21".
  - Cells show "★ 10:00–14:00 (4 h)", ", too short", "✗ None" and "No hours left".
  - The Indoor activity without daylight shows "★ 06:00–22:00 (16 h)".
  - Place cells show the nearest name or "✗ No place found".
- **Activity sections**:
  - "Places" lists the name, "3.4 km away" and the area (or no area).
  - The "View on map" link has the OpenStreetMap address, opens in a new tab, and has the accessible name "View on map, <place> (opens in a new tab)".
  - Two activities of the same category show the same places.
  - Each section has one settings line, the forecast summary, and "Show forecast details" closed. Opening it shows the date entries without sunrise and sunset, and their "Show hours" still works.
  - The step shows "Places updated at HH:MM".
- **No place found**:
  - "✗ No place found within 30 km." appears with Remove and Change activity, whose accessible names include the activity.
  - **Remove**:
    - The activity is removed, "Kayaking removed." is announced, and focus moves to the next heading, or the previous one when it was last.
    - The overview loses the row, and no new request is sent.
    - Activity selection no longer lists the activity.
    - Removing the only activity leads to Activity selection with "No activities added yet. Select at least one category to continue."
  - **Change activity**: Activity selection opens with the activities kept and focus on that activity's heading.
  - An activity that is kept stays flagged.
- **Errors**:
  - The map data service unavailable: one error with Retry above the overview, "Not available" in every Place cell, no places and no "No place found", and the forecast still shown.
  - Places Retry:
    - The overview and forecast stay, and "Getting nearby places…" is shown and announced.
    - The places then appear, and the forecast is not requested again.
    - Selecting Retry twice quickly sends one request.
  - Weather unavailable with places loaded: the overview stays, date cells show "Not available", and the headings have no sunrise or sunset.
  - Forecast Retry shows "Getting the forecast…" in the date cells.
  - Both failing: both errors, each with its own Retry.
  - Too many requests and server error for places.
  - The 10-second timeout.
  - A late answer after leaving the page is ignored.
- **Out of date**: a `setup…` or `activities…` answer from the places endpoint leads to Plan setup or Activity selection with the "checked again" notice, as for the forecast.
- **Stores**:
  - the places store's statuses, a double load ignored, `retrying`, `removeActivity` and reset aborting;
  - the forecast store's `retrying` and `removeActivity`;
  - `removeChecked` keeping the others checked and clearing `checked` when the last one goes.
- **Helpers**: `overviewCellText`, `activitySettingsText`, `placeText`, `openStreetMapLink`, `formatPlanDateShort` and `checkedPlanRequest`.
- **Responsive and accessible**:
  - At 320 px the overview is one card per activity with "Label: value" text.
  - Buttons are full width with 44 × 44 px targets, and there is no horizontal scrolling.
  - There is one `h1`.
  - Announcements happen without moving focus.
  - ★ and ✗ always come with words.
- **Existing tests**: the step 3 tests still pass (redirects, Back, progress), updated for the closed forecast details.

## Manual Validation

Start the database, the API and the frontend as in `README.md`, then open the address Vite prints (usually `http://localhost:5173`).

1. **Loading and places**:
   1. As a Visitor, create a plan for **Kaunas** with today and tomorrow and a maximum travel distance of 30 km.
   2. Add **Kayaking**, **Museum** and **Cycling** twice, and select **Continue**.
   3. Step 3 shows only "Getting the forecast and nearby places…", then everything at once, with "Forecast updated at" and "Places updated at" times from the last few minutes.
2. **Overview**:
   - It has one row per activity and one column per date. Each date heading shows its sunrise and sunset once.
   - No activity section repeats the sunrise and sunset.
   - Both Cycling rows show the same nearest place.
3. **Places under Kayaking**:
   - Up to 5 places, nearest first, each with "x.x km away" and, for some, a town.
   - Select **View on map**: OpenStreetMap opens in a new tab at the place.
   - The distances are at most 30 km.
4. **Forecast details**: Select **Show forecast details** under Kayaking. The date entries and **Show hours** from feature 006 appear. Select it again to close them.
5. **Radius**:
   - Go back to step 1 and set the maximum travel distance to 5 km, then continue to step 3. Fewer places are shown, all within 5 km.
   - If an activity now has none, it shows "✗ No place found within 5 km." with **Remove** and **Change activity**.
   - Set it to 200 km: places are still within 50 km.
6. **No place found**:
   - As an Administrator, set a test category's map place tags to `leisure=nonexistent_tag_for_test`.
   - As the Visitor, add that category and continue. Step 3 flags it with the reason, and the overview says "✗ No place found".
   - Select **Remove**: the activity disappears, the others and their places stay, and nothing reloads.
   - Add it again and select **Change activity**: Activity selection opens with focus on its heading.
7. **Reuse**: Reload step 3 within a few minutes. The same "Places updated at" time is shown, because the places were reused.
8. **Map data service unavailable**:
   1. Add the line `127.0.0.1 overpass-api.de` to `C:\Windows\System32\drivers\etc\hosts` (as administrator). The weather and location services keep working.
   2. Restart the API to empty the cache, then reload step 3. You should see "Error: The map data service is unavailable. No places are shown." with **Retry**, "Not available" in every Place cell, no places, no "No place found", and the forecast.
   3. Check that the API log has one warning "Map data service failed: …" with no position.
   4. Remove the line and select **Retry**. "Getting nearby places…" is shown while the overview stays, then the places appear.
9. **Too many requests**: Reload step 3 quickly 16 times or more within a minute (each load is two requests, so the 16th load passes the limit of 30). You should see "Error: Too many requests. Wait a minute and try again." Wait a minute and select **Retry**.
10. **Access**: As an Administrator, open `/plan/places`: Access denied. As a Suspended user: Account suspended.
11. **Phone width**: At 320 px, using only the keyboard, read the overview cards, open one activity's forecast details, follow a "View on map" link and remove an activity with no place. There should be no horizontal scrolling. With a screen reader, check that the loading, "updated at", error and "removed" messages are announced, and that the links and buttons name their place or activity.
12. **Speed (SC-001)**:
    1. Restart the API to empty the place cache.
    2. As a Visitor, create a plan for **Kaunas** with a maximum travel distance of 30 km, and add 10 activities from 5 categories (two of each), then select **Continue**.
    3. Time from step 3 opening until the places are shown. It should be at most 5 seconds.
    4. Repeat from step 1 five times. At most one attempt may take longer than 5 seconds. Record the times in the Pull Request.
