# Hourly Forecast Quickstart

## Prerequisites

The same as `specs/005-activity-selection/quickstart.md`: .NET SDK, PostgreSQL for the application database (the `speklaiku-db` container), Docker (or `SPEKLAIKU_TEST_POSTGRES`) for the integration tests, and installed frontend and backend dependencies. Manual validation also needs internet access, because the running API calls the live Open-Meteo forecast and geocoding services. Automated tests never call them (constitution III). This feature adds **no package** and **no migration** (`data-model.md`).

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

The backend tests must cover:

1. Every row of the authorization table in `contracts/plan-forecast-api.md`. A refused caller does not reach the fake geocoding or forecast client.
2. The request limit: location searches, plan setup checks and forecast requests from one address together get `429` on the 31st request in the window. The refused request reaches neither fake client and is not logged.
3. `200`, against `FakeForecastClient` and a `FixedTimeProvider`:
   - one day per plan date, in date order, with hours 06:00 to 21:00;
   - on today's date, started hours left out, and an empty list late in the evening;
   - activities in request order, with the same category twice and different limits giving different results;
   - an Indoor activity without daylight marked `weatherIndependent`;
   - `updatedAt` in Lithuanian time.
4. `400`:
   - a past date gives `setup.dates[0]`, an unknown location gives `setup.locationId`, and a missing `setup` gives `setup`;
   - a wind limit of 31 gives `activities[0].maxWindMs`, and an unknown category gives `activities[0]`;
   - in every case the fake forecast client is not called;
   - a string for a number gives `request`.
5. `503`:
   - each forecast failure kind gives `service: "forecast"` with the weather detail;
   - a geocoding failure during the setup check gives `service: "locationSearch"`;
   - each failure writes exactly one warning with the kind and status and no coordinates, dates or location id (`CapturingLoggerProvider`).
6. Freshness:
   - a second request for the same location within 29 minutes uses the cached answer (one client call) and keeps `updatedAt`;
   - at 30 minutes it calls the client again;
   - a new day calls it again;
   - a failure is not cached.
7. Unit tests:
   - `HourSuitabilityRules`: every row of the reasons table, each limit exactly at, 0.1 inside and 0.1 outside, rain limit 0, missing values, Indoor with and without daylight.
   - `PlanningDays`: the window, the hours already started today, rain taken from the next hour's entry, missing entries, rounding of 15.04 and 15.05, daylight at sunrise 07:42 (07:00 no, 08:00 yes) and at sunset, and the last Sundays of March and October.
   - `SuitablePeriods`: joining, gaps, a period equal to the duration not marked, 1.5 h duration.
   - `ActivityForecasts`: the counts and `hasLongEnoughPeriod`.
   - `WeatherForecastService`: the cache key and age.
   - `PlanForecastService`: the order of checks and the key prefixes.
   - `OpenMeteoForecastClient`: the request address and units, unixtime parsing, `null` values, unequal arrays, a missing sunrise, a timeout, a network error, an error status, invalid JSON.
   - `OpenMeteoGeocodingClient` and `ApiExceptionHandler`: existing tests still pass after the shared error handling moved, plus the new `service` field.
   - `ForecastOptions` validation and the mapping profile (`"HH:mm"` times).

The frontend tests must cover:

- Step 3 loading: "Getting the forecast…" announced, one request even when the page renders twice, and a request built from the checked values.
- Loaded:
  - "Forecast updated at 14:05";
  - each activity as a section named after it, with its summary line in all three wordings and the indoor message;
  - each date with its long date, sunrise and sunset;
  - periods with and without "shorter than this activity's 2 h";
  - "✗ No suitable hours on this date." and "No hours left to plan today.".
- Hourly details: "Show hours for <date>" opens a table with a caption and header cells, `aria-expanded` changes, the button's accessible name includes the activity, and each hour shows "★ Suitable" or "✗ Unsuitable" with the reasons and "No data" for missing values.
- Errors:
  - weather service unavailable, too many requests and server error, each with Retry and no forecast values shown;
  - the timeout after 10 seconds;
  - Retry loading again;
  - a late answer after leaving the page ignored.
- Out of date:
  - a `setup…` answer leads to Plan setup with "Your plan setup needs to be checked again. Select Continue.";
  - an `activities…` answer leads to Activity selection with "Your activities need to be checked again. Select Continue.";
  - the notice survives a reload, disappears after a successful Continue, and is not shown when the page is opened normally.
- The stores: `markOutdated`, `recheckNotice` persisted and cleared by `setChecked` and logout; the forecast store's statuses, double load ignored, reset aborting.
- The existing step 3 tests still pass: the redirects, Back and the progress bar.
- Responsive and accessible:
  - at 320 px each hour is a card with "Label: value" text and there is no horizontal scrolling;
  - one `h1`;
  - announcements without moving focus;
  - ★ and ✗ always with words.

## Manual Validation

Start the database, the API and the frontend as in `README.md`, then open the address Vite prints (usually `http://localhost:5173`).

1. As a Visitor, create a plan for **Vilnius** with today and tomorrow. Add **Kayaking**, **Museum** (Indoor) and **Picnic**, and select **Continue**. Step 3 shows "Getting the forecast…", then "Forecast updated at" with a time from the last few minutes.
2. Under Kayaking, each date shows its sunrise and sunset and either suitable periods or "✗ No suitable hours on this date." Today shows no hour that has already started. Under Museum: "Weather does not affect this indoor activity. Every hour from 06:00 to 22:00 is suitable."
3. Select **Show hours for <tomorrow>** under Kayaking. Compare a few hours with the Open-Meteo forecast for Vilnius: temperature, rain and wind match, and each unsuitable hour gives its reasons. Hours before sunrise say "Outside daylight". Select **Hide hours**.
4. Go **Back**, set Kayaking's maximum wind to `30`, minimum temperature to `-30` and rain to `20`, and continue. More Kayaking hours are now suitable; the remaining unsuitable ones say "Outside daylight". Set its duration to `12` h: its periods say "shorter than this activity's 12 h" and the summary says "No period is long enough for this activity's 12 h."
5. Reload step 3 within a few minutes: the same "Forecast updated at" time is shown (the forecast was reused).
6. To block only the weather service, add the line `127.0.0.1 api.open-meteo.com` to `C:\Windows\System32\drivers\etc\hosts` (as administrator). The location service `geocoding-api.open-meteo.com` keeps working. Restart the API to empty the forecast cache, then reload step 3: "Error: The weather service is unavailable. No forecast is shown." with **Retry**, and no hours. Remove the line, wait a few seconds, and select **Retry**: the forecast appears.
7. Leave a plan for today on step 3 open past midnight, then reload: you are sent to Plan setup with "Your plan setup needs to be checked again. Select Continue." and the passed date marked. Replace the date and continue through step 2: the notices are gone.
8. As an Administrator, change Picnic from Outdoor to Indoor while a Visitor is on step 3, then reload step 3 as the Visitor. It goes to Activity selection with "Your activities need to be checked again. Select Continue." **Continue** shows the category-changed message. Change Picnic back afterwards.
9. Reload step 3 quickly about 30 times within a minute (or type in Location search between reloads): "Error: Too many requests. Wait a minute and try again." Wait a minute and select **Retry**.
10. As an Administrator, open `/plan/places`: Access denied. As a Suspended user: Account suspended.
11. At 320 px width with the keyboard only, open and close the hours of two activities and read every hour, with no horizontal scrolling. With a screen reader, check that "Getting the forecast…" and "Forecast updated at …" are announced.
