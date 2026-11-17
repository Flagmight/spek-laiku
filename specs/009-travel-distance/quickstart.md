# Quickstart Validation Guide: 009-travel-distance

**Date**: 2026-11-17 | **Plan**: [plan.md](plan.md) | **API contract**: [contracts/plan-schedule-api.md](contracts/plan-schedule-api.md) | **Data model**: [data-model.md](data-model.md)

This guide describes how to verify the travel distance check after the branch is implemented. The automated tests are the deterministic proof: they use fake forecast and map data with known positions. The manual scenarios use live data, so the exact places and distances vary.

## Prerequisites

1. The app running as in the README, "Run the application": a local PostgreSQL database with the migrations applied (no new migration in this feature), the API started with `dotnet run --project .\backend\src\SpekLaiku.Api --launch-profile https`, and the frontend with `npm run dev` in `frontend/`. The API needs internet access to Open-Meteo and Overpass.
2. The five starter categories (feature 003 migration). In November, Kayaking and Picnic need at least 15 °C and will usually get "No suitable time found"; **Cycling** (at least 5 °C) and **Heritage site** (at least 0 °C) are the ones to use. Both have many places in Kaunas.
3. A Visitor session (not logged in) is enough.

**Note on getting two activities on one date**: since feature 008, each scheduled activity takes its whole suitable period, and an indoor activity's period is 06:00 to 22:00. Two activities therefore share a date only when their suitable periods do not overlap. With live weather, split the day by temperature:

1. Plan setup: Kaunas, **one** date (tomorrow), then add Cycling and Heritage site with a duration of 1 h each, and continue to step 3.
2. On step 3, open **Show forecast details** and **Show hours** for the date, and read the temperatures. Pick a value T between the cooler and the warmer hours that no hour has exactly (a value equal to a limit is accepted, which would let both activities use that hour).
3. Go back to **Activities** with the progress bar: set Heritage site's **maximum** temperature to T and Cycling's **minimum** temperature to T. Continue to step 3 again.
4. The overview row of each activity should now show different periods on the date. If one is "✗ None", move T, or keep the default limits and try another date.

If every date ends up with one activity, the page correctly shows "Travel: Start of the day" for each, and no travel summary.

---

## Scenario 1: Trips within the limit

**Goal**: spec User Story 1, FR-001, FR-007, FR-008.

1. Set up Cycling and Heritage site on one date with maximum travel distance 30, split by temperature as in the note above.
2. Step 3: wait for the forecast and places, then click **Generate schedule**.

Expected:

- The first activity of each date shows "Travel: Start of the day".
- Each later activity on the same date shows "Travel: <d.d> km from <previous place name>". The previous place name is the place shown on the entry above it.
- If at least one date has two or more activities: "✓ All trips within your 30 km limit." is shown at the top, next to the scheduling summary.
- Times, dates and weather are the same as before this feature.

## Scenario 2: Trip over the limit

**Goal**: spec User Stories 2 and 3, FR-002, FR-005, FR-008.

1. Repeat Scenario 1 with maximum travel distance **1** (Plan setup, Continue, then Continue on Activities). Places are searched within 1 km of the location, so two different places can be up to 2 km apart.
2. Generate the schedule.

With up to 5 listed places per activity, the travel check often finds one within 1 km (Scenario 3), so the result may be "✓ All trips within your 1 km limit." instead of a ✗. That is correct behaviour; the ✗ case is covered by the automated tests. To make a ✗ more likely, pick a location with few places nearby (a small town) and keep the maximum at 1 or 2 km.

Expected:

- A trip longer than 1.0 km shows "Travel: ✗ <d.d> km from <previous place name>, more than your 1 km limit".
- The top shows "✗ <n> trip(s) longer than your 1 km limit.", with n equal to the number of ✗ travel lines.
- A trip of exactly "1.0 km" is not flagged.
- The flagged activity still appears in the schedule (not in "Could not be scheduled") and uses the place shown first for it in step 3.

## Scenario 3: Another listed place keeps the trip within the limit

**Goal**: spec User Story 2 scenario 2, SC-002. This is checked by the automated tests (`TravelDistanceRulesTests`, `PlanScheduleTravelTests`), because live data cannot be arranged reliably. Manually, if an entry's place is not the first place listed for that activity in step 3, its trip must be within the limit.

## Scenario 4: Changing the maximum

1. From the Schedule Overview, go back to Plan Setup, change the maximum travel distance and continue to step 3.
2. Generate the schedule again.

Expected: the summary and the ✗ flags use the new maximum (spec Edge Cases).

## Scenario 5: Phone width and screen reader

**Goal**: spec User Story 4, FR-012, SC-006.

At 320 px width: every "Travel: …" text wraps inside its entry, with no horizontal scrolling. With a screen reader, the travel summary is read as part of the status text, and each entry is read with its travel text after the place and the weather. ✗ is always accompanied by words.

## Scenario 6: Unchanged behaviour

Authorization (403 for an administrator or a suspended account), 429, 503 with `service`, plan-out-of-date redirects and clearing the schedule on leaving step 4 all behave as in the [feature 008 quickstart](../008-generate-schedule/quickstart.md), Scenarios 4 to 8.

---

## Backend commands

```powershell
# From the repository root (SpekLaiku.slnx is there, as in CI)
dotnet build SpekLaiku.slnx
dotnet test SpekLaiku.slnx
dotnet format SpekLaiku.slnx --verify-no-changes
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

- [ ] SC-001: every trip over the maximum is flagged, and no trip within it is flagged (unit and endpoint tests, Scenario 2).
- [ ] SC-002: when a listed place fits, the trip is not over the limit (unit tests, Scenario 3).
- [ ] SC-003: every shown distance matches the straight-line distance between the two places to 0.1 km (unit tests).
- [ ] SC-004: the schedule still appears within 5 seconds with cached data.
- [ ] SC-005: the top of the page says whether the plan goes over the maximum (Scenarios 1 and 2).
- [ ] SC-006: travel information is usable at 320 px, with a keyboard and with a screen reader (Scenario 5, frontend responsive and accessibility tests).
- [ ] Feature 008 behaviour is unchanged (Scenario 6, existing tests green).
