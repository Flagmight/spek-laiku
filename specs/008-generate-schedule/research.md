# Research: 008-generate-schedule

**Date**: 2026-11-16 | **Plan**: [plan.md](plan.md)

## 1. No new packages needed

**Decision**: No new NuGet or npm package.

**Rationale**: Every primitive the scheduling algorithm needs exists in the project.

- `SuitablePeriods` builds non-overlapping suitable windows from `ActivityDayForecast`.
- `ActivityForecasts` computes per-activity forecasts from planning days.
- `PlanningDay.Hours` holds `PlanningHour` with the weather values (`TemperatureC`, `RainMmPerHour`, `WindMs`).
- `NearbyPlacesService` returns cached `IReadOnlyList<ReceivedPlaces>` per activity category.
- `PlanRecheckService` already validates the plan before each service call.
- AutoMapper is already used for all existing response mappings.

The scheduling algorithm is a simple greedy loop over in-memory data; no graph library, optimizer or external scheduler is needed.

## 2. Reusing the external-service error pattern unchanged

**Decision**: `ApiExceptionHandler` requires no change.

**Rationale**: The schedule endpoint calls the same two external services as features 006 and 007:

- `WeatherForecastService` throws `ExternalServiceException(ExternalService.Forecast)` on Open-Meteo failure.
- `NearbyPlacesService` throws `ExternalServiceException(ExternalService.MapData)` on Overpass failure.

`ApiExceptionHandler` already maps:

| `ExternalService` value | `service` field in 503 body |
|-------------------------|---------------------------|
| `Forecast`              | `"forecast"`              |
| `MapData`               | `"places"`                |
| `LocationSearch`        | `"locationSearch"`        |

The schedule endpoint produces the same two 503 variants. No new service name is introduced. The frontend maps `service: "forecast"` → "The weather service is unavailable." and `service: "places"` → "The map data service is unavailable." — both already exist in the places-and-forecast page helpers.

## 3. Scheduling algorithm

**Decision**: Greedy, activity-plan-order, longest-non-overlapping-period-wins.

**Rationale**: The spec requirements SC-002 through SC-004 define correctness fully; the schedule only needs to be correct and reproducible, not globally optimal (travel time, feature 009; re-optimise, feature 033). A greedy approach stays well under 200 lines, is easy to unit-test with deterministic data, and runs in microseconds for the plan sizes involved (up to ~10 activities, 7 dates, ~5 periods per date per activity).

**Algorithm** (implemented in `PlanScheduler.Assign`):

```
Input:
  activities   : IReadOnlyList<CheckedPlanActivity>  — in plan order
  forecasts    : IReadOnlyList<ActivityForecast>      — same order as activities
  categoryPlaces: IReadOnlyList<CategoryPlaces>       — keyed by CategoryId
  days         : IReadOnlyList<PlanningDay>            — for weather lookup

State:
  occupiedSlots: Dictionary<DateOnly, List<(TimeOnly Start, TimeOnly End)>>

For each (activity, forecast) in zip(activities, forecasts):

  1. Find the nearest place:
       categoryPlaces entry whose CategoryId == activity.CategoryId
       nearestPlace = entry.Places[0]  (already nearest-first from NearbyPlacesService)
       if null or empty → Unscheduled(NoPlace); continue

  2. Find the best non-overlapping suitable period across all dates:
       best = null
       For each ActivityDayForecast dayForecast in forecast.Days (dates ascending):
         For each SuitablePeriod period in dayForecast.Periods
             ordered by (LengthHours DESC, Start ASC):
           if period.ShorterThanDuration: skip
           if Overlaps(period, occupiedSlots[dayForecast.Date]): skip
           // This is the best available period for this date
           if best is null
             OR period.LengthHours > best.period.LengthHours:
             best = (dayForecast.Date, period)
           break  // No shorter period on this date can beat the longest
       if best is null → Unscheduled(NoSuitableTime); continue

  3. Build the weather snapshot:
       planningDay = days[best.Date]
       startHour   = planningDay.Hours.FirstOrDefault(h => h.Start == best.Period.Start)
       if forecast.NotAffectedByWeather:
         weather = WeatherSnapshot(null, null, null, IsIndoor: true)
       else:
         weather = WeatherSnapshot(startHour?.TemperatureC, startHour?.RainMmPerHour,
                                   startHour?.WindMs, IsIndoor: false)

  4. Record the assignment:
       scheduled.Add(ScheduledActivity(activity.Id, activity.Name,
                     best.Date, best.Period.Start, best.Period.End,
                     nearestPlace, weather))
       occupiedSlots[best.Date].Add((best.Period.Start, best.Period.End))

Overlap check:
  Overlaps(period, slots) = slots.Any(s => period.Start < s.End && s.Start < period.End)
```

**Tie-breaking**: iterating dates in ascending order means the first date that offers a period with `LengthHours > best` replaces best; for equal length the earlier date stays in `best`. This matches spec assumption: "earlier date preferred."

**Assigned slot = the full suitable period** (`period.Start` to `period.End`). This matches spec FR-003: "exactly one date and one non-overlapping time slot." Feature 009 will add duration trimming and travel gaps.

**Alternatives considered**:

- Trim slot to exactly `activity.DurationHours`: complicates overlap checks (need to place within the period) and produces odd display times (e.g., "10:00–12:00" when weather is good 10:00–14:00). Deferred to feature 009.
- Global optimum (Hungarian algorithm / interval scheduling maximization): heavier, not required by spec, adds package dependency or significant code.

## 4. Place selection: nearest-first from the existing list

**Decision**: `nearestPlace = categoryPlaces.Places[0]` — the first entry already sorted by distance.

**Rationale**: `NearbyPlacesService` returns places sorted by distance ascending (nearest first) per the feature 007 design. The schedule simply picks `[0]` per activity category. Spec FR-004 confirms this assumption ("nearest place, the first in the places list from feature 007"). Feature 009 may re-evaluate place selection when travel time is considered.

## 5. WeatherSnapshot for indoor activities

**Decision**: `IsIndoor = true`, all weather values `null`.

**Rationale**: `ActivityForecast.NotAffectedByWeather` is `true` when `activity.Type == ActivityType.Indoor && !activity.RequiresDaylight`. This covers the "Weather does not affect this indoor activity." case in the UI (spec FR-009). The JSON response has nullable decimals so `null` serializes to `null` and the frontend renders the indoor string instead of a weather badge.

## 6. Frontend store cleared on page unmount

**Decision**: `usePlanScheduleStore.reset()` is called in the `useEffect` cleanup of `ScheduleOverviewPage`.

**Rationale**: Spec clarification (session 2026-11-16): schedule is cleared immediately on leaving step 4. Clearing in the cleanup means the schedule is gone as soon as the page unmounts (Back press or progress bar click). The user must click "Generate schedule" again to reach step 4. This is a within-session ephemeral store; no `persist` middleware is used (spec FR-014).

## 7. Generate button enable/disable rule

**Decision**: Button enabled only when `forecastStore.status === "loaded" && placesStore.status === "loaded"`.

**Rationale**: Spec FR-001 says "enabled only after both the forecast and the places have loaded without a service error." A service error (e.g., `weatherUnavailable`) is not `"loaded"`, so the button stays disabled until both have succeeded. Clicking while in an error state on either store is therefore impossible without first retrying and reaching `"loaded"`.

## 8. `PlanScheduleService` does not call `PlanForecastService` or `PlanPlacesService`

**Decision**: `PlanScheduleService` calls `WeatherForecastService` and `NearbyPlacesService` directly (the same calls as the forecast and places services).

**Rationale**: `PlanForecastService.GetAsync` returns a `PlanForecastResult` shaped for display (with per-day, per-hour display columns). `PlanPlacesService.GetAsync` returns a `PlanPlacesResult` shaped for the places table. Neither is shaped for the scheduling algorithm. Calling them and then discarding their output would waste allocation. The schedule service needs the raw `PlanningDays` and `IReadOnlyList<ReceivedPlaces>` — the same objects the forecast and places services use internally — so it calls the same underlying services. This introduces minor code duplication (the forecast call + DB tag query + places call) but no logic duplication (rules stay in `ActivityForecasts`, `NearbyPlaceRules`, `SuitablePeriods`).
