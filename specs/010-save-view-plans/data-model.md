# Data Model: 010-save-view-plans

**Date**: 2026-11-18 | **Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

This feature adds two database tables and one migration, **`AddSavedPlans`**. Every other value already exists in the schedule generation from features 008 and 009.

## Entities (database)

### SavedPlan (`SavedPlans` table, new)

A plan kept under one Registered User's account (spec Key Entities). It is read-only in this feature.

| Property | Type / column | Rules |
|---|---|---|
| `Id` | `Guid`, primary key | `Guid.NewGuid()` on the server (`ValueGeneratedNever`). |
| `OwnerId` | `string`, same column type as `AspNetUsers.Id` (`text` with Npgsql; no length set), required | Foreign key to `AspNetUsers.Id`, `ON DELETE CASCADE` (for feature 016). Always the signed-in user (spec FR-013). Index `IX_SavedPlans_OwnerId_SavedAtUtc` on (`OwnerId`, `SavedAtUtc` descending). |
| `Name` | `string`, `varchar(80)`, required | Trimmed, 1 to 80 characters, not unique (spec FR-002). |
| `SavedAtUtc` | `DateTime` (UTC), `timestamp with time zone` | From `TimeProvider.GetUtcNow()` when saved. |
| `LocationName` | `string`, `varchar(200)`, required | Copied from `Snapshot.Setup.Location.Name`, for the lists (research section 5). |
| `Dates` | `List<DateOnly>`, `date[]`, required | Copied from `Snapshot.Setup.Dates` (1 to 7, ascending), for the lists. |
| `GeneratedScheduleId` | `Guid?` | The generated schedule it was saved from. Unique index `IX_SavedPlans_GeneratedScheduleId` (research section 6). `null` is allowed for plans that feature 011 creates by duplicating. |
| `Snapshot` | `PlanSnapshot`, `jsonb`, required | Value converter with `System.Text.Json` (research section 4). |

**Lifecycle**: created by Save, never changed or deleted in this feature. Feature 011 adds edit, duplicate and delete, and feature 016 deletes plans with the account (cascade).

### GeneratedSchedule (`GeneratedSchedules` table, new)

A schedule the system generated, remembered for 30 minutes so it can be saved exactly as shown (spec FR-004, Key Entities "Generated Schedule Record").

| Property | Type / column | Rules |
|---|---|---|
| `Id` | `Guid`, primary key | `Guid.NewGuid()`, unguessable (research section 3). Sent to the browser as `generatedScheduleId`. |
| `CreatedAtUtc` | `DateTime` (UTC) | When the schedule was generated. |
| `ExpiresAtUtc` | `DateTime` (UTC) | `CreatedAtUtc + 30 minutes`. Index `IX_GeneratedSchedules_ExpiresAtUtc`. |
| `Snapshot` | `PlanSnapshot`, `jsonb`, required | Same converter as `SavedPlan.Snapshot`. |

**Lifecycle**:

1. Created by `POST /api/plan-schedule` only when at least one activity was scheduled.
2. Valid while `now < ExpiresAtUtc`.
3. Expired rows are deleted before each new insert.

It has no owner and is not deleted when saved (research section 6).

## Stored value (JSON)

### PlanSnapshot (`Services/PlanSnapshot.cs`, new record)

```text
PlanSnapshot(CheckedPlanSetup Setup, IReadOnlyList<CheckedPlanActivity> Activities, PlanSchedule Schedule)
```

These are the records `PlanScheduleService` already uses, so nothing new is defined for their content:

- `CheckedPlanSetup(PlaceLocation Location, IReadOnlyList<DateOnly> Dates, int MaxTravelDistanceKm)`, where `PlaceLocation(long Id, string Name, string Area, double Latitude, double Longitude)`.
- `CheckedPlanActivity(Guid CategoryId, string Name, ActivityType Type, decimal DurationHours, bool RequiresDaylight, decimal? MaxWindMs, decimal? MaxRainMmPerHour, decimal? MinTemperatureC, decimal? MaxTemperatureC)`.
- `PlanSchedule(IReadOnlyList<ScheduledActivity> Scheduled, IReadOnlyList<UnscheduledActivity> Unscheduled, TravelSummary Travel)`, with `ScheduledActivity` (category id, name, date, start, end, `NearbyPlace`, `WeatherSnapshot`, `TravelLeg?`), `UnscheduledActivity(string ActivityName, UnscheduledReason Reason)` and `TravelSummary(int MaxDistanceKm, int TripsOverLimit)`.

**JSON rules**:

- Shared `JsonSerializerOptions`: web defaults (camelCase), plus `JsonStringEnumConverter`, so `ActivityType` and `UnscheduledReason` are stored by name.
- `DateOnly` is stored as `"yyyy-MM-dd"` and `TimeOnly` as `"HH:mm:ss"` (the .NET defaults).
- These records are now a storage format. A comment on each says so, and `PlanSnapshotJsonTests` writes a full snapshot and reads it back unchanged (research section 4, Risk).

## Validation rules

### Save request (`SavedPlanValidator`, new, static)

| Field | Rule | Message (key) |
|---|---|---|
| `name` | Required; after trimming, not empty | "Enter a plan name." (`name`) |
| `name` | After trimming, at most 80 characters | "Plan name can be at most 80 characters." (`name`) |
| `generatedScheduleId` | Required; a `GeneratedSchedule` with this id exists and `now < ExpiresAtUtc` | "Generate the schedule again to save it." (`generatedScheduleId`) |
| `generatedScheduleId` | Not already saved by another user (research section 6) | "Generate the schedule again to save it." (`generatedScheduleId`) |
| `generatedScheduleId` | `Snapshot.Schedule.Scheduled` is not empty | "There is nothing to save in this schedule." (`generatedScheduleId`) |

The name is checked first and needs no database access. Name and schedule errors are returned together.

### Reading a plan (`SavedPlanService`)

| Case | Result |
|---|---|
| No plan with this id | `NotFound` → 404 |
| Plan exists, `OwnerId` is not the signed-in user | `Forbidden` → 403, no plan data |
| Plan exists, owner matches | `Found` → 200 |

## Service results (new records in `Services/`)

- `SavePlanResult`: `Created(SavedPlan)`, `AlreadySaved(SavedPlan)` (the idempotent repeat, research section 6), or `Invalid(errors)`.
- `SavedPlanLookup`: `Found(SavedPlan)`, `NotFound`, `Forbidden`.
- `SavedPlanSummary(Guid Id, string Name, string LocationName, IReadOnlyList<DateOnly> Dates, DateTime SavedAtUtc)`: the list projection, so the list never loads `Snapshot`.

## Response DTOs (new, `DTOs/Responses/`)

- `SavedPlanSummaryResponse(Guid Id, string Name, string LocationName, IReadOnlyList<DateOnly> Dates, DateTimeOffset SavedAt)`.
- `SavedPlanResponse(Guid Id, string Name, DateTimeOffset SavedAt, SavedPlanLocationResponse Location, IReadOnlyList<DateOnly> Dates, int MaxTravelDistanceKm, IReadOnlyList<ScheduledActivityResponse> Scheduled, IReadOnlyList<UnscheduledActivityResponse> Unscheduled, TravelSummaryResponse Travel)`.
- `SavedPlanLocationResponse(string Name, string Area, double Latitude, double Longitude)`.

The scheduled, unscheduled and travel parts reuse the existing feature 008 and 009 DTOs and the existing `PlanScheduleMappingProfile` maps. `CategoryId`, `NearbyPlace.Key`, the activities' limits and the owner id are never sent.

**Changed**: `PlanScheduleResponse` gains `Guid? GeneratedScheduleId` (see [contracts/plan-schedule-api.md](contracts/plan-schedule-api.md)).

## Request DTO (new, `DTOs/Requests/`)

- `SavePlanRequest(Guid? GeneratedScheduleId, string? Name)`. It has no owner field. An `ownerId` in the body is ignored (spec FR-013).

## Frontend state

### `useKeptScheduleStore` (new, persisted in `sessionStorage`)

| Field | Meaning |
|---|---|
| `kept` | `{ key: string, schedule: PlanSchedule } \| null`. `key` is `JSON.stringify(checkedPlanRequest(setup, activities))`. |
| `keep(setup, activities, schedule)` | Stores the schedule before going to Log in (research section 8). |
| `take(setup, activities)` | Returns and removes the kept schedule when its key matches; otherwise removes it and returns `null`. |
| `clear()` | Called by logout. |

### `useSavePlanStore` (new, not persisted)

`status`: `closed` → `open` → `saving` → `saved` | `invalid` | `expired` | `sessionExpired` | `serverError`. It also holds `name`, `errors` (field messages), `savedPlanId`, and the last request for Retry. `open()`, `cancel()`, `submit(name, generatedScheduleId)`, `retry()`, `reset()`. The status `expired` (the `generatedScheduleId` error) shows "Generate the schedule again to save it." with **Generate again**. `sessionExpired` (401) makes the page keep the schedule and go to Log in with `loginReason: "expired"`.

### `useSavedPlansStore` (new) and `useSavedPlanStore` (new)

The list (`status`: `loading` | `loaded` | `serverError`, `plans`, `load()`, `retry()`) and one plan (`status`: `loading` | `loaded` | `notFound` | `forbidden` | `serverError`, `plan`, `load(id)`, `retry()`, `reset()`). Both use the 10-second timeout from `timedRequest.ts`.

### `usePlanScheduleStore` (changed)

Gains `restore(schedule)`, which sets `status: "loaded"` and the schedule without a request (research section 8). `PlanSchedule` gains `generatedScheduleId: string | null`.

## Display rules

| Where | Text |
|---|---|
| Visitor, Schedule Overview | Button "Save plan" + hint "Log in or register to save this plan." |
| Save success | "✓ Success: Plan saved." + link "Go to My plans" |
| Expired schedule | "Generate the schedule again to save it." + button **Generate again** |
| Save failure | "Error: Plan could not be saved. Try again." + **Retry** |
| Lists | Name, location name, dates as `formatPlanDateShort` joined with ", ", "Saved on Sat 21 Nov 2026 at 14:05" (Lithuanian time) |
| Open action name | Visible "Open", accessible name "Open <plan name>" |
| Plan page note | "This is your plan as saved on <date>. The forecast may have changed since." |
| Not found | Heading "Plan not found", text "This plan no longer exists.", links Home and My plans |
