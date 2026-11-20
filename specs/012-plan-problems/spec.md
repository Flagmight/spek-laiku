# Feature Specification: Plan Problem Detection

**Feature Branch**: `012-plan-problems`

**Created**: 2026-11-19

**Status**: Draft

**Input**: Feature 012 from the feature list in `docs/architecture.md` (section 6): "Plan Problem Detection: a user is told when a forecast change breaks a plan, with the reason. Covers FR-033 (detect when a scheduled activity no longer meets its weather, daylight, overlap or distance rules after the forecast is updated, and list each problem with its reason) and FR-034 (recalculate a saved plan with the latest forecast when the user opens it or selects Recalculate). Priority: Must. Depends on 010 Save and View Plans." It follows Journey 3 steps 1 and 2 ("Open the plan → the system recalculates using the latest forecast"; "Plan Problems and Alternatives lists the conflicts") and the Plan Problems and Alternatives states in section 6 of `docs/ux-design.md`. Suggesting and accepting alternatives (FR-048, Journey 3 steps 3 to 5) belongs to feature 013.

## Clarifications

### Session 2026-11-20

- Q: Should a successful check update the saved plan's stored weather? → A: No. The check never changes the saved plan; the latest forecast is only shown on the plan page (User Story 1 scenario 5, FR-014).
- Q: Is **Recalculate** also offered on the Schedule Overview (step 4) for a schedule that is not saved yet? → A: No. This feature covers saved plans only, as project FR-034 says; the unsaved-schedule case is out of scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See what no longer works when I open a saved plan (Priority: P1)

An Active Registered User opens one of their saved plans. The system checks every scheduled activity against the latest forecast and lists each problem with its reason, for example "Kayaking, Sat 14 Nov 10:00–12:00: wind up to 9 m/s at 11:00, more than your limit of 8 m/s." When nothing is wrong, the user is told the plan still fits.

**Why this priority**: Project FR-033 and FR-034, and Journey 3. A saved plan is made with the forecast of the day it was saved; days later the weather may have changed, and without this check the user would go out with a plan that no longer works.

**Independent Test**: Save a plan with Kayaking (wind up to 8 m/s) on Saturday 10:00–12:00 using a fake forecast with 5 m/s wind. Change the fake forecast so Saturday 11:00 has 9 m/s wind, open the plan, and check that the problem above is listed and the Kayaking entry is marked. Change the fake forecast back and check that "✓ No problems found. Your plan fits the current forecast." is shown.

**Acceptance Scenarios**:

1. **Given** the user opens one of their saved plans, **Then** the plan page shows the saved plan as before (feature 010) and, at the same time, "Checking your plan against the latest forecast…" (announced) in a "Plan check" section above the schedule, until the check has finished or failed.
2. **Given** the check finds problems, **Then** the "Plan check" section shows a summary ("2 problems in 1 of 4 scheduled activities.") and lists each problem in date and start time order with the activity name, date, time and reason, and each affected schedule entry is marked "✗ Problem" with its reasons.
3. **Given** the check finds no problem, **Then** the section shows "✓ No problems found. Your plan fits the current forecast."
4. **Given** the check has finished, **Then** each scheduled activity's weather shows the latest forecast for its time, and the plan note reads "Checked against the forecast updated at HH:MM." (Lithuanian time) instead of "This is your plan as saved on <date>. The forecast may have changed since."
5. **Given** the check has finished, **Then** the saved plan itself is not changed: its schedule, weather, "Saved on" date and time and its position on My plans stay as they were. The latest forecast is only shown on the page.

---

### User Story 2 - Recalculate on demand (Priority: P1)

While looking at a saved plan, the user selects **Recalculate** to check it again against the latest forecast, for example after the page has been open for a while.

**Why this priority**: Project FR-034 names "selects Recalculate" as the second way to recalculate, and the UX design lists "Recalculate" as a plan action.

**Independent Test**: Open a saved plan with a fake forecast that has no problem, change the fake forecast so one activity gets rain above its limit, wait until the forecast reuse time (FR-012) has passed, select **Recalculate**, and check that the new problem is listed.

**Acceptance Scenarios**:

1. **Given** the plan page, **Then** its actions are "Edit plan", "Recalculate", "Rename", "Duplicate" and "Delete".
2. **Given** the user selects **Recalculate**, **Then** the "Plan check" section shows "Checking your plan against the latest forecast…" (announced), **Recalculate** is disabled until the check ends, and the result replaces the previous one.
3. **Given** a check is already running, **Then** selecting **Recalculate** does not start a second one.

---

### User Story 3 - Know the reason for each problem (Priority: P1)

Each problem says which rule is broken, with the value from the forecast and the user's own limit, so the user can decide what to do without comparing numbers themselves.

**Why this priority**: FR-033 requires each problem to be listed "with its reason". A bare "problem" flag would not tell the user whether to move the activity, go anyway or drop it.

**Independent Test**: With fake forecasts, make one activity break each rule in turn (wind, rain, too cold, too warm, missing forecast hour, before sunrise, after sunset, an overlap and a trip over the maximum distance) and check that each reason text below is shown.

**Acceptance Scenarios**:

1. **Given** wind above the activity's limit in its time, **Then** the reason is "Wind up to <value> m/s at HH:MM, more than your limit of <limit> m/s."
2. **Given** rain above the limit, **Then** "Rain up to <value> mm/h at HH:MM, more than your limit of <limit> mm/h."
3. **Given** a temperature below the minimum, **Then** "Temperature down to <value> °C at HH:MM, below your minimum of <limit> °C."; above the maximum, "Temperature up to <value> °C at HH:MM, above your maximum of <limit> °C."
4. **Given** the forecast has no value for an hour of the activity's time, **Then** "No forecast for HH:MM." (feature 006 FR-012).
5. **Given** an activity that requires daylight starts before sunrise or ends after sunset, **Then** "Starts at HH:MM, before sunrise at HH:MM." or "Ends at HH:MM, after sunset at HH:MM."
6. **Given** two scheduled activities on the same date overlap, **Then** each shows "Overlaps with <other activity> (HH:MM–HH:MM)."
7. **Given** the trip from the previous activity's place is longer than the plan's maximum travel distance, **Then** "Travel of <distance> km from <previous place>, more than your <maximum> km limit." (feature 009).
8. **Given** a rule is broken in several hours of the activity's time, **Then** it is listed once, with the worst value and the first hour that has it.

---

### User Story 4 - Keep my saved plan when the forecast cannot be updated (Priority: P1)

When the weather service fails, the user sees that the plan could not be checked, the saved plan stays exactly as it was, and they can try again.

**Why this priority**: Project NFR-007 and NFR-008: no invented or outdated data shown as current, and the saved plan is preserved when the weather request fails during recalculation.

**Independent Test**: Make the fake weather service fail, open a saved plan, and check that the error and **Retry** are shown, the saved plan is shown with the "as saved on" note and its saved weather, and nothing is listed as a problem; then make the service answer and select **Retry**.

**Acceptance Scenarios**:

1. **Given** the weather service fails, does not answer in time or cannot be reached, **Then** the "Plan check" section shows "Error: The forecast could not be updated. Your saved plan is unchanged." with a **Retry** button, no problems are listed, and the schedule keeps its saved weather and the note "This is your plan as saved on <date>. The forecast may have changed since."
2. **Given** the user selects **Retry** and the service answers, **Then** the check result is shown as in User Story 1.
3. **Given** the check request fails for another reason, **Then** "Error: Something went wrong. Try again." is shown with **Retry**, and the saved plan is unchanged.
4. **Given** too many requests from the same network address (feature 006 FR-008), **Then** "Error: Too many requests. Wait a minute and try again." is shown and the weather service is not contacted.
5. **Given** a weather service failure, **Then** it is recorded with its time and kind of failure, without the user's identity (feature 006, reviewed in feature 015).

---

### User Story 5 - Plans in the past are not checked (Priority: P2)

A saved plan whose activities have already happened, fully or partly, is still shown, and only the activities still ahead are checked.

**Why this priority**: Saved plans stay listed after their dates (feature 010). Checking a past activity against a forecast is meaningless, and the forecast service has no forecast for past hours.

**Independent Test**: With a fake clock, open a plan whose first date is yesterday and second date is tomorrow; check that yesterday's activities show "Already past. Not checked." and tomorrow's are checked. Open a plan whose dates have all passed and check that "This plan's dates have passed. It is not checked against the forecast." is shown and the weather service is not contacted.

**Acceptance Scenarios**:

1. **Given** a scheduled activity whose start time has passed in Lithuanian time, **Then** it is not checked and its entry shows "Already past. Not checked."
2. **Given** every scheduled activity has started, **Then** the "Plan check" section shows "This plan's dates have passed. It is not checked against the forecast.", **Recalculate** is not offered, and the weather service is not contacted.
3. **Given** a past activity, **Then** it is not counted in the summary, but its place still counts as the previous place for the next activity's trip on the same date, as saved.

---

### User Story 6 - Only the owner can check their plan (Priority: P1)

The plan check is part of the plan page, so it follows the same access rules: only the plan's owner, an Active Registered User, can run it.

**Why this priority**: Project FR-025 and FR-041, and the constitution's rule that the server enforces every access rule. The check reads the plan's location, dates and activity limits.

**Independent Test**: Request the check of a plan directly from the server as its owner, another Active Registered User, a Visitor, an Active Administrator, a Suspended user and a deleted account; only the owner gets a result, and the weather service is contacted only for the owner.

**Acceptance Scenarios**:

1. **Given** the owner, **Then** the check result is returned.
2. **Given** another Active Registered User, **Then** the server answers 403 with no plan data and does not contact the weather service.
3. **Given** a Visitor, **Then** the server answers 401; an Administrator or a Suspended user gets 403; neither contacts the weather service.
4. **Given** a deleted or unknown plan, **Then** the server answers 404 and the page shows "This plan no longer exists." (feature 011).

---

### User Story 7 - Read the plan check with keyboard, screen reader and on a phone (Priority: P2)

The plan check, its problems and the marked schedule entries can be read and used with only a keyboard, with a screen reader and at 320 px width.

**Why this priority**: Project NFR-004 and NFR-009 to NFR-014, and the accessibility constraints in the constitution.

**Independent Test**: At 320 px, using only the keyboard, open a plan with two problems, read the problems, follow the link from a problem to its schedule entry, and select **Recalculate**, without horizontal scrolling.

**Acceptance Scenarios**:

1. **Given** a screen reader, **Then** the loading, result and error messages are announced without moving focus, and the "Plan check" section is a labelled region with a heading.
2. **Given** a problem in the list, **Then** it links to its schedule entry, and following the link moves focus to that schedule entry.
3. **Given** the problem marks, **Then** they use "✗" with words ("✗ Problem"), never colour alone (NFR-010), and "Already past. Not checked." is plain text.
4. **Given** a phone-sized screen, **Then** the problems are a list of cards that wrap inside the screen, **Recalculate** is full width with a touch target of at least 44 × 44 px, and there is no horizontal scrolling at 320 px.

---

### Edge Cases

- The forecast for an activity's time has improved since saving (a problem has gone away): no problem is shown; the check does not mention earlier forecasts.
- An activity breaks several rules: each broken rule is a separate reason on the same activity, and the summary counts each reason as a problem.
- An Indoor activity that does not require daylight: its weather is not checked (it has no weather limits), but the overlap and travel rules still apply.
- An activity's time is partly today and has not started yet: it is checked like any future activity.
- An activity has started but not ended: it is "Already past. Not checked." (User Story 5).
- The activity category's limits were changed by an administrator after saving: the activity's own saved limits are used (feature 010 FR-003), not the category's current ones.
- The sunrise or sunset of a date moved by a few minutes in the latest forecast: the daylight rule uses the latest times.
- A trip was already over the maximum travel distance when the plan was saved (feature 009 keeps such plans, flagged): it is listed as a problem, because the plan still breaks the rule.
- Unscheduled activities of the saved plan (feature 008) stay listed as saved; they are not checked again and not moved into the schedule (suggestions belong to feature 013).
- The plan was renamed, duplicated or edited (feature 011): the check always uses the plan as it is saved now.
- The user starts **Edit plan** while a check is running: the check's answer is ignored when the user has left the plan page.
- An answer arrives after the user has left the plan page: it is ignored.
- The forecast was reused from the shared forecast cache: the "updated at" time is the time it was received from the weather service, not the time of the check.

## Requirements *(mandatory)*

### Functional Requirements

**Access**

- **FR-001**: Only the plan's owner, a signed-in Active Registered User, MAY check a saved plan. The server MUST refuse the check for anyone else (401 for a Visitor; 403 with no plan data for another user, an Administrator or a Suspended user; 404 for a deleted or unknown plan), and MUST NOT contact the weather service for a refused request.

**When the check runs**

- **FR-002**: The system MUST check a saved plan against the latest forecast each time the user opens its plan page, and when the user selects **Recalculate** (project FR-034). The saved plan MUST be shown at once, as in feature 010, while the check runs.
- **FR-003**: Only one check MAY run at a time for the open plan page. **Recalculate** MUST be disabled while a check runs, and an answer that arrives after the user has left the plan page MUST be ignored.
- **FR-004**: The server MUST take the plan's location, dates, activities and their limits, schedule, places and maximum travel distance only from the saved plan, never from the request.

**What is checked**

- **FR-005**: Each scheduled activity whose start time has not passed in Lithuanian time MUST be checked against these rules (project FR-033):
  - **Weather**: every forecast hour within its time MUST meet its own saved limits for wind, rain and temperature, with the same rules as feature 006 (an hour without a forecast value is unsuitable). Activities without weather limits are not checked for weather.
  - **Daylight**: an activity that requires daylight MUST start at or after the date's latest sunrise and end at or before its latest sunset (feature 006 FR-016).
  - **Overlap**: it MUST NOT overlap another scheduled activity on the same date (feature 008 FR-005).
  - **Distance**: the trip from the previous scheduled activity's place on the same date MUST NOT be longer than the plan's maximum travel distance (feature 009).
- **FR-006**: Activities that have started, unscheduled activities, and the saved weather are not checked. A plan whose scheduled activities have all started MUST NOT contact the weather service.
- **FR-007**: For each broken rule of an activity the system MUST give one reason, using the texts of User Story 3. When a weather rule is broken in several hours, the reason MUST give the worst value and the first hour with that value.

**Showing the result**

- **FR-008**: The plan page MUST have a labelled "Plan check" region with a heading, above the schedule, that shows the loading message, the summary and the problem list, the no-problem message, the past-plan message or the error, as in User Stories 1 to 5.
- **FR-009**: The summary MUST read "<n> problem(s) in <m> of <k> scheduled activities." where k counts only checked activities. It uses "problem" when n is 1 and "problems" otherwise, and "activity" when k is 1 and "activities" otherwise ("1 problem in 1 of 1 scheduled activity."). The problem list MUST be in date and start time order, and each problem MUST name the activity, its date and time, and its reason, and link to its schedule entry.
- **FR-010**: Each affected schedule entry MUST show "✗ Problem" with its reasons. Each started activity MUST show "Already past. Not checked.".
- **FR-011**: After a successful check, each checked activity's weather line MUST show the latest forecast for its time, and the plan note MUST read "Checked against the forecast updated at HH:MM." with the time the forecast was received from the weather service, in Lithuanian time. Started activities keep their saved weather.
- **FR-012**: The forecast used MUST have been received from the weather service no more than 30 minutes earlier; forecasts for the same location may be reused within that time (as in feature 006).

**Failures and the saved plan**

- **FR-013**: When the weather service fails, does not answer in time or cannot be reached, the "Plan check" region MUST show "Error: The forecast could not be updated. Your saved plan is unchanged." with **Retry**; no problems MUST be listed, and the schedule MUST keep its saved weather and the note "This is your plan as saved on <date>. The forecast may have changed since." (NFR-007, NFR-008). Other failures MUST show "Error: Something went wrong. Try again." with **Retry**.
- **FR-014**: The check MUST NOT change the saved plan in any way: not its schedule, weather, name, "Saved on" date and time nor its order on My plans. The latest forecast is shown on the plan page only.
- **FR-015**: Checks MUST count towards the shared request limit of features 004 to 007 (at most 30 per minute per network address, project FR-049). A refused check MUST NOT contact the weather service, MUST NOT be recorded as a service failure, and MUST show "Error: Too many requests. Wait a minute and try again."
- **FR-016**: Each weather service failure MUST be recorded with its time and kind of failure, without the user's identity (feature 006, reviewed in feature 015).

**Plan page actions**

- **FR-017**: The plan page's actions MUST be "Edit plan", "Recalculate", "Rename", "Duplicate" and "Delete" (adds **Recalculate** to feature 011). **Recalculate** MUST NOT be offered when every scheduled activity has started.

**Accessibility and layout**

- **FR-018**: The loading, result and error messages MUST be announced without moving focus. Problem marks MUST use "✗" with words, never colour alone (NFR-010). Each problem's link MUST move focus to its schedule entry.
- **FR-019**: On phone-sized screens the problems MUST be cards that wrap inside the screen, **Recalculate** MUST be full width with a touch target of at least 44 × 44 px, and there MUST be no horizontal scrolling at 320 px.

### Key Entities

- **Plan Check**: the result of checking one saved plan against the latest forecast: when the forecast was received, the checked and past activities, and the problems. It is not stored.
- **Plan Problem**: one broken rule of one scheduled activity: the activity, its date and time, the rule (weather, daylight, overlap or distance) and its reason with the value and the limit.
- **Saved Plan** (from features 010 and 011): the plan as saved, which supplies everything the check needs and which the check never changes.
- **Hourly Forecast** (from feature 006): the latest forecast for the plan's location, with sunrise and sunset per date.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When the weather service answers normally, the plan check result is shown within 5 seconds of opening a saved plan or selecting **Recalculate** in 95% of attempts.
- **SC-002**: In a test set of saved plans and forecasts that break each rule (wind, rain, cold, heat, missing hour, sunrise, sunset, overlap, distance) and plans that break none, 100% of broken rules are listed with the expected reason and 0 problems are listed for plans that break none.
- **SC-003**: In 100% of weather service failures, the saved plan is shown unchanged with the error and **Retry**, and no problem is listed.
- **SC-004**: A user can tell which activities no longer work and why within 30 seconds of opening the plan, without opening any details.
- **SC-005**: 100% of check requests from anyone other than the plan's owner, and for plans whose activities have all started, are answered without contacting the weather service.
- **SC-006**: After any number of checks, the saved plan's stored schedule, weather and "Saved on" time are identical to before.
- **SC-007**: The plan check can be read and used with only the keyboard, and on a 320 px wide screen without horizontal scrolling.

## Assumptions

- **Check, not change.** "Recalculate" in this feature means checking the saved schedule against the latest forecast and showing the problems. Moving activities, replacing them or suggesting alternatives is feature 013; the user can already regenerate the whole plan with **Edit plan** (feature 011).
- **No new forecast rules.** The weather and daylight rules are exactly those used to generate the schedule (features 006 and 008), with the activity's own saved limits, so a plan that was valid when saved has no problem when the forecast has not changed.
- **Overlap and distance** cannot be caused by a forecast change alone, but they are checked because FR-033 names them and because a plan saved with a trip over the limit (feature 009) still breaks that rule. Later features that change the schedule (013) will rely on the same check.
- **Only the forecast is needed.** The saved plan holds the location's position, the places' positions and the activity limits, so the check needs only the weather service; the location search and map data services are not contacted.
- **The forecast covers every future plan date.** Plans can only be made for today and the next 6 days (feature 004), so every date that has not passed is within the forecast period.
- **Started activities** are not checked, because the forecast has no past hours and nothing can be changed about them.
- **Forecast reuse.** The check reuses the forecast cache of feature 006 (up to 30 minutes), so opening several plans for the same location shortly after each other contacts the weather service once.
- **Problems are not stored or sent by email.** The user sees them when they open the plan; reminders and notifications are not part of the project requirements.
- **My plans** does not show problem marks; each plan is checked when it is opened.

## Dependencies

- Feature 010 Save and View Plans (merged): the saved plan, its plan page and the "as saved on" note. This feature replaces feature 010 FR-010's rule that opening the plan page MUST NOT call the weather service.
- Feature 011 Plan Management (merged): the plan page actions, to which **Recalculate** is added, and "This plan no longer exists.".
- Feature 006 Hourly Forecast (merged): the forecast, its suitability rules, the request limit, failure records and forecast reuse.
- Features 008 Schedule Generation and 009 Travel Distance Check (merged): the overlap and travel distance rules.
- Feature 013 Alternative Suggestions (planned) builds on the problems listed here.
- Feature 015 Service Status and Error Log (planned) reviews the failure records.

## Scope Boundaries

**In scope**: checking a saved plan against the latest forecast when it is opened and on **Recalculate**; the weather, daylight, overlap and distance rules; the problem list with reasons; marking affected schedule entries and past activities; the error and request limit handling with the saved plan unchanged; access rules; accessibility and phone layout for these.

**Out of scope**: suggesting, accepting or rejecting alternatives (013); changing the saved plan from the check; **Recalculate** on the Schedule Overview (step 4) for a schedule that is not saved yet (Visitors and Registered Users), which can become a later feature; checking unscheduled activities again; problem marks on My plans or Home; notifications or emails about problems; checking against the map data service (places are taken as saved); travel time between activities (not on the roadmap); and administrator service status pages (015).

## Traceability

| Project requirement | Covered by |
|---|---|
| FR-033 (detect when a scheduled activity no longer meets its weather, daylight, overlap or distance rules after the forecast is updated, and list each problem with its reason) | FR-005 to FR-010, User Stories 1 and 3 |
| FR-034 (recalculate a saved plan with the latest forecast when the user opens it or selects Recalculate) | FR-002, FR-003, FR-011, FR-012, FR-017, User Stories 1 and 2 |
| FR-025, FR-041 (no access to another user's plan; block suspended users) | FR-001, User Story 6 |
| FR-043 (record weather service errors) | FR-016, User Story 4 |
| FR-049 (limit requests that reach external services) | FR-015, User Story 4 |
| NFR-007 (no unverified or fabricated data when the service is unavailable) | FR-011, FR-013, User Story 4 |
| NFR-008 (preserve the saved plan when the weather request fails during recalculation) | FR-013, FR-014, User Story 4 |
| NFR-010 (not by colour alone) | FR-010, FR-018 |
| NFR-004, NFR-009 to NFR-014 (keyboard, labels, announcements, layout) | FR-018, FR-019, User Story 7 |
