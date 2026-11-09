# Data Model: Activity Selection and Limits

No database change: the categories table from feature 003 is read only, and the plan's activities live in the browser tab session. **No migration.**

## Backend service models (`backend/src/SpekLaiku.Api/Services/`)

### CheckedPlanActivity (record)

One activity the server accepted.

| Field | Type | Notes |
|---|---|---|
| `CategoryId` | `Guid` | The stored category |
| `Name` | `string` | The category's current name, from the database |
| `Type` | `ActivityType` | The category's current type, from the database |
| `DurationHours` | `decimal` | The plan's own value |
| `RequiresDaylight` | `bool` | The plan's own value |
| `MaxWindMs`, `MaxRainMmPerHour`, `MinTemperatureC`, `MaxTemperatureC` | `decimal?` | The plan's own values for Outdoor; `null` for Indoor |

### PlanActivitiesResult

`Succeeded`, `Activities` (`IReadOnlyList<CheckedPlanActivity>`, in request order) or `Errors` (`IReadOnlyList<KeyValuePair<string, string>>`, in the order below). Same shape as `PlanSetupResult`.

### PlanActivityValidator (static)

`Validate(PlanActivitiesCheckRequest request, IReadOnlyDictionary<Guid, ActivityCategory> categories)` returns `PlanActivitiesResult`. Constants: `MaxActivities = 10` and the messages below. `MaxActivities` is the only copy of the limit: the categories endpoint sends it to the page as `maxActivities`. It has no database access; `PlanActivityService` loads the categories and passes them in.

### PlanActivityService

`CheckAsync(PlanActivitiesCheckRequest, CancellationToken)`:
1. If the list is missing, empty or longer than `MaxActivities`, returns the `activities` error without a query.
2. Otherwise reads the requested categories in one query (research section 5) and calls the validator.

`ListCategoriesAsync(CancellationToken)` returns `ActivityCategoryService.ListAsync`, so the order rule stays in one place.

## Validation rules

Keys, in this order: `activities`, then for each activity by position `activities[i]`, `activities[i].durationHours`, `activities[i].maxWindMs`, `activities[i].maxRainMmPerHour`, `activities[i].minTemperatureC`, `activities[i].maxTemperatureC`. The frontend adds "Error: " in front of each message.

| Key | When | Message |
|---|---|---|
| `activities` | Missing or empty | Add at least one activity. |
| `activities` | More than 10 | You can add up to 10 activities. |
| `activities[i]` | `categoryId` missing or not stored | This activity is no longer available. Remove it. |
| `activities[i]` | `type` is not the stored category's type (including missing or unknown type text) | This activity's category has changed. Remove it and add it again. |
| `activities[i].durationHours` | Missing, outside 0.5 to 12, not a multiple of 0.5 | Enter a duration between 0.5 and 12 hours. |
| `activities[i].maxWindMs` | Outdoor: missing, outside 0 to 30, more than one decimal | Enter a wind limit between 0 and 30 m/s. |
| `activities[i].maxRainMmPerHour` | Outdoor: missing, outside 0 to 20, more than one decimal | Enter a rain limit between 0 and 20 mm/h. |
| `activities[i].minTemperatureC` | Outdoor: missing, outside -30 to 45, more than one decimal | Enter a minimum temperature between -30 and 45 °C. |
| `activities[i].minTemperatureC` | Outdoor: both valid but min ≥ max | Minimum temperature must be lower than maximum temperature. |
| `activities[i].maxTemperatureC` | Outdoor: missing, outside -30 to 45, more than one decimal | Enter a maximum temperature between -30 and 45 °C. |

- The ranges and messages are `ActivityLimitRules` from feature 003, unchanged.
- An `activities` error stops all other checks. An `activities[i]` error skips that activity's field checks.
- For Indoor, the four limits are ignored and returned as `null`.

## Frontend types (`frontend/src/types/planActivity.ts`)

### PlanCategory

`{ id: string; name: string; type: ActivityType; defaultDurationHours: number; requiresDaylight: boolean; maxWindMs, maxRainMmPerHour, minTemperatureC, maxTemperatureC: number | null }`, exactly the contract's category object. `ActivityType` comes from `types/activityCategory.ts`.

### PlanActivity (as entered)

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | `crypto.randomUUID()` when added; browser only |
| `categoryId` | `string` | |
| `name` | `string` | The category's name when added; shown until the check returns the current one. Same field name as in `CheckedPlanActivity`, so one helper names both |
| `type` | `ActivityType` | The type when added; sent to the server |
| `durationText` | `string` | Text as typed; starts as the category default |
| `requiresDaylight` | `boolean` | |
| `maxWindText`, `maxRainText`, `minTemperatureText`, `maxTemperatureText` | `string` | Empty for Indoor |

### CheckedPlanActivity

`{ id: string; categoryId: string; name: string; type: ActivityType; durationHours: number; requiresDaylight: boolean; maxWindMs, maxRainMmPerHour, minTemperatureC, maxTemperatureC: number | null }`. The server's answer, matched back to the sent `id` by position.

### PlanActivityErrors

`{ list?: string; byActivity: Record<string, Partial<Record<PlanActivityField, string>>> }`. `PlanActivityField` is `"activity" | "durationHours" | "maxWindMs" | "maxRainMmPerHour" | "minTemperatureC" | "maxTemperatureC"`, where `"activity"` holds the `activities[i]` message.

## Frontend stores (`frontend/src/stores/`)

### Plan activities store (`usePlanActivitiesStore`, persisted in `sessionStorage` under `spek-laiku-plan-activities`, version 1)

| Field or action | Notes |
|---|---|
| `activities: PlanActivity[]` | In order of adding |
| `checked: CheckedPlanActivity[] \| null` | The last successful check; every change below sets it to `null` (spec FR-018) |
| `add(category: PlanCategory)` | Appends an activity with the category defaults (numbers written with `String(value)`, limits empty for Indoor). It holds no limit of its own: the category list disables Add at the server's `maxActivities`, and the server refuses more on Continue |
| `remove(id)` | |
| `update(id, changes)` | Changes text fields or `requiresDaylight` |
| `setChecked(checked)` | Does not count as a change |
| `clear()` | Called on logout |

Only the data is stored. A stored value in another shape is dropped (`migrate` returns the initial state), as in `usePlanSetupStore`.

### Plan categories store (`usePlanCategoriesStore`, not persisted)

`status: "loading" | "loaded" | "error"`, `categories: PlanCategory[]`, `maxActivities: number | null` (from the server; `null` until loaded), `load()` with a 10 s timeout, `reset()`. Follows `usePlanPeriodStore`.

### Plan activities check store (`usePlanActivitiesCheckStore`, not persisted)

`status: "idle" | "pending" | "invalid" | "serverError"`, `errors: PlanActivityErrors`, `lastRequest` (the sent activities with their ids), `submit()`, `retry()`, `reset()`. See research section 6.

## Helpers (`frontend/src/helpers/`)

- `planActivityNames.ts`: `planActivityNames(activities: { id: string; categoryId: string; name: string }[])` returns a map from id to shown name (research section 3). It works for both `PlanActivity` (step 2) and `CheckedPlanActivity` (step 3).
- `planActivityRequest.ts`: `planActivitiesRequest(activities)` turns the activities into the request body with `parseDecimal`; Indoor limits are `null`.
- `planActivityFieldIds.ts`: the field id for each activity field (`activity-<id>-<field>`, and `activity-<id>` for the group), and the summary list in page order for `ErrorSummary` and first focus.
