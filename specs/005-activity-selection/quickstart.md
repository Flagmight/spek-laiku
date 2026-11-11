# Activity Selection and Limits Quickstart

## Prerequisites

The same as `specs/004-plan-location-dates/quickstart.md`: .NET SDK, PostgreSQL for the application database (the `speklaiku-db` container), Docker (or `SPEKLAIKU_TEST_POSTGRES`) for the integration tests, and installed frontend and backend dependencies. The database must have the feature 003 migration `AddActivityCategories`, which adds the five starter categories. This feature adds **no package** and **no migration** (`data-model.md`).

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

1. Every row of the authorization table in `contracts/plan-activities-api.md`, for both endpoints.
2. Categories for planning: `200` with every category ordered by name, Indoor limits `null`, an empty list when there are none, and no `placeTags` or `version` in the JSON.
3. The check: `200` with the stored name and type in request order, including the same category twice with different settings. Every message in `data-model.md` (Validation rules), with keys in order. The boundaries 0.5 and 12 h, 0 and 30 m/s, 0 and 20 mm/h, and -30 and 45 °C are accepted, and 0.25 h, 12.5 h, 1.25 m/s and min = max are refused. Indoor limits sent in the request are ignored and returned as `null`. An unknown category id, and a type that differs from the stored one, give the `activities[i]` message and skip that activity's field checks. 0 and 11 activities give only the `activities` message, and no category query is run for them. A string where a number belongs and a malformed GUID give the `request` error.
4. Unit tests for `PlanActivityValidator` (with a dictionary of categories), `PlanActivityService` (EF Core in-memory database, as in `ActivityCategoryServiceTests`) and the mapping profile (no tags in `PlanCategoryResponse`).

The frontend tests must cover:

- The Activity selection step states: "Loading activity categories…", the categories in order with type and duration, the categories error with Retry while the activities stay visible, "No activity categories are available yet.", and "No activities added yet. Select at least one category to continue.".
- Add: the defaults filled in, "<name> added." announced, the same category twice shown as "Cycling 1" and "Cycling 2", Indoor without weather fields, and all Add buttons disabled at 10 with "You can add up to 10 activities.".
- Remove: the announcement, focus on the next activity's heading or, with none left, on the "Activity categories" button with the list open again, numbering going back to "Cycling", and adding again starting from the defaults.
- Settings and Continue: "Error: Add at least one activity." without a request; "Checking your activities…" with Continue disabled; field and activity errors from the server shown next to the right activity after another one was removed; the error summary with links and focus on the first invalid field; server error and timeout with Retry; an answer for changed activities not kept.
- Step 3: the setup and activity summary, Back, and the progress links; the redirects without a checked setup or checked activities.
- The activities store kept in `sessionStorage` across a reload and a login, cleared on logout, kept when the setup changes, and unchecked on any change.
- Access: the `PlanCreatorOnly` guard on `/plan/places`.
- Keyboard order, fieldset legends, button names, announcements, page titles and the 320 px layout rules.
- The category form still works with the shared `WeatherLimitFields` (existing tests pass unchanged).

## Manual Validation

Start the database, the API and the frontend as in `README.md`, then open the address Vite prints (usually `http://localhost:5173`).

1. As a Visitor, select **Create plan**, choose a location and a date, and select **Continue**. Activity selection shows the categories (Cycling, Heritage site, Kayaking, Museum, Picnic) and "No activities added yet. Select at least one category to continue."
2. Add **Kayaking**. Its settings show 2 h, Requires daylight checked, 8 m/s, 0.5 mm/h, 15 and 35 °C. Add **Museum**: only Duration and Requires daylight are shown.
3. Add **Cycling** twice. They are shown as "Cycling 1" and "Cycling 2". Change "Cycling 2" to 3 h; "Cycling 1" keeps 2 h. Remove "Cycling 1": the remaining one is shown as "Cycling" with 3 h.
4. Set Kayaking's minimum temperature to `40` and select **Continue**: "Error: Minimum temperature must be lower than maximum temperature." appears next to that field and in the summary. Set it to `18`.
5. Select **Continue**. "Places and forecast" opens with the location, dates, distance and all three activities with their settings. Select **Back**: every activity and setting is still there.
6. Reload the page, then log in as a Registered User in the same tab: the activities are still there. Log out: they are gone.
7. As an Administrator, open `/admin/categories` and change Picnic's minimum temperature. As a Visitor in another browser, add Picnic before that change and continue after it: the activity keeps the value it was added with.
8. As an Administrator, change Museum to Outdoor (with limits). In the Visitor's tab, with Museum added earlier, select **Continue**: "Error: This activity's category has changed. Remove it and add it again." Change Museum back to Indoor afterwards.
9. As an Administrator, open `/plan/activities` and `/plan/places`: both show Access denied. As a Suspended user, both go to Account suspended.
10. Stop the database container and reload Activity selection: "Error: Activity categories could not be loaded." with Retry, and the added activities are still shown. Start the container again and select **Retry**.
11. At 320 px width with the keyboard only, add two activities, change one setting, remove one and continue, without horizontal scrolling.
12. With activities in the plan, reload Activity selection: the category list is closed and **Activity categories** opens it; it stays open after **Add**. Remove every activity: the list opens again with focus on **Activity categories**. As an Administrator, add categories until there are 9: **Search activities** appears, filters by name, shows "No activities match your search." for text that matches nothing, and is empty again each time the list opens.
