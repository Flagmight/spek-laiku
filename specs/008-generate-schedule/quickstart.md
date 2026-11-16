# Quickstart Validation Guide: 008-generate-schedule

**Date**: 2026-11-16 | **Plan**: [plan.md](plan.md) | **API contract**: [contracts/plan-schedule-api.md](contracts/plan-schedule-api.md)

This guide describes how to verify that the implemented feature is working end-to-end. Run each scenario after the branch is implemented.

## Prerequisites

1. Local PostgreSQL running: `docker compose up -d` (from repo root).
2. Backend running: `cd backend && dotnet run --project src/SpekLaiku.Api`.
3. Frontend running: `cd frontend && npm run dev`.
4. At least one activity category seeded with Overpass tags (from feature 005 seed or integration test data).
5. A Visitor session (unauthenticated) or a logged-in Active Registered User.

---

## Scenario 1: Happy path — full schedule generated

**Goal**: Verify SC-002, SC-003, SC-004 and FR-007/FR-008.

Steps:
1. Complete Plan Setup: pick a location (e.g., Kaunas), 2 dates starting tomorrow.
2. Add two activities: one outdoor (e.g., "Kayaking", 2 h, outdoor, weather limits), one indoor (e.g., "Museum", 3 h, indoor).
3. Navigate to step 3 (Places and forecast); wait for both forecast and places to load.
4. Click "Generate schedule".

Expected:
- Progress bar advances to "Schedule Overview" (step 4).
- "Generating your schedule…" is shown briefly.
- Each activity appears exactly once — either as scheduled (with date, time, place and weather) or in the "Could not be scheduled" section.
- Scheduled activities are grouped by date in ascending order; within each date they are ordered by start time.
- The indoor activity row shows "Weather does not affect this indoor activity." instead of weather values.
- SC-004: no two scheduled activities share an overlapping time slot on the same date.

---

## Scenario 2: Activity without a place

**Goal**: Verify FR-006 and US2 SC-2.

Steps:
1. Add an activity in a category that has no Overpass tags configured (or one where Overpass returns no results for the chosen location).
2. Load forecast and places on step 3 (places card shows "No places found").
3. Click "Generate schedule".

Expected:
- Activity appears in the unscheduled section with reason "No place found."
- It does not appear in the scheduled list.

---

## Scenario 3: Competing time slots → one activity unscheduled

**Goal**: Verify FR-005 and FR-006 with `NoSuitableTime`.

Steps:
1. Add two outdoor activities with identical weather limits and 1-hour duration, in a plan with one date.
2. Load forecast and places (each activity has the same single suitable period on that date).
3. Click "Generate schedule".

Expected:
- First activity (plan order) appears as scheduled.
- Second activity appears in unscheduled section with "No suitable time found."

---

## Scenario 4: Navigate back clears schedule

**Goal**: Verify FR-014 (spec clarification: cleared on leaving step 4).

Steps:
1. Generate a schedule (Scenario 1).
2. Click Back (or the step 3 item in the progress bar).
3. Navigate back to step 4 by clicking "Generate schedule" again.

Expected:
- After clicking Back: the browser is on `/plan/places` (step 3), not `/plan/schedule`.
- After clicking "Generate schedule" again: "Generating your schedule…" appears again (fresh request, no cached result shown instantly).

---

## Scenario 5: Weather service unavailable

**Goal**: Verify FR-013 (503 with `service: "forecast"`).

Steps:
1. Configure the backend to use a fake / unreachable Open-Meteo URL (or use the integration test `RecordingForecastClient` stub that throws `ExternalServiceException(ExternalService.Forecast)`).
2. Navigate to step 3 and load forecast/places (may succeed from cache).
3. Click "Generate schedule".

Expected:
- 503 response body contains `"service": "forecast"`.
- Schedule Overview shows "Error: The weather service is unavailable." with a Retry button.
- Clicking Retry re-sends the POST.

---

## Scenario 6: Map data service unavailable

**Goal**: Verify FR-013 (503 with `service: "places"`).

Same as Scenario 5 but configure the Overpass client to throw `ExternalServiceException(ExternalService.MapData)`.

Expected:
- 503 body contains `"service": "places"`.
- Schedule Overview shows "Error: The map data service is unavailable. No places are shown." with Retry.

---

## Scenario 7: Unauthorized access

**Goal**: Verify FR-010 (US3 SC-2).

Steps:
1. Send `POST /api/plan-schedule` as an Active Administrator (or Suspended user, or deleted account).

Expected:
- Server returns `403 Forbidden`.
- Schedule service is not called (verify via test assertion or log absence).

---

## Scenario 8: Rate limit

**Goal**: Verify FR-012 (shared `PlanSetup` limit).

Steps:
1. Send 31 `POST /api/plan-schedule` requests within one minute from the same IP address (combine with forecast/places requests if needed to hit 30).

Expected:
- 31st request returns `429 Too Many Requests`.
- UI shows "Error: Too many requests. Wait a minute and try again." with Retry.

---

## Backend commands

```powershell
# From backend/
dotnet build
dotnet test
dotnet format --verify-no-changes
```

## Frontend commands

```powershell
# From frontend/
npm run lint
npm test
npm run build
```

---

## Acceptance checklist

After running all scenarios, confirm:

- [ ] SC-001: Schedule appears within 5 seconds of clicking "Generate schedule" with cached data.
- [ ] SC-002: Every activity with a place and an available non-overlapping slot is scheduled.
- [ ] SC-003: Every activity without a place or slot appears in the unscheduled list with its reason.
- [ ] SC-004: No overlapping scheduled activities on the same date.
- [ ] SC-005: Schedule Overview is usable at 320 px width with no horizontal scrolling.
- [ ] SC-006: Unauthorized caller receives 403 and no schedule data.
