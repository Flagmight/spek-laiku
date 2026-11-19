# API Contract: Plan management (`/api/plans`)

**Date**: 2026-11-19 | **Plan**: [plan.md](../plan.md) | **Data model**: [data-model.md](../data-model.md)

This contract adds four endpoints and changes two existing ones from feature 010 ([../../010-save-view-plans/contracts/plans-api.md](../../010-save-view-plans/contracts/plans-api.md)). `POST /api/plans` is unchanged.

All endpoints below:

- **Authorization**: policy `ActiveRegisteredUser`, the same as feature 010 (research section 8).
  - Not signed in, or the session has ended → **401** with no body.
  - Signed in as an Administrator or a Suspended user → **403** with the standard problem body and no plan data.
- **Ownership**: checked on every request, after the policy.
  - Another user's plan → **403** with the standard problem body. No plan data is returned, and the plan is not changed, copied or deleted (spec FR-015).
  - No plan with this id → **404** with `"detail": "This plan no longer exists."`, the same body as `GET /api/plans/{id}`. Nothing is created or changed.
- `{id}` is a GUID. An id that is not a GUID does not match the route and gives **404**.
- **Rate limit**: none. No external service is called (spec FR-017).
- **Unexpected failure**: **500**, the general problem body from `ApiExceptionHandler`.
- Times are UTC ISO 8601 and dates `yyyy-MM-dd`. JSON is camelCase.

The **summary** body used below is feature 010's `SavedPlanSummaryResponse`:

```json
{
  "id": "0b8f4c1e-7d2a-4f3b-9e6c-5a1d2c3b4e5f",
  "name": "Weekend in Kaunas",
  "locationName": "Kaunas",
  "dates": ["2026-11-21", "2026-11-22"],
  "savedAt": "2026-11-18T12:05:00Z"
}
```

---

## DELETE /api/plans/{id}: delete a plan

No request body.

### 204 No Content

The plan is deleted permanently (spec FR-001). It no longer appears in `GET /api/plans`, and `GET /api/plans/{id}` gives 404.

### 403 / 404

As above. A second delete of the same plan gives **404**.

---

## POST /api/plans/{id}/copies: duplicate a plan

No request body. Any body sent is ignored, including an owner. The copy always belongs to the signed-in user (spec FR-016).

### 201 Created

`Location: /api/plans/{copyId}`

The summary of the copy:

```json
{
  "id": "5d2e9a7c-1b3f-4c8d-a6e2-9f0b1c2d3e4f",
  "name": "Copy of Weekend in Kaunas",
  "locationName": "Kaunas",
  "dates": ["2026-11-21", "2026-11-22"],
  "savedAt": "2026-11-18T12:05:00Z"
}
```

- `name` is `"Copy of " + original name`, at most 80 characters (research section 6, spec FR-005).
- `savedAt` is the original's `savedAt` (clarification Q3).
- The copy has the original's setup, activities and schedule (spec FR-004).
- `GET /api/plans` lists it directly above its original (research section 5).

Every request creates a new copy. The browser makes sure one action sends one request (research section 12).

### 403 / 404

As above.

---

## PUT /api/plans/{id}/name: rename a plan

### Request

```json
{ "name": "Kaunas trip" }
```

| Field | Type | Rules |
|---|---|---|
| `name` | string | Required. 1 to 80 characters after trimming. Not unique. The same rule and messages as `POST /api/plans`. |

### 200 OK

The summary with the new name. `savedAt` and the schedule are unchanged (spec FR-014).

### 400 Bad Request

```json
{
  "title": "One or more request fields are invalid.",
  "status": 400,
  "errors": { "name": ["Enter a plan name."] }
}
```

The `name` message is "Enter a plan name." or "Plan name can be at most 80 characters.". The ownership check comes first: another user's plan gives 403 and a missing plan 404, even with an invalid name.

### 403 / 404

As above.

---

## PUT /api/plans/{id}: save changes from an edit

The body is the same as `POST /api/plans`:

```json
{
  "generatedScheduleId": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
  "name": "Weekend in Kaunas"
}
```

| Field | Type | Rules |
|---|---|---|
| `generatedScheduleId` | string (GUID) | Required. From `POST /api/plan-schedule`, at most 30 minutes old, with at least one scheduled activity. It must not already be saved in another plan. |
| `name` | string | Required. 1 to 80 characters after trimming. |

Any other field (setup, activities, times, places, weather, owner) is ignored. The plan's content always comes from the remembered schedule (spec FR-011).

### 200 OK

The summary of the changed plan:

- Same `id`.
- The new name, location name and dates.
- `savedAt` = now.

The plan's setup, activities and schedule are replaced by the remembered ones (spec FR-010).

When this plan already holds this `generatedScheduleId` (a repeat or a double submit), only the name is applied and **200** is returned. Nothing else changes, and no second plan exists (research section 3).

### 400 Bad Request

Name errors and schedule errors are returned together, as for `POST /api/plans`:

| Key | Message | When |
|---|---|---|
| `name` | "Enter a plan name." / "Plan name can be at most 80 characters." | Name rules. |
| `generatedScheduleId` | "Generate the schedule again to save it." | Missing, unknown, expired, or already saved in another plan. |
| `generatedScheduleId` | "There is nothing to save in this schedule." | Nothing scheduled. |

The plan is unchanged after any 400.

### 403 / 404

As above. When the plan was deleted (for example in another tab), the answer is **404**. The browser then offers "Save it as a new plan instead." with the same `generatedScheduleId` through `POST /api/plans` (spec FR-012).

---

## GET /api/plans/{id}: changed

The 200 body of feature 010 gains two things (research section 4). Everything else is unchanged.

- `location.id`: the place id from the location search (`long`). Plan Setup sends it on Continue.
- `activities`: the plan's activities as they were saved, each in the shape of `CheckedPlanActivityResponse` (feature 005):

```json
{
  "id": "0b8f4c1e-7d2a-4f3b-9e6c-5a1d2c3b4e5f",
  "name": "Weekend in Kaunas",
  "savedAt": "2026-11-18T12:05:00Z",
  "location": { "id": 598316, "name": "Kaunas", "area": "Kaunas City Municipality", "latitude": 54.90272, "longitude": 23.90961 },
  "dates": ["2026-11-21", "2026-11-22"],
  "maxTravelDistanceKm": 30,
  "activities": [
    {
      "categoryId": "3f2a1b0c-9d8e-4f7a-b6c5-d4e3f2a1b0c9",
      "name": "Cycling",
      "type": "Outdoor",
      "durationHours": 3,
      "requiresDaylight": true,
      "maxWindMs": 8,
      "maxRainMmPerHour": 0.5,
      "minTemperatureC": 5,
      "maxTemperatureC": 28
    }
  ],
  "scheduled": [ "… unchanged …" ],
  "unscheduled": [ "… unchanged …" ],
  "travel": { "maxDistanceKm": 30, "tripsOverLimit": 0 }
}
```

The four limits are `null` for an Indoor activity. The owner, the generated schedule id and the places' internal keys are still not sent.

## GET /api/plans: changed order

The body is unchanged. Order: `savedAt` newest first, then the most recently created first (so a copy is directly above its original), then by id (research section 5).
