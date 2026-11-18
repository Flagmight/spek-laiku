# Quickstart Validation Guide: 010-save-view-plans

**Date**: 2026-11-18 | **Plan**: [plan.md](plan.md) | **API contracts**: [contracts/plans-api.md](contracts/plans-api.md), [contracts/plan-schedule-api.md](contracts/plan-schedule-api.md) | **Data model**: [data-model.md](data-model.md)

This guide describes how to check saving and viewing plans after the branch is implemented. The automated tests are the deterministic proof: they use fake forecast and map data and a fixed clock. The manual scenarios use live data.

## Prerequisites

1. The app running as in the README, "Run the application": local PostgreSQL, the API with `dotnet run --project .\backend\src\SpekLaiku.Api --launch-profile https`, and the frontend with `npm run dev` in `frontend/`. The API needs internet access to Open-Meteo and Overpass.
2. Apply the new migration first (from `backend/`): `dotnet ef database update --project src/SpekLaiku.Api`. Check that the tables `SavedPlans` and `GeneratedSchedules` exist.
3. Two Registered User accounts (A and B), one Administrator and one Suspended user. See the README, "Testing an Administrator or Suspended account".
4. A plan that schedules at least one activity: Kaunas, tomorrow, **Heritage site** (indoor, so it is scheduled in any weather).

## Automated checks

From `backend/`: `dotnet build` and `dotnet test`. From `frontend/`: `npm run lint`, `npm test` and `npm run build`. All must pass. The new tests are listed in [plan.md](plan.md), "Testing".

---

## Scenario 1: Save as a Registered User

**Goal**: spec User Story 1, FR-001 to FR-005.

1. Log in as A. Create the plan above and click **Generate schedule**.
2. On the Schedule Overview, click **Save plan**. Leave the name empty and click **Save**.
3. Enter 81 characters and click **Save**.
4. Enter "Weekend in Kaunas" and click **Save**.

Expected:

- Step 2: "Enter a plan name." next to the field, with focus on the field.
- Step 3: "Plan name can be at most 80 characters."
- Step 4: "✓ Success: Plan saved." with a link to My plans. **Save plan** is no longer shown.
- In the database, `SavedPlans` has one row for A, and its `Snapshot` contains the schedule's activities.

## Scenario 2: Visitor saves through Log in and Register

**Goal**: spec User Story 2, FR-006 to FR-008, SC-002.

1. Log out. Create the same plan as a Visitor and generate it. Note the place and times.
2. Click **Save plan**. The Log in page shows "Log in to continue.".
3. Log in as A. The Schedule Overview opens with the same place and times, without "Generating your schedule…".
4. Click **Save plan**, enter a name and save. Then log out.
5. Repeat steps 1 and 2, but click **Create an account** on Log in and register a new email.

Expected:

- Step 3: the same schedule as in step 1.
- Step 5: after registering, the Schedule Overview opens with "✓ Success: Account created." and the same schedule, and **Save plan** opens the form.
- Opening `/register` from the navigation and registering still lands on Home.

## Scenario 3: Expired schedule

**Goal**: spec FR-004, Edge Case "more than 30 minutes".

1. Log in as A, generate a schedule, and wait more than 30 minutes. Alternatively, in the database, set that row's `ExpiresAtUtc` in `GeneratedSchedules` to the past.
2. Click **Save plan**, enter a name and save.

Expected: "Generate the schedule again to save it." with **Generate again**, and the entered name is kept. After **Generate again** the new schedule can be saved.

## Scenario 4: My plans, Home and the plan page

**Goal**: spec User Stories 3, 4 and 6, FR-009 to FR-011, SC-003.

1. As A, save three plans with different names.
2. Open **My plans** from the navigation, then **Home**.
3. On My plans, click **Open** on the first plan.
4. Log out, log in again as A and open the same plan.

Expected:

- My plans: all of A's plans, newest first, each with name, location, dates and "Saved on … at …" in Lithuanian time.
- Home: "Your saved plans" with up to 5 plans and **All my plans**.
- Plan page: the plan name as the heading, breadcrumbs "Home › My plans › <name>", location, dates, maximum travel distance, "Saved on …", the note "This is your plan as saved on …", and the same schedule, travel information and unscheduled activities as when it was saved. There are no edit, recalculate, duplicate or delete actions.
- With the network tab open: opening the plan makes no request to `/api/plan-schedule`, `/api/plan-forecast` or `/api/plan-places`.
- Spec SC-005: My plans and the plan page each finish loading within 2 seconds (network tab, request to `/api/plans` and `/api/plans/{id}`). To check with 50 plans, copy one `SavedPlans` row 49 times in the local database with new `Id` values and `GeneratedScheduleId` set to `NULL`.
- At desktop width My plans is a table with the columns Plan, Location, Dates and Saved. At 320 px each plan is a labelled card.

## Scenario 5: Privacy and roles

**Goal**: spec User Story 5, FR-012 to FR-014, SC-004.

1. As A, open a plan and copy its address.
2. Log in as B and open that address. Then open My plans.
3. Log out and open the address as a Visitor.
4. Log in as the Administrator, then as the Suspended user, and open `/plans` and the address.
5. As A, change the last character of the plan id in the address.

Expected:

- Step 2: the Access Denied page with links to Home and My plans, and no plan data. B's My plans does not list A's plans.
- Step 3: Log in with "Log in to continue.". Logging in as A then opens the plan.
- Step 4: the Administrator has no **My plans** link and sees Access Denied. The Suspended user goes to the Account suspended page.
- Step 5: "Plan not found" with "This plan no longer exists.".

## Scenario 6: Phone width, keyboard and screen reader

**Goal**: spec User Story 7, FR-018, SC-006.

At 320 px, with the keyboard only and a screen reader, repeat Scenario 1 and open the plan from My plans.

Expected:

- No horizontal scrolling.
- My plans shows cards with the plan name as the title.
- Escape closes the Save plan form.
- Status messages are announced.
- Each Open button is announced as "Open <plan name>".
