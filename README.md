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

   Run it again after pulling a feature that adds a migration. Feature 003 adds `AddActivityCategories`, which creates the `ActivityCategories` table and inserts the five starter categories. Features 004 to 009 add no migration. Feature 010 adds `AddSavedPlans`, which creates the `SavedPlans` and `GeneratedSchedules` tables. Feature 011 adds `AddSavedPlanCreatedAt`, which adds the `CreatedAtUtc` column to `SavedPlans` and fills it from each plan's saved time. Features 012 and 014 add no migration.

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

#### Map data server

Nearby places (step 3) and schedules come from an OpenStreetMap Overpass API server. Which server, and how long the API waits for it, are settings in the `MapData` section of `appsettings.json`:

| Setting | Environment variable | Default | Allowed values |
|---|---|---|---|
| `MapData:MainServer` | `MapData__MainServer` | `https://overpass-api.de/` | An absolute `https` address; `http` only in the Development environment |
| `MapData:MainTimeoutSeconds` | `MapData__MainTimeoutSeconds` | `6` | A whole number from 1 to 8 |
| `MapData:FallbackServer` | `MapData__FallbackServer` | empty (no fallback) | Empty, or an address with the same rules, different from the main server |
| `MapData:FallbackTimeoutSeconds` | `MapData__FallbackTimeoutSeconds` | `6` | A whole number from 1 to 8 |

- An address is the server's root. The API sends its queries to `<address>api/interpreter`, and a missing trailing `/` is added.
- Plain `http` is accepted only when the API runs in the Development environment (the `https` launch profile sets it). This is for a local copy of the map data service.
- A wrong setting stops the API at start-up with a message that names the setting, for example `MapData:MainTimeoutSeconds must be 1 to 8.`. The message never repeats the value, so an address with a user name or password in it is not printed.
- Put local values in environment variables in the terminal that runs the API (for example `$env:MapData__MainServer = "http://127.0.0.1:12345/"`), never in a committed file.
- **Fallback**: when `MapData:FallbackServer` is set and the main server fails (no answer in time, no connection, an error status or an answer that cannot be read), the same request is sent to the fallback once, within the same page request, before any error is shown. An answer from the main server, even one without places, is used as it is. The page does not say which server answered, and places from either server are reused the same way. Each failed attempt is logged as a warning that ends with "on the main server" or "on the fallback server", never with the address, the position or the tags. A cancelled request is not sent to the fallback.
- **Time limit**: a place or schedule request ends within 9 seconds of the API starting to work on it (routing, the request limit and sign-in checks before that take milliseconds), so the page shows the places or the map data error before its own 10-second limit. The location lookup and the forecast count towards the 9 seconds. Each map data attempt gets its waiting time or what is left of the 9 seconds, whichever is shorter, and a server is not contacted with less than 1 second left; the API then answers with the map data error and logs the warning "Map data service not contacted: no time left for the main server" (or "fallback server"). With the defaults, a main server that answers after 5 seconds is still used.

#### Running the API on Windows 10

Windows 10 cannot make TLS 1.3 connections. In November 2026 `overpass-api.de` (nearby places, step 3) accepted only TLS 1.3, so an API started with `dotnet run` on Windows 10 showed "Error: The map data service is unavailable. No places are shown." on Places and forecast, and no schedule could be generated. On 2026-11-25 the server accepted TLS 1.2 again, so `dotnet run` on Windows 10 can reach it. This affects only the machine that runs the API: users' browsers never contact Overpass. Windows 11, macOS and Linux are not affected.

To check whether the server still accepts TLS 1.2, run this in PowerShell:

```powershell
curl.exe -sS -o NUL -w "%{http_code}`n" --tlsv1.2 --tls-max 1.2 https://overpass-api.de/api/status
```

Any HTTP status code, even an error such as `406` or `502`, means TLS 1.2 works. `curl: (35) ... SEC_E_ALGORITHM_MISMATCH` means the server accepts only TLS 1.3 again. In that case there are two ways around it on Windows 10:

- Use the [local map data copy](#local-map-data-copy) as the map data server. The API reaches it over plain `http`, so no TLS 1.3 is needed and `dotnet run` works as in step 4.
- Or run the API in a Linux container (Linux .NET uses OpenSSL, which supports TLS 1.3). Keep the database and the frontend as above, and replace step 4 with:

1. Export the development certificate once, with a password of your choice, to a folder outside the repository:

   ```powershell
   dotnet dev-certs https -ep "$HOME\.aspnet\https\aspnetapp.pfx" -p "<certificate-password>"
   ```

2. Start the API in a container on the same address, `https://localhost:7254` (from the repository root; `host.docker.internal` is how the container reaches the database on your machine). The source is copied into the container, so your Windows `bin` and `obj` folders are not touched:

   ```powershell
   docker run -d --name speklaiku-api-linux -p 7254:7254 `
     -v "${PWD}\backend\src\SpekLaiku.Api:/repo/SpekLaiku.Api:ro" `
     -v "${PWD}\.editorconfig:/repo/.editorconfig:ro" `
     -v "$HOME\.aspnet\https:/https:ro" `
     -e ASPNETCORE_ENVIRONMENT=Development `
     -e ASPNETCORE_URLS=https://+:7254 `
     -e ASPNETCORE_Kestrel__Certificates__Default__Path=/https/aspnetapp.pfx `
     -e "ASPNETCORE_Kestrel__Certificates__Default__Password=<certificate-password>" `
     -e "ConnectionStrings__DefaultConnection=Host=host.docker.internal;Port=5432;Database=speklaiku;Username=<local-user>;Password=<local-password>" `
     mcr.microsoft.com/dotnet/sdk:10.0 `
     sh -c "mkdir -p /app/SpekLaiku.Api && cp /repo/.editorconfig /app/ && cd /repo/SpekLaiku.Api && tar --exclude=./bin --exclude=./obj -cf - . | tar -xf - -C /app/SpekLaiku.Api && cd /app && dotnet run --project SpekLaiku.Api --no-launch-profile"
   ```

   The first start restores and builds inside the container, which takes a minute or two; `docker logs -f speklaiku-api-linux` shows "Now listening on: https://[::]:7254" when it is ready. After a code change, run `docker restart speklaiku-api-linux` (it copies the source again); stop it with `docker rm -f speklaiku-api-linux`.

   To use the local map data copy from this container, add two lines before the image name: `--network speklaiku-dev` (the copy's Docker network, created by its script) and `-e "MapData__MainServer=http://speklaiku-overpass/"`. Inside that network the copy is reached by its container name, not through `localhost`.

#### Local map data copy

`scripts/local-map-data.ps1` runs a local copy of the Overpass API with the OpenStreetMap data for Lithuania only. Use it for development, and when the public map data servers are down or too slow. The automated tests, CI and the deployed application never use it: the tests keep using fake map data answers.

**Prerequisites**: Docker Desktop (on Windows with WSL 2), running. Run the script from the repository root, in Windows PowerShell 5.1 or PowerShell 7.

```powershell
.\scripts\local-map-data.ps1 start
```

| Command | What it does |
|---|---|
| `start` | The first time: downloads and loads the map data, then starts the copy. Later: starts the existing copy. Ends with "Local map data copy is ready at http://127.0.0.1:12345/" (exit code 0), or with the reason and the copy's last log lines (exit code 1). |
| `status` | Shows `missing`, `loading`, `stopped`, `failed` or `ready`. When ready, it also shows the date of the map data and the memory limit. Exit code 0 only when ready. |
| `stop` | Stops the copy. The loaded data is kept, and the next `start` takes about 10 seconds. |
| `remove` | Removes the copy, its loaded data and its Docker network. The next `start` loads again. |
| `refresh` | `remove`, then `start`: loads the latest Lithuania map data. This is a full first load again. |

**The first load** happens once and is slow. Measured on the development machine (8 GB RAM, 4 cores, Windows 10 Home, Docker Desktop with WSL 2):

| | |
|---|---|
| Download | 214 MB of map data (Geofabrik's Lithuania extract), plus the 423 MB image |
| Disk space | 4.4 GB for the loaded data (Docker volume `speklaiku-overpass-db`) |
| Loading time | about 2 hours; the log prints a line only when a stage (nodes, ways, relations) finishes |
| Peak memory while loading | about 5.1 GB, without a limit |
| Memory while running | at most 2 GB (the container's limit); about 30 MB when idle |

The peak while loading is more than WSL 2 gives Docker by default (half of the computer's memory, about 3.8 GB on an 8 GB machine). With the default, loading stops with "Failed to process planet file" and `status` shows `failed`. Give WSL 2 more memory for the first load only:

1. Create `%UserProfile%\.wslconfig` with these two lines:

   ```ini
   [wsl2]
   memory=6GB
   ```

2. Close Docker Desktop, run `wsl --shutdown`, and start Docker Desktop again.
3. Run `.\scripts\local-map-data.ps1 remove` (after a failed load), then `start`. Other programs are slow while it loads.
4. When it is ready, delete `.wslconfig`, run `wsl --shutdown` and start Docker Desktop again. The running copy stays within its 2 GB limit.

**Check that it is ready**: `.\scripts\local-map-data.ps1 status` shows `ready at http://127.0.0.1:12345/`, the map data date and `memory limit 2.0 GB`.

**Use it from the API**: set the map data server in the terminal that runs the API, before step 4 (see [Map data server](#map-data-server); plain `http` works because the `https` launch profile runs in the Development environment):

```powershell
$env:MapData__MainServer = "http://127.0.0.1:12345/"
```

Use `127.0.0.1`, not `localhost`. The copy listens only on IPv4, and on Windows a connection to `localhost` tries IPv6 (`::1`) first; the refused attempt costs about 2 seconds of the waiting time on every request, enough to make a slow first query show the map data error.

To keep the public server as the main one and use the copy only when it fails, set `$env:MapData__FallbackServer = "http://127.0.0.1:12345/"` instead. For the Windows 10 API container, see [Running the API on Windows 10](#running-the-api-on-windows-10).

**The data is a snapshot**: the copy is not updated automatically, and `status` shows the date of its data. Run `refresh` for newer data. The copy listens only on `127.0.0.1`, so other computers on the network cannot reach it.

## Log in and log out

- **Log in page** (`/login`): email and password. An unknown email, a wrong password and a locked account all show the same message, "Error: Incorrect email or password.", so the page never reveals which accounts exist. After login a Suspended user opens the Account Suspended page; everyone else returns to the page they were sent from (`/login?returnTo=...`, only pages inside the application) or opens the home page.
- **Lockout**: 5 wrong passwords in a row lock the account for 15 minutes. During the lock even the correct password is refused. A successful login resets the count.
- **Session**: the sign-in cookie expires 30 minutes after the last request and is renewed when at least half of that time has passed, so a session ends 15 to 30 minutes after the user's last action. A user whose session expired is told so on the Log in page.
- **Log out**: the "Log out" button in the navigation ends the session and opens the home page with "✓ Success: You have logged out."

### Testing an Administrator or Suspended account

An Active Administrator suspends and reactivates Registered User accounts on the User accounts page (see "User accounts" below). Making an account an Administrator, and changing an Administrator account, is still done directly in the database (table `AspNetUsers`), then log in again:

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

## User accounts

- **Page** (`/admin/users`, "Users" in the navigation, after "Categories"): lists the accounts newest registration first, at most 50, with each account's email, role, status and registration date. "Search by email" lists only the accounts whose email contains the text, ignoring letter case; when more than 50 accounts match, the page says so. No password or other sign-in secret is ever shown or sent to the browser.
- **Suspend and reactivate**: only Registered User accounts have a button. **Suspend** asks "Suspend <email>? They will lose access until reactivated." first; **Reactivate** needs no confirmation. A suspension applies on the user's next request, without them logging out: features that need an active account send them to the Account Suspended page. Their saved plans are kept, and after a reactivation they have the same access and plans as before.
- **Administrator accounts**, including your own, cannot be suspended or reactivated here (the API answers `409`). Promote, suspend or restore them with the SQL in "Testing an Administrator or Suspended account".
- **Log**: each change writes one Information entry, for example `Account <id> suspended by administrator <id>.`, with the two account ids and no email.
- **Who can open it**: only a signed-in Active Administrator, with the same rules as Activity categories (Log in, "Access denied", Account Suspended). The API refuses everyone else with `401` or `403` and no account data.

Feature 014 adds no migration. Deleting accounts is not part of it. The manual checks for a release are in `specs/014-admin-accounts/quickstart.md`.

## Plan setup

- **Pages**: **Plan setup** (`/plan/setup`, "Create plan" in the navigation and on Home) is step 1 of a plan: choose a location in Lithuania from the search suggestions, add 1 to 7 dates from today to today plus 6 days (by the date in Lithuania), and set a maximum travel distance (a whole number from 1 to 200 km, 30 by default). **Continue** checks everything on the server and opens **Activity selection** (`/plan/activities`).
- **Who can use it**: visitors (no account needed) and Active Registered Users. An Administrator sees "Access denied" and a Suspended user opens the Account Suspended page; the API refuses both with `403`.
- **Where the setup is kept**: only in the browser tab (session storage). It survives a reload and logging in or registering in the same tab, and is gone when the tab closes or the user logs out. It is stored in an account only when the finished schedule is saved (see "Saved plans").
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
- **Where the activities are kept**: only in the browser tab (session storage), next to the plan setup. They survive a reload and logging in or registering in the same tab, stay when the setup changes, and are gone when the tab closes or the user logs out. They are stored in an account only when the finished schedule is saved (see "Saved plans").
- **Who can use it**: visitors (no account needed) and Active Registered Users. An Administrator sees "Access denied" and a Suspended user opens the Account Suspended page; the API refuses both with `403`.

This feature needs no migration. The manual checks for a release are in `specs/005-activity-selection/quickstart.md`.

## Places and forecast

- **Page**: **Places and forecast** (`/plan/places`) is step 3 of a plan. It asks for the hourly forecast (Open-Meteo) and the nearby places (OpenStreetMap Overpass API) together, shows "Getting the forecast and nearby places…" until both have answered, and then shows everything at once:
  - **Plan overview**: a table with a row per activity, its nearest place, and one column per date with that date's sunrise and sunset in the heading. Each cell shows the date's longest suitable period ("★ 10:00–14:00 (4 h)", with ", too short" when it is shorter than the activity), "✗ None" or "No hours left". On phones each row is a card.
  - **Each activity**: its places, one line with its settings, its forecast summary, and **Show forecast details**, closed at first. The details list each date's suitable periods ("★ Suitable 10:00–14:00 (4 h)"), and **Show hours** opens a table of that date's hours with temperature, rain, wind, daylight and "★ Suitable" or "✗ Unsuitable" with every reason, for example "Too windy: 9.0 m/s, maximum 8.0 m/s".
- **Places**: for each activity, at most 5 named places that have one of its category's map place tags, nearest to the plan's location first. Each shows its distance ("3.4 km away"), its town when the map data has one, and **View on map**, which opens it on OpenStreetMap in a new tab. The search radius is the plan's maximum travel distance, capped at 50 km. Activities of the same category share their places. The tags come from the category on the server and are never sent to the browser. The schedule then chooses one of them per activity (see "Schedule overview" below).
- **No place found**: an activity without a place shows "✗ No place found within 30 km." with **Remove** (takes it out of the plan without asking the services again; the other activities stay checked) and **Change activity** (opens Activity selection on that activity). It is never removed automatically.
- **Rules** (decided on the server): an hour suits an Outdoor activity when its temperature, rain and wind are within the activity's limits (a value equal to a limit is accepted) and, if the activity requires daylight, the whole hour is between sunrise and sunset. Indoor activities are judged only on daylight. Values are rounded to one decimal place before they are compared, the same as shown. One forecast for the plan's location is used for every activity.
- **Planning hours**: only the hours from 06:00 to 22:00 of each date are planned; on today's date, hours that have already started are left out.
- **Reuse and freshness**: a forecast is reused for the same location for up to 30 minutes, and each category's places for the same location, radius and tags for up to 24 hours. The page shows when each was received ("Forecast updated at 14:05", "Places updated at 09:30"; for places, the oldest time when categories were received at different times). Neither is kept in the browser or saved.
- **Settings**: `appsettings.json` has a `Forecast` section with `MaxAgeMinutes` (30), `FirstHour` (6) and `LastHour` (22), checked when the API starts (`FirstHour` at least 4, so no planning hour falls on the clock change, and `LastHour` at most 23). A `Places` section has `MaxRadiusKm` (50, from 1 to 200), `MaxPlacesPerActivity` (5, from 1 to 20) and `MaxAgeHours` (24, at least 1), also checked at start. They can be changed without a code change, for example `$env:Forecast__MaxAgeMinutes = "10"` or `$env:Places__MaxRadiusKm = "20"`.
- **Request limit**: forecast and place requests share the `RateLimiting:PlanSetup` limit with location searches and plan setup checks (30 per minute per network address together). Each opening of step 3 is two requests.
- **When something fails**: the forecast and the places fail and are retried separately. The forecast shows "Error: The weather service is unavailable. No forecast is shown." and the places "Error: The map data service is unavailable. No places are shown."; either can also show "Error: Too many requests. Wait a minute and try again." or "Error: Something went wrong. Try again.". Each has its own **Retry**, which keeps the rest of the step and shows "Getting the forecast…" or "Getting nearby places…". Without the places, every place shows "Not available" and no activity is flagged; without the forecast, every date cell shows "Not available". The places error appears only after the main map data server and, when one is configured, the fallback server have both failed (see [Map data server](#map-data-server)). The places succeed or fail as a whole, so no partial or old places are shown. Each weather or map data service failure is logged as a warning with its kind, never the position, dates or tags.
- **Plan out of date**: the server checks the setup and activities again before asking for the forecast or the places. If a date has passed or an activity's category changed, the user is sent back to step 1 or 2, which shows "Your plan setup needs to be checked again. Select Continue." or "Your activities need to be checked again. Select Continue." until the next successful Continue.
- **Who can use it**: visitors (no account needed) and Active Registered Users. An Administrator sees "Access denied" and a Suspended user opens the Account Suspended page; the API refuses both with `403` before contacting any outside service.

These features need no migration. Running them needs internet access from the API host (see Deployment notes); the automated tests never call Open-Meteo or Overpass. The manual checks for a release are in `specs/006-hourly-forecast/quickstart.md` and `specs/007-nearby-places/quickstart.md`.

## Schedule overview

- **Page**: **Generate schedule** on Places and forecast (enabled once the forecast and the places have loaded) opens **Schedule overview** (`/plan/schedule`), step 4 of a plan. It shows "Generating your schedule…", then the activities grouped by date in date order and, within a date, by start time. Each entry shows its time, the activity, its place with the distance from the plan's location, the weather at the start ("Weather does not affect this indoor activity." for Indoor activities) and its travel.
- **Scheduling** (decided on the server, from the same forecast and places as step 3): activities are taken in plan order, and each one gets the longest suitable period on any date that does not overlap an activity already scheduled; the whole period is its time slot. Activities that cannot be placed are listed under **Could not be scheduled** with "No place found" or "No suitable time found"; none is dropped.
- **Travel distance**: within each date, each activity after the first shows "Travel: 4.2 km from <previous place>", the straight-line distance from the previous activity's place, rounded to 0.1 km; the first one shows "Travel: Start of the day". Dates are not linked, and there is no trip from the plan's location. When an activity's nearest place is farther than the plan's maximum travel distance from the previous place, the first of its other listed places that is within the maximum is used. When none is, it keeps its nearest place and the trip is marked "Travel: ✗ 42.0 km from <previous place>, more than your 30 km limit". The top of the page then says "✓ All trips within your 30 km limit." or "✗ 1 trip longer than your 30 km limit." (only when a date has two or more activities). A trip exactly at the limit is within it. Times never move because of travel, and travel time is not taken into account. The maximum is changed on Plan setup.
- **Kept only on the page**: the schedule exists only while the page is open, unless it is saved (see "Saved plans"). Leaving it (Back or the progress bar) clears it, and **Generate schedule** makes a new one. The one exception is **Save plan** as a visitor: the schedule is kept in the tab while the visitor logs in or registers, and shown again afterwards.
- **Requests and failures**: each generation is one request that counts toward the shared `RateLimiting:PlanSetup` limit. It uses the cached forecast and places when they are still fresh. Failures show the same messages as step 3 ("Error: The weather service is unavailable.", "Error: The map data service is unavailable. No places are shown.", "Error: Too many requests. Wait a minute and try again." or "Error: Something went wrong. Try again.") with **Retry**, and an out-of-date plan sends the user back to step 1 or 2.
- **Who can use it**: visitors (no account needed) and Active Registered Users. An Administrator or a Suspended user is refused with `403`, as in step 3.

This feature needs no migration. The manual checks for a release are in `specs/008-generate-schedule/quickstart.md` and `specs/009-travel-distance/quickstart.md`.

## Saved plans

- **Saving**: on the Schedule overview, an Active Registered User selects **Save plan**, enters a name (required, at most 80 characters after removing spaces at either end; names need not be unique) and selects **Save**. "✓ Success: Plan saved." links to My plans. Nothing is offered when no activity could be scheduled.
- **Exactly what was shown**: each generated schedule is kept on the server for 30 minutes, and Save sends only its id and the name, never the schedule itself. A schedule older than 30 minutes shows "Generate the schedule again to save it." with **Generate again**, which keeps the entered name. Saving the same schedule twice, for example with a double click or Retry, stores one plan.
- **Visitors**: **Save plan** says "Log in or register to save this plan." and opens Log in. After logging in, or after **Create an account** on that page and registering, the same schedule is shown again and can be saved. A session that ends while saving does the same, with "Your session has expired. Log in again.".
- **My plans** (`/plans`, "My plans" in the navigation): the user's plans, newest first, with location, dates and saved time (Lithuanian time) and **Open**. A table on wide screens, cards on phones. **Home** shows the five most recent with **All my plans**.
- **A plan's page** (`/plans/<id>`): the plan as it was saved (location, dates, maximum travel distance, saved time and the schedule in the Schedule overview's layout), with the note that the forecast may have changed since. Its actions are **Edit plan**, **Recalculate**, **Rename**, **Duplicate** and **Delete**.
- **Plan check**: opening a plan and selecting **Recalculate** check it against the latest forecast (at most 30 minutes old), in the **Plan check** section above the schedule.
  - **Rules**: each activity's own saved weather limits (wind, rain, too cold, too warm), a missing forecast hour, starting before sunrise or ending after sunset when it requires daylight, overlapping another activity, and a trip from the previous place longer than the plan's maximum. Each problem is listed with its reason, for example "Wind up to 9 m/s at 11:00, more than your limit of 8 m/s.", links to its schedule entry, and the entry shows "✗ Problem". Without problems the section says "✓ No problems found. Your plan fits the current forecast.".
  - **Past activities**: activities that have started show "Already past. Not checked." with their saved weather. A plan whose activities have all started is not checked and the weather service is not asked; it shows "This plan's dates have passed. It is not checked against the forecast.".
  - **Never saved**: the check never changes the saved plan, its weather, name or saved time. The latest weather is shown only on the page, with "Checked against the forecast updated at HH:MM.".
  - **Failures**: a weather failure shows "Error: The forecast could not be updated. Your saved plan is unchanged." with **Retry**, and the plan stays on screen exactly as saved. Checks count toward the shared limit of 30 requests per minute ("Error: Too many requests. Wait a minute and try again.").
- **Delete**: on My plans or a plan's page, **Delete** asks "Delete '<name>'? This cannot be undone." with **Delete** and **Cancel** (or Escape). Deleting is permanent; "Plan deleted." is shown and the plan's address then shows "This plan no longer exists.".
- **Duplicate**: on My plans or a plan's page, **Duplicate** makes a separate copy named "Copy of <name>" (cut to 80 characters), with the same schedule and the original's saved time, listed directly above the original. From the plan page, the copy's page opens.
- **Rename**: on a plan's page, **Rename** changes only the name; the schedule and the saved time stay as they are.
- **Edit plan**: on a plan's page, **Edit plan** opens Plan setup with the plan's location, dates, maximum travel distance and activities. Every step shows "Editing '<name>'. Your saved plan is not changed until you save." with **Cancel editing**. After generating the schedule again (with the latest forecast), **Save changes** replaces the plan, keeping its address; to keep the original, duplicate it first. If the tab holds a plan that is not saved, **Edit plan** asks before replacing it. A plan deleted while being edited can be saved as a new plan instead.
- **Private**: only the plan's owner can list, open, edit, rename, duplicate or delete it. A Visitor is sent to Log in, an Administrator sees "Access denied" and a Suspended user opens the Account Suspended page; the API refuses them with `401` or `403` and reads the account on every request. Another user's plan answers `403` with no plan data, and a plan that does not exist shows "This plan no longer exists.". A plan keeps the activity names it was saved with, even if a category is renamed later.

Feature 010 adds the migration `AddSavedPlans` and feature 011 the migration `AddSavedPlanCreatedAt` (see "Run the application"). Feature 012 adds no migration. The manual checks for a release are in `specs/010-save-view-plans/quickstart.md`, `specs/011-plan-management/quickstart.md` and `specs/012-plan-problems/quickstart.md`.

## Deployment notes

- **Behind a reverse proxy**: the plan setup request limit counts requests per client network address. Behind a reverse proxy every request arrives from the proxy's address, so all users would share one limit. Configure the ASP.NET Core forwarded-headers middleware for the trusted proxy before going live.
- **Outgoing access**: the API host needs outgoing HTTPS access to `geocoding-api.open-meteo.com` (location search), `api.open-meteo.com` (forecast) and `overpass-api.de` (nearby places). The map data server can be changed with `MapData:MainServer`, and a second one added with `MapData:FallbackServer` (see [Map data server](#map-data-server)); the API host then needs access to those instead. `overpass-api.de` accepted only TLS 1.3 for a time in November 2026 and accepted TLS 1.2 again on 2026-11-25. Prefer a host whose operating system supports TLS 1.3: Linux (the Linux .NET images), Windows Server 2022 or later, or Windows 11. Windows 10 and Windows Server 2019 reach it only while it accepts TLS 1.2 (see "Running the API on Windows 10").
- **Forecast and places cache**: forecasts are kept in the API's memory for up to `Forecast:MaxAgeMinutes`, and places for up to `Places:MaxAgeHours`. With more than one API instance each keeps its own copy, which only means a few more calls to Open-Meteo and Overpass. The public Overpass service gives each address only a few requests at a time, so a busy deployment may need its own Overpass instance, set as `MapData:MainServer`, with the public service as `MapData:FallbackServer` if wanted.
- **Generated schedules**: each generated schedule is kept for 30 minutes in the `GeneratedSchedules` table so it can be saved; expired rows are deleted when the next schedule is generated, so no cleanup job is needed. Because they are in the database, saving also works with more than one API instance and after a restart.
- **Time zone data**: the date limits use the `Europe/Vilnius` time zone, so the API host needs time zone data. Slim Linux container images need the `tzdata` package; Windows needs ICU, so do not turn on invariant globalization mode.

## Development workflow

Every feature is developed in its own branch (for example `001-user-registration`), follows the Spec Kit steps (specification, clarification, plan, tasks, analysis, implementation), and is merged into `main` through a Pull Request. Commit messages follow Conventional Commits.