# Plan Location and Dates Quickstart

## Prerequisites

The same as `specs/003-activity-categories/quickstart.md`: .NET SDK, PostgreSQL for the application database, Docker (or `SPEKLAIKU_TEST_POSTGRES`) for the integration tests, and installed frontend and backend dependencies. This feature adds **no package** and **no migration** (`data-model.md`). The running API needs outgoing HTTPS access to `geocoding-api.open-meteo.com` for manual validation. The automated tests never call it.

## Automated Validation

From the repository root:

```powershell
dotnet restore .\SpekLaiku.slnx
dotnet build .\SpekLaiku.slnx
dotnet format .\SpekLaiku.slnx --verify-no-changes
dotnet test .\SpekLaiku.slnx
```

From `frontend/`:

```powershell
npm ci
npm run lint
npm run format:check
npm test
npm run build
```

The backend tests must cover:

1. Every row of the authorization table in `contracts/plan-setup-api.md`, for all three endpoints: a Visitor and an Active Registered User are allowed; Suspended Registered User, Active and Suspended Administrator, and a cookie whose account was deleted get `403`.
2. Search: `200` with only `LT` places (a fake result from another country is dropped), at most 10, with the area rule from research section 3 ("Kaunas, Kaunas County", "Kauniai, Biržai District Municipality", fallback "Lithuania"). A response without `results` gives an empty list. Text of 1 character, only spaces or 101 characters gives `400`. Failures of the fake geocoding service (timeout, network error, `500`, unreadable JSON) give `503` with the contract message. A second identical search is answered from the cache. "Kaunas, Kaunas Count" searches "Kaunas", and fewer than 2 characters before the comma gives an empty list without calling the service.
3. Date limits: `GET /api/plan-setup/period` returns the fixed-clock period (for example `2026-11-04` to `2026-11-10` and `maxDates` 7 at 2026-11-04T21:59Z, then `2026-11-05` to `2026-11-11` at 22:00Z) and is never rate limited. The plan setup check: `200` with sorted dates, the server's location data and distance 30 when null. Each validation message from `data-model.md` with keys in order. The boundaries "today" and "today + 6" are accepted, while "yesterday" and "today + 7" are refused, using a fixed `TimeProvider`, including just before and after midnight in `Europe/Vilnius` (for example 2026-11-04T21:59Z and 22:00Z) and across a daylight-saving change. Duplicate dates are reported at the later index, and 8 dates give only the count error. Distances 1 and 200 are accepted; 0, 201 and 12.5 are refused. A location id unknown to the service, or a non-`LT` place, is refused. A string where a number belongs gives the `request` error.
4. Request limit, with a factory whose `RateLimiting:PlanSetup:PermitLimit` is 3 (research section 14): the fourth request in the window gets `429` with the contract body, whether it is a search or a check, because both share one count. A refused search does not call the fake geocoding client. A Visitor and a signed-in user from the same address share the limit. The ordinary test factory sets a high limit, so other tests never reach it. Start-up fails for a limit of 0.
5. Unit tests for `ForecastPeriod`, `PlanSetupValidator`, `LocationAreaName`, `LocationSearchService` (cache hit, failures not cached, places cached by id), `PlanSetupService`, `PlanCreatorHandler` (each role and status, a missing account, anonymous), `OpenMeteoGeocodingClient` with a fake `HttpMessageHandler` (query string, parsing, missing `results`, `400` on get means not found, other failures become `ExternalServiceException`, and the warning log contains the failure kind but never the search text) and the `ApiExceptionHandler` mapping to `503`.

The frontend tests must cover:

- the Plan setup page states: empty start with distance 30; "Searching locations…"; suggestions with name and area; the empty, service-error and too-many-requests messages (search and Continue, with Retry on Continue); choosing by mouse and by keyboard; Escape; typed text clearing the choice; only the latest search shown; adding and removing dates in date order, with focus back on the date picker; each date message; the date picker's `min` and `max` taken from the server's period (not from the browser clock), "Loading available dates…" while it loads, and its load error with Retry;
- the distance messages;
- Continue: the error summary, focus on the first invalid field, "Checking your plan setup…", Continue disabled, server error and timeout with Retry, per-date server errors;
- moving to the Activity selection step with its summary, Back and progress-bar link, and the redirect when no checked setup exists;
- the store kept in `sessionStorage` across a re-render and a reload, cleared on logout, and reset to unchecked on any change; a passed date marked when the page opens;
- the `PlanCreatorOnly` guard and the "Create plan" navigation and Home button for each role and status;
- keyboard order, combobox ARIA attributes, live-region announcements, page titles, and the 320 px layout rules.

## Manual Validation

Start the API and the frontend as in `README.md`, then open the address Vite prints (usually `http://localhost:5173`).

1. As a Visitor, select **Create plan**. Plan setup opens at step 1 of 4, with Location and Dates empty and distance 30.
2. Type `Kaun`. "Searching locations…" appears, then suggestions such as "Kaunas, Kaunas County". Choose one with the arrow keys and Enter.
3. Type `zzqxw`. "No location found. Check the spelling or try a larger town." appears.
4. Add tomorrow and today. The chips show today first. Add today again: "Error: This date is already added." The date picker does not offer yesterday or any day after today + 6.
5. Set distance to `abc` and select **Continue**: the distance error appears in the summary and next to the field. Set it to `50` and continue: Activity selection opens, showing the location, both dates and "Maximum travel distance: 50 km".
6. Reload the page, select **Back**, and the values are still there. Change a date and open `/plan/activities` directly: you are sent back to Plan setup.
7. Log in as a Registered User in the same tab. **Create plan** still shows the setup. Log out: the setup is empty.
8. Log in as an Administrator. There is no **Create plan**, and `/plan/setup` shows Access denied. Log in as a Suspended user: `/plan/setup` goes to Account suspended.
9. Stop the network connection of the API machine (or block `geocoding-api.open-meteo.com`) and search. "Error: Location search is unavailable. Try again later." appears, and the API log has a warning without the search text.
10. At 320 px width with the keyboard only, complete steps 1 to 5 without horizontal scrolling.
11. Stop the API. Start it again with a lower limit by setting the environment variable `RateLimiting__PlanSetup__PermitLimit` to `5` in the API's terminal (PowerShell: `$env:RateLimiting__PlanSetup__PermitLimit = "5"`). Then search 6 times within a minute (type, pause, change the text). The sixth search shows "Error: Too many requests. Wait a minute and try again.", and searching works again a minute later. Close that terminal or run `Remove-Item Env:RateLimiting__PlanSetup__PermitLimit` afterwards.
