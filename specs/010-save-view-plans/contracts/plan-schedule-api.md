# API Contract Change: POST /api/plan-schedule (generated schedule id)

**Date**: 2026-11-18 | **Plan**: [plan.md](../plan.md)

Feature 010 adds one field to the **200 OK** response of the existing endpoint. The method, path, authorization (`PlanCreator`, so Visitors and Active Registered Users), the shared `PlanSetup` rate limit, the request body and every error response stay as in [../../008-generate-schedule/contracts/plan-schedule-api.md](../../008-generate-schedule/contracts/plan-schedule-api.md) and [../../009-travel-distance/contracts/plan-schedule-api.md](../../009-travel-distance/contracts/plan-schedule-api.md).

## 200 OK: schedule generated (changed)

```json
{
  "generatedScheduleId": "6f1c2a8e-3b7d-4e55-9a10-0c4f2d9b7e31",
  "scheduled": [ … unchanged … ],
  "unscheduled": [ … unchanged … ],
  "travel": { "maxDistanceKm": 30, "tripsOverLimit": 0 }
}
```

| Field | Type | Meaning |
|---|---|---|
| `generatedScheduleId` | string (GUID) or `null` | The id under which the server remembers this exact schedule, with its setup and activities, for 30 minutes (spec FR-004). `null` when `scheduled` is empty, because there is nothing to save. |

- Each successful request with at least one scheduled activity creates a new id. Generating again never reuses an id.
- The id is unguessable (research section 3), and it does not identify the person who generated it. A Visitor's id still works after they log in or register in the same tab.
- Saving uses the id with `POST /api/plans` ([plans-api.md](plans-api.md)).
- Generating stores one database row. It does not change the 5-second target (feature 008 SC-004).
