# Spėk laiku

Activity planning application for families and groups in Lithuania. Users create a list of possible activities (kayaking, cycling, outdoor heritage visits, picnics, indoor activities) and set acceptable weather conditions. The system uses hourly forecasts from Open-Meteo and nearby places from the OpenStreetMap Overpass API to find suitable time slots, and recalculates the plan when the forecast changes.

Status: in development. Implemented so far: user registration (feature `001-user-registration`), login and logout (feature `002-user-login`), activity category management for administrators (feature `003-activity-categories`), choosing a plan's location and dates (feature `004-plan-location-dates`), choosing a plan's activities (feature `005-activity-selection`), the hourly forecast for each activity (feature `006-hourly-forecast`) and nearby places for each activity (feature `007-nearby-places`).

## Technology

- Backend: ASP.NET Core Web API, Entity Framework Core, PostgreSQL, ASP.NET Core Identity
- Frontend: React with TypeScript
- External APIs: Open-Meteo (weather), OpenStreetMap Overpass (places)
- Development process: Spec Kit (spec-driven development) with GitHub Copilot

## Repository structure

- `backend/`: API and backend tests
- `frontend/`: React application
- `docs/`: requirements, UX design and architecture documents
- `specs/`: feature specifications, plans and task lists
- `.specify/`: Spec Kit files and the project constitution
- `AGENTS.md`: instructions for AI coding agents

## Prerequisites

- Git
- .NET 10 SDK
- The EF Core command-line tool, for applying migrations: `dotnet tool install --global dotnet-ef`
- Node.js and npm
- PostgreSQL (local or hosted)
- Docker (required to run the backend integration tests, which start PostgreSQL with Testcontainers), or a local PostgreSQL server for those tests as described below

Without Docker, point the integration tests at an existing PostgreSQL server. Each test run creates a throwaway database with a random `speklaiku_test_` name on that server and drops it afterwards. Set the variable once for your Windows user (it takes effect in new terminals):

```powershell
[Environment]::SetEnvironmentVariable("SPEKLAIKU_TEST_POSTGRES", "Host=localhost;Port=5432;Database=postgres;Username=<local-user>;Password=<local-password>", "User")
```

The user needs permission to create databases. When the variable is not set, the tests start PostgreSQL with Testcontainers, as CI does.

## Setup, run and test

### Build and test

Run the backend checks from the repository root, as CI does:

```powershell
dotnet restore .\SpekLaiku.slnx
dotnet build .\SpekLaiku.slnx
dotnet format .\SpekLaiku.slnx --verify-no-changes
dotnet test .\SpekLaiku.slnx
```

Run the frontend checks from `frontend/`:

```powershell
npm ci
npm run lint
npm run format:check
npm test
npm run build
```

`.gitattributes` checks text files out with LF line endings on every machine, so the format check gives the same result on Windows as in CI. In a clone made before that file was added, check the files out again once, with no uncommitted changes: `git rm -r --cached -q .` then `git reset --hard`.

### Run the application

1. Set the backend connection string through an environment variable in the terminal you run the backend from. Do not commit local credentials:

   ```powershell
   $env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5432;Database=speklaiku;Username=<local-user>;Password=<local-password>"
   ```

2. Create or update the database by applying the migrations (from the repository root, in the same terminal):

   ```powershell
   dotnet ef database update --project .\backend\src\SpekLaiku.Api
   ```

   Run it again after pulling a feature that adds a migration. Feature 003 adds `AddActivityCategories`, which creates the `ActivityCategories` table and inserts the five starter categories. Features 004 to 007 add no migration.

3. Trust the ASP.NET Core development certificate once per machine. The sign-in cookie is `Secure`, so the API runs over https:

   ```powershell
   dotnet dev-certs https --trust
   ```

4. Start the API with the https profile, which listens on `https://localhost:7254`:

   ```powershell
   dotnet run --project .\backend\src\SpekLaiku.Api --launch-profile https
   ```

5. In a second terminal, start the frontend from `frontend/`:

   ```powershell
   npm ci
   npm run dev
   ```

   Open the address Vite prints (usually `http://localhost:5173`). The Vite dev server forwards every `/api` request to `https://localhost:7254`, so the browser sees one origin and the sign-in cookie works without CORS.

The API needs outgoing HTTPS access to `geocoding-api.open-meteo.com` for the location search on Plan setup. The browser never calls it, and the automated tests never call it either: they use fake answers, so they pass without a network connection.

## Log in and log out

- **Log in page** (`/login`): email and password. An unknown email, a wrong password and a locked account all show the same message, "Error: Incorrect email or password.", so the page never reveals which accounts exist. After login a Suspended user opens the Account Suspended page; everyone else returns to the page they were sent from (`/login?returnTo=...`, only pages inside the application) or opens the home page.
- **Lockout**: 5 wrong passwords in a row lock the account for 15 minutes. During the lock even the correct password is refused. A successful login resets the count.
- **Session**: the sign-in cookie expires 30 minutes after the last request and is renewed when at least half of that time has passed, so a session ends 15 to 30 minutes after the user's last action. A user whose session expired is told so on the Log in page.
- **Log out**: the "Log out" button in the navigation ends the session and opens the home page with "✓ Success: You have logged out."

### Testing an Administrator or Suspended account

There is no user administration page yet, so change a registered account directly in the database (table `AspNetUsers`), then log in again:

```sql
-- Administrator
UPDATE "AspNetUsers" SET "Role" = 'Administrator' WHERE "NormalizedEmail" = 'USER@EXAMPLE.COM';

-- Suspended (AccountStatus is stored as a number: 0 = Active, 1 = Suspended)
UPDATE "AspNetUsers" SET "AccountStatus" = 1 WHERE "NormalizedEmail" = 'USER@EXAMPLE.COM';

-- End a lockout early
UPDATE "AspNetUsers" SET "LockoutEnd" = NULL, "AccessFailedCount" = 0 WHERE "NormalizedEmail" = 'USER@EXAMPLE.COM';

-- Restore the account afterwards
UPDATE "AspNetUsers" SET "Role" = 'Registered User', "AccountStatus" = 0 WHERE "NormalizedEmail" = 'USER@EXAMPLE.COM';
```

The application reads the role and status from the database on each page load, but the page opened after login is chosen when logging in, so log out and log in again to check it.

## Activity categories

- **Page** (`/admin/categories`, "Categories" in the navigation): lists every category in alphabetical order. "Create category" and each category's "Edit" open a form next to the list (below it on a phone) with the name, type (Indoor or Outdoor), default duration, the weather limits of an Outdoor category (maximum wind, maximum rain, minimum and maximum temperature), "Requires daylight" and the map place tags (`key=value` pairs such as `leisure=slipway`, used by a later feature to find places on OpenStreetMap). Categories cannot be deleted.
- **Validation**: every value is checked on the server; each message is shown next to its field, with an error summary when two or more fields fail. Names are unique without regard to letter case.
- **Two administrators**: a save is refused with "Error: This category was changed by someone else. Reload it and try again." when the category changed since the form was opened; "Reload" shows the stored values.
- **Starter categories**: the migration adds Cycling, Kayaking, Picnic, Heritage site (all Outdoor) and Museum (Indoor) once. Administrators may edit or rename them afterwards.
- **Who can open it**: only a signed-in Active Administrator. A visitor is sent to Log in, a Registered User sees "Access denied", and a Suspended user opens the Account Suspended page. The API refuses everyone else with `401` or `403` and reads the account on every request, so a suspension applies at once.

To try it, make an account an Administrator with the SQL in "Testing an Administrator or Suspended account" above, log in again and select **Categories**. The manual checks for a release are in `specs/003-activity-categories/quickstart.md`.

## Plan setup

- **Pages**: **Plan setup** (`/plan/setup`, "Create plan" in the navigation and on Home) is step 1 of a plan: choose a location in Lithuania from the search suggestions, add 1 to 7 dates from today to today plus 6 days (by the date in Lithuania), and set a maximum travel distance (a whole number from 1 to 200 km, 30 by default). **Continue** checks everything on the server and opens **Activity selection** (`/plan/activities`).
- **Who can use it**: visitors (no account needed) and Active Registered Users. An Administrator sees "Access denied" and a Suspended user opens the Account Suspended page; the API refuses both with `403`.
- **Where the setup is kept**: only in the browser tab (session storage). It survives a reload and logging in or registering in the same tab, and is gone when the tab closes or the user logs out. Nothing is saved to an account yet.
- **Request limit**: location searches and Continue checks together are limited to 30 per minute per network address; more get "Error: Too many requests. Wait a minute and try again." The settings are in `appsettings.json` under `RateLimiting:PlanSetup` (`PermitLimit`, `WindowSeconds`) and can be changed without a code change, for example for one terminal session:

  ```powershell
  $env:RateLimiting__PlanSetup__PermitLimit = "5"
  ```

  Remove it again with `Remove-Item Env:RateLimiting__PlanSetup__PermitLimit`, or close the terminal.

The manual checks for a release are in `specs/004-plan-location-dates/quickstart.md`.

## Activity selection

- **Pages**: **Activity selection** (`/plan/activities`) is step 2 of a plan: pick activities from the categories and adjust each one's settings. **Continue** checks every activity on the server and opens **Places and forecast** (`/plan/places`), step 3 (see below).
- **Adding activities**: the categories are in a list that the **Activity categories** button opens and closes. It starts open while the plan has no activities and closed once it has some, and with more than 8 categories it has a **Search activities** field. A plan can have up to 10 activities, and a category can be added more than once. Copies of one category are shown as "Cycling 1" and "Cycling 2", each with its own settings.
- **Settings**: duration and "Requires daylight" for every activity, plus maximum wind, maximum rain and minimum and maximum temperature for Outdoor activities. They start from the category's defaults, and changes apply only to this plan, never to the category.
- **Where the activities are kept**: only in the browser tab (session storage), next to the plan setup. They survive a reload and logging in or registering in the same tab, stay when the setup changes, and are gone when the tab closes or the user logs out. Nothing is saved to an account yet.
- **Who can use it**: visitors (no account needed) and Active Registered Users. An Administrator sees "Access denied" and a Suspended user opens the Account Suspended page; the API refuses both with `403`.

This feature needs no migration. The manual checks for a release are in `specs/005-activity-selection/quickstart.md`.

## Places and forecast

- **Page**: **Places and forecast** (`/plan/places`) is step 3 of a plan. It asks for the hourly forecast (Open-Meteo) and the nearby places (OpenStreetMap Overpass API) together, shows "Getting the forecast and nearby places…" until both have answered, and then shows everything at once:
  - **Plan overview**: a table with a row per activity, its nearest place, and one column per date with that date's sunrise and sunset in the heading. Each cell shows the date's longest suitable period ("★ 10:00–14:00 (4 h)", with ", too short" when it is shorter than the activity), "✗ None" or "No hours left". On phones each row is a card.
  - **Each activity**: its places, one line with its settings, its forecast summary, and **Show forecast details**, closed at first. The details list each date's suitable periods ("★ Suitable 10:00–14:00 (4 h)"), and **Show hours** opens a table of that date's hours with temperature, rain, wind, daylight and "★ Suitable" or "✗ Unsuitable" with every reason, for example "Too windy: 9.0 m/s, maximum 8.0 m/s".
- **Places**: for each activity, at most 5 named places that have one of its category's map place tags, nearest to the plan's location first. Each shows its distance ("3.4 km away"), its town when the map data has one, and **View on map**, which opens it on OpenStreetMap in a new tab. The search radius is the plan's maximum travel distance, capped at 50 km. Activities of the same category share their places. The tags come from the category on the server and are never sent to the browser. Places are only shown here; the schedule (a later feature) chooses one per activity.
- **No place found**: an activity without a place shows "✗ No place found within 30 km." with **Remove** (takes it out of the plan without asking the services again; the other activities stay checked) and **Change activity** (opens Activity selection on that activity). It is never removed automatically.
- **Rules** (decided on the server): an hour suits an Outdoor activity when its temperature, rain and wind are within the activity's limits (a value equal to a limit is accepted) and, if the activity requires daylight, the whole hour is between sunrise and sunset. Indoor activities are judged only on daylight. Values are rounded to one decimal place before they are compared, the same as shown. One forecast for the plan's location is used for every activity.
- **Planning hours**: only the hours from 06:00 to 22:00 of each date are planned; on today's date, hours that have already started are left out.
- **Reuse and freshness**: a forecast is reused for the same location for up to 30 minutes, and each category's places for the same location, radius and tags for up to 24 hours. The page shows when each was received ("Forecast updated at 14:05", "Places updated at 09:30"; for places, the oldest time when categories were received at different times). Neither is kept in the browser or saved.
- **Settings**: `appsettings.json` has a `Forecast` section with `MaxAgeMinutes` (30), `FirstHour` (6) and `LastHour` (22), checked when the API starts (`FirstHour` at least 4, so no planning hour falls on the clock change, and `LastHour` at most 23). A `Places` section has `MaxRadiusKm` (50, from 1 to 200), `MaxPlacesPerActivity` (5, from 1 to 20) and `MaxAgeHours` (24, at least 1), also checked at start. They can be changed without a code change, for example `$env:Forecast__MaxAgeMinutes = "10"` or `$env:Places__MaxRadiusKm = "20"`.
- **Request limit**: forecast and place requests share the `RateLimiting:PlanSetup` limit with location searches and plan setup checks (30 per minute per network address together). Each opening of step 3 is two requests.
- **When something fails**: the forecast and the places fail and are retried separately. The forecast shows "Error: The weather service is unavailable. No forecast is shown." and the places "Error: The map data service is unavailable. No places are shown."; either can also show "Error: Too many requests. Wait a minute and try again." or "Error: Something went wrong. Try again.". Each has its own **Retry**, which keeps the rest of the step and shows "Getting the forecast…" or "Getting nearby places…". Without the places, every place shows "Not available" and no activity is flagged; without the forecast, every date cell shows "Not available". The places succeed or fail as a whole, so no partial or old places are shown. Each weather or map data service failure is logged as a warning with its kind, never the position, dates or tags.
- **Plan out of date**: the server checks the setup and activities again before asking for the forecast or the places. If a date has passed or an activity's category changed, the user is sent back to step 1 or 2, which shows "Your plan setup needs to be checked again. Select Continue." or "Your activities need to be checked again. Select Continue." until the next successful Continue.
- **Who can use it**: visitors (no account needed) and Active Registered Users. An Administrator sees "Access denied" and a Suspended user opens the Account Suspended page; the API refuses both with `403` before contacting any outside service.

These features need no migration. Running them needs internet access from the API host (see Deployment notes); the automated tests never call Open-Meteo or Overpass. The manual checks for a release are in `specs/006-hourly-forecast/quickstart.md` and `specs/007-nearby-places/quickstart.md`.

## Deployment notes

- **Behind a reverse proxy**: the plan setup request limit counts requests per client network address. Behind a reverse proxy every request arrives from the proxy's address, so all users would share one limit. Configure the ASP.NET Core forwarded-headers middleware for the trusted proxy before going live.
- **Outgoing access**: the API host needs outgoing HTTPS access to `geocoding-api.open-meteo.com` (location search), `api.open-meteo.com` (forecast) and `overpass-api.de` (nearby places).
- **Forecast and places cache**: forecasts are kept in the API's memory for up to `Forecast:MaxAgeMinutes`, and places for up to `Places:MaxAgeHours`. With more than one API instance each keeps its own copy, which only means a few more calls to Open-Meteo and Overpass. The public Overpass service gives each address only a few requests at a time, so a busy deployment may need its own Overpass instance.
- **Time zone data**: the date limits use the `Europe/Vilnius` time zone, so the API host needs time zone data. Slim Linux container images need the `tzdata` package; Windows needs ICU, so do not turn on invariant globalization mode.

## Development workflow

Every feature is developed in its own branch (for example `001-user-registration`), follows the Spec Kit steps (specification, clarification, plan, tasks, analysis, implementation), and is merged into `main` through a Pull Request. Commit messages follow Conventional Commits.