# Feature Specification: Activity Selection and Limits

**Feature Branch**: `005-activity-selection`

**Created**: 2026-11-05

**Status**: Draft

**Input**: After a checked Plan setup (feature 004), a Visitor or Active Registered User picks activities for the plan from the activity categories that administrators maintain (feature 003), removes activities from the plan, and changes each activity's duration and weather limits (temperature, precipitation, wind, daylight) inside the plan without changing the category defaults (project FR-006, FR-008, FR-037). It follows Journey 1 step 3, Screen 5, Form 4 and the Activity Selection states, navigation and responsive rules in `docs/ux-design.md`, and replaces the first version of the Activity selection step built by feature 004. Checking the limits against the forecast belongs to feature 006.

## Clarifications

### Session 2026-11-05

- Q: Can a plan include the same activity category more than once, for example Cycling twice? → A: Yes. A category can be added several times; each copy is its own activity with its own settings, numbered when its category appears more than once ("Cycling 1", "Cycling 2") (FR-005).
- Q: What is the most activities one plan may have? → A: 10 activities, counting repeats of the same category (FR-006, FR-012).
- Q: If an administrator switches a category between Indoor and Outdoor after a user added it to their plan, what happens on Continue? → A: The check refuses that activity with "This activity's category has changed. Remove it and add it again." and the user stays on the step; nothing is adapted automatically (FR-012, User Story 4 scenario 5).
- Q: After a successful Continue on Activity selection, where does the user go while features 006 and 007 do not exist yet? → A: To a first version of step 3, "Places and forecast", that shows only the checked setup and activities with a Back button; features 006 and 007 add the forecast and places to it (FR-016 to FR-018).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pick activities for the plan (Priority: P1)

On the Activity selection step a Visitor or Active Registered User sees the available activity categories, for example Cycling, Kayaking, Picnic, Heritage site and Museum, and adds the ones they want to do to their plan. Each added activity starts with its category's default duration, daylight setting and, for outdoor activities, weather limits.

**Why this priority**: A plan is a set of activities. Without choosing activities none of the later steps (forecast, places, schedule) can work.

**Independent Test**: With a checked setup, open the Activity selection step, add Kayaking and Museum, and check that both appear under the plan's activities with the category defaults filled in.

**Acceptance Scenarios**:

1. **Given** a checked setup, **When** the user opens the Activity selection step, **Then** "Loading activity categories…" is shown and announced, followed by every category in alphabetical order with its name, type (Indoor or Outdoor) and default duration, each with an "Add" button.
2. **Given** the categories are shown and no activity is added yet, **When** the user looks at the plan's activities, **Then** "No activities added yet. Select at least one category to continue." is shown.
3. **Given** the categories are shown, **When** the user selects "Add" for Kayaking, **Then** Kayaking appears in the plan's activities with duration 2 h, "Requires daylight" checked, max wind 8 m/s, max rain 0.5 mm/h and temperature 15 to 35 °C (its category defaults), "Kayaking added." is announced, and Kayaking's "Add" button stays available.
8. **Given** Cycling is already in the plan, **When** the user selects "Add" for Cycling again, **Then** a second Cycling activity with the category defaults is added, the two are shown as "Cycling 1" and "Cycling 2", "Cycling 2 added." is announced, and changing one does not change the other.
4. **Given** the user adds Museum (an Indoor category), **Then** its activity shows only Duration and Requires daylight, with no weather limit fields.
5. **Given** the categories cannot be loaded (server error, no answer within 10 seconds, or network failure), **Then** "Error: Activity categories could not be loaded." is shown with a "Retry" button, and the activities already in the plan stay visible.
6. **Given** there are no categories at all, **Then** the categories area shows "No activity categories are available yet." and "Continue" cannot succeed.
7. **Given** the plan already has 10 activities, **When** the user looks at the categories, **Then** every "Add" button is disabled and "You can add up to 10 activities." is shown.

---

### User Story 2 - Change an activity's duration and weather limits in this plan (Priority: P1)

For each activity in the plan the user can change the duration, whether it needs daylight, and, for outdoor activities, the maximum wind, maximum rain and minimum and maximum temperature. The change applies only to this plan; the category's defaults stay as the administrator set them.

**Why this priority**: People's tolerance differs (a family may want warmer weather for a picnic than the default). Project FR-037 requires these changes inside a plan.

**Independent Test**: Add Picnic, change its minimum temperature to 18 °C and its duration to 2.5 h, continue, and check that the next step shows 18 °C and 2.5 h while the Picnic category still has 15 °C and 1.5 h.

**Acceptance Scenarios**:

1. **Given** Picnic is in the plan, **When** the user changes its duration to 2.5 and its minimum temperature to 18, **Then** the fields show the new values and the activity keeps them when the user leaves the step and comes back in the same tab.
2. **Given** an activity's settings were changed, **When** an administrator or anyone else looks at the category, **Then** the category's defaults are unchanged.
3. **Given** an outdoor activity, **When** the user clears "Requires daylight", **Then** the activity is kept without the daylight requirement.
4. **Given** the user enters a duration of 13, 0 or 1.25, **When** they select "Continue", **Then** "Error: Enter a duration between 0.5 and 12 hours." is shown next to that activity's Duration field.
5. **Given** the user enters a max wind of 31, a max rain of 25, a minimum temperature of -31 or a maximum temperature of 46, **When** they select "Continue", **Then** the matching message from Form 4 is shown next to the field: "Error: Enter a wind limit between 0 and 30 m/s.", "Error: Enter a rain limit between 0 and 20 mm/h.", "Error: Enter a minimum temperature between -30 and 45 °C." or "Error: Enter a maximum temperature between -30 and 45 °C.".
6. **Given** a minimum temperature of 20 and a maximum temperature of 20 (or lower), **When** the user selects "Continue", **Then** "Error: Minimum temperature must be lower than maximum temperature." is shown next to the minimum temperature field.
7. **Given** a weather limit with two decimal places (for example 0.25) or text that is not a number, **When** the user selects "Continue", **Then** that field's message is shown.
8. **Given** an activity's field is empty, **When** the user selects "Continue", **Then** that field's message is shown.

---

### User Story 3 - Remove an activity from the plan (Priority: P1)

The user can take an activity out of the plan again, for example after adding the wrong one.

**Why this priority**: Required by project FR-008 and needed to correct mistakes before continuing.

**Independent Test**: Add Cycling and Picnic, remove Cycling, and check that only Picnic remains.

**Acceptance Scenarios**:

1. **Given** Cycling and Picnic are in the plan, **When** the user selects "Remove" for Cycling, **Then** Cycling disappears from the plan's activities, "Cycling removed." is announced, and keyboard focus moves to the next activity's heading (the previous one when Cycling was last, or the categories list when none is left).
2. **Given** the user removes an activity whose settings were changed and adds the category again, **Then** the new activity starts with the category defaults.
3. **Given** the last activity is removed, **Then** "No activities added yet. Select at least one category to continue." is shown.
4. **Given** "Cycling 1" and "Cycling 2" are in the plan, **When** the user removes "Cycling 1", **Then** only the other one remains, with its own settings, and it is shown as "Cycling" again.

---

### User Story 4 - Continue to the next step with valid activities (Priority: P1)

When the activities are ready, the user selects "Continue". The server checks every activity and, if all are valid, the user goes to step 3, "Places and forecast". In this feature step 3 shows only the checked setup and activities; features 006 and 007 add the forecast and places.

**Why this priority**: The values must be checked on the server before later steps use them, and the user needs a clear way forward.

**Independent Test**: Add two activities with valid settings, select "Continue", and check that step 3 opens and lists both activities with their settings.

**Acceptance Scenarios**:

1. **Given** no activity is in the plan, **When** the user selects "Continue", **Then** "Error: Add at least one activity." is shown and nothing is sent to the server.
2. **Given** one or more activities with valid settings, **When** the user selects "Continue", **Then** "Checking your activities…" is shown and announced, "Continue" is disabled while waiting, the server checks every activity again, and the user goes to step 3.
3. **Given** one or more fields are invalid, **When** the user selects "Continue", **Then** each message is shown next to its field, an error summary at the top lists every message as a link to its field, keyboard focus moves to the first invalid field, and every entered value is kept.
4. **Given** the check fails for a technical reason, takes more than 10 seconds, or the network fails, **Then** "Error: Something went wrong. Try again." is shown with a "Retry" button that sends the same activities again, and the entered values are kept.
5. **Given** an activity's category was changed from Outdoor to Indoor (or the other way) by an administrator after the user added it, **When** the user selects "Continue", **Then** "Error: This activity's category has changed. Remove it and add it again." is shown for that activity and the user stays on the step.
6. **Given** step 3 is open, **Then** it shows the heading "Places and forecast", the progress bar with step 3 current and steps 1 and 2 selectable, the checked location, dates and maximum travel distance, each activity with its name and settings, and a "Back" button that returns to the Activity selection step with every activity and setting kept.
7. **Given** the user changes, adds or removes an activity after continuing, or opens step 3 directly without checked activities, **Then** step 3 sends the user back to the Activity selection step.
8. **Given** the user selects "Back" or step 1 in the progress bar on the Activity selection step, **Then** the Plan setup page opens with the kept values and the plan's activities are still kept.

---

### User Story 5 - Keep the activities while planning in this session (Priority: P2)

The chosen activities and their settings stay with the current plan in the browser tab, together with the setup from feature 004, so the user does not lose them by reloading, going back to step 1, or logging in or registering in the same tab.

**Why this priority**: A Visitor may decide to log in during planning (project FR-038); losing the activities would force them to start again.

**Independent Test**: Add two activities, change one setting, reload the page, then log in in the same tab, and check that both activities and the changed setting are still there; log out and check that they are gone.

**Acceptance Scenarios**:

1. **Given** activities were added and changed, **When** the user reloads the page, goes to step 1 and back, or logs in or registers in the same tab, **Then** the activities and their settings are still shown.
2. **Given** the user logs out or closes the tab, **Then** the activities are cleared together with the rest of the current plan.
3. **Given** the user changes the location or dates on step 1, **Then** the activities are kept; the user has to continue from step 1 and step 2 again.

---

### User Story 6 - Only visitors and active registered users can select activities (Priority: P1)

The same people who may set up a plan (feature 004) may select activities. Administrators do not create plans for users, and suspended users are blocked.

**Why this priority**: Project FR-032 and FR-041, and the security rule that the server enforces every access rule.

**Independent Test**: Request the categories for planning and the activity check as a Visitor, an Active Registered User, an Active and a Suspended Administrator, a Suspended Registered User and a signed-in user whose account was deleted; only the first two are allowed.

**Acceptance Scenarios**:

1. **Given** a Visitor or an Active Registered User, **When** they open the Activity selection step or step 3 with a checked setup, **Then** the page works.
2. **Given** a signed-in Active Administrator, **When** they open either address, **Then** the Access Denied page is shown; a Suspended user is sent to the Account Suspended page.
3. **Given** anyone other than a Visitor or an Active Registered User, **When** they request the categories for planning or the activity check directly from the server, **Then** the server refuses the request.
4. **Given** the categories for planning, **Then** they contain only what planning needs (name, type, default duration, daylight and weather limits) and never the map place tags or other administrator-only data.

---

### User Story 7 - Select activities with keyboard, screen reader and on a phone (Priority: P2)

The step can be completed using only the keyboard and a screen reader, and on a phone-sized screen.

**Why this priority**: Project NFR-004 and NFR-009 to NFR-014, the accessibility constraints in the constitution and the responsive rules in `docs/ux-design.md`.

**Independent Test**: At 320 px width, using only the keyboard, add two activities, change one setting, remove one and continue, without horizontal scrolling.

**Acceptance Scenarios**:

1. **Given** the step on a desktop screen, **Then** the categories are on the left and the plan's activities with their settings on the right.
2. **Given** a phone-sized screen, **Then** the categories come first and the plan's activities follow in one column, each setting on its own row, with full-width buttons, touch targets of at least 44 × 44 px and no horizontal scrolling at 320 px.
3. **Given** a screen reader, **Then** each activity's settings are a labelled group named after the activity, every field has a visible label with its unit and allowed range, "Add" and "Remove" buttons name their activity, and loading, added, removed, checking and error messages are announced.

---

### Edge Cases

- A category is renamed by an administrator after the user added it: the activity keeps its own settings; the name shown after "Continue" is the category's current name.
- An administrator changes a category's defaults after the user added it: the activity keeps the values it was added with (feature 003 assumption, project FR-037).
- An activity refers to a category that does not exist (for example a request made directly to the server, or an old session): the check refuses it with "Error: This activity is no longer available. Remove it."
- A request sent directly to the server lists more than 10 activities or leaves out a weather limit of an Outdoor activity: the server refuses it with the matching message and nothing is accepted. Weather limits sent for an Indoor activity are ignored.
- The user selects "Continue" twice quickly: the second select is ignored while the first check runs.
- The user edits a field while the check runs: the answer for the old values is not kept as checked (same rule as feature 004).
- The categories fail to load but the plan already has activities from earlier in the session: the activities stay visible and editable, and "Continue" still works because the server checks them.
- The setup from step 1 is no longer checked (for example after a change there): opening the Activity selection step sends the user to the Plan setup page (feature 004 FR-026).
- Numbers are typed with a comma instead of a decimal point: the field's message is shown, as for any text that is not a number.
- A temperature limit of exactly -30 or 45, a wind of exactly 0 or 30, a rain of exactly 0 or 20 and a duration of exactly 0.5 or 12 are accepted.

## Requirements *(mandatory)*

### Functional Requirements

**Access**

- **FR-001**: Only Visitors and signed-in Active Registered Users MAY use the Activity selection step and step 3, with the same rules as feature 004 FR-001 and FR-002: an Active Administrator MUST see the Access Denied page and a Suspended user MUST be sent to the Account Suspended page.
- **FR-002**: The server MUST refuse the categories for planning (FR-003) and the activity check (FR-013) for anyone other than a Visitor or an Active Registered User, whatever the browser shows.

**Categories**

- **FR-003**: The Activity selection step MUST list every activity category in alphabetical order by name, each with its name, type (Indoor or Outdoor) and default duration, and an "Add" button. The categories for planning MUST include each category's default duration, daylight setting and, for Outdoor categories, its weather limits, and MUST NOT include map place tags or any other administrator-only data.
- **FR-004**: While the categories load, the step MUST show and announce "Loading activity categories…". If they cannot be loaded (server error, no answer within 10 seconds, network failure) it MUST show "Error: Activity categories could not be loaded." with a "Retry" button. When there are no categories it MUST show "No activity categories are available yet." The plan's activities MUST stay visible in all of these states.

**Plan activities**

- **FR-005**: Selecting "Add" MUST add a new activity for that category to the plan with the category's default duration, daylight setting and, for Outdoor categories, its four weather limits, and announce "<name> added.". A category MAY be added more than once; each copy MUST be a separate activity with its own settings. When a category appears more than once, its activities MUST be named with a number in the order they were added ("Cycling 1", "Cycling 2"), and the numbers MUST follow the remaining activities after one is removed; when it appears once, the activity is named after the category alone.
- **FR-006**: A plan MUST have at most 10 activities. When it has 10, every "Add" button MUST be disabled and "You can add up to 10 activities." MUST be shown.
- **FR-007**: When the plan has no activities, the step MUST show "No activities added yet. Select at least one category to continue."
- **FR-008**: Each activity in the plan MUST be shown as a labelled group named after the activity, with a "Remove" button and these settings (Form 4): Duration (h); Requires daylight; and only for Outdoor activities Max wind (m/s), Max rain (mm/h), Min temperature (°C) and Max temperature (°C). Each field MUST show its unit and allowed range.
- **FR-009**: Selecting "Remove" MUST take the activity out of the plan, announce "<name> removed.", and move focus to the next activity's heading (the previous one when the removed activity was last, or the categories list when none is left). An activity added again MUST start with the category defaults.
- **FR-010**: Changing an activity's settings MUST change only this plan's activity, never the category's defaults (project FR-037).

**Validation**

- **FR-011**: The system MUST check each activity with these rules and messages, the same as feature 003 FR-005 and FR-006 and Form 4: duration 0.5 to 12 hours in steps of 0.5 ("Enter a duration between 0.5 and 12 hours."); for Outdoor activities, each weather limit a number with at most one decimal place: maximum wind 0 to 30 m/s ("Enter a wind limit between 0 and 30 m/s."), maximum rain 0 to 20 mm/h ("Enter a rain limit between 0 and 20 mm/h."), minimum temperature -30 to 45 °C ("Enter a minimum temperature between -30 and 45 °C."), maximum temperature -30 to 45 °C ("Enter a maximum temperature between -30 and 45 °C."), and the minimum lower than the maximum ("Minimum temperature must be lower than maximum temperature.", next to the minimum temperature field). An empty field gets that field's message.
- **FR-012**: The system MUST refuse a plan with no activities ("Add at least one activity."), more than 10 activities ("You can add up to 10 activities."), an activity whose category does not exist ("This activity is no longer available. Remove it."), and an activity added as Indoor whose category is now Outdoor, or the other way round ("This activity's category has changed. Remove it and add it again."). Each activity's settings are checked by its category's current type: an empty or invalid weather limit of an Outdoor activity gets that field's message (FR-011), and weather limits sent for an Indoor activity are ignored, as for Indoor categories in feature 003 (its FR-007). The duration, daylight setting and weather limits MUST be the plan's own values; the category's name and type MUST come from the stored category, never from the request.
- **FR-013**: "Continue" MUST check every activity on the server against FR-011 and FR-012, even when the page already checked them, and MUST NOT accept any activity unless all are valid.
- **FR-014**: Validation messages MUST be shown as text next to the affected field (or next to the activity for FR-012 messages), linked to it for assistive technology, and MUST start with "Error:", added by the frontend. When there is more than one message, an error summary at the top MUST list each as a link that moves focus to its field. After a failed check, focus MUST move to the first invalid field and every entered value MUST be kept. Errors MUST NOT be shown by colour alone.

**Continue and step 3**

- **FR-015**: With no activities, "Continue" MUST show "Error: Add at least one activity." without contacting the server. Otherwise, while the check runs, the step MUST show and announce "Checking your activities…" and disable "Continue"; a second "Continue" MUST be ignored. On a server error, a 10 second timeout or a network failure it MUST show "Error: Something went wrong. Try again." with a "Retry" button that sends the same activities again. An answer for activities the user changed while the check ran MUST NOT be kept as checked.
- **FR-016**: On a successful check the system MUST keep the checked activities, with the category's current name and type, as the current plan's checked activities and open step 3.
- **FR-017**: Step 3 (first version) MUST have the heading "Places and forecast", the browser tab title "Places and forecast - Spėk laiku", the progress bar with step 3 current and steps 1 and 2 selectable, a summary of the checked location, dates and maximum travel distance, a list of the checked activities with their name, type, duration, daylight setting and (Outdoor) weather limits, and a "Back" button that opens the Activity selection step. In this feature it MUST contain nothing else; features 006 and 007 add the forecast and places to it.
- **FR-018**: Opening step 3 without checked activities MUST send the user to the Activity selection step, and without a checked setup to the Plan setup page. Activities count as checked only until the user adds, removes or changes an activity.

**Session**

- **FR-019**: The plan's activities and their settings MUST be kept for the current browser tab session together with the setup from feature 004 (its FR-017): when the user leaves and returns to the step, reloads the page, goes to another step, or logs in or registers in the same tab. They MUST be cleared when the user logs out or closes the tab. Changing the location, dates or maximum travel distance on step 1 MUST NOT remove the activities. Nothing in this feature is saved to a user's account.

**Navigation, accessibility and layout**

- **FR-020**: The Activity selection step MUST keep the heading "Activity selection", the browser tab title "Activity selection - Spėk laiku", the summary of the checked setup and the "Back" button from feature 004 FR-024 and FR-025, with the progress bar showing step 2 current and step 1 selectable. On phone-sized screens the progress bar MUST show "Step 2 of 4: Activities" (and "Step 3 of 4: Places and forecast" on step 3) with four segments.
- **FR-021**: Both steps MUST have exactly one main heading and "Skip to main content" as the first item reached with Tab. Every field MUST have a visible label; "Add" and "Remove" MUST name their activity for screen readers; loading, added, removed, checking and error messages MUST be announced.
- **FR-022**: On desktop the categories MUST be on the left and the plan's activities with their settings on the right. On phone-sized screens the categories MUST come first and the activities follow in one column, each setting on its own row, with full-width buttons, touch targets of at least 44 × 44 px, input text of at least 16 px, and no horizontal scrolling at 320 px width.

### Key Entities

- **Activity Category** (from feature 003): read only. Its name, type, default duration, daylight setting and weather limits are the defaults for a new plan activity. Its map place tags are not used here.
- **Plan Activity**: one activity in the current plan, created from one category. It holds the category it came from, the category's name and type, and the plan's own duration, daylight setting and, for Outdoor activities, maximum wind, maximum rain and minimum and maximum temperature. A plan has 1 to 10 activities; several may come from the same category, and each is a separate activity with its own settings. It lives only in the browser tab session in this feature; feature 010 saves it with the plan.
- **Current Plan** (from feature 004): the checked location, dates and maximum travel distance, now with its activities and whether they are checked.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add three activities with their default settings and continue to step 3 in under 1 minute.
- **SC-002**: A user can change one weather limit of an activity and continue in under 30 seconds.
- **SC-003**: 100% of activity lists with no activities, more than 10 activities, an unknown category, a setting outside its range, a missing Outdoor weather limit, or an activity whose category changed between Indoor and Outdoor are refused, including when sent directly to the server.
- **SC-004**: 0 changes to a plan activity change its category's stored defaults.
- **SC-005**: 100% of requests for the categories for planning or the activity check from Administrators, Suspended users or deleted accounts are refused, and no response for planning contains map place tags.
- **SC-006**: After reloading the page or logging in in the same tab, the activities and their settings are still shown in 100% of cases.
- **SC-007**: The step can be completed using only the keyboard, and on a 320 px wide screen without horizontal scrolling.

## Assumptions

- **Repeated activities.** A category can be added more than once, for example to go cycling on two days with different limits (Clarifications). The schedule (feature 008) places each activity separately.
- **At most 10 activities per plan** (Clarifications), counting repeats of the same category. With 1 to 7 dates and activities of 0.5 to 12 hours, 10 is enough for a realistic plan and keeps the later forecast, places and schedule steps fast.
- **Step 3 first version** (Clarifications). As feature 004 did for step 2, this feature adds a first version of step 3 ("Places and forecast") that shows only the checked setup and activities; features 006 and 007 replace its content.
- The current plan, including its activities, is kept only in the browser tab session, as in feature 004. This feature stores nothing new in the database and needs no schema change.
- Categories are read when the step opens and are not refreshed while it is open. An administrator's change during that time is caught by the server check on "Continue" (FR-012).
- The categories for planning are public data for Visitors and Active Registered Users. They contain no external service call, so they do not need the request limit from feature 004.
- Numbers are entered with a decimal point, and the interface uses one language, as in feature 003.
- Checking the weather limits and daylight against the forecast (project FR-011 to FR-015) is feature 006. Finding places with the categories' map place tags is feature 007. Saving the activities with a plan is feature 010.
- The Access Denied and Account Suspended pages and the plan access rule come from features 002, 003 and 004 and are reused.

## Dependencies

- Feature 003 Activity Category Management (merged): the categories, their defaults and the shared ranges and messages of Form 4.
- Feature 004 Plan Location and Dates (merged): the checked setup, the Activity selection step's first version, the progress bar, the session storage of the current plan, and the access rule for plan pages.
- Related UX material: Journey 1 step 3, Screen 5 (Activity selection), Form 4 (Activity settings), the Activity Selection states in section 6, the progress bar and Back rules in section 7, and the Activity Selection layout in section 8 of `docs/ux-design.md`.
- Features 006 and 007 depend on this feature.

## Scope Boundaries

**In scope**: listing the categories for planning; adding and removing plan activities; changing each activity's duration, daylight setting and weather limits; checking the activities on the server; keeping them in the session; the first version of step 3; and access, accessibility and layout for both steps.

**Out of scope**: checking limits against the forecast (006), nearby places (007), the schedule (008), saving plans (010), changing category defaults (003, administrators only), activities that are not based on a category, ordering activities, and refreshing the categories while the step is open.

## Traceability

| Project requirement | Covered by |
|---|---|
| FR-006 (select activities from the activity categories) | FR-003 to FR-007, User Story 1 |
| FR-008 (remove an activity from the current plan) | FR-009, User Story 3 |
| FR-037 (change duration and weather limits inside a plan without changing category defaults) | FR-008, FR-010, FR-011, User Story 2 |
| FR-038 (keep a Visitor's plan on login or registration; activities part) | FR-019, User Story 5 |
| FR-032 (administrator does not create plans for users) | FR-001, FR-002, User Story 6 |
| FR-041 (block suspended users with explanation) | FR-001, FR-002, User Story 6 |
| NFR-003, NFR-015 (validation messages next to the field) | FR-011, FR-012, FR-014 |
| NFR-004, NFR-009 to NFR-014 (keyboard, labels, announcements, layout, headings) | FR-020 to FR-022, User Story 7 |
| Wizard navigation: progress bar and Back keep entered data (`docs/ux-design.md` section 7) | FR-017, FR-018, FR-020, User Story 4 |
