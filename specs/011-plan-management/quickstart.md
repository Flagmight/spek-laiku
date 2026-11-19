# Quickstart Validation Guide: 011-plan-management

**Date**: 2026-11-19 | **Plan**: [plan.md](plan.md) | **API contract**: [contracts/plans-api.md](contracts/plans-api.md) | **Data model**: [data-model.md](data-model.md)

This guide describes how to check deleting, duplicating, renaming and editing saved plans after the branch is implemented. The automated tests are the deterministic proof: they use fake forecast and map data and a fixed clock. The manual scenarios use live data.

## Prerequisites

1. The app running as in the README, "Run the application": local PostgreSQL, the API and the frontend. The API needs internet access to Open-Meteo and Overpass for the editing scenario.
2. Apply the new migration (from `backend/`): `dotnet ef database update --project src/SpekLaiku.Api`. Check that `SavedPlans` has a `CreatedAtUtc` column and that plans saved before the migration have `CreatedAtUtc` equal to `SavedAtUtc`.
3. Two Registered User accounts (A and B), one Administrator and one Suspended user, as in feature 010.
4. As A, two saved plans:
   - "Weekend in Kaunas": Kaunas, tomorrow, **Heritage site** and **Picnic**.
   - "Vilnius day": any setup.

## Automated checks

From `backend/`: `dotnet build`, `dotnet test` and `dotnet format --verify-no-changes`. From `frontend/`: `npm run lint`, `npm test` and `npm run build`. All must pass. The new and changed tests are listed in [plan.md](plan.md), "Testing".

---

## Scenario 1: Delete with confirmation

**Goal**: spec User Story 1, FR-001 to FR-003, SC-006.

1. As A, open **My plans**. Click **Delete** on "Vilnius day".
2. Press **Escape**.
3. Click **Delete** again, then **Delete** in the dialog.
4. Open the deleted plan's old address.

Expected:

- Step 1: a dialog "Delete 'Vilnius day'? This cannot be undone." with **Delete** and **Cancel**, and focus inside it.
- Step 2: the dialog closes, focus is back on the **Delete** button, and the plan is still listed.
- Step 3: "Plan deleted." is announced, and the row is gone. Focus is on the next row's **Open**, or on the "My plans" heading.
- Step 4: "This plan no longer exists." with links to Home and My plans.

## Scenario 2: Duplicate

**Goal**: spec User Story 2, FR-004 to FR-006, SC-002, SC-004.

1. On **My plans**, click **Duplicate** on "Weekend in Kaunas".
2. Reload the page.
3. Open the copy and compare it with the original.
4. On the copy's plan page, click **Duplicate**.

Expected:

- Step 1: "Plan duplicated." and a row "Copy of Weekend in Kaunas" directly above the original, with the same Saved date and time.
- Step 2: the same order after the reload.
- Step 3: the same location, dates, distance, schedule, unscheduled activities and note "This is your plan as saved on …".
- Step 4: the page of "Copy of Copy of Weekend in Kaunas" opens with "Plan duplicated.".

## Scenario 3: Rename

**Goal**: spec User Story 4, FR-014.

1. Open "Weekend in Kaunas" and click **Rename**. Clear the name and click **Save**.
2. Enter "Kaunas trip" and click **Save**.

Expected:

- Step 1: "Enter a plan name." next to the field, with focus on the field.
- Step 2: "✓ Success: Plan renamed."; the heading, the tab title and the breadcrumbs show "Kaunas trip"; "Saved on" and the schedule are unchanged.

## Scenario 4: Edit and save changes

**Goal**: spec User Story 3, FR-007 to FR-013, SC-003.

1. Open "Kaunas trip" and click **Edit plan**.
2. Check Plan Setup and click **Continue**. On Activity Selection, remove **Picnic**, add **Museum** and click **Continue**.
3. On Places and Forecast, click **Generate schedule**. On the Schedule Overview, click **Save changes** and confirm.
4. Open **My plans**.

Expected:

- Step 1: Plan Setup shows Kaunas, the saved dates and distance, with the notice "Editing 'Kaunas trip'. Your saved plan is not changed until you save." and **Cancel editing**. Activity Selection shows the saved activities and settings.
- Step 3: "✓ Success: Changes saved." with **Open plan**. The plan page shows Heritage site and Museum, and "Saved on" is now.
- Step 4: one "Kaunas trip", now at the top. There is no second plan.

**Variations**:

- **Cancel editing** on any step opens the plan page unchanged.
- Edit a plan whose dates have passed: Plan Setup shows "Dates cannot be in the past." until the dates are replaced.
- Start creating a new plan (enter a location), then open a saved plan and click **Edit plan**: "Editing this plan replaces the plan you have not saved. Continue?" appears. **Cancel** keeps the new plan.
- While editing in tab 1, delete the plan in tab 2, then click **Save changes** in tab 1: "This plan no longer exists. Save it as a new plan instead." with **Save plan**, which saves a new plan.
- Wait more than 30 minutes after generating, then save: "Generate the schedule again to save it." with **Generate again**.

## Scenario 5: Nobody else can change a plan

**Goal**: spec User Story 5, FR-015, FR-016, SC-005.

As A, note a plan id. As B, send these requests with B's session cookie (for example from the browser console with `fetch`, `credentials: "include"`):

- `DELETE /api/plans/{id}`
- `POST /api/plans/{id}/copies`
- `PUT /api/plans/{id}/name` with `{"name":"x"}`
- `PUT /api/plans/{id}` with a fresh `generatedScheduleId` and a name

Repeat them signed out, as the Administrator and as the Suspended user.

Expected:

- B: **403** with no plan data.
- Signed out: **401**.
- Administrator and Suspended user: **403**.
- A's plan is unchanged and no copy is listed for anyone.
- An unknown GUID gives **404** "This plan no longer exists.".

## Scenario 6: Phone, keyboard and screen reader

**Goal**: spec User Story 6, FR-019, FR-020, SC-007.

At 320 px width, with the keyboard only and a screen reader on, repeat Scenarios 1 to 3.

Expected:

- No horizontal scrolling. My plans shows cards with **Open**, **Duplicate** and **Delete** under the name.
- The actions are read as "Delete Weekend in Kaunas" and similar.
- The dialog keeps Tab inside and closes with Escape.
- "Plan deleted.", "Plan duplicated." and the errors are announced without moving focus.
