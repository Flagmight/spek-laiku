# Data Model: 011-plan-management

**Date**: 2026-11-19 | **Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

This feature adds one column to an existing table in one migration, **`AddSavedPlanCreatedAt`**. Every other value already exists from feature 010 ([../010-save-view-plans/data-model.md](../010-save-view-plans/data-model.md)).

## Entities (database)

### SavedPlan (`SavedPlans` table, changed)

| Property | Type / column | Change |
|---|---|---|
| `CreatedAtUtc` | `DateTime` (UTC), `timestamp with time zone`, required | **New.** When this plan row was created, by a save or a duplicate. Existing rows get their `SavedAtUtc` in the migration (`UPDATE "SavedPlans" SET "CreatedAtUtc" = "SavedAtUtc"`). Never changed afterwards. |
| `Name` | `varchar(80)` | Now changed by Rename and Save changes. |
| `SavedAtUtc` | `timestamp with time zone` | Set to now by Save changes. Unchanged by Rename. A copy takes the original's value. |
| `LocationName`, `Dates`, `Snapshot` | unchanged types | Replaced by Save changes from the remembered snapshot. A copy takes the original's values. |
| `GeneratedScheduleId` | `Guid?`, unique | Set to the new id by Save changes. `null` for a copy. |

All other properties (`Id`, `OwnerId`) are unchanged, and the plan keeps both through every change.

**Indexes**: unchanged. The list query orders by (`SavedAtUtc` desc, `CreatedAtUtc` desc, `Id`) within one owner's few dozen rows, so `IX_SavedPlans_OwnerId_SavedAtUtc` is enough.

**Lifecycle**:

```text
             Save (feature 010)          Duplicate (copy of another plan)
                   │                              │
                   ▼                              ▼
              ┌──────────────── SavedPlan ───────────────┐
              │   Rename: Name only                       │
              │   Save changes: Name, LocationName, Dates,│
              │     Snapshot, SavedAtUtc, GeneratedScheduleId │
              └───────────────────┬───────────────────────┘
                                  │ Delete (after confirmation in the browser)
                                  ▼
                               removed (row deleted; its address gives 404)
```

Only the owner can perform any transition (spec FR-015). Account deletion (feature 016) removes the rows by the existing cascade.

### GeneratedSchedule (`GeneratedSchedules` table, unchanged)

Save changes refers to it in the same way as Save. A generated schedule can be held by at most one saved plan (unique `GeneratedScheduleId`).

## Validation rules

### Name (Rename and Save changes)

`SavedPlanValidator.CheckName`, unchanged: required, not only spaces, at most 80 characters after trimming. The messages are "Enter a plan name." and "Plan name can be at most 80 characters." (key `name`).

### Copy name

`SavedPlanValidator.CopyName(original)`: `"Copy of " + original`, cut to 80 characters. A trailing half of a surrogate pair is dropped (research section 6).

### Save changes (`PUT /api/plans/{id}`)

Checked in this order:

1. **Owner**: the plan exists, otherwise 404, and belongs to the caller, otherwise 403. Nothing else is checked for a missing or foreign plan.
2. **Name**: as above.
3. **Generated schedule**, through `GeneratedScheduleService.FindSavableAsync` (shared with Save):

| Rule | Message (key `generatedScheduleId`) |
|---|---|
| Sent, and remembered and not expired, or already held by **this** plan | "Generate the schedule again to save it." |
| Not held by **another** saved plan | "Generate the schedule again to save it." |
| Something is scheduled in it | "There is nothing to save in this schedule." |

Name and schedule errors are returned together. When this plan already holds the id, only the name is applied (research section 3).

## Service results

### SavedPlanChange (`Services/SavedPlanChange.cs`, new record)

The result of every change operation in `SavedPlanChangeService`. It has the same shape as `SavePlanResult` and `SavedPlanLookup`.

| Outcome | Carries | HTTP |
|---|---|---|
| `Changed` | the plan (rename, save changes, duplicate) | 200, or 201 for a duplicate |
| `Deleted` | nothing | 204 |
| `Invalid` | field errors | 400 |
| `NotFound` | nothing | 404 |
| `Forbidden` | nothing (no plan data) | 403 |

## Browser state (frontend)

### Plan edit (`stores/usePlanEditStore.ts`, new, `sessionStorage` key `spek-laiku-plan-edit`)

| Field | Type | Rules |
|---|---|---|
| `edit` | `{ planId: string; planName: string; ownerEmail: string } \| null` | Set by "Edit plan" after the setup and activities stores are filled. Cleared by Cancel editing, a successful Save changes, deleting that plan, logout, or a different signed-in email (research section 10). |
| `savedPlanKey` | `string \| null` | Set by a successful Save plan or Save changes from the checked setup and activities (the same key as `useKeptScheduleStore`, from `helpers/planKey.ts`). A plan in progress whose key equals it counts as saved (spec FR-013). Cleared on logout and when the editing notice discards another account's edit. |

The plan in progress itself stays in the existing `usePlanSetupStore` and `usePlanActivitiesStore` (features 004 and 005).

### Filling the plan in progress from a saved plan (`helpers/planFromSavedPlan.ts`, new)

| Store field | From the saved plan |
|---|---|
| setup `location` | `location` (`id`, `name`, `area`, `latitude`, `longitude`) |
| setup `locationText` | `locationLabel(location)` ("Kaunas, Kaunas City Municipality") |
| setup `dates` | `dates` |
| setup `maxTravelDistanceText` | `String(maxTravelDistanceKm)` |
| setup `checked`, `recheckNotice` | `null`, `false` |
| activities `activities[]` | one per saved activity: new `crypto.randomUUID()` id, `categoryId`, `name`, `type`, `durationText = String(durationHours)`, `requiresDaylight`, each limit as text (`""` for `null`) |
| activities `checked`, `recheckNotice` | `null`, `false` |

### Other browser state

- **Plan actions** (`stores/usePlanActionsStore.ts`, new, not persisted): `pending: { kind: "delete" | "duplicate"; planId } | null`, `error: { kind; planId; message } | null`, `notice: string | null`. The message for an error is "Error: Plan could not be deleted. Try again.", "Error: Plan could not be duplicated. Try again." or "This plan no longer exists.". The notice is "Plan deleted." or "Plan duplicated.". The pending message is "Deleting your plan…" or "Duplicating your plan…", and rename shows "Renaming your plan…". These are shown in the page's `role="status"` region while the request runs (spec FR-020).
- **Rename** (`stores/useRenamePlanStore.ts`, new, not persisted): `status` (`closed`, `open`, `saving`, `renamed`, `invalid`, `notFound`, `sessionExpired`, `serverError`), `name`, `nameError`, `nameRefusals`, `lastRequest`, `controller`. It has the same shape as `useSavePlanStore`.
- **Save plan** (`stores/useSavePlanStore.ts`, changed): `submit({ generatedScheduleId, planId?, setup, activities })` sends `PUT /api/plans/{planId}` when a plan id is given. `lastSubmission` replaces `lastRequest` and keeps all four values for Retry and the saved marker. It has a new status, `planGone`. `saveAsNew()` keeps the name and reopens the form for `POST /api/plans`.
- **Saved plans list** (`stores/useSavedPlansStore.ts`, changed): `remove(id)` and `insertAbove(copy, originalId)`.
- **Saved plan** (`stores/useSavedPlanStore.ts`, changed): `rename(name)` updates the loaded plan's name after a rename.
- **Navigation state** (`types/navigationState.ts`, changed): `planNotice?: "deleted" | "duplicated"`.
- **Types** (`types/savedPlan.ts`, changed): `SavedPlan.location.id` and `SavedPlan.activities: SavedPlanActivity[]` (the shape of `CheckedPlanActivity` without its browser `id`).
