# Research: Activity Selection and Limits

Decisions for feature 005. Each section names the spec requirements it serves.

## 1. Categories for planning (spec FR-002, FR-003)

- **Decision**: A new endpoint, `GET /api/plan-activities/categories`, for Visitors and Active Registered Users. It returns every category in the existing order (`ActivityCategoryService.ListAsync`, ordered by normalized name) as `PlanCategoryResponse`: id, name, type, default duration, daylight setting and the four weather limits (`null` for Indoor). It leaves out `placeTags` and `version`. The response also carries `maxActivities` (10, from `PlanActivityValidator.MaxActivities`), which the page uses to disable Add. The limit is a business rule, so it lives only on the server (constitution I, analysis finding C1), as `maxDates` does in feature 004.
- **Rationale**: The admin endpoint `GET /api/admin/categories` is limited to Active Administrators (feature 003 FR-016) and returns the map place tags and the edit version, which planners must not get (spec FR-003, User Story 6 scenario 4). A separate response type makes leaving them out a compile-time fact rather than a filter that could be forgotten. Reusing `ListAsync` keeps one query and one ordering rule (constitution I).
- **Alternatives considered**:
  - Opening the admin endpoint to planners and hiding tags in the browser: refused, because hiding a field in the browser is not access control (constitution IV).
  - Adding an optional "without tags" switch to the admin endpoint: mixes two access rules in one action.

## 2. Where the plan's activities live (spec FR-019)

- **Decision**: A new Zustand store, `usePlanActivitiesStore`, persisted to `sessionStorage` under `spek-laiku-plan-activities` (version 1) with the same `persist` set-up as `usePlanSetupStore`. It holds the activities as typed and the last checked activities. `useLogoutStore` clears it next to the plan setup store.
- **Rationale**: The spec keeps the activities with the setup for the tab session and clears both on logout (feature 004 research section 7). A separate store keeps each file to one responsibility and under about 200 lines, and lets changing the setup leave the activities alone (spec FR-019) without extra code. `sessionStorage` survives a reload and a login in the same tab and is gone when the tab closes.
- **Alternatives considered**:
  - Adding the activities to `usePlanSetupStore`: one store with two steps' rules, and every setup change would have to take care not to touch the activities.
  - Keeping activities on the server: the spec stores nothing (feature 010 saves plans), and a server copy would need its own identity and clean-up.

## 3. Identity and names of repeated activities (spec FR-005, FR-009, Clarifications)

- **Decision**:
  - Each activity gets a browser-only id from `crypto.randomUUID()` when it is added. React lists use it as the key, field ids use it (`activity-<id>-durationHours`), and focus after Remove finds the next activity by it.
  - The shown name is worked out when rendering by `helpers/planActivityNames.ts`: the category name when the category appears once, otherwise "<name> <n>" by order of adding among that category's activities. It is never stored, so the numbers follow the remaining activities after a removal.
  - The server never sees the id. It answers per position (`activities[i]`), and the check store turns positions back into ids with the list it sent (section 6).
- **Rationale**: Two activities of the same category must be told apart without a server id, and the numbers must change when one is removed (spec FR-005). A derived name cannot get out of step with the list. `crypto.randomUUID()` is built into every supported browser in a secure context (localhost and HTTPS) and into Node for the tests, so no package is needed.
- **Alternatives considered**:
  - Storing the number with the activity: it would need renumbering on every removal.
  - Using the list position as the id: positions move on removal, so focus, keys and errors would jump to the wrong activity.

## 4. Check request and validation (spec FR-011 to FR-013)

- **Decision**:
  - `POST /api/plan-activities/check` with `{ "activities": [ { "categoryId", "type", "durationHours", "requiresDaylight", "maxWindMs", "maxRainMmPerHour", "minTemperatureC", "maxTemperatureC" } ] }`. `type` is the type the activity was added with; the four limits are `decimal?` and `null` for Indoor.
  - `PlanActivityValidator` (static) checks in this order and reports every problem together:
    1. `activities` missing or empty gives "Add at least one activity."; more than `MaxActivities = 10` gives "You can add up to 10 activities.". Either one stops the check: no per-activity checks and no database query.
    2. Per activity, a category id that is not stored gives `activities[i]` "This activity is no longer available. Remove it.", and a `type` that differs from the stored category's type gives `activities[i]` "This activity's category has changed. Remove it and add it again.". Either one skips that activity's field checks.
    3. Otherwise `activities[i].durationHours` uses `ActivityLimitRules.CheckDuration`, and for an Outdoor category `activities[i].maxWindMs`, `.maxRainMmPerHour`, `.minTemperatureC` and `.maxTemperatureC` use the other `ActivityLimitRules` methods, including `CheckTemperatureOrder` when both temperatures are valid on their own. For Indoor the limits are ignored and returned as `null`.
  - The rules are exactly feature 003's: `ActivityLimitRules` was written to be shared with Form 4 (its summary says so).
- **Rationale**: Sending the type the activity was added with lets the server tell "the category changed" apart from "the user left a limit empty" (spec FR-012, User Story 2 scenario 8). Without it, a missing limit would look like a type change. Reusing `ActivityLimitRules` keeps one copy of every range and message (constitution I). Stopping after a count error keeps a 1000-item request from causing 1000 checks or a large query.
- **Alternatives considered**:
  - Inferring the type from which limits are present: confuses an empty field with a type change.
  - Accepting the category's name and type from the request: the spec forbids it (FR-012), and the name could be invented.

## 5. Category lookup on Continue (spec FR-012, FR-016)

- **Decision**: `PlanActivityService.CheckAsync` reads all requested categories in one query (`Where(category => ids.Contains(category.Id))`, `AsNoTracking`, only the columns needed). It runs the validator with that dictionary and returns `CheckedPlanActivity` records with the stored name and type and the plan's own values, in request order.
- **Rationale**: At most 10 ids per request, so one small query is enough. The name shown on step 3 is the category's current one (edge case "renamed category").
- **Alternatives considered**: One query per activity: up to 10 round trips for no benefit.

## 6. Continue, double submit and answers for changed values (spec FR-015, edge cases)

- **Decision**: `usePlanActivitiesCheckStore` follows `usePlanSetupCheckStore` after the review fix in feature 004:
  - `idle | pending | invalid | serverError` status, a 10 s timeout, a second submit ignored while pending, and Retry sending the last request.
  - It watches `usePlanActivitiesStore` while the check runs and drops the answer if the activities changed.
  - On `400` it turns `activities[i]...` keys into errors keyed by the sent activity's id and field; `activities` stays a list-level error.
  - On `200` it calls `setChecked(activities)` with the server's list matched to the sent ids, and the page goes to step 3.
  - On `403` it refreshes the current user, so the guard shows the right page.
- **Rationale**: The same behaviour as Continue on step 1, which users and tests already know. Keying errors by id keeps them on the right activity even after the user removes another one.
- **Alternatives considered**: Disabling all fields while checking: the spec only disables Continue, and step 1 does the same.

## 7. Step 3, first version (spec FR-016 to FR-018, Clarifications)

- **Decision**: A new page, `PlacesAndForecastPage.tsx`, at `/plan/places`, inside `PlanCreatorOnly`. It shows `<h1>` "Places and forecast", `PlanProgress` at step 3, `PlanSetupSummary`, a new `PlanActivitiesSummary` list and "Back" to `/plan/activities`. Without a checked setup it redirects to `/plan/setup`; without checked activities to `/plan/activities`. `PlanProgress` gets the path `/plan/activities` for step 2, so it becomes a link on step 3.
- **Rationale**: The same pattern feature 004 used for step 2. Features 006 and 007 add content to an existing page.
- **Alternatives considered**: Showing the checked activities on step 2 only: the spec chose a step 3 (Clarifications).

## 8. Access (spec FR-001, FR-002)

- **Decision**: The new `PlanActivitiesController` carries `[Authorize(Policy = AuthorizationPolicies.PlanCreator)]`, the policy from feature 004, so both actions allow anonymous callers and Active Registered Users and refuse everyone else with `403`. Both routes are wrapped in `PlanCreatorOnly` in the browser. **No request limit**: neither action calls an external service.
- **Rationale**: One access rule for every plan endpoint. The feature 004 limit exists to protect the location search service (its research section 14). These actions do at most one small database read; the count check (section 4) bounds the work per request.
- **Alternatives considered**: Adding the actions to the `PlanSetup` request limit: users would lose searches to category loads for no protection gain.

## 9. Frontend fields and checks (spec FR-008, FR-011, FR-014)

- **Decision**:
  - Numbers are typed as text and sent with the existing `helpers/parseDecimal.ts`: empty or not a plain decimal becomes `null`, and the server answers with the field's range message. That is the same as the category form.
  - The page itself checks only "Add at least one activity." before contacting the server, like the empty-location check on step 1.
  - `components/weatherLimitFields.tsx` gets an `idPrefix` prop and a plain `Partial<Record<keyof WeatherLimitValues, string>>` for errors, so the category form and each plan activity use the same four fields. The category form passes `idPrefix="category"`, keeping its ids.
  - Each activity is a `<fieldset>` with a `<legend>` of its shown name: Duration (h), Requires daylight, the weather fields for Outdoor, and Remove.
- **Rationale**: Feature 003 already holds every range on the server and shows the server's messages. Duplicating ranges in the browser would break constitution I. Reusing the weather fields keeps labels and range hints identical to the admin form (Form 4 equals Form 6).
- **Alternatives considered**: Number inputs (`type="number"`): browsers accept commas differently and hide invalid text, so the server could not show the right message (feature 003 research section 6).

## 10. Failures and logging (spec FR-004, FR-015)

- **Decision**: A database failure in either action reaches the existing `ApiExceptionHandler`, which logs it and answers `500`. The page shows "Error: Activity categories could not be loaded." or "Error: Something went wrong. Try again." with Retry. Nothing new is logged: no external service is called.
- **Rationale**: Expected failures are handled in one place (constitution IV).

## 11. Category changes while planning (spec edge cases, Clarifications)

- **Decision**:
  - The page reads the categories once when it opens.
  - An activity keeps the values it was added with, whatever the administrator changes later.
  - On Continue, the server reports an unknown category or a changed type (section 4) and returns the current name for the rest.
  - The browser does not compare its activities with the newly loaded categories.
- **Rationale**: The server is the only judge (constitution IV), and the spec keeps plan values independent of later default changes (project FR-037).

## 12. Dependencies

- **Decision**: No new NuGet or npm package. `crypto.randomUUID()`, Zustand's `persist`, EF Core, AutoMapper and the test libraries are already available.
