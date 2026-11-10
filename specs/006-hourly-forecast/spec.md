# Feature Specification: Hourly Forecast

**Feature Branch**: `006-hourly-forecast`

**Created**: 2026-11-10

**Status**: Draft

**Input**: Feature 006 from the feature list in `docs/architecture.md` (section 6): "A user sees which hours suit each activity" (project FR-009, FR-011 to FR-015). After a checked Plan setup (feature 004) and checked activities (feature 005), the "Places and forecast" step gets the hourly weather forecast for the plan's location and dates and shows, for each activity, which hours meet its temperature, rain, wind and daylight requirements, with the reason for every unsuitable hour. It follows Journey 1 step 5, Screen 6, the Places and Forecast states in section 6, and the Places and Forecast layout in section 8 of `docs/ux-design.md`, and adds the forecast to the first version of step 3 built by feature 005. Nearby places belong to feature 007 and the schedule to feature 008.

## Clarifications

### Session 2026-11-10

- Q: Which hours of each day count for planning? → A: A fixed window from 06:00 to 22:00 (16 hours, the last hour 21:00–22:00), a default that can be changed in configuration. Hours outside it are not shown and are never suitable (FR-010).
- Q: When a run of suitable hours is shorter than the activity's duration, what should step 3 do with it? → A: Show it but mark it ("★ Suitable 10:00–11:00 (1 h), shorter than this activity's 2 h"), and the activity summary says when no period on any date is long enough (FR-021, FR-022).
- Q: When the server finds the plan out of date and sends the user back to step 1 or 2, what should they see there? → A: A notice at the top of that page: "Your plan setup needs to be checked again. Select Continue." (step 1) or "Your activities need to be checked again. Select Continue." (step 2); Continue then shows the field messages as usual (FR-005).
- Q: Should every activity be judged against the forecast for the plan's chosen location, even when its place may be up to 200 km away? → A: Yes. One forecast for the plan's location is used for every activity, on step 3 and in the schedule (feature 008) (FR-003, Assumptions).
- Q: Should forecast requests share the limit of 30 per minute per network address with location searches and plan setup checks, or have their own? → A: Shared. Forecast requests count towards the same limit as feature 004's location searches and plan setup checks, with the same message (FR-008).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See which hours suit each activity (Priority: P1)

On step 3, "Places and forecast", a Visitor or Active Registered User sees each of their activities with the suitable hours on each plan date, for example "Kayaking, Saturday 14 November 2026: ★ Suitable 10:00–14:00 (4 h)". They no longer have to compare a weather app, sunrise times and their own limits by hand.

**Why this priority**: This is the problem the application exists to solve (problem statement, project goal 6). The schedule (feature 008) is built from these suitable hours.

**Independent Test**: With a checked setup of one date and checked activities Kayaking (max wind 8 m/s, max rain 0.5 mm/h, 15 to 35 °C, requires daylight) and Museum (Indoor, no daylight requirement), and a fake forecast, open step 3 and check that Kayaking lists exactly the hours that meet all its limits and fall in daylight, and that Museum says every hour is suitable.

**Acceptance Scenarios**:

1. **Given** a checked setup and checked activities, **When** the user opens step 3, **Then** "Getting the forecast…" is shown and announced, followed by a forecast area under each activity, with one entry per plan date in date order.
2. **Given** the forecast has arrived, **When** the user looks at an Outdoor activity's entry for a date, **Then** it shows the date, the sunrise and sunset times, and each period of consecutive suitable hours as "★ Suitable 10:00–14:00 (4 h)", in time order.
3. **Given** an Outdoor activity has no suitable hour on a date, **Then** that date's entry shows "✗ No suitable hours on this date."
4. **Given** an activity has no suitable hour on any plan date, **Then** its forecast area starts with "No suitable hours on any of your dates. Try other dates or change this activity's limits."
5. **Given** an activity has suitable hours, **Then** its forecast area starts with a summary such as "Suitable hours: 9 on 2 of 3 dates."
6. **Given** an Indoor activity that does not require daylight, **Then** its forecast area shows "Weather does not affect this indoor activity. Every hour from 06:00 to 22:00 is suitable." and no hourly details.
7. **Given** an Indoor activity that requires daylight, **Then** only daylight is checked, and its suitable periods are the daylight hours of each date.
8. **Given** the forecast is shown, **Then** the step shows "Forecast updated at 14:05" with the time, in Lithuanian time, at which the forecast was received from the weather service.
9. **Given** Kayaking has a duration of 2 h and a suitable period 10:00–11:00, **Then** the period is shown as "★ Suitable 10:00–11:00 (1 h), shorter than this activity's 2 h", while a period 13:00–16:00 is shown as "★ Suitable 13:00–16:00 (3 h)".
10. **Given** an activity has suitable hours but no period on any date is as long as its duration, **Then** its summary reads, for example, "Suitable hours: 3 on 2 of 3 dates. No period is long enough for this activity's 2 h."

---

### User Story 2 - Understand why an hour is unsuitable (Priority: P1)

For each activity and date the user can open the hour-by-hour details: the temperature, rain, wind and daylight of every hour, whether it suits the activity and, if not, why ("Too windy: 9.0 m/s, maximum 8.0 m/s").

**Why this priority**: Weather apps report conditions without saying whether they suit an activity (problem statement). Showing the reason lets the user decide whether to change dates or loosen a limit, and NFR-010 requires the reason in words.

**Independent Test**: With a fake forecast where 12:00 has 9 m/s wind and 1.2 mm/h rain, open Kayaking's details for that date and check that 12:00 shows "✗ Unsuitable" with both reasons.

**Acceptance Scenarios**:

1. **Given** an activity's entry for a date, **When** the user selects "Show hours for Saturday 14 November 2026", **Then** a table of that date's hours opens with the columns Time, Temperature, Rain, Wind, Daylight and Suitability, and the button changes to "Hide hours for Saturday 14 November 2026".
2. **Given** the hour 12:00–13:00 meets every requirement of the activity, **Then** its Suitability shows "★ Suitable".
3. **Given** the hour 12:00–13:00 has a wind of 9.0 m/s against a maximum of 8.0 m/s and rain of 1.2 mm/h against a maximum of 0.5 mm/h, **Then** its Suitability shows "✗ Unsuitable" with "Too windy: 9.0 m/s, maximum 8.0 m/s" and "Too much rain: 1.2 mm/h, maximum 0.5 mm/h".
4. **Given** a temperature of 12.0 °C against a minimum of 15.0 °C, or 36.0 °C against a maximum of 35.0 °C, **Then** the reason is "Too cold: 12.0 °C, minimum 15.0 °C" or "Too warm: 36.0 °C, maximum 35.0 °C".
5. **Given** an activity that requires daylight and an hour that starts before sunrise or ends after sunset, **Then** the hour's Daylight shows "No" and the reason "Outside daylight" is listed.
6. **Given** a value equal to its limit (for example wind 8.0 m/s with a maximum of 8.0 m/s, or 15.0 °C with a minimum of 15.0 °C), **Then** that value does not make the hour unsuitable.
7. **Given** the weather service has no value for an hour, **Then** the missing value shows "No data" and the hour is "✗ Unsuitable" with the reason "No forecast for this hour".

---

### User Story 3 - Know when the weather service is unavailable (Priority: P1)

When the forecast cannot be received, the user is told so and can try again. Nothing that looks like a forecast is shown in its place.

**Why this priority**: Project NFR-007 and the constitution's external data rule: the application MUST NOT show invented or outdated data as current.

**Independent Test**: Make the fake weather service fail, open step 3, and check that the error and "Retry" are shown with no hours, then make it answer and select "Retry".

**Acceptance Scenarios**:

1. **Given** the weather service fails, does not answer in time, or cannot be reached from the server, **When** step 3 opens, **Then** "Error: The weather service is unavailable. No forecast is shown." is shown with a "Retry" button, no hours or suitable periods are shown, and the setup summary, the activities and "Back" stay visible.
2. **Given** the error is shown, **When** the user selects "Retry" and the service answers, **Then** the forecast is shown.
3. **Given** the step's request fails for a reason other than the weather service (for example a server error, no answer from the server within 10 seconds, or no network connection), **Then** "Error: Something went wrong. Try again." is shown with a "Retry" button.
4. **Given** 30 location searches, plan setup checks and forecast requests together in one minute from the same network address, **Then** the next forecast request is refused without contacting the weather service, and "Error: Too many requests. Wait a minute and try again." is shown.
5. **Given** a weather service failure, **Then** it is recorded with its time and kind of failure so that an administrator can review it later (feature 015).

---

### User Story 4 - The forecast matches the checked plan (Priority: P1)

The server checks the plan's setup and activities again before getting the forecast, so the result always belongs to a valid plan and to the real position of the chosen location.

**Why this priority**: The constitution requires every input to be checked on the server; the browser session can be old or changed.

**Independent Test**: Send a forecast request directly to the server with a date in the past, an unknown location id, and an activity with a wind limit of 31; check that each is refused and the weather service is not contacted.

**Acceptance Scenarios**:

1. **Given** a checked setup whose date has passed since it was checked (for example the tab was left open overnight), **When** step 3 opens, **Then** the setup is no longer counted as checked and the user is sent to the Plan setup page, which shows "Your plan setup needs to be checked again. Select Continue." at the top and marks the passed date (feature 004 FR-018).
2. **Given** checked activities of which one is no longer valid (for example its category was deleted or changed between Indoor and Outdoor), **When** step 3 opens, **Then** the activities are no longer counted as checked and the user is sent to the Activity selection step, which shows "Your activities need to be checked again. Select Continue." at the top; selecting "Continue" shows the matching message (feature 005 FR-012).
3. **Given** a request sent directly to the server, **Then** the location's position is taken from the location search service using the location's id, never from the request, and the setup and activities are checked with the same rules as features 004 and 005 before the weather service is contacted.

---

### User Story 5 - Only visitors and active registered users can get the forecast (Priority: P1)

The same people who may plan (features 004 and 005) may get the forecast for their plan.

**Why this priority**: Project FR-032 and FR-041, and the security rule that the server enforces every access rule.

**Independent Test**: Request the forecast for a valid plan as a Visitor, an Active Registered User, an Active and a Suspended Administrator, a Suspended Registered User and a signed-in user whose account was deleted; only the first two get it.

**Acceptance Scenarios**:

1. **Given** a Visitor or an Active Registered User with a checked setup and checked activities, **When** they open step 3, **Then** the forecast is shown.
2. **Given** a signed-in Active Administrator, **When** they open step 3, **Then** the Access Denied page is shown; a Suspended user is sent to the Account Suspended page.
3. **Given** anyone other than a Visitor or an Active Registered User, **When** they request the forecast directly from the server, **Then** the server refuses the request and does not contact the weather service.

---

### User Story 6 - Read the forecast with keyboard, screen reader and on a phone (Priority: P2)

The forecast can be read and the hourly details opened using only the keyboard and a screen reader, and on a phone-sized screen.

**Why this priority**: Project NFR-004 and NFR-009 to NFR-014, the accessibility constraints in the constitution and the responsive rules in `docs/ux-design.md`.

**Independent Test**: At 320 px width, using only the keyboard, open and close the hourly details of two activities and read every hour's suitability, without horizontal scrolling.

**Acceptance Scenarios**:

1. **Given** a desktop screen, **Then** each date's hourly details are a table with a header row, grouped under their activity.
2. **Given** a phone-sized screen, **Then** each hour becomes a card titled with its time, the other values listed as "Label: value", and suitability still shown with ★ or ✗ and words; there is no horizontal scrolling at 320 px.
3. **Given** a screen reader, **Then** each activity's forecast area is a labelled section named after the activity, the "Show hours" buttons name their activity and date and report whether the details are open, and the loading, error and "Forecast updated" messages are announced.

---

### Edge Cases

- Hours before 06:00 or after 22:00 are not shown and never count as suitable, even when the weather is good or the activity is Indoor without a daylight requirement (FR-010).
- A plan date is today: hours that have already started in Lithuanian time are not shown. When no hour is left, the date shows "No hours left to plan today." and counts as a date with no suitable hours.
- The clocks change on a plan date (last Sunday of March or October): hours are shown in Lithuanian local time as the weather service gives them; no hour is invented or shown twice.
- The weather service returns fewer hours than asked for the last date in the forecast period: the missing hours show "No data" and are unsuitable with "No forecast for this hour" (FR-012).
- A value is exactly at its limit, or differs from it only after the first decimal place (for example 15.04 °C against a minimum of 15.0 °C): values are compared after rounding to one decimal place, as shown, so the hour is suitable.
- Rain limit 0 mm/h: only hours with 0.0 mm/h of rain are suitable.
- Two activities from the same category with different limits ("Cycling 1", "Cycling 2"): each has its own suitable hours.
- The user opens step 3, goes back to Activity selection, changes nothing and returns: the forecast is requested again; it may be the same forecast if it is still recent (FR-009).
- The user changes an activity or the setup and returns to step 3 without continuing: step 3 sends them back (feature 005 FR-018), and no forecast is requested.
- The user selects "Retry" several times quickly: only one request runs at a time.
- An answer arrives after the user has left step 3: it is ignored.
- Sunrise or sunset falls in the middle of an hour (sunrise 07:42): the hour 07:00–08:00 is outside daylight, and 08:00–09:00 is the first daylight hour.

## Requirements *(mandatory)*

### Functional Requirements

**Access**

- **FR-001**: Only Visitors and signed-in Active Registered Users MAY use step 3 with its forecast, with the same rules as feature 005 FR-001: an Active Administrator MUST see the Access Denied page and a Suspended user MUST be sent to the Account Suspended page.
- **FR-002**: The server MUST refuse the forecast request for anyone other than a Visitor or an Active Registered User, whatever the browser shows, and MUST NOT contact the weather service for a refused request.

**Getting the forecast**

- **FR-003**: When step 3 opens with a checked setup and checked activities, the system MUST get the hourly forecast for the plan's location on every plan date (project FR-009). This one forecast MUST be used to judge every activity of the plan. While it loads, the step MUST show and announce "Getting the forecast…".
- **FR-004**: Before contacting the weather service, the server MUST check the setup again with the rules of feature 004 FR-012 and the activities again with the rules of feature 005 FR-011 to FR-013. The location MUST be identified only by its location search id, and its position MUST come from the location search service, never from the request. The limits used for the forecast MUST be the plan's checked values.
- **FR-005**: When the server finds the setup no longer valid (for example a date has passed), the system MUST stop counting the setup as checked and send the user to the Plan setup page with the kept values. When it finds an activity no longer valid, the system MUST stop counting the activities as checked and send the user to the Activity selection step with the kept activities. No forecast is shown in either case. The page the user lands on MUST show and announce a notice at the top: "Your plan setup needs to be checked again. Select Continue." on the Plan setup page, or "Your activities need to be checked again. Select Continue." on the Activity selection step. The notice MUST appear only after such a redirect. It MUST stay, including after a reload or when the user leaves the page and comes back, until the next successful "Continue" on that page, and then disappear. Logging out clears it with the rest of the plan.
- **FR-006**: When the weather service fails, does not answer in time (the server stops waiting for it well within the step's 10 seconds), or cannot be reached from the server, the step MUST show "Error: The weather service is unavailable. No forecast is shown." with a "Retry" button. When the request fails for another reason, including no answer from the server within 10 seconds or a network failure between the browser and the server, it MUST show "Error: Something went wrong. Try again." with a "Retry" button. In both cases no hours, suitable periods or earlier forecast MUST be shown, and the setup summary, the activities and "Back" MUST stay visible. Only one forecast request MAY run at a time, and an answer that arrives after the user has left step 3 MUST be ignored.
- **FR-007**: The system MUST record each weather service failure (time and kind of failure, without the user's identity) so that it can be reviewed later (project FR-043, feature 015).
- **FR-008**: Forecast requests MUST count towards the same limit as location searches and plan setup checks (feature 004 FR-027, project FR-049): together at most 30 per minute from one network address. A refused request MUST NOT reach the weather service, MUST NOT be recorded as a service failure, and the step MUST show "Error: Too many requests. Wait a minute and try again."
- **FR-009**: The forecast shown MUST have been received from the weather service no more than 30 minutes earlier; requests for the same location within that time MAY use the same forecast. The step MUST show "Forecast updated at HH:MM" with the time it was received, in Lithuanian time.

**Hours and weather**

- **FR-010**: For each plan date the forecast MUST cover the 16 hours from 06:00 to 22:00 (the first hour 06:00–07:00, the last 21:00–22:00), each hour running from HH:00 to the next full hour, in Lithuanian local time. On today's date, hours that have already started MUST NOT be shown; when none is left the date MUST show "No hours left to plan today."
- **FR-011**: For each hour the system MUST provide the temperature (°C), rain (mm/h), wind speed (m/s), each with one decimal place, and whether the hour is in daylight. For each date it MUST provide the sunrise and sunset times.
- **FR-012**: A value the weather service does not provide for an hour MUST be shown as "No data", never estimated, and the hour MUST be unsuitable for every activity whose rules need that value, with the reason "No forecast for this hour".

**Suitability rules** (decided on the server)

- **FR-013**: An hour meets an activity's temperature requirement when its temperature is at least the minimum and at most the maximum temperature (project FR-011).
- **FR-014**: An hour meets an activity's rain requirement when its rain is at most the maximum rain (project FR-012).
- **FR-015**: An hour meets an activity's wind requirement when its wind speed is at most the maximum wind (project FR-013).
- **FR-016**: An hour is in daylight when it starts at or after sunrise and ends at or before sunset. For an activity that requires daylight, an hour outside daylight MUST be unsuitable (project FR-014).
- **FR-017**: An hour is suitable for an Outdoor activity only when it meets the temperature, rain and wind requirements and, when the activity requires daylight, is in daylight (project FR-015). For an Indoor activity the weather is not checked: an hour is suitable when the activity does not require daylight or the hour is in daylight. Only the hours of FR-010 are ever judged.
- **FR-018**: Values MUST be compared with the limits after rounding to one decimal place, the same as shown. A value equal to its limit MUST meet the requirement.
- **FR-019**: Each unsuitable hour MUST list every requirement it fails, in this order and wording: "Too cold: <t> °C, minimum <min> °C", "Too warm: <t> °C, maximum <max> °C", "Too much rain: <r> mm/h, maximum <max> mm/h", "Too windy: <w> m/s, maximum <max> m/s", "Outside daylight", "No forecast for this hour".

**Showing the forecast on step 3**

- **FR-020**: Step 3 MUST keep everything from feature 005 FR-017 (heading, tab title, progress bar, setup summary, activities with their settings, "Back") and add, under each activity, a forecast area that is a labelled section named after the activity, with one entry per plan date in date order. It MUST NOT contain a "Generate schedule" button or places in this feature.
- **FR-021**: Each date entry MUST show the date with its weekday, the sunrise and sunset times, and each period of consecutive suitable hours in time order as "★ Suitable HH:MM–HH:MM (n h)", or "✗ No suitable hours on this date." when there is none. A period shorter than the activity's duration MUST be shown with ", shorter than this activity's <duration> h" added (for example "★ Suitable 10:00–11:00 (1 h), shorter than this activity's 2 h"); a period exactly as long as the duration is not marked.
- **FR-022**: Each activity's forecast area MUST start with a summary: "Suitable hours: <n> on <d> of <total> dates." when it has suitable hours (with "date" instead of "dates" when the plan has one date, for example "Suitable hours: 3 on 1 of 1 date."), with " No period is long enough for this activity's <duration> h." added when every period is shorter than the activity's duration, or "No suitable hours on any of your dates. Try other dates or change this activity's limits." when it has none. For an Indoor activity that does not require daylight it MUST show only "Weather does not affect this indoor activity. Every hour from 06:00 to 22:00 is suitable."
- **FR-023**: Each date entry MUST have a "Show hours for <date>" button, closed at first, that opens and closes a list of that date's hours with Time, Temperature, Rain, Wind, Daylight ("Yes" or "No") and Suitability ("★ Suitable", or "✗ Unsuitable" followed by every reason from FR-019). For screen readers the button MUST also name the activity and report whether the list is open. Its accessible name MUST start with its visible text, followed by the activity, for example "Show hours for Saturday 14 November 2026, Kayaking", so voice control users can say the visible text.
- **FR-024**: Suitable and unsuitable hours MUST be told apart by the ★ and ✗ symbols and words, never by colour alone (NFR-010).

**Session**

- **FR-025**: The forecast MUST be requested each time step 3 opens and on "Retry". It MUST NOT be kept in the browser session or saved to any account; feature 008 uses it to build the schedule.

**Accessibility and layout**

- **FR-026**: On desktop the hourly details MUST be tables with header cells, grouped under their activity. On phone-sized screens each hour MUST become a card titled with its time, the other values listed as "Label: value", with full-width buttons, touch targets of at least 44 × 44 px and no horizontal scrolling at 320 px width.
- **FR-027**: Step 3 MUST keep exactly one main heading and "Skip to main content" as the first item reached with Tab. The loading, error and "Forecast updated" messages MUST be announced to screen readers without moving focus.

### Key Entities

- **Hourly Weather**: the forecast for the plan's location for one hour of one plan date: the hour, temperature, rain and wind speed, any of which may be missing. Received from the weather service; it is not stored in the database.
- **Daylight**: the sunrise and sunset times of the plan's location on one plan date.
- **Hour Suitability**: for one plan activity and one hour, whether the hour is suitable and the reasons when it is not.
- **Suitable Period**: a run of consecutive suitable hours for one activity on one date, with its start, end and length.
- **Current Plan** (from features 004 and 005): the checked location, dates, maximum travel distance and checked activities, which the forecast is requested for.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a plan with 7 dates and 10 activities, the suitable hours of every activity are shown within 5 seconds of opening step 3 in 95% of attempts when the weather service answers normally.
- **SC-002**: A user can find the suitable hours of a given activity on a given date within 30 seconds, without using any other tool.
- **SC-003**: In a test set that covers every rule at its limit, 0.1 inside it and 0.1 outside it (temperature, rain, wind and daylight at sunrise and sunset), 100% of hours are judged correctly.
- **SC-004**: Every unsuitable hour shows at least one reason in words (100%).
- **SC-005**: In 100% of weather service failures the error message is shown and no forecast values are shown.
- **SC-006**: 100% of forecast requests from Administrators, Suspended users or deleted accounts, with an invalid setup or activities, or over the request limit are refused without contacting the weather service.
- **SC-007**: The forecast can be read and every hourly list opened using only the keyboard, and on a 320 px wide screen without horizontal scrolling.

## Assumptions

- **Weather values.** Rain is the total precipitation (rain, showers and snow) forecast for the hour in mm. Wind is the mean wind speed 10 m above ground in m/s; gusts are not checked, because the activity limits from feature 003 have no gust limit. Temperature is the air temperature 2 m above ground.
- **One forecast per plan** (Clarifications). All activities are judged against the forecast for the plan's chosen location, on step 3 and in the schedule (feature 008). Places within the maximum travel distance (1 to 200 km) are assumed to have similar enough weather for planning; a forecast per place is not part of the MVP.
- **Duration only marks short periods** (Clarifications). Step 3 marks suitable periods that are shorter than the activity's duration so the user is not misled, but placing activities into periods, avoiding overlaps and the "No suitable time found" flag (project FR-016, FR-036) are part of the schedule (feature 008).
- **Planning hours** (Clarifications). Only the hours from 06:00 to 22:00 are planned, so an indoor activity without a daylight requirement is never suitable at night. The window covers early summer mornings (sunrise is around 04:45 in June) and evenings, keeps each date to 16 hours, and is a default that can be changed in configuration without a code change. Feature 008 schedules only within these hours.
- **Freshness.** A forecast up to 30 minutes old counts as current, because the weather service updates its forecast roughly once an hour. The 30 minutes is a default that can be changed in configuration without a code change.
- **Shared request limit** (Clarifications). Every forecast request also asks the location search service for the location's position (FR-004), so it shares feature 004's limit of 30 per minute per network address (project FR-049). A normal planning session (a few searches, one setup check and a few forecast loads) stays well below it. The limit stays configurable, as in feature 004.
- **The forecast period** is today plus 6 days (feature 004 FR-010), which the weather service covers hour by hour.
- Times are shown in 24-hour format in Lithuanian time, and numbers with a decimal point, as in features 003 to 005.
- The forecast is public data: it contains no personal data, and the location's name and position already came from the location search service in feature 004.
- Nothing in this feature is stored in the database, so it needs no schema change.

## Dependencies

- Feature 004 Plan Location and Dates (merged): the checked setup, the location's id and position from the location search service, the forecast period, the session storage of the current plan, and the access rule for plan pages.
- Feature 005 Activity Selection and Limits (merged): the checked activities with their duration, daylight setting and weather limits, the check rules reused by FR-004, and the first version of step 3 that this feature extends.
- The weather service (Open-Meteo, a project constraint) for the hourly forecast and the sunrise and sunset times.
- Related UX material: Journey 1 step 5, Screen 6 (Places and forecast), the External service unavailable and Places and Forecast states in section 6, the progress bar and Back rules in section 7, the Places and Forecast layout and the intentional exceptions in section 8, and the "Suitability is not only a colour" rule in section 9 of `docs/ux-design.md`.
- Features 008 (schedule) and 015 (service status and error log) depend on this feature.

## Scope Boundaries

**In scope**: getting the hourly forecast and daylight times for the plan's location and dates; checking every hour against each activity's temperature, rain, wind and daylight requirements; showing suitable periods, hourly details and reasons on step 3; the weather service error, request limit and failure records; the "checked again" notices on steps 1 and 2 when the server finds the plan out of date; and access, accessibility and layout for the forecast.

**Out of scope**: nearby places and the combined "Getting the forecast and nearby places…" message (007); placing activities by duration, building the schedule and the "Generate schedule" button (008); travel distance (009); saving the forecast or plan (010); recalculating saved plans when the forecast changes (012); the administrator's service status and error log pages (015); weather notifications; gust, humidity, UV or other weather values; and forecasts for each place rather than the plan's location.

## Traceability

| Project requirement | Covered by |
|---|---|
| FR-009 (retrieve hourly forecast for the location and dates) | FR-003 to FR-012, User Stories 1 and 4 |
| FR-011 (temperature requirement) | FR-013, FR-018, FR-019, User Story 2 |
| FR-012 (precipitation requirement) | FR-014, FR-018, FR-019, User Story 2 |
| FR-013 (wind requirement) | FR-015, FR-018, FR-019, User Story 2 |
| FR-014 (exclude hours outside daylight) | FR-016, FR-017, User Stories 1 and 2 |
| FR-015 (intervals that satisfy all conditions) | FR-017, FR-021, FR-022, User Story 1 |
| FR-032, FR-041 (no planning by administrators; block suspended users) | FR-001, FR-002, User Story 5 |
| FR-043 (record weather service errors for later review) | FR-007, User Story 3 |
| FR-049 (limit requests that reach the location search service) | FR-008, User Story 3 |
| NFR-007 (no invented or outdated data when the service is unavailable) | FR-006, FR-009, FR-012, User Story 3 |
| NFR-010 (suitability not by colour alone) | FR-019, FR-023, FR-024 |
| NFR-004, NFR-009 to NFR-014 (keyboard, labels, announcements, layout, headings) | FR-026, FR-027, User Story 6 |
| Business rule: an outdoor activity requiring daylight starts after sunrise and ends before sunset | FR-016 |
| Business rule: an outdoor activity must not be scheduled outside its weather limits | FR-013 to FR-017 |
