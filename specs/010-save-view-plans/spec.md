# Feature Specification: Save and View Plans

**Feature Branch**: `010-save-view-plans`

**Created**: 2026-11-18

**Status**: Draft

**Input**: Feature 010 from the roadmap. "Save and View Plans: a Registered User saves a generated plan and later sees a list of their saved plans and opens one. A Visitor's current plan is kept through login so it can then be saved. Users can only see and open their own plans; a Visitor cannot save permanently. Covers FR-020, FR-021, FR-025, FR-026, FR-038." Editing, duplicating and deleting saved plans (FR-022 to FR-024, feature 011), recalculating a saved plan and detecting problems (FR-033, FR-034, feature 012) and alternatives (FR-048, feature 013) are out of scope.

## Clarifications

### Session 2026-11-18

- Q: When a user saves a plan, how should the server make sure the saved schedule is really one the app produced, and not times or places edited in the browser? → A: The server remembers each generated schedule for a limited time (30 minutes), and Save refers to it. If it has expired, the user sees "Generate the schedule again to save it."
- Q: When a Visitor selects "Save plan", goes to Log in, and chooses to register instead, where should they land after registering? → A: Registering from the "Save plan" route returns the user to the Schedule Overview with the "✓ Success: Account created." banner. All other registrations still go to Home (feature 001). (Refined during planning, research section 9: the Register link on Log in carries any "return to" page, so a Visitor sent to Log in from My plans also returns there after registering. Registration from the navigation or Home still goes to Home.)
- Q: Should Home show a "Your saved plans" block with the user's 5 most recent plans in this feature, or should saved plans appear only on My plans? → A: Include the Home block now: up to 5 most recently saved plans, an "All my plans" link, and its own loading, empty and error states.
- Q: When a signed-in user opens the address of another user's saved plan, should they see "Access Denied" or "This plan no longer exists"? → A: The Access Denied (403) page, as in `docs/ux-design.md`, with no plan data. Only a plan that does not exist gives "This plan no longer exists." (404).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save the schedule I generated (Priority: P1)

An Active Registered User who has generated a schedule on the Schedule Overview selects "Save plan", gives the plan a name and saves it, so the plan is kept under their account after the session ends.

**Why this priority**: This is project FR-020 and the reason the feature exists. Without saving, every plan is lost when the tab is closed.

**Independent Test**: Log in as an Active Registered User, generate a schedule, select "Save plan", enter "Weekend in Kaunas" and save. Check that "✓ Success: Plan saved." is shown with a link to My plans, and that the plan appears in My plans.

**Acceptance Scenarios**:

1. **Given** an Active Registered User on the Schedule Overview with a generated schedule that has at least one scheduled activity, **Then** a "Save plan" button is shown.
2. **Given** the user selects "Save plan", **Then** a Save plan form opens with one required field, "Plan name", and the buttons "Save" and "Cancel".
3. **Given** a plan name of 1 to 80 characters after trimming, **When** the user selects "Save", **Then** the plan is saved under their account, "✓ Success: Plan saved." is shown with a link to My plans, and the "Save plan" button is no longer offered for this schedule.
4. **Given** an empty name or a name of only spaces, **When** the user selects "Save", **Then** "Enter a plan name." is shown next to the field and nothing is saved.
5. **Given** a name longer than 80 characters after trimming, **When** the user selects "Save", **Then** "Plan name can be at most 80 characters." is shown next to the field and nothing is saved.
6. **Given** a name already used by another of the user's plans, **When** the user saves, **Then** the plan is saved. Names need not be unique.
7. **Given** the server fails, does not answer within 10 seconds, or the network fails, **When** the user saves, **Then** "Error: Plan could not be saved. Try again." is shown with a Retry button, the entered name and the schedule are kept, and Retry sends the same request again.
8. **Given** the user selects "Cancel", **Then** the form closes, nothing is saved and the schedule is unchanged.

---

### User Story 2 - Keep my plan when I log in or register to save it (Priority: P1)

A Visitor who has generated a schedule selects "Save plan". They are sent to Log in, where they can log in or go on to Register. Afterwards they are back on the Schedule Overview with the same schedule and can save it.

**Why this priority**: Project FR-026 (a Visitor cannot save permanently) and FR-038 (the Visitor's plan is kept through login or registration). This is Journey 2 in `docs/ux-design.md`. Losing the plan at this step would make visitors start over.

**Independent Test**: As a Visitor, generate a schedule and select "Save plan". Check that the Log in page shows "Log in to continue.". Log in, and check that the Schedule Overview opens with the same scheduled activities, times and places, and that "Save plan" now opens the Save plan form. Repeat with Register instead of Log in.

**Acceptance Scenarios**:

1. **Given** a Visitor on the Schedule Overview with a generated schedule, **Then** a "Save plan" button is shown with the hint "Log in or register to save this plan."
2. **Given** a Visitor selects "Save plan", **Then** they are sent to the Log in page with "Log in to continue.", the Schedule Overview is remembered as the "return to" page, and the plan (setup, activities and generated schedule) is kept in the browser tab session.
3. **Given** the Visitor logs in as an Active Registered User, **Then** they return to the Schedule Overview showing the same schedule as before, and selecting "Save plan" opens the Save plan form.
4. **Given** the Visitor selects the Register link on that Log in page and registers, **Then** they are signed in and return to the Schedule Overview with the same schedule, with the "✓ Success: Account created." banner shown, instead of opening the home page.
5. **Given** the Visitor logs in as a Suspended user, **Then** the Account suspended page opens (feature 002). **Given** they log in as an Administrator, **Then** they return to the Schedule Overview address and see the Access Denied page, as on every plan page for Administrators (feature 004). In both cases nothing is saved.
6. **Given** a Visitor, **Then** the system never stores a plan under any account or keeps it after the tab is closed or the user logs out, even if the save request is sent directly to the server.

---

### User Story 3 - See my saved plans (Priority: P1)

An Active Registered User opens My plans from the navigation and sees all their saved plans, newest first, each with its name, location, dates and when it was saved.

**Why this priority**: Project FR-021. A saved plan is only useful if the user can find it again.

**Independent Test**: As a user with three saved plans, open My plans. Check that all three are listed newest first with name, location, dates and saved date, and that a plan saved by another user does not appear.

**Acceptance Scenarios**:

1. **Given** an Active Registered User, **Then** the navigation shows a "My plans" link.
2. **Given** the user opens My plans, **Then** each of their saved plans is listed with its name, location, dates (for example "Sat 21 Nov, Sun 22 Nov"), the date and time it was saved, and an "Open" action. The list is ordered by saved time, newest first.
3. **Given** a user with no saved plans, **Then** My plans shows "No saved plans yet." with a **New plan** button that opens Plan Setup.
4. **Given** the list is loading, **Then** placeholder rows with "Loading your plans…" are shown and announced.
5. **Given** the list cannot be loaded (server error, 10 second timeout, network failure), **Then** "Error: Saved plans could not be loaded." is shown with a Retry button.
6. **Given** a desktop viewport, **Then** the plans are shown as a table (with column headers Plan, Location, Dates and Saved) with "Open" in the last column. **Given** a 320 px viewport, **Then** the same table is shown as cards, one per plan, with the plan name as the card title, each value labelled, and "Open" below it.
7. **Given** the plans of any other user, **Then** they never appear in this user's list.

---

### User Story 4 - Open a saved plan (Priority: P1)

The user opens one of their saved plans and sees it exactly as it was saved: the setup, the schedule with times, places, weather and travel, and any unscheduled activities.

**Why this priority**: Project FR-021 and Journey 2 step 4. It completes the save-and-return loop.

**Independent Test**: Save a plan, log out, log in again, open My plans and select "Open". Check that the plan page shows the plan name, location, dates, maximum travel distance, the saved date, and the same schedule as on the Schedule Overview when it was saved.

**Acceptance Scenarios**:

1. **Given** the user selects "Open" on one of their plans, **Then** the plan page opens with the plan name as its main heading and the breadcrumbs "Home › My plans › <plan name>".
2. **Given** the plan page, **Then** it shows the location, dates, maximum travel distance, and "Saved on <date> at <time>".
3. **Given** the plan page, **Then** it shows the schedule as saved, in the same layout as the Schedule Overview: for each date, the scheduled activities in start-time order with start and end time, activity, place, forecast weather and travel information, the unscheduled activities with their reasons, and the scheduling and travel summaries.
4. **Given** the plan page, **Then** it shows the note "This is your plan as saved on <date>. The forecast may have changed since." The schedule is not recalculated (feature 012).
5. **Given** the plan is loading, **Then** "Loading your plan…" is shown and announced. **Given** it cannot be loaded because of a server error, timeout or network failure, **Then** "Error: Plan could not be loaded." is shown with a Retry button.
6. **Given** the plan page, **Then** it offers no edit, recalculate, duplicate or delete actions (features 011 and 012).

---

### User Story 5 - Nobody else can see or use my plans (Priority: P1)

Saved plans are private. Only the owner can list and open them. Visitors, other Registered Users, Administrators and Suspended users cannot.

**Why this priority**: Project FR-025 and the constitution's security principle (ownership checks on the server for every protected operation). A plan contains where and when a person will be.

**Independent Test**: As user A, save a plan and note its address. Log in as user B and open that address. Check that the Access Denied page is shown and no plan detail is visible. Repeat as a Visitor, an Administrator and a Suspended user.

**Acceptance Scenarios**:

1. **Given** user B opens the address of user A's plan, **Then** the Access Denied (403) page is shown with "You do not have permission to open this page." and links to Home and My plans, and no part of the plan is shown.
2. **Given** a Visitor opens My plans or a plan address, **Then** they are sent to Log in with "Log in to continue.", and after logging in as the owner they return to that page.
3. **Given** an Administrator, **Then** the navigation has no My plans link, and opening My plans, a plan address, or sending a save request gives the Access Denied (403) result. An Administrator cannot save plans (project FR-032).
4. **Given** a Suspended user, **Then** saving, listing and opening plans are blocked and the Account Suspended page explains why (project FR-041).
5. **Given** an address for a plan that does not exist, **Then** the Not Found page shows "This plan no longer exists." with links to Home and My plans.
6. **Given** a save request, **Then** the plan is always stored under the signed-in user. A request cannot choose another owner.

---

### User Story 6 - See my latest plans on the home page (Priority: P2)

An Active Registered User sees their most recent saved plans on the home page and can open one or go to My plans.

**Why this priority**: `docs/ux-design.md` places saved plans on Home (Home → FR-021) with its own loading, empty and error states, and it is in scope for this feature (Clarifications). My plans already gives full access, so it is P2.

**Independent Test**: As a user with seven saved plans, open Home. Check that the five most recently saved are shown with an "Open" action and an "All my plans" link.

**Acceptance Scenarios**:

1. **Given** an Active Registered User with saved plans, **Then** Home shows a "Your saved plans" block with up to 5 most recently saved plans (name, location, dates, "Open") and an "All my plans" link.
2. **Given** no saved plans, **Then** the block shows "No saved plans yet." with a **Create your first plan** button.
3. **Given** the block is loading, **Then** only the block shows "Loading your saved plans…". **Given** it cannot be loaded, **Then** "Error: Saved plans could not be loaded." is shown with a Retry button, and the rest of Home still works.
4. **Given** a Visitor, Administrator or Suspended user, **Then** the block is not shown.

---

### User Story 7 - Use saving and saved plans on a phone and with assistive technology (Priority: P2)

Saving a plan, My plans and the plan page can be used at 320 px width, with only a keyboard, or with a screen reader.

**Why this priority**: Constitution accessibility constraint and project NFR-009 to NFR-015.

**Independent Test**: At 320 px with a keyboard and screen reader, save a plan with an empty name, fix the error, save, go to My plans and open the plan.

**Acceptance Scenarios**:

1. **Given** a 320 px viewport, **Then** the Save plan form, My plans and the plan page have no horizontal scrolling.
2. **Given** a validation error in the Save plan form, **Then** the message is shown as text next to the field, the field is marked invalid for screen readers, and focus moves to the field.
3. **Given** saving, loading, success or error, **Then** the status text is announced by screen readers.
4. **Given** the Save plan form, **Then** "Plan name" has a visible label, the form can be completed and cancelled with the keyboard only, and Escape closes it like "Cancel".
5. **Given** My plans and the plan page, **Then** each has one main heading and a descriptive page title ("My plans – Spėk laiku", "<plan name> – Spėk laiku"), and each "Open" action names its plan for screen readers ("Open Weekend in Kaunas").

---

### Edge Cases

- The user selects "Save" twice quickly: exactly one plan is saved.
- The user regenerates the schedule after saving: the new schedule can be saved as a separate plan. The saved plan is not changed.
- The session expires while the Save plan form is open: on "Save" the user is sent to Log in with "Your session has expired. Log in again.", and after logging in they return to the Schedule Overview with the schedule kept. The form is closed and the user saves again.
- The user saves more than 30 minutes after generating the schedule (for example, a Visitor who took a long time to register): the save is refused with "Generate the schedule again to save it." The user generates again, reviews the new schedule, which may differ if the forecast changed, and saves that.
- A schedule where no activity could be scheduled ("No suitable time found for any activity…"): "Save plan" is not offered.
- A schedule with some unscheduled activities: it can be saved, and the unscheduled activities and their reasons are saved with it.
- A saved plan whose dates have passed: it is still listed and can be opened, unchanged.
- An Administrator renames or changes an activity category after a plan was saved: the saved plan still shows the activity name and settings as they were when saved.
- A Visitor logs out or closes the tab before logging in: the kept plan is cleared, as in feature 004. Nothing is saved.
- A Visitor selects "Save plan", then leaves the Log in page without logging in (for example to Home): the kept schedule stays in the tab session until it is shown again on the Schedule Overview, the user logs out, or the tab is closed. Logging in later from the navigation uses the normal destination for the role (Home). The user reaches the kept schedule again through "Create plan" and the wizard steps: step 4 shows the kept schedule instead of generating a new one, as long as the setup and activities are unchanged. If they were changed, the kept schedule is discarded and a new one is generated.
- The user leaves the Schedule Overview by Back or the progress bar: the generated schedule is cleared as in feature 008, so there is nothing to save until a new one is generated. Only the "Save plan" → Log in or Register route keeps the schedule.
- The plan name contains leading or trailing spaces: they are removed before saving and before the length check.
- The plan name contains characters such as `<script>`: it is stored and shown as plain text, never run as code.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an Active Registered User to save the schedule currently shown on the Schedule Overview as a plan under their account, with a plan name (project FR-020). "Save plan" MUST be offered only when the schedule has at least one scheduled activity.
- **FR-002**: The plan name MUST be required, 1 to 80 characters after trimming leading and trailing spaces, and not only spaces. Names need not be unique. The server MUST check these rules even when the browser already checked them, with the messages "Enter a plan name." and "Plan name can be at most 80 characters." (`docs/ux-design.md` Form 5).
- **FR-003**: A saved plan MUST contain the plan setup (location with its name and position, dates, maximum travel distance), the activities with their duration and weather limits as used for the schedule, and the generated schedule as shown: scheduled activities with date, start and end time, place name and position, forecast weather and travel information; unscheduled activities with their reasons; the scheduling and travel summaries; and the date and time it was saved.
- **FR-004**: The saved schedule MUST be one the system itself generated. The server MUST remember each generated schedule, with its setup and activities, for 30 minutes after it was generated, and a save request MUST refer to that remembered schedule and send only the plan name. The server MUST NOT accept setup, activity, time, place, weather or travel values for the saved plan from the browser. When the remembered schedule has expired or is unknown, the save MUST be refused and the Schedule Overview MUST show "Generate the schedule again to save it." with a **Generate again** button that generates a new schedule from the kept setup and activities; the entered name is kept.
- **FR-005**: After a successful save the system MUST show "✓ Success: Plan saved." with a link to My plans, MUST stop offering "Save plan" for that schedule, and MUST keep the schedule shown. If the save fails because of a server error, a 10 second timeout or a network failure, it MUST show "Error: Plan could not be saved. Try again." with a Retry button and keep the name and schedule. Repeated or double-submitted save requests for the same schedule MUST create at most one plan.
- **FR-006**: The system MUST NOT save a plan for a Visitor (project FR-026). A Visitor who selects "Save plan" MUST be sent to Log in with "Log in to continue." and the Schedule Overview as the "return to" page. A save request without a signed-in Active Registered User MUST be refused by the server.
- **FR-007**: The system MUST keep a Visitor's current plan, including a generated schedule, in the browser tab session when the Visitor goes from "Save plan" to Log in or Register, and MUST show the same schedule on the Schedule Overview after they log in or register in the same tab (project FR-038). The kept plan MUST still be cleared on logout or when the tab is closed (feature 004 FR-017).
- **FR-008**: The Log in page reached from "Save plan" MUST offer a Register link that keeps the "return to" page. After registering through it, the new user MUST be signed in and returned to the Schedule Overview with the "✓ Success: Account created." banner, instead of the home page used by feature 001. The "return to" page MUST pass the same check as on Log in (feature 002 FR-012). The Register link carries the "return to" page whenever the Log in page has one (for example also when a Visitor was sent to Log in from My plans). A registration started from the navigation, Home or a Log in page without a "return to" page still opens the home page.
- **FR-009**: The system MUST provide a My plans page that lists all saved plans of the signed-in Active Registered User, newest saved first, each with name, location name, dates, saved date and time, and an "Open" action (project FR-021). It MUST show the loading, empty and server error states from User Story 3.
- **FR-010**: The system MUST provide a plan page that shows one saved plan as described in User Story 4, read-only and unchanged since it was saved. Opening it MUST NOT call the weather or map data services or recalculate the schedule.
- **FR-011**: Home MUST show an Active Registered User a "Your saved plans" block with up to 5 most recently saved plans and an "All my plans" link, with its own loading, empty and error states (User Story 6).
- **FR-012**: Listing, opening and saving plans MUST be allowed only for an Active Registered User, and only for their own plans. The server MUST check ownership on every request (project FR-025): opening another user's plan MUST give the Access Denied (403) result without any plan data; an address for a plan that does not exist MUST give the Not Found result "This plan no longer exists."; Visitors MUST be sent to Log in with the "return to" page; Administrators MUST get the Access Denied result; Suspended users MUST be blocked as in project FR-041.
- **FR-013**: A saved plan MUST always be stored under the signed-in user. The server MUST ignore or refuse any owner given in the request.
- **FR-014**: The navigation MUST show a "My plans" link to Active Registered Users only, and the Access Denied and Not Found pages MUST link to My plans for them (`docs/ux-design.md` sections 7 and 8).
- **FR-015**: A saved plan MUST keep the activity names and settings it was saved with, even if an Administrator later changes or renames the activity category.
- **FR-016**: Saving, listing and opening plans MUST NOT call the weather or map data services.
- **FR-017**: Plan names and all other saved text MUST be shown as plain text and MUST never be run as code.
- **FR-018**: The Save plan form, My plans and the plan page MUST be usable at 320 px without horizontal scrolling, with only a keyboard and with a screen reader, MUST announce loading, success and error states, and MUST show validation errors as text next to the field (project NFR-009 to NFR-015).

### Key Entities

- **Saved Plan**: a plan kept under one Registered User's account. It has an owner, a name (1 to 80 characters), the date and time it was saved, its plan setup, its activities and its schedule as generated. Only its owner can see it. It is not changed after saving in this feature.
- **Saved Plan Setup**: the location (name and position), 1 to 7 dates and the maximum travel distance, as checked when the schedule was generated (feature 004).
- **Saved Activity**: one activity of the plan, with its category name as saved, duration and weather limits (feature 005).
- **Saved Schedule Entry**: one scheduled activity with date, start and end time, place name and position, forecast weather and travel information (features 008 and 009), or one unscheduled activity with its reason.
- **Generated Schedule Record**: a schedule the system generated, remembered on the server for 30 minutes with its setup and activities, so that it can be saved exactly as shown. The tab keeps an unguessable reference to it, which still works after a Visitor logs in or registers in the same tab. It belongs to no account and is not a saved plan.
- **Current Plan** (from features 004 to 009, extended): the plan in the browser tab session. It now also keeps the generated schedule while a Visitor goes from "Save plan" to Log in or Register and back.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An Active Registered User can save a generated schedule in under 30 seconds from selecting "Save plan".
- **SC-002**: A Visitor who selects "Save plan" and then logs in or registers in the same tab sees the same schedule again, with no re-entry of the setup or activities, in 100% of attempts.
- **SC-003**: A saved plan opened later shows the same scheduled activities, times, places, weather, travel information and unscheduled activities as when it was saved, in 100% of cases.
- **SC-004**: In every authorization test, 0 plans of another user are listed or shown, and 100% of save, list and open requests from Visitors, Administrators, Suspended users and non-owners are refused.
- **SC-005**: My plans and the plan page are displayed within 2 seconds for a user with up to 50 saved plans.
- **SC-006**: Saving, My plans and the plan page are usable at 320 px width with no horizontal scrolling, and with a keyboard and screen reader only.

## Assumptions

- A saved plan is a snapshot. It is shown exactly as saved; checking it against the latest forecast and recalculating it (project FR-033, FR-034) belong to feature 012, and editing, duplicating and deleting (FR-022 to FR-024, FR-039) to feature 011. The plan page and My plans are therefore read-only in this feature, and the My plans "Duplicate" and "Delete" actions from `docs/ux-design.md` are added by feature 011.
- Project FR-025 ("prevent a Registered User from modifying another user's private plan") is met in this feature by ownership checks on saving, listing and opening. Feature 011 applies the same checks to editing, duplicating and deleting.
- All saved plans are private. There is no sharing between users.
- No limit on the number of saved plans per user is set in this feature. Expected use is a few dozen plans per user at most.
- The Save plan form needs no rate limit beyond login. Saving does not call external services.
- Deleting a user's saved plans when the account is deleted belongs to feature 016.
- The 403 result for another user's plan follows `docs/ux-design.md` section 9 (states table) and was confirmed in Clarifications. Plan addresses are hard to guess, but the ownership check does not rely on that.
- The "return to" page and the "Log in to continue." message are the ones built in feature 002 (FR-012, FR-020). Feature 001's rule that registration opens the home page is kept for every registration that does not start from "Save plan".
- Times are shown in Lithuanian time, as in features 006 to 009.
