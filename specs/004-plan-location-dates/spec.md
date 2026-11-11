# Feature Specification: Plan Location and Dates

**Feature Branch**: `004-plan-location-dates`

**Created**: 2026-11-04

**Status**: Draft

**Input**: A Visitor or Registered User starts a new plan by choosing a location in Lithuania from search results and between 1 and 7 dates that are not in the past and fall within the available forecast period (project FR-007, FR-046), following Journey 1 step 2, Screen 4, Form 3 and the Plan Setup states, navigation and responsive rules in `docs/ux-design.md`.

## Clarifications

### Session 2026-11-04

- Q: How far ahead can dates be chosen? → A: Today plus 6 days, so the forecast period is 7 days including today, judged by the current date in Lithuania (FR-010).
- Q: What does the user see after a successful Continue, while the Activity selection step (feature 005) does not exist yet? → A: They go to the Activity selection step. In this feature it shows only its heading, the chosen location, dates and maximum travel distance, and a Back button. Feature 005 replaces its content (FR-015, FR-024 to FR-026).
- Q: Does this feature include the "Maximum travel distance (km)" field from Form 3? → A: Yes. The field is shown, checked and kept with the setup (whole number 1 to 200, default 30). Feature 009 applies the limit to the schedule (FR-016).
- Q: Should the public location search be protected against being used to flood the location search service, or is that out of scope? → A: Protect it in this feature. Location searches and plan setup checks together are limited to 30 per minute per network address, with "Error: Too many requests. Wait a minute and try again." (FR-027).
- Q (consistency analysis): Where are the date limits worked out? → A: Only on the server, because constitution principle I forbids duplicating business rules. The page gets the forecast period and the maximum number of dates from the server when it opens, and shows a loading and an error state for that (FR-010, User Story 2 scenario 9).

### Session 2026-11-11 (Requirement Change)

- Q (user testing): The Dates group shows its legend "Dates" and, right below it, the date picker's own label "Date". Is the second label needed? → A: No. The two words repeat each other. The date picker has no separate label; the visible "Dates" legend labels it, so screen readers still name it and every input keeps a visible label (FR-021).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose a location in Lithuania (Priority: P1)

As a visitor or registered user, I want to search for a town or place in Lithuania and pick it from a list, so that my plan is built around a real place that the weather and map services know.

**Why this priority**: Every later step (forecast, nearby places, schedule) needs an exact location. Without it nothing else in the plan can work.

**Independent Test**: A visitor opens "Create plan", types "Kaun" in Location, sees "Kaunas, Kaunas County" in the suggestions, selects it, and the field shows the chosen place.

**Acceptance Scenarios**:

1. **Given** a visitor on Home, **When** they select "Create plan" in the navigation, **Then** the Plan setup page opens with the heading "Plan setup", the progress bar shows step 1 of 4, and Location and Dates are empty.
2. **Given** the Plan setup page, **When** the user types at least 2 characters in Location and stops typing, **Then** "Searching locations…" is shown and announced, and then up to 10 places in Lithuania appear, each with its name and the larger area it belongs to (for example "Kaunas, Kaunas County").
3. **Given** a list of suggestions, **When** the user selects one with the mouse, by touch, or with the arrow keys and Enter, **Then** the list closes, Location shows the chosen place, and that place becomes the plan's location.
4. **Given** a chosen location, **When** the user changes the text in Location, **Then** the chosen place is cleared and must be chosen again from new suggestions.
5. **Given** a search with no matches in Lithuania, **When** the results arrive, **Then** "No location found. Check the spelling or try a larger town." is shown.
6. **Given** the location search service fails, does not answer within 10 seconds, or the network fails, **When** the user searches, **Then** "Error: Location search is unavailable. Try again later." is shown and announced, and no old or invented suggestions are shown.
7. **Given** the suggestion list is open, **When** the user presses Escape, **Then** the list closes and the typed text is kept.
8. **Given** a user (one network address) who has made 30 location searches and plan setup checks within one minute, **When** they search again in the same minute, **Then** "Error: Too many requests. Wait a minute and try again." is shown and announced, no suggestions are shown, and searching works again once the minute has passed (FR-027).

---

### User Story 2 - Choose the dates to plan (Priority: P1)

As a visitor or registered user, I want to add the days I want to plan, from one day up to a week, so that the schedule covers exactly the days I am free.

**Why this priority**: The forecast and schedule are calculated for the chosen dates. A plan without dates cannot be evaluated.

**Independent Test**: On the Plan setup page the user adds Saturday and Sunday of the coming weekend, sees both as date chips in date order, removes Sunday, and sees only Saturday left.

**Acceptance Scenarios**:

1. **Given** the Plan setup page, **When** the user picks a date and selects "Add date", **Then** the date appears as a chip showing the weekday and date (for example "Sat 7 Nov 2026") with a "Remove" button named after the date (for example "Remove Sat 7 Nov 2026").
2. **Given** several added dates, **When** they are shown, **Then** they are listed in date order whatever order they were added in, and they do not have to be consecutive days.
3. **Given** an added date, **When** the user selects its "Remove" button, **Then** the chip is removed and keyboard focus moves to the date picker.
4. **Given** a date that is already added, **When** the user adds it again, **Then** "Error: This date is already added." is shown and the date is not added twice.
5. **Given** a date before today, **When** the user adds it, **Then** "Error: Dates cannot be in the past." is shown and the date is not added.
6. **Given** a date after the last day of the forecast period (FR-010), **When** the user adds it, **Then** "Error: Forecast is not available that far ahead." is shown and the date is not added.
7. **Given** the date picker, **When** it opens, **Then** it offers today as the earliest date and today plus 6 days as the latest (for example 4 to 10 November 2026 when today is 4 November 2026 in Lithuania).
8. **Given** all 7 days of the forecast period are added, **When** the user looks at Dates, **Then** all 7 chips are shown in date order, and any further date is refused as already added or as beyond the forecast period.
9. **Given** the Plan setup page is opening, **When** the available dates have not loaded yet or failed to load, **Then** the date picker and "Add date" are disabled, with "Loading available dates…" while loading, or "Error: Available dates could not be loaded. Try again." with a Retry button after a failure (FR-010).

---

### User Story 3 - Set the maximum travel distance (Priority: P2)

As a visitor or registered user, I want to say how far I am willing to travel between activities, so that the schedule later keeps the places close enough (feature 009).

**Why this priority**: Form 3 places the field on this page, and project FR-035 needs the value. The plan works with the default of 30 km if the user never changes it.

**Independent Test**: The user changes Maximum travel distance from 30 to 50, continues, and the Activity selection step shows "Maximum travel distance: 50 km".

**Acceptance Scenarios**:

1. **Given** the Plan setup page, **When** it opens for a new plan, **Then** Maximum travel distance (km) shows 30, with the hint "Whole number from 1 to 200".
2. **Given** the field, **When** the user enters a whole number from 1 to 200 and continues, **Then** that value is kept with the setup.
3. **Given** the field, **When** the user enters 0, 201, a decimal such as 12.5, or text such as "abc", and continues, **Then** "Error: Enter a whole number between 1 and 200." appears next to the field and in the error summary, and the user stays on the page.
4. **Given** the field, **When** the user clears it and continues, **Then** the default of 30 is used and shown again.

---

### User Story 4 - Continue to the next step with a valid setup (Priority: P1)

As a visitor or registered user, I want the system to check my location and dates when I continue, so that I only go on with a setup the later steps can use.

**Why this priority**: Project FR-046 makes these rules mandatory, and constitution principle IV requires the server to check them, not only the page.

**Independent Test**: The user selects "Continue" with an empty form and sees both error messages; then with a chosen location and one valid date selects "Continue" and goes on, with the location and date kept.

**Acceptance Scenarios**:

1. **Given** the Plan setup page with no chosen location and no dates, **When** the user selects "Continue", **Then** "Error: Select a location in Lithuania from the list." appears next to Location, "Error: Add at least one date." appears next to Dates, an error summary at the top lists both messages with links that move focus to the fields, keyboard focus moves to the first invalid field, and the user stays on the page.
2. **Given** text typed in Location but no place chosen from the list, **When** the user selects "Continue", **Then** "Error: Select a location in Lithuania from the list." is shown and the typed text is kept.
3. **Given** a chosen location and 1 to 7 valid dates, **When** the user selects "Continue", **Then** "Checking your plan setup…" is shown and announced, "Continue" is disabled while waiting, the system checks the location, dates and maximum travel distance again, and the user goes to the Activity selection step.
4. **Given** the user arrived at the Activity selection step, **When** it is shown, **Then** it has the heading "Activity selection", the browser tab title "Activity selection - Spėk laiku", the progress bar with step 2 current and step 1 selectable, the chosen location, the dates in date order and the maximum travel distance (for example "Kaunas, Kaunas County · Sat 7 Nov 2026, Sun 8 Nov 2026 · Maximum travel distance: 30 km"), and a "Back" button.
5. **Given** the Activity selection step, **When** the user selects "Back" or step 1 in the progress bar, **Then** the Plan setup page opens with the same location, dates and maximum travel distance.
6. **Given** a checked setup, **When** the user goes back and changes the location, a date or the distance, **Then** the setup must be checked again with "Continue" before the Activity selection step can be opened.
7. **Given** no checked setup in the session, **When** the user opens the Activity selection step address directly, **Then** they are sent to the Plan setup page.
8. **Given** a setup whose dates were valid when added but are no longer valid when the user continues (for example the page was left open past midnight), **When** the user selects "Continue", **Then** the affected date is marked with the matching message from User Story 2, and the user stays on the page.
9. **Given** the check fails because of a server error, a 10 second timeout or a network failure, **When** the user selects "Continue", **Then** "Error: Something went wrong. Try again." is shown with a Retry button, the entered values are kept, and Retry sends the same values again.
10. **Given** a user who has reached the request limit (FR-027), **When** they select "Continue", **Then** "Error: Too many requests. Wait a minute and try again." is shown with a Retry button, and the entered values are kept.
11. **Given** anyone, **When** a location outside Lithuania, a location id the location search service does not know, no dates, more than 7 dates, a repeated date, a past date, a date beyond the forecast period or a maximum travel distance outside 1 to 200 is sent directly to the server, **Then** it is refused with the matching message and nothing is accepted.

---

### User Story 5 - Keep the setup while planning in this session (Priority: P2)

As a visitor or registered user, I want my location and dates to stay filled in when I come back to the Plan setup page during the same session, so that I do not have to enter them again.

**Why this priority**: The wizard's Back button must keep entered data (navigation rules in `docs/ux-design.md`), and project FR-038 builds on the plan staying in the session. The page is usable without it, but it would be frustrating.

**Independent Test**: The user chooses a location and two dates, reloads the page, and both are still shown; after logging out, the Plan setup page is empty again.

**Acceptance Scenarios**:

1. **Given** a chosen location and dates, **When** the user leaves the Plan setup page (for example to Home) and opens "Create plan" again in the same browser tab, **Then** the same location and dates are shown.
2. **Given** a chosen location and dates, **When** the user reloads the page, **Then** the same location and dates are shown.
3. **Given** a setup kept in the session, **When** the user logs out, **Then** the setup is cleared and the next Plan setup page is empty.
4. **Given** a setup kept in the session, **When** the user closes the browser tab and opens the application again, **Then** the Plan setup page is empty.
5. **Given** a visitor with a setup in progress, **When** they log in or register in the same tab, **Then** the setup is still shown when they open "Create plan" (project FR-038).
6. **Given** a kept setup with a date that has since passed, **When** the Plan setup page opens, **Then** that date is still shown, marked with "Error: Dates cannot be in the past.", so the user can remove it.

---

### User Story 6 - Only visitors and active registered users can set up a plan (Priority: P1)

As the project owner, I want plan setup to be offered only to the people allowed to create plans, so that administrators do not create plans for users and suspended users are told why they are blocked.

**Why this priority**: Project FR-032 (an administrator must not create plans on behalf of a user), FR-041 (suspended users are blocked with an explanation), and the navigation table in `docs/ux-design.md`.

**Independent Test**: Open the Plan setup page as a visitor, an Active Registered User, an Active Administrator and a Suspended user, and check that only the first two can use it.

**Acceptance Scenarios**:

1. **Given** a visitor or an Active Registered User, **When** they look at the navigation, **Then** they see "Create plan", and Home shows a "Create plan" button; both open the Plan setup page.
2. **Given** a signed-in Administrator or a Suspended user, **When** they look at the navigation and Home, **Then** they do not see "Create plan".
3. **Given** a signed-in Active Administrator, **When** they open the Plan setup page address, **Then** the Access Denied page is shown.
4. **Given** a signed-in Suspended user (Registered User or Administrator), **When** they open the Plan setup page address, **Then** they are sent to the Account Suspended page.
5. **Given** a signed-in Administrator or Suspended user, **When** they send a location search, a plan setup check or a request for the available dates directly to the server, **Then** it is refused.

---

### User Story 7 - Set up a plan with keyboard, screen reader and on a phone (Priority: P2)

As a user who uses a keyboard, a screen reader or a phone, I want to choose a location and dates in the same way as everyone else.

**Why this priority**: Accessibility and mobile use are project-wide requirements (NFR-004, NFR-009 to NFR-014). The page works for most users without them.

**Independent Test**: A user completes the Plan setup page with the keyboard only, and the page is usable on a 320 px wide screen without horizontal scrolling.

**Acceptance Scenarios**:

1. **Given** the Plan setup page, **When** a user moves through it with the keyboard only, **Then** Location, its suggestions, the date picker, "Add date", each "Remove" button, Maximum travel distance and "Continue" can be reached and used in a logical order.
2. **Given** the suggestion list, **When** a screen reader user moves through it, **Then** the number of suggestions and the currently highlighted place are announced.
3. **Given** the Dates area, **When** a screen reader user reaches it, **Then** it is announced as a labelled group ("Dates") with the number of dates added, and adding or removing a date is announced.
4. **Given** a desktop screen, **When** the page is shown, **Then** the maximum travel distance and date fields are side by side and the date chips are in a row; **Given** a phone-sized screen, **Then** fields are stacked, chips wrap onto new lines, buttons are full width, every button and link is at least 44 × 44 px and input text is at least 16 px.
5. **Given** the Plan setup page, **When** it opens, **Then** it has exactly one main heading "Plan setup", the browser tab title "Plan setup - Spėk laiku", and "Skip to main content" is the first item reached with Tab.

### Edge Cases

- Location text with spaces around it, or only spaces: the spaces are ignored; fewer than 2 remaining characters starts no search and shows no message.
- Location text longer than 100 characters: no more characters can be typed.
- The user types quickly: a search starts only after a short pause in typing, and only the results for the latest text are shown, never results from an older search that arrived late.
- Several places with the same name (for example several villages called "Pakalnė"): each suggestion shows its larger area so the user can tell them apart.
- Lithuanian letters: the user can type them ("Šiauliai"). The location search service also finds the place without them ("Siauliai"); this is the service's behaviour and is not tested in this feature.
- The user edits the text of a chosen place (for example "Kaunas, Kaunas Count"): only the text before the first comma is searched, so suggestions still appear. If fewer than 2 characters remain before the comma, nothing is searched and "No location found. Check the spelling or try a larger town." is shown.
- A place near the border that the search service lists under another country: it is not offered.
- A date added late in the evening becomes "today" or "the past" at midnight Lithuanian time: dates are always judged by the current date in Lithuania, both when added and again on Continue.
- The location search service recovers after an error: the next search shows results normally; the error message is removed.
- Several people behind one shared network address (for example a school network) share one request limit. 30 requests per minute is far more than one person needs: a search starts only after a pause in typing.
- Repeated searches for the same text count towards the limit even when the answer comes from the system's memory of earlier results.
- Both a location error and a date error at once: both messages and both summary links are shown.
- The forecast period and the 7-date limit are both 7 days, so on the page the limit is reached only when every day of the period is added. "Error: You can add up to 7 dates." is still checked by the server for requests sent directly (FR-011, FR-012).
- Maximum travel distance with spaces around the number (" 45 "): the spaces are ignored. A leading zero ("045") is read as 45.
- "Add date" selected with no date picked, or with a date the browser could not read: "Error: Choose a date first." is shown next to the date picker and nothing is added.

## Requirements *(mandatory)*

### Functional Requirements

**Access**

- **FR-001**: The system MUST offer the Plan setup page to Visitors and to signed-in Active Registered Users through "Create plan" in the navigation and a "Create plan" button on Home.
- **FR-002**: The system MUST NOT show "Create plan" to signed-in Administrators or Suspended users. An Active Administrator who opens the Plan setup or Activity selection step address MUST see the Access Denied page; a Suspended user MUST be sent to the Account Suspended page.
- **FR-003**: The server MUST refuse location searches (FR-004), plan setup checks (FR-012) and requests for the available dates (FR-010) from a signed-in Administrator or a Suspended user, and MUST allow them for Visitors and Active Registered Users.

**Location**

- **FR-004**: The system MUST search for places when the Location text has at least 2 characters after removing spaces around it, start the search only after a short pause in typing, and show up to 10 matching places, each with its name and the larger area it belongs to.
- **FR-005**: The system MUST offer only places in Lithuania.
- **FR-006**: The plan's location MUST be a place chosen from the suggestions. Typed text alone MUST NOT be accepted, and changing the text after a place was chosen MUST clear the chosen place. The message is "Error: Select a location in Lithuania from the list."
- **FR-007**: The Location field MUST show the states from `docs/ux-design.md`: "Searching locations…" while searching, "No location found. Check the spelling or try a larger town." when nothing matches, and "Error: Location search is unavailable. Try again later." when the service fails, does not answer within 10 seconds, or the network fails. On failure no old or invented suggestions MUST be shown.
- **FR-008**: The system MUST record each location search service failure (time and kind of failure, without the user's search text or identity) so that it can be reviewed later (project FR-043, feature 015).

**Dates**

- **FR-009**: The user MUST be able to add dates one at a time and remove each added date. Added dates MUST be shown in date order, with weekday, day, month and year, and need not be consecutive.
- **FR-010**: A plan MUST have between 1 and 7 dates. Each date MUST be today or later and no later than the last day of the forecast period, which is today plus 6 days (7 days including today). "Today" MUST be the current date in Lithuania. These limits are business rules kept only on the server: when the Plan setup page opens, it MUST get the forecast period (first and last date) and the maximum number of dates from the server and use only these for the date picker and for the checks in FR-011. While they load, the date picker and "Add date" MUST be disabled and "Loading available dates…" shown and announced; Location still works. If they cannot be loaded (server error, 10 second timeout, network failure), "Error: Available dates could not be loaded. Try again." MUST be shown with a Retry button.
- **FR-011**: The system MUST refuse a date with the matching message: "Error: Add at least one date." (none added), "Error: This date is already added.", "Error: Dates cannot be in the past.", "Error: Forecast is not available that far ahead.", "Error: You can add up to 7 dates." and, when "Add date" is selected with no date picked (or a date the browser could not read), "Error: Choose a date first."

**Continue and checks**

- **FR-012**: When the user selects "Continue", the system MUST check the location, dates and maximum travel distance on the server against FR-005, FR-006, FR-010, FR-011 and FR-016, even when the page already checked them. A location MUST be identified only by the location search service's id; it MUST be refused if the service does not know that id or the place is not in Lithuania. Its name, area and position MUST come from the service, never from the request.
- **FR-013**: On a failed check the system MUST show each message next to its field, show an error summary at the top of the form that lists every message with links to the fields, keep every entered value, and move keyboard focus to the first invalid field.
- **FR-014**: While the check runs the system MUST show and announce "Checking your plan setup…" and disable "Continue". On a server error, a 10 second timeout or a network failure it MUST show "Error: Something went wrong. Try again." with a Retry button that sends the same values again.
- **FR-015**: On a successful check the system MUST keep the checked location, dates and maximum travel distance as the current plan's checked setup and open the Activity selection step (FR-024).
- **FR-016**: The page MUST have an optional "Maximum travel distance (km)" field that shows 30 for a new plan and accepts a whole number from 1 to 200; spaces around the number are ignored and an empty field means 30. Any other value MUST be refused with "Error: Enter a whole number between 1 and 200." This feature only keeps the value; feature 009 applies it to the schedule (project FR-035).

**Session**

- **FR-017**: The current plan's location, dates and maximum travel distance MUST be kept for the current browser tab session, including when the user leaves and returns to the Plan setup page, reloads the page, or logs in or registers. They MUST be cleared when the user logs out or closes the tab. Nothing in this feature is saved to a user's account.
- **FR-018**: When a kept date has passed, the Plan setup page MUST show it marked with "Error: Dates cannot be in the past." instead of removing it silently.
- **FR-019**: A setup counts as checked only until the user changes the location, a date or the maximum travel distance; after a change it MUST be checked again with "Continue".

**Page, accessibility and layout**

- **FR-020**: The page MUST show a progress bar with the four steps "Plan setup", "Activities", "Places and forecast" and "Schedule", with step 1 marked as current; later steps MUST NOT be selectable. On phone-sized screens it MUST show "Step 1 of 4: Plan setup" with four segments.
- **FR-021**: Location, Dates and Maximum travel distance MUST have visible labels; Dates MUST be a labelled group, and its visible legend "Dates" MUST also label the date picker, with no second "Date" label; the suggestion list MUST be usable with the arrow keys, Enter and Escape; loading, success and error messages MUST be announced to screen readers; errors MUST NOT be shown by colour alone.
- **FR-022**: The page MUST have exactly one main heading "Plan setup", the browser tab title "Plan setup - Spėk laiku", and "Skip to main content" as the first item reached with Tab.
- **FR-023**: On desktop the maximum travel distance and date fields MUST be side by side with the date chips in a row; on phone-sized screens the fields MUST be stacked, chips MUST wrap, buttons MUST be full width, touch targets MUST be at least 44 × 44 px, input text at least 16 px, and the page MUST work at 320 px width without horizontal scrolling.

**Activity selection step (first version)**

- **FR-024**: The system MUST provide the Activity selection step with the heading "Activity selection", the browser tab title "Activity selection - Spėk laiku", the progress bar with step 2 current and step 1 selectable, a summary of the checked location, dates (in date order) and maximum travel distance, and a "Back" button. In this feature it MUST contain nothing else; feature 005 adds activity selection to it.
- **FR-025**: "Back" and step 1 in the progress bar MUST open the Plan setup page with the kept values.
- **FR-026**: Opening the Activity selection step without a checked setup in the session MUST send the user to the Plan setup page. The same access rules as FR-001 and FR-002 apply.

**Request limit**

- **FR-027**: The system MUST limit location searches and plan setup checks together to 30 per minute from one network address (project FR-049). A refused request MUST NOT reach the location search service, and the page MUST show "Error: Too many requests. Wait a minute and try again." Refused requests MUST NOT be recorded as service failures.

### Key Entities

- **Plan setup**: the first part of the current plan. Holds one chosen location, 1 to 7 dates, a maximum travel distance in whole kilometres (1 to 200, default 30) and whether it has been checked since the last change. Exists only in the user's current session in this feature; saving plans belongs to feature 010.
- **Location**: a place in Lithuania chosen from the location search. Has a display name, the larger area it belongs to (municipality or county), the country and its geographic position, which later features use for the forecast and nearby places.
- **Forecast period**: the range of dates for which the forecast is available, from today (in Lithuania) to today plus 6 days (FR-010). Worked out only by the server; the page receives it with the maximum number of dates.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user who knows where and when they want to go can choose a location and two dates and continue in under 1 minute.
- **SC-002**: When the location search service is working, suggestions appear within 2 seconds of the user stopping typing in at least 95% of searches.
- **SC-003**: 100% of setups with a location outside Lithuania, a location id the location search service does not know, no dates, more than 7 dates, a repeated date, a past date, a date beyond the forecast period or a maximum travel distance outside 1 to 200 are refused, including when sent directly to the server.
- **SC-004**: In usability checks, every invalid setup shows a message that names the problem and how to fix it, and the user can correct it without losing other entered values.
- **SC-005**: The Plan setup page can be completed using only the keyboard, and on a 320 px wide screen without horizontal scrolling.
- **SC-006**: After leaving and returning to the page or reloading it in the same tab, the entered location, dates and maximum travel distance are still shown in 100% of cases.

## Assumptions

- The location search uses the geocoding service named in `docs/architecture.md`, called by the backend on the user's behalf; the browser does not call it directly. Its results include the country, so places outside Lithuania can be filtered out.
- Location search is public data: Visitors can use it without an account. Because it is open, it is protected by the request limit in FR-027 so that it cannot be used to flood the location search service. The limit of 30 per minute per network address is a default that can be changed in configuration without a code change.
- The current plan is held in the browser tab's session; this feature stores nothing in the database and needs no schema change.
- Dates are picked with a calendar-style date picker; typing a date by keyboard in the picker is also possible.
- The location field accepts at most 100 characters.
- Selecting activities (feature 005; this feature only adds the empty Activity selection step), the forecast (006), nearby places (007), schedule generation (008), applying the travel distance limit (009) and saving plans (010) are out of scope. Feature 004 has no dependencies; features 005, 006 and 007 depend on it.
- Signed-in status, roles and the Access Denied and Account Suspended pages come from features 002 and 003 and are reused.

## Traceability

| Project requirement | Covered by |
|---|---|
| FR-007 (select one or more dates) | FR-009, FR-010, FR-011, User Story 2 |
| FR-046 (location in Lithuania from search results; 1 to 7 valid dates) | FR-004 to FR-006, FR-010 to FR-013, User Stories 1, 2 and 4 |
| FR-032 (administrator does not create plans for users) | FR-002, FR-003, User Story 6 |
| FR-038 (keep a Visitor's plan on login or registration) | FR-017, User Story 5 (setup part only) |
| FR-041 (block suspended users with explanation) | FR-002, FR-003, User Story 6 |
| FR-035 (maximum travel distance 1 to 200 km; setting only) | FR-016, User Story 3 |
| FR-043 (service errors reviewable later) | FR-008 |
| NFR-003 (validation messages) | FR-006, FR-011, FR-013, FR-016 |
| NFR-007 (error message when a service is unavailable) | FR-007, FR-014, FR-027 |
| FR-049 (limit location searches and plan setup checks per network address; constitution IV, OWASP unrestricted resource consumption) | FR-027, User Story 1 scenario 8, User Story 4 scenario 10 |
| NFR-004, NFR-009 to NFR-014 (keyboard, labels, contrast, announcements, layout, headings) | FR-020 to FR-023, User Story 7 |
| Wizard navigation: progress bar and Back keep entered data (`docs/ux-design.md` section 7) | FR-020, FR-024 to FR-026, User Story 4 |
