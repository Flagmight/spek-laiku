# Data Model: 012-plan-problems

**Date**: 2026-11-20 | **Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

This feature adds **no table, no column and no migration**. A plan check is worked out on each request and never stored (spec Key Entities). The only stored change is one optional member inside the existing `SavedPlans.Snapshot` JSON (`jsonb`), and stored plans without it stay readable.

## Stored data (changed)

### ScheduledActivity (inside `PlanSnapshot.Schedule.Scheduled`, changed)

| Member | Type | Change |
|---|---|---|
| `ActivityIndex` | `int?`, JSON `activityIndex`, default `null` | **New.** The position of this entry's activity in `PlanSnapshot.Activities` (0-based). Set by `PlanScheduler.Assign` from now on, and copied by `TravelDistanceRules` through `with`. Not sent to the browser (`ScheduledActivityResponse` has no such member). |
| `CategoryId`, `ActivityName`, `Date`, `StartTime`, `EndTime`, `Place`, `Weather`, `Travel` | unchanged | Read by the check, never written. |

**Why**: a category can appear more than once in a plan with different limits (feature 005 FR-005), so `CategoryId` alone cannot say which limits apply (research section 4).

**Old plans**: a stored entry without `activityIndex` is read with `null`, the parameter's default. The check then uses the first activity in `Activities` with the same `CategoryId`.

**Where it is written**: in generated schedules (`GeneratedSchedules.Snapshot`, kept 30 minutes) and, through them, in saved plans created or replaced after this feature (feature 010 save, feature 011 Save changes and Duplicate, which copies the snapshot as it is).

**Validation**: when the index is present, the check uses it only if `0 <= index < Activities.Count` and that activity's `CategoryId` equals the entry's. Otherwise it falls back as for old plans. If no activity in the plan has the entry's `CategoryId` at all, the entry is checked as an Indoor activity without limits: no weather or daylight problems, and `IsIndoor` weather. Overlap and travel are still checked. A stored plan can therefore never make the check fail.

### SavedPlan (`SavedPlans` table, unchanged)

The check reads `OwnerId` (through `SavedPlanService.GetAsync`), `SavedAtUtc` and `Snapshot`. It never writes any column (spec FR-014, SC-006). The plan is read with `AsNoTracking` and `SaveChangesAsync` is never called on this path.

## Values worked out per request (not stored)

All of these are plain records in `Services/`. Each one is returned once and then discarded.

### PlanCheck

The result of checking one saved plan (spec Key Entities "Plan Check").

| Member | Type | Notes |
|---|---|---|
| `SavedAt` | `DateTime` (UTC) | The plan's `SavedAtUtc`, so the page can tell whether the schedule it shows is the one that was checked (research section 12). |
| `AllPast` | `bool` | `true` when every scheduled entry has started. The weather service was then not contacted. |
| `ForecastUpdatedAt` | `TimeOnly?` | When the forecast used was received from the weather service, in Lithuanian time to the minute. `null` when `AllPast`. |
| `Entries` | `IReadOnlyList<PlanCheckEntry>` | One per saved scheduled entry, **in the stored order** (date, then start time). |

Invariants:

- `Entries.Count == Snapshot.Schedule.Scheduled.Count`.
- `AllPast` ⇔ every entry has `Past == true` ⇔ `ForecastUpdatedAt is null`.
- A saved plan always has at least one scheduled entry (feature 010 saves only such schedules), so `Entries` is never empty.

### PlanCheckEntry

| Member | Type | Notes |
|---|---|---|
| `Date` | `DateOnly` | As saved. |
| `StartTime`, `EndTime` | `TimeOnly` | As saved. |
| `ActivityName` | `string` | As saved. |
| `Past` | `bool` | The start instant (Date + StartTime, Lithuanian time) is at or before now, or its date is not covered by the forecast answer (research section 8). |
| `Weather` | `WeatherSnapshot?` | The latest forecast at the start hour, worked out as the scheduler does (`IsIndoor` for Indoor activities that do not require daylight). `null` when `Past`. |
| `Problems` | `IReadOnlyList<PlanProblem>` | Empty when `Past` or when no rule is broken. |

### PlanProblem

One broken rule of one scheduled entry (spec Key Entities "Plan Problem"). The record has one member for the rule and nullable members for the values. Each rule fills only the members listed for it.

| `Rule` (`PlanRule` enum, JSON camelCase) | Filled members | Reason in the browser (spec User Story 3) |
|---|---|---|
| `Wind` | `Time`, `Value`, `Limit` | "Wind up to {Value} m/s at {Time}, more than your limit of {Limit} m/s." |
| `Rain` | `Time`, `Value`, `Limit` | "Rain up to {Value} mm/h at {Time}, more than your limit of {Limit} mm/h." |
| `Cold` | `Time`, `Value`, `Limit` | "Temperature down to {Value} °C at {Time}, below your minimum of {Limit} °C." |
| `Heat` | `Time`, `Value`, `Limit` | "Temperature up to {Value} °C at {Time}, above your maximum of {Limit} °C." |
| `NoForecast` | `Time` | "No forecast for {Time}." |
| `BeforeSunrise` | `Time` (the entry's start), `SunTime` (sunrise) | "Starts at {Time}, before sunrise at {SunTime}." |
| `AfterSunset` | `Time` (the entry's end), `SunTime` (sunset) | "Ends at {Time}, after sunset at {SunTime}." |
| `Overlap` | `OtherActivityName`, `OtherStartTime`, `OtherEndTime` | "Overlaps with {OtherActivityName} ({OtherStartTime}–{OtherEndTime})." |
| `Travel` | `Value` (distance km), `Limit` (maximum km), `FromPlaceName` | "Travel of {Value} km from {FromPlaceName}, more than your {Limit} km limit." |

Rules for the values:

- **Weather values and limits** are the rounded values that are shown and compared (feature 006 research section 5). A value equal to its limit meets it.
- **`Time` for a weather rule** is the start of the first hour with the worst value. The worst value is the highest for `Wind`, `Rain` and `Heat` and the lowest for `Cold` (spec FR-007).
- **`NoForecast`** is given once, at the first hour of the entry with a missing value. It applies only to Outdoor activities. An hour with a missing value is not compared for the other weather rules, as in feature 006.
- **Order** within an entry: `Wind`, `Rain`, `Cold`, `Heat`, `NoForecast`, `BeforeSunrise`, `AfterSunset`, `Overlap`, `Travel`. That is the order of spec User Story 3. Overlaps are listed by the other entry's start time.
- **Indoor activities** never get weather or `NoForecast` problems. They get daylight problems only when they require daylight. Overlap and travel apply to every activity.

### LimitBreach (internal to the rules)

`HourSuitabilityRules.Breaches(hour, activity)` returns, for one planning hour, the weather limits it breaks: `(PlanRule Rule, decimal Value, decimal Limit)`, with the rule being `Wind`, `Rain`, `Cold` or `Heat`. Both `HourSuitabilityRules.Check` (feature 006 texts) and `PlanWeatherRules` (this feature) use it, so the comparison exists once (research section 5).

### PlanCheckResult

The service's answer to the controller, following `SavedPlanLookup`:

| Outcome | Meaning | HTTP |
|---|---|---|
| `Checked(PlanCheck)` | The owner's plan, checked or all past. | 200 |
| `NotFound` | No plan with this id. | 404 |
| `Forbidden` | Another user's plan. No plan data. | 403 |

A weather service failure is not an outcome. It is an `ExternalServiceException` that `ApiExceptionHandler` turns into 503 (research section 10).

## Flow of one check

```text
GET /api/plans/{id}/check
  │ rate limit (PlanSetup) ── refused ──► 429, nothing else happens
  │ policy ActiveRegisteredUser ── refused ──► 401 / 403
  ▼
PlanCheckService.CheckAsync(ownerId, id)
  │ SavedPlanService.GetAsync ── not found / not owner ──► 404 / 403
  │ now = ForecastPeriod.GetNow()
  │ every entry started? ── yes ──► PlanCheck(AllPast) ──► 200, no weather call
  │ WeatherForecastService.GetAsync(location)   (cache ≤ 30 min; failure ──► 503)
  │ PlanningDays.Build(forecast, dates of entries not started and covered, now)
  ▼
PlanCheckRules.Check(snapshot, days, now)
  │ per entry: started → Past
  │            else → weather + daylight (PlanWeatherRules), overlap, travel
  ▼
PlanCheck ──► AutoMapper ──► PlanCheckResponse ──► 200
```

## Browser state (not stored on the server)

### usePlanCheckStore (Zustand, not persisted)

| Field | Type | Notes |
|---|---|---|
| `status` | `"idle" \| "checking" \| "checked" \| "allPast" \| "weatherUnavailable" \| "tooManyRequests" \| "serverError"` | `idle` before the first check and after `reset()`. |
| `planId` | `string \| null` | The plan being checked, for `retry()`. |
| `result` | `PlanCheck \| null` | Set only when `status` is `checked` or `allPast`. Cleared when a new check starts, so a failed Recalculate shows the saved weather and the "as saved on" note again (spec FR-013). |
| `controller` | `AbortController \| null` | The running request. An answer whose controller is no longer the current one is dropped. |

Transitions:

```text
idle ──check(id)──► checking ──200 checked──► checked ──Recalculate──► checking …
                       │      ──200 allPast──► allPast   (Recalculate not offered)
                       │      ──503 forecast─► weatherUnavailable ──Retry──► checking
                       │      ──429──────────► tooManyRequests    ──Retry──► checking
                       │      ──other/timeout► serverError        ──Retry──► checking
                       │      ──404──────────► idle + useSavedPlanStore.markGone() ("This plan no longer exists.")
                       │      ──401/403──────► idle + current user refreshed (the route guards decide the page)
any ──reset()──► idle (the running request is aborted; a late answer is ignored)
```

`check()` while `status === "checking"` does nothing (spec FR-003).
