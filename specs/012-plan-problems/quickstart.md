# Quickstart: 012-plan-problems

**Date**: 2026-11-20 | **Plan**: [plan.md](plan.md) | **Contract**: [contracts/plan-check-api.md](contracts/plan-check-api.md)

This guide proves the feature works. Part 1 runs the automated checks. Part 2 is the manual walkthrough for the Pull Request screenshots and the release check.

## Prerequisites

- The setup in the README ("Setup, run and test"): .NET SDK, Node.js, Docker for PostgreSQL and the integration tests.
- Branch `012-plan-problems`, with `main` merged in. There is no new migration: `dotnet ef database update` is only needed if the local database is older than feature 011.
- For Part 2: the weather service (Open-Meteo) must answer. The map data service (Overpass) is only needed to **create** a plan, not to check it (spec Assumptions). If Overpass is down, use a plan saved earlier, or a duplicate of one.

## Part 1: Automated checks

From `backend/`:

```powershell
dotnet build
dotnet test
dotnet format --verify-no-changes
```

Expected: all tests pass, including the new ones:

| Test class | Proves |
|---|---|
| `PlanWeatherRulesTests` | Each weather rule with the worst value and its first hour; a missing hour; equal to the limit is not a problem; Indoor gets no weather problem; daylight before sunrise, after sunset and both (spec User Story 3, SC-002). |
| `PlanCheckRulesTests` | Started entries are `past`; overlap on the same date only; travel over the limit from the saved trip; a past activity is still the previous place; `ActivityIndex` and the fallback for old plans. |
| `HourSuitabilityRulesTests` (changed) | `Breaches` gives the rule, value and limit, and the feature 006 texts are unchanged. |
| `PlanSchedulerTests` (changed) | Each scheduled entry carries its activity's index, also with a category repeated. |
| `PlanSnapshotJsonTests` (changed) | A stored snapshot without `activityIndex` is still read, with `null`. |
| `PlanCheckMappingTests` | The response has the contract's shape; rules are camelCase; times are `HH:mm`; `CategoryId` and `ActivityIndex` are not sent. |
| `PlanCheckEndpointTests` | The contract body for problems, for no problems, for a partly past plan and for `allPast` (with no weather call). `forecastUpdatedAt` is the time the forecast was received. A second check within 30 minutes reuses the forecast (spec User Story 1, 2, 5). |
| `PlanCheckFailureTests` | A weather failure gives 503 `forecast` (its log is the real client's, covered by `OpenMeteoForecastClientTests`); the check succeeds after recovery; 429 after the limit, with no weather call (spec User Story 4). |
| `PlanCheckAuthorizationTests` | Visitor 401; Administrator and Suspended 403; another user 403 with no plan data; unknown id 404. The weather service is never called for any of them (spec User Story 6, SC-005). |
| `PlanCheckUnchangedTests` | After several checks, the row's `Snapshot`, `SavedAtUtc`, `CreatedAtUtc` and `Name` are identical and the list order is unchanged (spec SC-006). |

From `frontend/`:

```powershell
npm run lint
npm test
npm run build
```

The first `npm test` of a session can fail with "Failed to start forks worker". If it does, run it again before investigating.

Expected: all tests pass, including:

| Test file | Proves |
|---|---|
| `planCheckApi.test.ts` | Every status maps to its answer; any other status throws. |
| `planProblemText.test.ts` | Every reason text of spec User Story 3, and the summary with singular and plural. |
| `usePlanCheckStore.test.ts` | Checking, checked, allPast, each error, Retry, a second check while checking does nothing, a late answer after `reset()` is ignored, timeout. |
| `planCheckSection.test.tsx` | The region and heading; the loading, result, no-problem, all-past and error messages are announced; the problem list order; each link moves focus to its schedule entry. |
| `PlanDetailsPage.test.tsx` (changed) | The five actions in order; Recalculate disabled while checking and not shown for allPast; problem marks, "Already past. Not checked." and the latest weather in the schedule; the note after a check and after a failure; a different `savedAt` loads the plan again. |
| `ScheduleOverviewPage.test.tsx` (unchanged) | The Schedule Overview looks the same without check results. |
| `accessibility.test.tsx`, `keyboard.test.tsx`, `responsive.test.tsx` (changed) | The new section, links and button by keyboard, labelled, with no horizontal scrolling at 320 px and Recalculate full width. |

## Part 2: Manual walkthrough

Start the database, the API and the frontend as in the README ("Run the application"). Sign in as an Active Registered User.

### 1. A plan that still fits (spec User Story 1)

1. Open **My plans** and open a plan whose dates are today or later. If there is none, create one (Plan setup → Activities → Places and forecast → Schedule overview → **Save plan**).
2. The plan appears at once. The "Plan check" section shows "Checking your plan against the latest forecast…", then "✓ No problems found. Your plan fits the current forecast."
3. The note under the saved time reads "Checked against the forecast updated at HH:MM.", and each activity's weather line shows the latest values.

**Screenshot**: the plan page with "No problems found".

### 2. A plan with problems (spec User Stories 1 and 3)

A real forecast rarely changes on demand, so tighten a limit of the saved plan in the **local development database**. This changes only your own test data. Open a shell in the database container (see the README for the container and database names) and run:

```sql
-- Make the first activity's wind limit 0 m/s in the plan named "Problem test".
UPDATE "SavedPlans"
SET "Snapshot" = jsonb_set("Snapshot", '{activities,0,maxWindMs}', '0')
WHERE "Name" = 'Problem test';
```

(Rename one of your test plans to "Problem test" first, and make sure its first activity is Outdoor.)

1. Open that plan. The section shows the summary, for example "1 problem in 1 of 2 scheduled activities.", and the list "<Activity>, <date> <start>–<end>: Wind up to <value> m/s at HH:MM, more than your limit of 0 m/s."
2. The activity's schedule entry shows "✗ Problem" with the same reason.
3. Press Tab to the problem's link and press Enter. Focus moves to the schedule entry.

**Screenshot**: the plan page with a problem listed and the entry marked.

### 3. Recalculate (spec User Story 2)

1. On any plan page, the actions read **Edit plan**, **Recalculate**, **Rename**, **Duplicate**, **Delete**.
2. Select **Recalculate**. The loading message is shown again, and **Recalculate** is disabled until the result is shown.
3. Select it twice quickly: only one request is sent (check the browser's network tab).

### 4. The weather service fails (spec User Story 4)

1. Open a plan page, then cut the API off from the internet:
   - **If the API runs in a Docker container** (as in the README's Windows 10 notes), disconnect the container from its network: `docker network disconnect <network> <api-container>`. `docker inspect <api-container>` shows the network name. The hosts file of Windows has no effect inside the container.
   - **If the API runs directly on Windows**, disconnect the computer from the network.
   
   Then restart the API, or wait 30 minutes, so the cached forecast is not reused.
2. Select **Recalculate**. "Error: The forecast could not be updated. Your saved plan is unchanged." is shown with **Retry**. The weather lines are the saved ones and the note reads "This is your plan as saved on <date>. The forecast may have changed since."
3. Reconnect (`docker network connect <network> <api-container>`, or the computer's network) and select **Retry**. The check result is shown.
4. The API's console log has the forecast failure with its kind and no user name or email.

**Screenshot**: the error state.

### 5. A plan in the past (spec User Story 5)

1. Open a plan whose dates have all passed (keep an old test plan, or set its dates in the past with `jsonb_set` as in step 2).
2. The section reads "This plan's dates have passed. It is not checked against the forecast." and **Recalculate** is not shown. Each entry shows "Already past. Not checked."

### 6. Access (spec User Story 6)

1. Copy a plan's address, log out and open it: you are sent to Log in.
2. Log in as another Registered User and open it: "Access denied".
3. Delete a plan in another tab and select **Recalculate** on its page: "This plan no longer exists." (feature 011).

### 7. Phone and keyboard (spec User Story 7)

1. Narrow the browser to 320 px. The problem cards wrap, **Recalculate** is full width, and the page does not scroll sideways.
2. With a screen reader (NVDA on Windows), open a plan: the loading and the result are announced without focus moving.

**Screenshot**: the plan page with problems at 320 px.

### Clean up

Set any changed test plan back by using **Edit plan** → **Save changes**, or delete it.
