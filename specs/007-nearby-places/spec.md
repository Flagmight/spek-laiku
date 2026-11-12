# Feature Specification: Nearby Places

**Feature Branch**: `007-nearby-places`

**Created**: 2026-11-11

**Status**: Draft

**Input**: Feature 007 from the feature list in `docs/architecture.md` (section 6): "A user sees places for each activity, and what to do when none is found" (project FR-010, FR-036 for no place found). After a checked Plan setup (feature 004) and checked activities (feature 005), the "Places and forecast" step finds, for each activity, nearby places that match its category's map place tags (feature 003), and shows their names and locations. An activity with no place is flagged with the reason and the user can remove or change it. It follows Journey 1 step 4, Screen 6, and the Places and Forecast states and layout in sections 6 and 8 of `docs/ux-design.md`. It also reorganizes step 3, found in user testing of feature 006: an overview of every activity on every date at the top, sunrise and sunset once per date, and each activity's details closed at first. The schedule belongs to feature 008 and the distance between activities to feature 009.

## Clarifications

### Session 2026-11-11

- Q (user testing of feature 006): Step 3 repeats the sunrise and sunset under every activity, repeats each activity's settings, and has no way to see at a glance which activity suits which day. Should feature 007 change that, since it adds places to the same page? → A: Yes. Step 3 starts with an overview table of every activity on every date, with the sunrise and sunset once per date in the column headings; each activity's places stay visible, and its date-by-date forecast details are closed at first (FR-014 to FR-018).
- Q: How far around the plan's location are places searched? → A: Within the plan's maximum travel distance from step 1, capped at 50 km so the search stays small; the cap is a default that can be changed in configuration (FR-006).
- Q: Does the user choose one place per activity on step 3? → A: No. Step 3 only shows the places; the schedule (feature 008) chooses the place for each activity, so that it can keep travel between activities short (feature 009) (FR-008).
- Q: When the places for some categories arrive but the map data service fails for another category in the same request, does step 3 show the places it did get? → A: No. The place request succeeds or fails as a whole: if any category fails, no places are shown, the one error with "Retry" is shown, and every "Place" cell shows "Not available" (FR-009).
- Q: When reused places of different categories were received at different times, what time does "Places updated at HH:MM" show? → A: One message with the oldest receive time among the places shown (FR-012).
- Q: When the weather service fails but the places arrive, what do the overview's date cells show? → A: The overview stays; every date cell shows "Not available", the date headings show only the date and weekday without sunrise and sunset, and the forecast error with its "Retry" is shown above the overview (FR-015, FR-016).
- Q: Does step 3 wait for both the forecast and the places before showing anything, and what do the "Place" cells show during a places "Retry"? → A: On opening, the step waits until both have answered or failed and then shows everything at once. During a places "Retry", the forecast and overview stay, and the "Place" cells and place lists show "Getting nearby places…", which is announced (FR-003, FR-009).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See nearby places for each activity (Priority: P1)

On step 3, "Places and forecast", a Visitor or Active Registered User sees, under each activity, the nearest places where it can be done, with each place's name and where it is, for example "Kayaking: Nemuno slipway, 3.4 km away, Kaunas". They no longer have to search a map for each activity themselves.

**Why this priority**: Project FR-010 and Journey 1 step 4. The schedule (feature 008) places each activity at one of these places.

**Independent Test**: With a checked setup in Kaunas and checked activities Kayaking (tags `leisure=slipway`, `sport=canoe`) and Museum (tag `tourism=museum`), and a fake map data service with three matching places for each, open step 3 and check that each activity lists its places, nearest first, with name, distance and area.

**Acceptance Scenarios**:

1. **Given** a checked setup and checked activities, **When** the user opens step 3, **Then** "Getting the forecast and nearby places…" is shown and announced until both the forecast and the places have answered or failed, and then the overview and a "Places" list under each activity are shown at once.
2. **Given** the map data has places that match any of an activity's category tags within the search area, **Then** the activity lists at most 5 of them, nearest to the plan's location first, each with its name, its distance from the plan's location in km with one decimal place ("3.4 km away"), its town or area when the map data has one, and a "View on map" link that opens the place on OpenStreetMap in a new tab.
3. **Given** two activities of the same category ("Cycling 1", "Cycling 2"), **Then** both list the same places.
4. **Given** a place in the map data has no name, **Then** it is not listed.
5. **Given** the same place matches two of a category's tags, **Then** it is listed once.
6. **Given** the places are shown, **Then** the step shows "Places updated at HH:MM" with the time, in Lithuanian time, at which they were received from the map data service (the oldest time when categories were received at different times).

---

### User Story 2 - Know what to do when no place is found (Priority: P1)

When no place is found for an activity, the activity is flagged with the reason instead of being dropped, and the user can remove it from the plan or go back and change it.

**Why this priority**: Project FR-036. Without a place, the activity cannot be scheduled; the user must see why and what they can do.

**Independent Test**: With a fake map data service that returns no place for Kayaking, open step 3 and check that Kayaking shows "No place found within 30 km." with "Remove" and "Change activity", then select "Remove" and check that Kayaking is gone and the other activities stay.

**Acceptance Scenarios**:

1. **Given** no named place matches an activity's tags within the search area, **Then** the activity shows "✗ No place found within <radius> km." with a "Remove" button and a "Change activity" button, and the overview marks it "No place found".
2. **Given** the flag is shown, **When** the user selects "Remove", **Then** the activity is taken out of the plan, "<name> removed." is announced, focus moves to the next activity's heading (the previous one when it was last), and the other activities, places and forecast stay as they are without a new request.
3. **Given** the activity is the only one in the plan, **When** the user selects "Remove", **Then** the user is sent to the Activity selection step, which shows "No activities added yet. Select at least one category to continue."
4. **Given** the flag is shown, **When** the user selects "Change activity", **Then** the Activity selection step opens with the plan's activities kept and focus on that activity's heading.
5. **Given** the user keeps an activity without a place, **Then** it stays in the plan and stays flagged; the schedule (feature 008) lists it as unscheduled with the reason (project FR-036).

---

### User Story 3 - See every activity on every date at a glance (Priority: P1)

Step 3 starts with an overview: one row per activity and one column per plan date, with the best suitable period in each cell and whether a place was found. The details of each activity are below it, closed until the user opens them.

**Why this priority**: Found in user testing of feature 006: with several activities and dates, the step repeats the sunrise, sunset and settings many times and the answer the user needs is hard to find. Adding places makes the step longer still.

**Independent Test**: With 3 activities, 2 dates and a fake forecast, open step 3 and check that the overview has 3 rows and 2 date columns, each date heading shows its sunrise and sunset once, and each cell shows the longest suitable period or "✗ None".

**Acceptance Scenarios**:

1. **Given** the forecast and places have arrived, **Then** step 3 shows, above the activities, an overview table with a row per activity in plan order, a "Place" column and one column per plan date in date order.
2. **Given** a date column, **Then** its heading shows the date with its weekday and that date's sunrise and sunset ("Sat 14 Nov · Sunrise 07:42 · Sunset 16:21"), and the sunrise and sunset are not repeated under each activity.
3. **Given** an activity has suitable periods on a date, **Then** its cell shows the longest one ("★ 10:00–14:00 (4 h)"), the earliest when two are equally long, with ", too short" added when it is shorter than the activity's duration; with no suitable hour it shows "✗ None"; on today's date with no hour left it shows "No hours left".
4. **Given** an Indoor activity that does not require daylight, **Then** each of its cells shows "★ 06:00–22:00 (16 h)" (or the hours left today).
5. **Given** an activity's "Place" cell, **Then** it shows the nearest place's name, "✗ No place found", or "Not available" when the places could not be loaded.
6. **Given** the activities below the overview, **Then** each shows its places, a one-line summary of its settings, its forecast summary, and a "Show forecast details" button, closed at first, that opens the date entries with their suitable periods and "Show hours" buttons from feature 006.

---

### User Story 4 - Know when the map data service is unavailable (Priority: P1)

When the places cannot be received, the user is told so and can try again. No places that look current are shown in their place, and the forecast is still shown when it arrived.

**Why this priority**: Project NFR-007 and the constitution's external data rule: the application MUST NOT show invented or outdated data as current.

**Independent Test**: Make the fake map data service fail while the fake weather service answers, open step 3, and check that the places error and "Retry" are shown, no places are listed, and the forecast is shown; then make the map data service answer and select "Retry".

**Acceptance Scenarios**:

1. **Given** the map data service fails, does not answer in time, or cannot be reached from the server, **When** step 3 opens, **Then** "Error: The map data service is unavailable. No places are shown." is shown once above the overview with a "Retry" button, no places are listed, every "Place" cell shows "Not available", and no activity is flagged "No place found".
2. **Given** only the map data service failed, **Then** the forecast and the overview's date cells are still shown.
3. **Given** the places error is shown, **When** the user selects "Retry", **Then** the forecast and overview stay, the "Place" cells and place lists show "Getting nearby places…" (announced), and when the service answers the places are shown and the forecast is not requested again.
4. **Given** both services fail, **Then** both errors are shown, each with its own "Retry".
5. **Given** only the weather service failed, **Then** the places are shown, the forecast error with its "Retry" is shown above the overview, the overview stays with every date cell showing "Not available", and the date headings show the date and weekday without sunrise and sunset.
6. **Given** a map data service failure, **Then** it is recorded with its time and kind of failure so that an administrator can review it later (feature 015).
7. **Given** 30 location searches, plan setup checks, forecast requests and place requests together in one minute from the same network address, **Then** the next place request is refused without contacting the map data service, and "Error: Too many requests. Wait a minute and try again." is shown.

---

### User Story 5 - Places match the checked plan (Priority: P1)

The server checks the plan's setup and activities again before searching for places, and takes the location's position and each category's tags from its own data, so the places always belong to a valid plan.

**Why this priority**: The constitution requires every input to be checked on the server; the browser session can be old or changed, and map place tags are administrator-only data (feature 005 FR-003).

**Independent Test**: Send a place request directly to the server with an unknown location id, a date in the past, an unknown category and made-up tags; check that each is refused or ignored as described and the map data service is not contacted for a refused request.

**Acceptance Scenarios**:

1. **Given** a checked setup or checked activities that are no longer valid, **When** step 3 opens, **Then** the same redirects and "checked again" notices as feature 006 FR-005 apply, and no places are shown.
2. **Given** a request sent directly to the server, **Then** the location's position comes from the location search service by its id, and each activity's tags come from its stored category, never from the request.
3. **Given** the answer to the browser, **Then** it contains each place's name, position, distance and area, and never the category's map place tags.

---

### User Story 6 - Only visitors and active registered users can get places (Priority: P1)

The same people who may plan (features 004 to 006) may get places for their plan.

**Why this priority**: Project FR-032 and FR-041, and the security rule that the server enforces every access rule.

**Independent Test**: Request places for a valid plan as a Visitor, an Active Registered User, an Active and a Suspended Administrator, a Suspended Registered User and a signed-in user whose account was deleted; only the first two get them.

**Acceptance Scenarios**:

1. **Given** a Visitor or an Active Registered User with a checked setup and checked activities, **When** they open step 3, **Then** the places are shown.
2. **Given** a signed-in Active Administrator, **When** they open step 3, **Then** the Access Denied page is shown; a Suspended user is sent to the Account Suspended page.
3. **Given** anyone other than a Visitor or an Active Registered User, **When** they request places directly from the server, **Then** the server refuses the request and does not contact the map data service.

---

### User Story 7 - Use places and the overview with keyboard, screen reader and on a phone (Priority: P2)

The overview, the places and the forecast details can be read and used with only the keyboard and a screen reader, and on a phone-sized screen.

**Why this priority**: Project NFR-004 and NFR-009 to NFR-014, the accessibility constraints in the constitution and the responsive rules in `docs/ux-design.md`.

**Independent Test**: At 320 px width, using only the keyboard, read the overview, open one activity's forecast details, follow a "View on map" link and remove an activity with no place, without horizontal scrolling.

**Acceptance Scenarios**:

1. **Given** a desktop screen, **Then** the overview is a table with a caption, column headings for the place and each date, and a row heading for each activity.
2. **Given** a phone-sized screen, **Then** the overview shows one card per activity, titled with the activity, listing the place and each date as "Label: value"; places are a list; buttons are full width with touch targets of at least 44 × 44 px; and there is no horizontal scrolling at 320 px.
3. **Given** a screen reader, **Then** the "View on map" links name their place and say that they open in a new tab, "Remove" and "Change activity" name their activity, "Show forecast details" names its activity and reports whether the details are open, and the loading, error, removed and "updated at" messages are announced.

---

### Edge Cases

- A place matches the tags but lies outside the search area: it is not listed.
- More than 5 places match: only the 5 nearest are listed; places at the same distance are ordered by name.
- A place is a line or an area in the map data (a cycle route, a park): its position and distance are taken from its centre point.
- Two places have the same name in different positions: both are listed, each with its own distance and area.
- The map data has a place name in several languages: the Lithuanian name is shown when present, otherwise the default name.
- A category's tags were changed by an administrator after the user added the activity: the current stored tags are used (the tags are not part of the activity's own settings).
- The map data service answers with more places than are needed: the server keeps only what step 3 shows.
- The user selects "Retry" for places several times quickly: only one place request runs at a time.
- An answer arrives after the user has left step 3: it is ignored.
- The map data service answers for some categories but fails for another: no places are shown and the map data service error is shown, as for a full failure (FR-009).
- The user removes an activity on step 3, then goes back to Activity selection: the removed activity is gone there too.
- The user removes every activity with no place until one with a place is left: the step keeps working with the remaining activities.
- The plan's maximum travel distance is changed on step 1 after places were shown: the setup is no longer checked, and step 3 sends the user back (feature 004 FR-026) before any new search.

## Requirements *(mandatory)*

### Functional Requirements

**Access**

- **FR-001**: Only Visitors and signed-in Active Registered Users MAY get places on step 3, with the same rules as feature 006 FR-001: an Active Administrator MUST see the Access Denied page and a Suspended user MUST be sent to the Account Suspended page.
- **FR-002**: The server MUST refuse the place request for anyone other than a Visitor or an Active Registered User, whatever the browser shows, and MUST NOT contact the map data service for a refused request.

**Getting the places**

- **FR-003**: When step 3 opens with a checked setup and checked activities, the system MUST get the places for every activity together with the forecast of feature 006. Until both have answered or failed, the step MUST show and announce "Getting the forecast and nearby places…" instead of feature 006's "Getting the forecast…", and MUST NOT show the overview, the places or the forecast; it then shows them all at once.
- **FR-004**: Before contacting the map data service, the server MUST check the setup and the activities again with the same rules and redirects as feature 006 FR-004 and FR-005. The location MUST be identified only by its location search id, its position MUST come from the location search service, and each activity's map place tags MUST come from its stored category, never from the request.
- **FR-005**: For each activity the system MUST find the named places in the map data that match at least one of its category's map place tags within the search area of FR-006. Activities of the same category MUST get the same places, and each category MUST be searched at most once per request.
- **FR-006**: The search area MUST be a circle around the plan's location whose radius is the plan's checked maximum travel distance (feature 004 FR-016), but at most 50 km. A place exactly on the edge of the circle is inside it. The distance is compared after rounding to one decimal place, as it is shown (FR-018), so a place shown as "30.0 km away" is inside a 30 km circle.
- **FR-007**: For each activity the system MUST list at most 5 places, nearest to the plan's location first, places at the same distance ordered by name. Each place MUST be listed once even when it matches several tags. A place without a name MUST NOT be listed. The distance MUST be the straight-line distance from the plan's location to the place (its centre point for a line or an area).
- **FR-008**: Step 3 MUST only show the places; the user MUST NOT choose a place for an activity in this feature. The schedule (feature 008) chooses the place for each activity from the places found with these rules.
- **FR-009**: When the map data service fails, does not answer in time (the server stops waiting for it after 4 seconds, so that the whole place request, even with a location lookup that is not reused, ends within the step's 10 seconds), or cannot be reached from the server, the step MUST show "Error: The map data service is unavailable. No places are shown." once, above the overview, with a "Retry" button that requests only the places again. No places and no "No place found" flags MUST be shown, and every "Place" cell MUST show "Not available". The place request MUST succeed or fail as a whole: when the map data service fails for any category, the places of the other categories MUST NOT be shown either, and "Retry" requests the places of every activity again. While a places "Retry" runs, the forecast and the overview MUST stay as they are, and the "Place" cells and place lists MUST show "Getting nearby places…", which MUST be announced. The forecast MUST be shown when it arrived, and a forecast error MUST be shown with its own "Retry" (feature 006 FR-006). When the place request fails for another reason, the step MUST show "Error: Something went wrong. Try again." once, above the overview, with a "Retry" button. Only one place request MAY run at a time, and an answer that arrives after the user has left step 3 MUST be ignored.
- **FR-010**: The system MUST record each map data service failure (time and kind of failure, without the user's identity) so that it can be reviewed later (project FR-043, feature 015).
- **FR-011**: Place requests MUST count towards the same limit as location searches, plan setup checks and forecast requests (feature 006 FR-008, project FR-049): together at most 30 per minute from one network address. A refused request MUST NOT reach the map data service, MUST NOT be recorded as a service failure, and the step MUST show "Error: Too many requests. Wait a minute and try again."
- **FR-012**: The places shown MUST have been received from the map data service no more than 24 hours earlier; requests for the same location, search area and tags within that time MAY use the same places. The step MUST show one "Places updated at HH:MM" message with the time they were received, in Lithuanian time; when the places of different categories were received at different times, it MUST show the oldest of those times.
- **FR-013**: The answer to the browser MUST contain, for each place, only its name, position, distance and town or area, and MUST NOT contain the category's map place tags or other administrator-only data (feature 005 FR-003).

**Step 3 layout**

- **FR-014**: Step 3 MUST keep the heading, tab title, progress bar, setup summary and "Back" from feature 005 FR-017 and feature 006 FR-020. Below the setup summary it MUST show an overview table ("Plan overview") with one row per activity in plan order, a "Place" column, and one column per plan date in date order. It MUST NOT contain a "Generate schedule" button in this feature.
- **FR-015**: Each date column heading MUST show the date with its weekday and that date's sunrise and sunset times. The sunrise and sunset MUST NOT be repeated under each activity. When the forecast is not available (feature 006 FR-006), the headings MUST show only the date with its weekday.
- **FR-016**: Each date cell MUST show the activity's longest suitable period on that date as "★ HH:MM–HH:MM (n h)", the earliest when two are equally long, with ", too short" added when it is shorter than the activity's duration; "✗ None" when there is no suitable hour; or "No hours left" on today's date when no hour is left. An Indoor activity without a daylight requirement MUST show the whole planning window that is left on that date. When the forecast is not available, the overview MUST still be shown, every date cell MUST show "Not available", and the forecast error with its "Retry" MUST be shown above the overview. While a forecast "Retry" runs, the places and the overview MUST stay as they are, and the date cells MUST show "Getting the forecast…", which MUST be announced. Each "Place" cell MUST show the nearest place's name, "✗ No place found", or "Not available" (FR-009).
- **FR-017**: Below the overview, each activity MUST be a labelled section named after the activity, with: a "Places" list (FR-007) or the no-place flag (FR-019); one line with its settings ("Outdoor · 2 h · Requires daylight · Wind up to 8 m/s · Rain up to 0.5 mm/h · 15 to 35 °C"); its forecast summary (feature 006 FR-022); and a "Show forecast details" button, closed at first, that opens its date entries from feature 006 FR-021 and FR-023 without the sunrise and sunset.
- **FR-018**: Each place MUST show its name, "<distance> km away" with one decimal place, its town or area when the map data has one, and a "View on map" link that opens the place on OpenStreetMap in a new tab. The link's name for screen readers MUST start with its visible text and name the place, for example "View on map, Nemuno slipway (opens in a new tab)".

**No place found**

- **FR-019**: When no place is found for an activity (FR-005 to FR-007), the activity MUST show "✗ No place found within <radius> km." (the radius of FR-006, for example "within 30 km") with a "Remove" button and a "Change activity" button. The activity MUST NOT be removed automatically (project FR-036).
- **FR-020**: "Remove" MUST take the activity out of the plan, announce "<name> removed.", and move focus to the next activity's heading (the previous one when it was last). The remaining activities MUST keep their places, forecast and checked state without a new request, and the overview MUST lose that row. When it was the only activity, the user MUST be sent to the Activity selection step, which shows its "No activities added yet" text (feature 005 FR-007).
- **FR-021**: "Change activity" MUST open the Activity selection step with every activity kept and focus on that activity's heading.
- **FR-022**: An activity without a place that the user keeps MUST stay in the plan and stay flagged on step 3; the schedule (feature 008) lists it as unscheduled with the reason.

**Session**

- **FR-023**: The places MUST be requested each time step 3 opens and on the places "Retry". They MUST NOT be kept in the browser session or saved to any account in this feature.

**Accessibility and layout**

- **FR-024**: On desktop the overview MUST be a table with a caption, column headings and a row heading per activity. On phone-sized screens it MUST become one card per activity, titled with the activity, listing the place and each date as "Label: value", with full-width buttons, touch targets of at least 44 × 44 px and no horizontal scrolling at 320 px width.
- **FR-025**: "Remove" and "Change activity" MUST name their activity for screen readers. "Show forecast details" MUST name its activity and report whether the details are open, with an accessible name that starts with its visible text. The loading, error, removed and "updated at" messages MUST be announced without moving focus. Suitability and the no-place flag MUST use ★ and ✗ with words, never colour alone (NFR-010).

### Key Entities

- **Place**: a named point, line or area in the map data that matches at least one of a category's map place tags: its name, position, distance from the plan's location and town or area when known. Received from the map data service; it is not stored in the database.
- **Search Area**: the circle around the plan's location in which places are searched (FR-006).
- **Activity Places**: for one plan activity, its listed places, or the no-place flag with its reason.
- **Activity Category** (from feature 003): its map place tags, used only on the server.
- **Current Plan** (from features 004 and 005): the checked location, dates, maximum travel distance and checked activities that places are found for.
- **Plan Overview**: for each activity, its nearest place or no-place flag, and for each plan date its longest suitable period (from feature 006).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a plan with 10 activities from 5 categories, the places of every activity are shown within 5 seconds of opening step 3 in 95% of attempts when the map data service answers normally.
- **SC-002**: A user can tell which activity suits which date, and where each activity can be done, within 30 seconds of the step loading, without opening any details.
- **SC-003**: In a test set with places inside, on and outside the edge of the search area, unnamed places and places matching several tags, 100% of activities list exactly the expected places in the expected order.
- **SC-004**: 100% of activities without a place show the flag with the reason and both actions, and none is removed without the user's action.
- **SC-005**: In 100% of map data service failures the error message is shown and no places are shown, while a forecast that arrived is still shown.
- **SC-006**: 100% of place requests from Administrators, Suspended users or deleted accounts, with an invalid setup or activities, or over the request limit are refused without contacting the map data service.
- **SC-007**: The overview, places and forecast details can be read and used with only the keyboard, and on a 320 px wide screen without horizontal scrolling.

## Assumptions

- **Search radius** (Clarifications). The search uses the user's own maximum travel distance, so a 10 km plan only shows places within 10 km. The 50 km cap keeps the map data search small and fast even for a 200 km plan; it is a default that can be changed in configuration without a code change.
- **No choice of place** (Clarifications). Showing the places is enough for the user to see what is nearby. Choosing one place per activity is left to the schedule (feature 008), which can pick places that keep travel short (feature 009). Letting the user pick or prefer a place may be added in a later feature.
- **Matching tags.** A place matches a category when it has at least one of the category's exact key=value tags (feature 003 FR-009). Points, lines and areas in the map data are all searched, because some places (cycle routes, parks, castles) are mapped as lines or areas.
- **Named places only.** FR-010 asks for each place's name and location, so places without a name are not listed. A category whose places are mostly unnamed (for example plain picnic tables) may show "No place found"; the administrator can then change its tags. A place needs its default name in the map data to be found; when it also has a Lithuanian name, that name is shown. A place with only a Lithuanian name is not listed.
- **Straight-line distance.** The distance shown is the straight-line distance from the plan's location. Travel distance between consecutive activities and the maximum travel distance check belong to feature 009.
- **Five places per activity** is enough to choose from on step 3 and keeps the step short; it is a default that can be changed in configuration without a code change.
- **Freshness.** Places change rarely, so places up to 24 hours old count as current. The 24 hours is a default that can be changed in configuration without a code change.
- **Shared request limit.** Place requests share the limit of features 004 and 006 (project FR-049); one opening of step 3 stays well within it.
- **Independent services.** The forecast and the places come from different services, so a failure of one does not hide the other's results.
- **Area name.** The town or area is taken from the place's own address in the map data when it has one; otherwise only the distance is shown.
- **The map link** opens openstreetmap.org in the browser at the place's position. Opening a public map page is not a call to the map data service from the browser.
- The places are public map data and contain no personal data. Nothing in this feature is stored in the database, so it needs no schema change.

## Dependencies

- Feature 003 Activity Category Management (merged): each category's map place tags.
- Feature 004 Plan Location and Dates (merged): the checked setup, the location's position from the location search service, the maximum travel distance, and the access rule for plan pages.
- Feature 005 Activity Selection and Limits (merged): the checked activities, removing an activity, the Activity selection step that "Change activity" opens, and the "No activities added yet" text.
- Feature 006 Hourly Forecast (merged): the forecast, suitable periods, summaries, date entries and "Show hours" that this feature arranges into the overview and the closed details, the "checked again" redirects, the error handling and the shared request limit.
- The map data service (OpenStreetMap Overpass API, a project constraint) for the places.
- Related UX material: Journey 1 step 4, Screen 6 (Places and forecast), the Places and Forecast states in section 6, and the Places and Forecast layout in section 8 of `docs/ux-design.md`.
- Features 008 (schedule), 009 (travel distance) and 015 (service status and error log) depend on this feature.

## Scope Boundaries

**In scope**: finding and showing the nearest named places for each activity; the no-place flag with "Remove" and "Change activity"; the map data service error, request limit and failure records; the overview table with sunrise and sunset once per date; closing each activity's forecast details at first; and access, accessibility and layout for these.

**Out of scope**: choosing or preferring a place for an activity (008 chooses); building the schedule, the "Generate schedule" button and the "unscheduled" list (008); travel distance between activities and the maximum travel distance check (009); saving places or plans (010); a forecast for each place instead of the plan's location (feature 006 assumption); opening hours, prices, ratings, photos or reviews of places; an embedded map; routing or directions; and the administrator's service status and error log pages (015).

## Traceability

| Project requirement | Covered by |
|---|---|
| FR-010 (display the name and location of each retrieved place) | FR-003 to FR-008, FR-012, FR-017, FR-018, User Story 1 |
| FR-036 (flag an activity with the reason when no place is found, instead of removing it) | FR-019 to FR-022, User Story 2 |
| FR-044 (map place tags per category, used to find places) | FR-004, FR-005, FR-013, User Story 5 |
| FR-032, FR-041 (no planning by administrators; block suspended users) | FR-001, FR-002, User Story 6 |
| FR-043 (record map service errors for later review) | FR-010, User Story 4 |
| FR-049 (limit requests that reach external services) | FR-011, User Story 4 |
| NFR-007 (no invented or outdated data when the service is unavailable) | FR-009, FR-012, User Story 4 |
| NFR-010 (not by colour alone) | FR-016, FR-019, FR-025 |
| NFR-004, NFR-009 to NFR-014 (keyboard, labels, announcements, layout, headings) | FR-024, FR-025, User Story 7 |
| User testing of feature 006 (step 3 hard to scan) | FR-014 to FR-017, User Story 3 |
