# Research: 012-plan-problems

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-20

The spec has no open questions (Clarifications, session 2026-11-20). This file records the design decisions made while planning. Each section gives the decision, the reason and the alternatives that were rejected.

## 1. Dependencies

**Decision**: No new NuGet or npm package.

**Rationale**: Everything the check needs already exists:

- The forecast and its 30-minute reuse: `WeatherForecastService` (feature 006).
- The planning hours with sunrise and sunset: `PlanningDays`.
- The weather and daylight comparisons: `HourSuitabilityRules`.
- The saved plan and its owner check: `SavedPlanService.GetAsync` (feature 010).
- The request limit: `RateLimitPolicies.PlanSetup` (feature 004).
- The 503 answer and the failure log: `ApiExceptionHandler` and the clients (feature 006).

**Alternatives considered**: None needed.

## 2. One endpoint: `GET /api/plans/{id}/check`

**Decision**: Add a new action `Check` on the existing `PlansController`, at `GET /api/plans/{id}/check`. It has `[EnableRateLimiting(RateLimitPolicies.PlanSetup)]` on the action only. The controller's `ActiveRegisteredUser` policy covers access. Opening the plan page and **Recalculate** both call this endpoint.

**Rationale**:

- The check changes nothing on the server (spec FR-014), so `GET` fits. It repeats safely, and **Retry** can send it again.
- It belongs to one saved plan, so it sits under `/api/plans/{id}` and reuses the controller's policy and its 404 body ("This plan no longer exists.").
- The limit is placed on the action only, so listing, opening, renaming and the other plan actions stay outside the shared limit, as in feature 011.
- `UseRateLimiter` runs before `UseAuthorization` (Program.cs). A refused request therefore never reaches the account lookup or the weather service (spec FR-015).
- `PlansController.cs` is 131 lines and grows by about 15.

**Alternatives considered**:

- **Do the check inside `GET /api/plans/{id}`.** Rejected because the saved plan must appear at once and must still appear when the weather service fails (spec FR-002, FR-013). It would also put every plan opening under the request limit.
- **`POST /api/plans/{id}/checks`.** Rejected because nothing is created or stored (spec Key Entities: "It is not stored").
- **A separate `PlanCheckController`.** Rejected because it would repeat the policy, the 404 body and the route prefix for one action.

## 3. Reading the plan: reuse `SavedPlanService.GetAsync`

**Decision**: The new `PlanCheckService` reads the plan with `SavedPlanService.GetAsync(ownerId, id)`. That method returns the plan (read with `AsNoTracking`), "not found" or "forbidden", and the check service returns early on a refusal.

**Rationale**:

- The owner rule stays in one place, the same one the plan page uses (spec FR-001).
- A refused request ends before the weather service is contacted (spec SC-005).
- The plan is read with `AsNoTracking`, and the check never calls `SaveChangesAsync`. Nothing in the saved plan can therefore change (spec FR-014, SC-006).
- The plan's location, dates, activities, limits, schedule and maximum distance come only from the stored snapshot (spec FR-004). The request has no body.

**Alternatives considered**:

- **`SavedPlanOwnership.FindOwnedAsync`.** Rejected because it loads the plan with tracking, for changes. A read-only check should not hold a tracked entity.

## 4. Finding each scheduled entry's activity

**Problem**: A saved `ScheduledActivity` holds `CategoryId` and `ActivityName`, but not which of the plan's activities it came from. Feature 005 allows the same category more than once, each copy with its own limits (feature 005 FR-005: "Cycling 1", "Cycling 2"). In such a plan, the category id does not say which limits apply to a scheduled entry.

**Decision**:

- Add a new member `int? ActivityIndex = null` to `ScheduledActivity`. It holds the position of the entry's activity in `PlanSnapshot.Activities`.
- `PlanScheduler.Assign` sets it from its loop index. `TravelDistanceRules` copies it through `with`.
- It is stored in the snapshot JSON (`activityIndex`) but not added to `ScheduledActivityResponse`, so the browser never sees it.
- When a stored entry has no index (plans saved before this feature), the check uses the first activity in the plan with the same `CategoryId`. This is exact when the category appears once, or when its copies have the same limits.

**Rationale**:

- The index is the only exact link, and it costs one optional member.
- Adding a member does not break stored plans. `System.Text.Json` fills a missing constructor parameter with its default value, as it already does for `Travel` in plans saved before feature 009. `PlanSnapshotJsonTests` will prove this with a stored plan that has no `activityIndex`.
- No EF Core migration is needed, because the snapshot is a `jsonb` column written through `PlanSnapshotConversion` (data-model.md).

**Known limitation**: A plan saved before feature 012 that repeats a category with different limits is checked against the first copy's limits. Such plans exist only as development data. Editing and saving the plan again (feature 011) stores the index.

**Alternatives considered**:

- **Match by `ActivityName`.** Rejected because repeated activities share the category name on the server. The browser alone adds the numbers.
- **Work out the link again from the schedule.** Rejected because the travel check reorders entries by date and time, so plan order is lost.
- **A data migration that fills the index in old plans.** Rejected because the information cannot be recovered (see above).

## 5. Weather rules: one comparison, two wordings

**Decision**: Split `HourSuitabilityRules`:

- New `HourSuitabilityRules.Breaches(PlanningHour, CheckedPlanActivity)` returns structured breaches (`LimitBreach`: the rule, the hour's value and the limit). It applies only to Outdoor activities and only when the hour has every value.
- `HourSuitabilityRules.Check` builds its existing strings from `Breaches`, so feature 006's texts and tests are unchanged.
- New `PlanWeatherRules` (static) walks the hours of one scheduled entry and, for each broken rule, keeps:
  - **Wind and rain**: the highest value.
  - **Too cold**: the lowest temperature.
  - **Too warm**: the highest temperature.
  - In each case, the first hour that has that value (spec FR-007, User Story 3 scenario 8).
- An Outdoor hour with a missing value gives one "noForecast" problem, at the first such hour (feature 006 FR-012).
- Indoor activities have no weather problems (spec Edge Cases). The existing `ActivityType.Outdoor` test in `HourSuitabilityRules` already decides this.

**Rationale**:

- The comparison (a value equal to its limit meets it; values are the rounded ones that are shown) exists exactly once (constitution I, DRY).
- A plan that was valid when saved has no problem while the forecast is unchanged (spec Assumptions).

**Alternatives considered**:

- **Reuse `HourSuitabilityRules.Check` strings and parse them.** Rejected because parsing text is fragile, and the strings word a different message.
- **A second copy of the comparisons.** Rejected because the two copies could drift apart (constitution I).

## 6. Daylight rule

**Decision**:

- For an activity that requires daylight, the check uses the `Daylight` flag of the latest forecast's planning hours. That flag is already "the hour lies fully between sunrise and sunset" (`PlanningDays`).
- If the first hour of the entry is not in daylight, the problem is `beforeSunrise`, with the entry's start time and the date's sunrise.
- If the last hour is not in daylight, the problem is `afterSunset`, with the end time and the sunset.
- Both can occur on one entry.
- A dark hour counts for the side of the day it is on: before or after the middle of the day (halfway between sunrise and sunset). So a one-hour entry, or one that is dark all through, gets only "beforeSunrise" or only "afterSunset" (added after the code review, tasks.md T069).
- The sunrise and sunset shown are `PlanningDay.Sunrise` and `Sunset` from the latest forecast (spec Edge Cases: the latest times are used).

**Rationale**:

- It is the same rule the scheduler used (feature 006 FR-016), with no new time arithmetic.
- Daylight hours are contiguous, so a non-daylight hour inside an entry is always at its start or its end.

**Alternatives considered**:

- **Compare `StartTime` with `PlanningDay.Sunrise` directly.** Rejected because `Sunrise` is cut to the minute for display. Within the same minute it could disagree with the flag the scheduler used.

## 7. Overlap and travel use the saved schedule

**Decision**:

- **Overlap**: the check compares every entry with the other entries on the same date, past ones included. Entries overlap when `start < otherEnd && otherStart < end`, the test `PlanScheduler` uses. Each overlapping pair gives each checked entry an `overlap` problem with the other activity's name and times.
- **Travel**: the check uses the saved `TravelLeg` of each checked entry. If `OverLimit` is true, the problem is `travel`, with the distance, the previous place and the plan's `Schedule.Travel.MaxDistanceKm` (feature 009).

**Rationale**:

- The places, their positions and the plan's maximum are all saved and never change in a check. The saved distance and over-limit flag are therefore still correct, and working them out again would give the same numbers.
- A past activity still counts as the previous place, as saved (spec User Story 5 scenario 3), and the saved leg already says so.
- Plans saved with a trip over the limit are listed as a problem (spec Edge Cases).

**Alternatives considered**:

- **Recompute the trips with `TravelDistanceRules`.** Rejected because that would choose places again, which changes the plan (spec FR-014; place choice belongs to feature 013).
- **Skip the overlap check because the scheduler never overlaps.** Rejected because spec FR-005 and project FR-033 name it, and feature 013 will change schedules.

## 8. Started activities and the clock

**Decision**:

- `now` comes from `ForecastPeriod.GetNow()`, the only clock the forecast services read, so tests control it.
- An entry has started when its start instant in Lithuanian time (date + start time) is at or before `now`. This is the rule `PlanningDays` uses to leave out hours.
- Started entries are returned as `past` with no weather and no problems (spec FR-006, FR-010).
- When every entry has started, the service returns `allPast` **before** asking for the forecast (spec User Story 5 scenario 2, SC-005).
- The weather service is asked once for the plan's location, through the shared cache (section 9).
- `PlanningDays.Build` is given only the dates of entries that have not started.
- Midnight can pass between reading `now` and the forecast answer. A date the answer does not cover (no daylight entry) has then already started, and its entries are returned as `past`. This avoids the `InvalidOperationException` `PlanningDays` throws for a date without daylight, in the same way as the midnight check in `PlanForecastService`.

**Rationale**: It is the same "started" rule as the forecast, so an hour is never both "left out" and "checked".

**Alternatives considered**:

- **"Ended" instead of "started".** Rejected because the spec says an activity that has started but not ended is not checked (Edge Cases).

## 9. Forecast reuse and the "updated at" time

**Decision**:

- The check uses `WeatherForecastService.GetAsync(plan location)`, which reuses a forecast for the same location for up to `Forecast:MaxAgeMinutes` (30) (spec FR-012).
- The response's `forecastUpdatedAt` is `ForecastPeriod.ToLithuanianMinute(received.ReceivedAt)`. It is the time the forecast was received from the weather service, not the time of the check (spec FR-011, Edge Cases).

**Rationale**:

- The caching and its key (location id + first date) are unchanged.
- Opening several plans for the same location contacts the service once (spec Assumptions).

**Alternatives considered**:

- **Skip the cache for Recalculate.** Rejected because spec FR-012 allows reuse within 30 minutes, and the User Story 2 independent test waits for that time.

## 10. Failures, the request limit and logging

**Decision**: Nothing new on the server.

- **The weather service fails** (any `FailureKind`): `WeatherForecastService` throws `ExternalServiceException`. The client has already logged the time and kind without user data (spec FR-016). `ApiExceptionHandler` answers `503` with `service: "forecast"`.
- **Anything else unexpected**: `500` through the same handler.
- **The request limit**: `429` with "Too many requests. Wait a minute and try again." from `PlanSetupRateLimit`. Nothing is logged, and the weather service is not contacted (spec FR-015).
- **Mapping in the browser**:
  - `503` with `service: "forecast"` → "Error: The forecast could not be updated. Your saved plan is unchanged."
  - `429` → "Error: Too many requests. Wait a minute and try again."
  - Anything else, including the browser's own 10-second timeout and network errors → "Error: Something went wrong. Try again."
- **Timeouts**: a slow weather service is reported by the client as a forecast failure (`503`), which matches spec User Story 4 scenario 1 ("does not answer in time"). The browser timeout (`planRequestTimeoutMs`, 10 s) only fires when the API itself does not answer.

**Rationale**:

- This is the central error handling of constitution IV, reused unchanged.
- A failed check leaves the saved plan on screen with its saved weather and the "as saved on" note (spec FR-013), because the page only changes the view after a successful answer.

## 11. The response carries rule data; the page words it

**Decision**:

- Each problem is sent as a `rule` (`wind`, `rain`, `cold`, `heat`, `noForecast`, `beforeSunrise`, `afterSunset`, `overlap`, `travel`) and the values the reason needs (contracts/plan-check-api.md).
- The browser builds the texts of spec User Story 3 in one helper, `helpers/planProblemText.ts`.
- The summary counts ("2 problems in 1 of 4 scheduled activities.") are also worked out in the browser from the returned entries.

**Rationale**:

- The server makes every decision: started or not, which rules are broken, the worst value and its hour, and over the limit or not.
- The browser only words the answer, as it already does for `travelText`, `scheduleReasonText` and the forecast summaries (feature 006 research section 7). Counting returned items for a sentence is wording, not a business rule.
- The value formatting matches the schedule's weather line (`scheduleWeatherText`): a JSON decimal such as `9.0` reads as `9`, as in the spec example "Wind up to 9 m/s".

**Alternatives considered**:

- **Send finished English sentences from the server.** Rejected because the number formatting and the ✗ marks would then live in two places (schedule view and check), and the frontend tests could not cover the texts next to the other schedule texts.

## 12. Matching the result to the shown schedule

**Decision**:

- The response's `entries` are in the same order as the saved plan's `scheduled` list (date, then start time, as `TravelDistanceRules` stores them). Each entry also repeats `date`, `startTime`, `endTime` and `activityName`.
- The response carries the plan's `savedAt`. If it differs from the `savedAt` of the plan on the page, the plan was replaced by **Save changes** in another tab. The page then loads the plan again, which starts a new check, instead of showing a result for a different schedule (spec Edge Cases: "the check always uses the plan as it is saved now").
- A rename does not change `savedAt` or the schedule, so it needs nothing.

**Rationale**: It is the smallest safe link. An index is enough, and `savedAt` catches the one case where the schedule changed under the page.

**Alternatives considered**:

- **Return the whole plan again with the check.** Rejected because it duplicates `GET /api/plans/{id}` and its mapping.
- **Ignore the mismatch.** Rejected because problems could then be shown on the wrong activities.

## 13. Page flow and state

**Decision**:

- A new Zustand store, `usePlanCheckStore`. Its statuses are `idle`, `checking`, `checked`, `allPast`, `weatherUnavailable`, `tooManyRequests` and `serverError`. Its actions are `check(planId)`, `retry()` and `reset()`.
- It follows `useSavedPlanStore`: one `AbortController`, the 10-second `startTimeout`, and an answer is dropped when the controller has changed.
- `check` does nothing while a check is running (spec FR-003, User Story 2 scenario 3).
- `PlanDetailsPage` starts `load(planId)` and `check(planId)` together when it opens, so the result can arrive as soon as possible (spec SC-001). It resets both stores when it closes, so an answer that arrives after the user has left is ignored (spec FR-003, Edge Cases).
- A **404** from the check means the plan was deleted, perhaps in another tab after the page loaded. The check store calls a new `useSavedPlanStore.markGone()`, which sets the plan store's status to `notFound`, so the page shows "This plan no longer exists." (spec User Story 6 scenario 4). While the plan is still loading, its own 404 gives the same page.
- A **401** refreshes the current user, as the plan store does, so `SignedInOnly` sends the user to Log in. A **403** does the same, so the route guards show Access denied or Account Suspended for the account's new state. The check store then returns to `idle`.

**Rationale**:

- It follows the constitution's Zustand rule and reuses the abort, timeout and stale-answer pattern of the existing stores.
- Starting both requests together keeps opening the plan instant while the forecast is fetched.

**Alternatives considered**:

- **Start the check after the plan has loaded.** Rejected because it adds one round trip to SC-001's 5 seconds for no benefit. The `savedAt` check (section 12) covers the order of the answers.
- **Keep the check in `useSavedPlanStore`.** Rejected because that store would pass 150 lines and hold two responsibilities.

## 14. Showing the result on the page

**Decision**:

- **Plan check section**: a new component, `components/planCheckSection.tsx`. It is a labelled `<section aria-labelledby>` with the heading "Plan check", placed above the schedule.
  - A `role="status"` element holds the loading, result, past-plan and error messages, so they are announced without moving focus (spec FR-018).
  - The problem list is a `<ul>` of cards. Each card shows the activity, its date and time, and the reason, with a link to `#scheduled-entry-<index>`.
- **Schedule entries**: `ScheduleView` and `ScheduledDaySection` take an optional `checks` value, one per scheduled entry with the latest weather, `past` and the problems. When it is given, each entry:
  - gets `id="scheduled-entry-<index>"` and `tabIndex={-1}`;
  - shows the latest weather instead of the saved weather (spec FR-011);
  - shows "✗ Problem" with its reasons, or "Already past. Not checked." (spec FR-010).
  
  The Schedule Overview passes nothing and is unchanged.
- **The note**: `SavedPlanView` shows "Checked against the forecast updated at HH:MM." after a successful check and the "as saved on" note otherwise (spec FR-011, FR-013).
- **Recalculate**: `PlanDetailsActions` gains it between **Edit plan** and **Rename** (spec FR-017). It is disabled while checking and not shown when the result is `allPast`.
- **Following a problem's link**: focus moves to the schedule entry itself (the `<li>` with `tabIndex={-1}`). The entry's accessible name starts with its time and activity name.

**Spec change made during planning**: User Story 7 scenario 2 and FR-018 said focus moves to "that entry's heading". Schedule entries have no heading of their own; the date is the heading (feature 008). Adding one heading per activity would change the Schedule Overview of features 008 to 011. The spec now says focus moves to "that schedule entry".

**Alternatives considered**:

- **A heading per scheduled activity.** Rejected for the reason above.
- **A separate "checked schedule" component.** Rejected because it would duplicate the schedule layout, which feature 010 deliberately shares (feature 010 research section 12).

## 15. Phone layout

**Decision**: Changes to `styles.css` only:

- The problem cards wrap inside the screen.
- **Recalculate** gets its own class, `plan-recalculate`. It takes the full width of `.plan-actions` (`flex-basis: 100%`) below 40em, the breakpoint the stylesheet already uses, and keeps the 44 px `min-height` every button has (spec FR-019). The other plan actions keep their feature 011 wrapping.
- The "✗ Problem" reasons wrap under the entry.
- The existing `responsive.test.tsx` checks cover 320 px.

## 16. Testing approach

**Decision**:

- **Unit tests** cover the pure rule classes with hand-built `PlanningDay` values:
  - `PlanWeatherRules`: every rule, the worst value, the first hour, a missing hour, Indoor.
  - `PlanCheckRules`: started entries, overlap, travel, the old-plan fallback for `ActivityIndex`.
  - `HourSuitabilityRules.Breaches`.
- **Integration tests** seed `SavedPlans` rows directly with a hand-built `PlanSnapshot`, so each test controls the schedule exactly. Then they script `FakeForecastClient` for the plan's position and set `FixedTimeProvider`. This tests every rule against the real endpoint and PostgreSQL, without the map data service.
- **Authorization tests** cover a Visitor, an Administrator, a Suspended user, another user and an unknown id. Each also checks that `FakeForecastClient.Calls` did not change (spec SC-005).
- **SC-006** is tested by reading the row before and after several checks and comparing the snapshot JSON, `SavedAtUtc`, `CreatedAtUtc` and `Name`.

**Rationale**: The tests are deterministic (constitution III) and fast, and they do not need Overpass, whose public servers were down during feature 011's testing.
