# Data Model: 008-generate-schedule

**Date**: 2026-11-16 | **Plan**: [plan.md](plan.md)

This feature introduces no new database tables and no migration. All models are in-memory service layer records and response DTOs.

---

## Backend Service Records (new, in `Services/`)

### `UnscheduledReason` (enum)

| Member          | Meaning                                               |
|-----------------|-------------------------------------------------------|
| `NoPlace`       | No place found in the activity's category radius      |
| `NoSuitableTime`| A place was found but every suitable slot overlaps    |

---

### `WeatherSnapshot`

Weather at the start hour of an assigned slot. `null` values when indoor (`IsIndoor: true`).

| Property          | Type       | Nullable | Notes                                   |
|-------------------|------------|----------|-----------------------------------------|
| `TemperatureC`    | `decimal`  | yes      | From `PlanningHour.TemperatureC`        |
| `RainMmPerHour`   | `decimal`  | yes      | From `PlanningHour.RainMmPerHour`       |
| `WindMs`          | `decimal`  | yes      | From `PlanningHour.WindMs`              |
| `IsIndoor`        | `bool`     | no       | `true` when `ActivityForecast.NotAffectedByWeather` |

---

### `ScheduledActivity`

One activity successfully assigned to a date and time slot.

| Property       | Type            | Notes                                              |
|----------------|-----------------|----------------------------------------------------|
| `ActivityId`   | `Guid`          | From `CheckedPlanActivity.Id`                      |
| `ActivityName` | `string`        | From `CheckedPlanActivity.Name`                    |
| `Date`         | `DateOnly`      | Assigned date                                      |
| `Start`        | `TimeOnly`      | `SuitablePeriod.Start` (equals full period start)  |
| `End`          | `TimeOnly`      | `SuitablePeriod.End` (equals full period end)      |
| `Place`        | `NearbyPlace`   | Nearest place (index 0 from `CategoryPlaces`)      |
| `Weather`      | `WeatherSnapshot` | Weather at `Start` hour                          |

---

### `UnscheduledActivity`

One activity that could not be assigned a slot.

| Property       | Type                | Notes                        |
|----------------|---------------------|------------------------------|
| `ActivityId`   | `Guid`              | From `CheckedPlanActivity.Id`|
| `ActivityName` | `string`            |                              |
| `Reason`       | `UnscheduledReason` | `NoPlace` or `NoSuitableTime`|

---

### `PlanSchedule`

The complete scheduling result.

| Property      | Type                               | Notes                        |
|---------------|------------------------------------|------------------------------|
| `Scheduled`   | `IReadOnlyList<ScheduledActivity>` | May be empty                 |
| `Unscheduled` | `IReadOnlyList<UnscheduledActivity>` | May be empty               |

---

### `PlanScheduleResult`

Service return value. Follows `PlanForecastResult`.

| Property    | Type            | Notes                                                 |
|-------------|-----------------|-------------------------------------------------------|
| `Succeeded` | `bool`          | `false` when plan recheck fails                       |
| `Schedule`  | `PlanSchedule?` | Present only when `Succeeded`                         |
| `Errors`    | `IReadOnlyList<PlanRecheckError>` | Present only when `!Succeeded`  |

---

## Backend Response DTOs (new, in `DTOs/Responses/`)

### `WeatherSnapshotResponse`

| Property        | Type       | JSON key          | Nullable |
|-----------------|------------|-------------------|----------|
| `TemperatureC`  | `decimal?` | `temperatureC`    | yes      |
| `RainMmPerHour` | `decimal?` | `rainMmPerHour`   | yes      |
| `WindMs`        | `decimal?` | `windMs`          | yes      |
| `IsIndoor`      | `bool`     | `isIndoor`        | no       |

---

### `ScheduledActivityResponse`

| Property       | Type                   | JSON key       | Format                |
|----------------|------------------------|----------------|-----------------------|
| `ActivityName` | `string`               | `activityName` |                       |
| `Date`         | `string`               | `date`         | `"yyyy-MM-dd"`        |
| `StartTime`    | `string`               | `startTime`    | `"HH:mm"`             |
| `EndTime`      | `string`               | `endTime`      | `"HH:mm"`             |
| `Place`        | `NearbyPlaceResponse`  | `place`        | Existing DTO from 007 |
| `Weather`      | `WeatherSnapshotResponse` | `weather`   |                       |

`NearbyPlaceResponse` (from feature 007): `name`, `latitude`, `longitude`, `distanceKm`, `area?`.

---

### `UnscheduledActivityResponse`

| Property       | Type     | JSON key       | Values                             |
|----------------|----------|----------------|------------------------------------|
| `ActivityName` | `string` | `activityName` |                                    |
| `Reason`       | `string` | `reason`       | `"noPlace"` or `"noSuitableTime"`  |

---

### `PlanScheduleResponse`

| Property      | Type                                  | JSON key      |
|---------------|---------------------------------------|---------------|
| `Scheduled`   | `IReadOnlyList<ScheduledActivityResponse>`   | `scheduled`   |
| `Unscheduled` | `IReadOnlyList<UnscheduledActivityResponse>` | `unscheduled` |

---

## Backend Request DTO (new, in `DTOs/Requests/`)

### `PlanScheduleRequest`

Identical shape to `PlanForecastRequest` and `PlanPlacesRequest`.

| Property     | Type                                  | Validation                     |
|--------------|---------------------------------------|--------------------------------|
| `Setup`      | `PlanSetupCheckRequest`               | Required; validated by recheck |
| `Activities` | `IReadOnlyList<PlanActivityRequest>`  | Required; min 1                |

---

## Frontend Types (new, in `types/planSchedule.ts`)

### `WeatherSnapshot`

| Property        | TS type   | Notes                                     |
|-----------------|-----------|-------------------------------------------|
| `temperatureC`  | `number \| null` | null when indoor                   |
| `rainMmPerHour` | `number \| null` | null when indoor                   |
| `windMs`        | `number \| null` | null when indoor                   |
| `isIndoor`      | `boolean` |                                           |

### `ScheduledActivity`

| Property       | TS type        | Notes                           |
|----------------|----------------|---------------------------------|
| `activityName` | `string`       |                                 |
| `date`         | `string`       | `"yyyy-MM-dd"`                  |
| `startTime`    | `string`       | `"HH:mm"`                       |
| `endTime`      | `string`       | `"HH:mm"`                       |
| `place`        | `NearbyPlace`  | Existing type from feature 007  |
| `weather`      | `WeatherSnapshot` |                              |

### `UnscheduledActivity`

| Property       | TS type                             |
|----------------|-------------------------------------|
| `activityName` | `string`                            |
| `reason`       | `"noPlace" \| "noSuitableTime"`     |

### `PlanSchedule`

| Property      | TS type                    |
|---------------|----------------------------|
| `scheduled`   | `ScheduledActivity[]`      |
| `unscheduled` | `UnscheduledActivity[]`    |

```typescript
// Alias — same shape as the existing PlanForecastRequest
export type PlanScheduleRequest = PlanForecastRequest;
```

---

## Frontend Store State (`usePlanScheduleStore`)

No `persist` middleware. Cleared on `ScheduleOverviewPage` unmount via `reset()`.

| Status                | Meaning                                              |
|-----------------------|------------------------------------------------------|
| `idle`                | Initial state; `ScheduleOverviewPage` not yet mounted |
| `loading`             | POST in flight (initial generate or retry)           |
| `loaded`              | Schedule received; `schedule` field populated        |
| `weatherUnavailable`  | 503 with `service: "forecast"`                       |
| `placesUnavailable`   | 503 with `service: "places"`                         |
| `tooManyRequests`     | 429                                                  |
| `serverError`         | 500 or network/timeout failure                       |
| `setupOutdated`       | 400 with `setup` key → redirect to Plan Setup        |
| `activitiesOutdated`  | 400 with `activities` key → redirect to Activities   |

| Action              | Behaviour                                              |
|---------------------|--------------------------------------------------------|
| `generate(setup, activities)` | Ignored while `loading`. Aborts previous request, sets `loading`, sends POST. |
| `retry()`           | Same as `generate` but always fires (called from error UI). |
| `reset()`           | Aborts, sets `idle`, clears `schedule`.               |

---

## Mapping Rules (`PlanScheduleMappingProfile`)

| Source                        | Target                         | Rule                                       |
|-------------------------------|--------------------------------|--------------------------------------------|
| `ScheduledActivity.Date`      | `ScheduledActivityResponse.Date` | `.ToString("yyyy-MM-dd")`                |
| `ScheduledActivity.Start`     | `ScheduledActivityResponse.StartTime` | `.ToString("HH:mm")`              |
| `ScheduledActivity.End`       | `ScheduledActivityResponse.EndTime`   | `.ToString("HH:mm")`              |
| `ScheduledActivity.Place`     | `ScheduledActivityResponse.Place`     | AutoMapper → `NearbyPlaceResponse`|
| `UnscheduledReason.NoPlace`   | `UnscheduledActivityResponse.Reason`  | `"noPlace"`                       |
| `UnscheduledReason.NoSuitableTime` | `UnscheduledActivityResponse.Reason` | `"noSuitableTime"`          |
| `WeatherSnapshot` (all props) | `WeatherSnapshotResponse`      | Direct property mapping                    |
