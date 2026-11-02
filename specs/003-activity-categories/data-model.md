# Activity Category Management Data Model

One new entity and one new enum. The migration `AddActivityCategories` creates the table and inserts the five starter categories (research section 5). The user account from features 001 and 002 is read, not changed.

## ActivityCategory (new)

`backend/src/SpekLaiku.Api/Entities/ActivityCategory.cs`, table `ActivityCategories`.

| Property | Type | Column | Rules |
|---|---|---|---|
| `Id` | `Guid` | `uuid`, primary key | Set by the service with `Guid.NewGuid()`; fixed values for the starter categories. |
| `Name` | `string` | `varchar(60)`, not null | Trimmed, 2 to 60 characters (spec FR-003). Stored as entered after trimming. |
| `NormalizedName` | `string` | `varchar(60)`, not null, unique index `IX_ActivityCategories_NormalizedName` | `Name.Trim().ToUpperInvariant()`. Makes names unique without regard to letter case; also the sort key for the list. |
| `Type` | `ActivityType` | `integer`, not null | `Indoor` or `Outdoor` (spec FR-004). |
| `DefaultDurationHours` | `decimal` | `numeric(4,1)`, not null | 0.5 to 12, a multiple of 0.5 (spec FR-005). |
| `RequiresDaylight` | `bool` | `boolean`, not null | Default `false` (spec FR-008). |
| `MaxWindMs` | `decimal?` | `numeric(4,1)` | Outdoor: required, 0 to 30, one decimal place. Indoor: `null` (spec FR-006, FR-007). |
| `MaxRainMmPerHour` | `decimal?` | `numeric(4,1)` | Outdoor: required, 0 to 20, one decimal place. Indoor: `null`. |
| `MinTemperatureC` | `decimal?` | `numeric(4,1)` | Outdoor: required, -30 to 45, one decimal place, lower than `MaxTemperatureC`. Indoor: `null`. |
| `MaxTemperatureC` | `decimal?` | `numeric(4,1)` | Outdoor: required, -30 to 45, one decimal place. Indoor: `null`. |
| `PlaceTags` | `List<string>` | `text[]`, not null | One or more normalized `key=value` entries, no duplicates, in entered order (spec FR-009; research section 3). |
| `Version` | `uint` | PostgreSQL `xmin` system column (`IsRowVersion()`) | Concurrency token; changes on every update. Not a real column, so the migration adds nothing for it (spec FR-026; research section 4). |

**Invariants** (enforced by `ActivityCategoryValidator` before every save):
- An Outdoor category has all four weather limits; an Indoor category has none.
- `MinTemperatureC < MaxTemperatureC`.
- `PlaceTags` has at least one entry, and the text it was parsed from had at most 200 characters.

**Relationships**: none in this feature. Feature 005 creates a plan activity from a category and copies its defaults, so later changes to a category do not change existing plan activities (spec Assumptions).

**Lifecycle**: created by an administrator or by the migration (starter set), changed by an administrator. Never deleted in this feature (spec FR-023).

## ActivityType (new)

`backend/src/SpekLaiku.Api/Entities/ActivityType.cs`

```text
Indoor = 0
Outdoor = 1
```

Stored as `integer` with `HasConversion<int>()`, like `AccountStatus`. The API uses the names `"Indoor"` and `"Outdoor"`.

## Starter categories (spec FR-025)

Inserted by the migration with fixed ids. Values are the spec table; `NormalizedName` is the upper-case name.

| Name | Type | Duration | Daylight | Wind | Rain | Min / max °C | PlaceTags |
|---|---|---|---|---|---|---|---|
| Cycling | Outdoor | 2.0 | true | 10.0 | 1.0 | 5.0 / 32.0 | `highway=cycleway`, `route=bicycle` |
| Kayaking | Outdoor | 2.0 | true | 8.0 | 0.5 | 15.0 / 35.0 | `leisure=slipway`, `sport=canoe` |
| Picnic | Outdoor | 1.5 | true | 8.0 | 0.0 | 15.0 / 32.0 | `tourism=picnic_site`, `leisure=picnic_table` |
| Heritage site | Outdoor | 1.5 | true | 15.0 | 2.0 | 0.0 / 35.0 | `historic=castle`, `historic=manor`, `historic=monument`, `historic=archaeological_site` |
| Museum | Indoor | 2.0 | false | null | null | null / null | `tourism=museum` |

## ApplicationUser (existing, read only)

`Role` and `AccountStatus` are read by `ActiveAdministratorHandler` on every request to the category endpoints (research section 1). Only `Role == "Administrator"` together with `AccountStatus == Active` is allowed.

## Migration

`dotnet ef migrations add AddActivityCategories --project src/SpekLaiku.Api` (from `backend/`). It creates `ActivityCategories` with the unique index and inserts the five starter rows. It does not touch the Identity tables.
