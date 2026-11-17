# Feature Specification: Generate Schedule

**Feature Branch**: `008-generate-schedule`

**Created**: 2026-11-16

**Status**: Draft

**Input**: Feature 008 from the roadmap. After the "Places and forecast" step (feature 007) shows each activity's nearby places and forecast, the user clicks "Generate schedule" to assign each activity a date and a concrete start–end time. The result is the "Schedule Overview" (step 4), which lists all activities chronologically with their time, place and weather conditions. Activities that cannot be scheduled are flagged with the reason (project FR-017, FR-018, FR-019, FR-036). Save, edit and recalculate (FR-020 to FR-026, FR-033) are out of scope and belong to later features.

## Clarifications

### Session 2026-11-16

- Q: When the user navigates back from the Schedule Overview (step 4) to step 3 via Back or the progress bar, is the previously generated schedule cleared immediately, or kept for forward navigation without regenerating? → A: Cleared immediately when leaving step 4; the user must click "Generate schedule" again to see step 4.
- Q: When the schedule generation fails because a service is unavailable, should the 503 response carry a `service` field (like the forecast and places endpoints) so the frontend shows the specific "weather service" or "map data service" message, or a generic error? → A: Yes — the 503 carries a `service` field; the frontend shows the specific unavailability message with its own Retry, matching the pattern from features 006/007.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate and view the schedule (Priority: P1)

A Visitor or Active Registered User is on "Places and forecast" (step 3) with forecast and places loaded. They click "Generate schedule", wait briefly, and see the Schedule Overview: all activities laid out day by day in chronological order, each with its time, place and the weather at that time. They can tell at a glance when and where each activity happens.

**Why this priority**: Core purpose of the feature (FR-017, FR-018, FR-019). Without the schedule the app cannot answer "when exactly do I do each activity?"

**Independent Test**: With a checked setup (Kaunas, 2 dates), three activities with forecast and places, click "Generate schedule", confirm that "Generating your schedule…" is shown, then the Schedule Overview appears with the activities grouped by date, in time order, each with start, end, place name and weather conditions for that slot.

**Acceptance Scenarios**:

1. **Given** step 3 with forecast and places loaded, **When** the user clicks "Generate schedule", **Then** step 4 opens with "Generating your schedule…" and the progress bar advances to Schedule Overview.
2. **Given** the schedule has been generated, **Then** activities are grouped by plan date, the dates are in ascending order, and within each date the activities are ordered by start time.
3. **Given** a scheduled activity, **Then** its row shows the start time, end time, activity name, nearest place (name and distance), and the forecast weather conditions at the assigned time (wind, rain and temperature, or "Weather does not affect this indoor activity.").
4. **Given** all activities are scheduled, **Then** "✓ All activities scheduled." is shown at the top.
5. **Given** the user navigates back to step 3 via the progress bar and clicks "Generate schedule" again, **Then** a fresh schedule is generated without using the previous result.
6. **Given** the schedule is shown, **Then** the page title is "Schedule Overview – Spėk laiku" and the browser tab reflects it.

---

### User Story 2 - Know when an activity cannot be scheduled (Priority: P1)

When no suitable non-overlapping time slot is found for an activity, or the activity has no place, it is listed as unscheduled with a plain-language reason, below the scheduled activities.

**Why this priority**: Project FR-036. Silently dropping an activity would confuse the user. The reason lets them decide what to change.

**Independent Test**: With two activities that have overlapping suitable periods and only one available slot on the only date, generate the schedule and confirm that one activity is scheduled and the other is listed below as unscheduled with "No suitable time found."

**Acceptance Scenarios**:

1. **Given** an activity has a place and a suitable period long enough for its duration, but every suitable slot on every date overlaps with an already-scheduled activity, **Then** it appears in the unscheduled list as "✗ No suitable time found."
2. **Given** an activity has no place (flagged in step 3), **Then** it appears in the unscheduled list as "✗ No place found."
3. **Given** at least one activity is unscheduled, **Then** an unscheduled section appears below the schedule with a heading "Could not be scheduled" and one row per unscheduled activity with its name and reason.
4. **Given** all activities are unscheduled, **Then** only the unscheduled section is shown with "No suitable time found for any activity. Change the dates or the weather limits." and **Back**.
5. **Given** an activity is unscheduled with reason "No suitable time found", **Then** the activity's suitable periods that were found (if any) are still visible in step 3 when the user goes back.

---

### User Story 3 - Only authorised users can generate a schedule (Priority: P1)

The same people who may use the forecast and places endpoint (PlanCreator policy: Visitors and Active Registered Users) may generate a schedule. All others are refused on the server.

**Why this priority**: Constitution IV, project FR-025. Access must be enforced on the server.

**Independent Test**: Send a schedule generation request as an Active Administrator, a Suspended Registered User and a user whose account was deleted. Each is refused (403 or 401) and the schedule service is not called.

**Acceptance Scenarios**:

1. **Given** the caller is a Visitor or an Active Registered User, **Then** the schedule is generated and returned.
2. **Given** the caller is an Active Administrator, Suspended Registered User, Suspended Administrator or a deleted account, **Then** the server returns 403 and the schedule service is not called.
3. **Given** the server returns 403, **Then** the frontend refreshes the current user and shows the same "Access denied" or "Account suspended" page as the forecast and places endpoints do.
4. **Given** the server returns 429 (rate limit reached), **Then** "Error: Too many requests. Wait a minute and try again." is shown with Retry.

---

### User Story 4 - Use the Schedule Overview on a phone and with a keyboard (Priority: P2)

The Schedule Overview can be read and acted on at 320 px width, using only a keyboard or a screen reader, without any horizontal scrolling.

**Why this priority**: Constitution accessibility constraint. The schedule is the app's primary output and must be usable by everyone.

**Independent Test**: At 320 px width, using only the keyboard: read the full schedule, identify an unscheduled activity, and press Back.

**Acceptance Scenarios**:

1. **Given** a 320 px viewport, **Then** the schedule table or list has no horizontal scrolling and every piece of information is visible.
2. **Given** a screen reader, **Then** each row is announced with start time, end time, activity name and place; the unscheduled section is announced with its heading.
3. **Given** keyboard navigation, **Then** Back and any interactive elements are reachable by Tab in page order.
4. **Given** the weather badge, **Then** it uses ★ or ✗ with a word (not colour alone).

---

### Edge Cases

- What happens when the user opens the Schedule Overview URL directly without a checked plan? They are redirected to Plan Setup.
- What happens when the schedule generation server call fails or times out? "Error: Something went wrong. Try again." with Retry.
- What happens when the weather or map data service is unavailable during generation? The 503 carries a `service` field; the Schedule Overview shows "Error: The weather service is unavailable." or "Error: The map data service is unavailable. No places are shown.", each with Retry.
- What if the forecast or places have expired between step 3 and generating the schedule? The server re-fetches them (or uses the cache if still fresh); if the plan is out of date the user is sent back to Plan Setup or Activity Selection.
- What if two activities have identical best periods on the same date? The activity that appears first in the plan is scheduled; the other is marked unscheduled.
- What if an activity has suitable periods on multiple dates? The server picks the date with the longest suitable non-overlapping slot.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a "Generate schedule" button on the "Places and forecast" step that is enabled only after both the forecast and the places have loaded without a service error.
- **FR-002**: The system MUST generate the schedule on the server, using the forecast and cached places data for the checked plan.
- **FR-003**: The system MUST assign each activity that has a place and a suitable period of at least its required duration to exactly one date and one non-overlapping time slot.
- **FR-004**: The system MUST use the nearest place (the first in the places list from feature 007) for each activity when assigning it to a slot. *(Replaced by feature 009, FR-004 and FR-005 in `specs/009-travel-distance/spec.md`: an activity that is not the first on its date uses the first listed place within the maximum travel distance from the previous activity's place, and keeps the nearest place only when none fits.)*
- **FR-005**: The system MUST NOT schedule two activities in the same plan in overlapping time slots on the same date.
- **FR-006**: The system MUST flag an activity as unscheduled, with one of the reasons "No place found" or "No suitable time found", instead of silently dropping it (project FR-036).
- **FR-007**: The system MUST display the schedule in chronological order: dates ascending, activities within each date ordered by start time (project FR-018).
- **FR-008**: The system MUST display, for each scheduled activity: start time, end time, activity name, place name, place distance, and forecast weather conditions at the assigned time (project FR-019, FR-047).
- **FR-009**: The system MUST display forecast weather conditions as: wind speed (m/s), precipitation (mm/h) and temperature (°C) for outdoor activities; and "Weather does not affect this indoor activity." for indoor activities.
- **FR-010**: The system MUST enforce the PlanCreator authorization policy on the schedule generation endpoint (Visitors and Active Registered Users only).
- **FR-011**: The system MUST recheck the plan setup and activities before generating the schedule, and return the same "checked again" response as the forecast and places endpoints when the plan is out of date.
- **FR-012**: The system MUST share the existing rate limit (PlanSetup) with the forecast and places endpoints; a schedule request counts toward the shared limit.
- **FR-013**: The system MUST return a 503 response if the forecast or map data service is unavailable during schedule generation. The response MUST carry a `service` field (`"forecast"` or `"places"`) matching the pattern from features 006/007, so the frontend can display the specific unavailability message ("Error: The weather service is unavailable." or "Error: The map data service is unavailable. No places are shown.") with its own Retry button.
- **FR-014**: The system MUST NOT store the generated schedule between sessions (save and persist belong to feature 010). Within a session, the schedule store MUST be cleared when the user leaves the Schedule Overview, so that navigating back to step 3 and forward again requires a new generation.
- **FR-015**: The progress bar on the "Places and forecast" step MUST advance to show "Schedule Overview" as the active step once the schedule is shown.

### Key Entities

- **Schedule**: the generated result for a checked plan. Contains zero or more scheduled activities and zero or more unscheduled activities.
- **Scheduled Activity**: one activity assigned to a specific date, start time and end time, with the place name and forecast weather at that slot.
- **Unscheduled Activity**: an activity that could not be assigned a slot, with a reason ("No place found" or "No suitable time found").
- **Scheduling Rule**: a constraint that must hold for an assignment to be valid. Feature 008 rules: a slot must be a subset of a suitable forecast period; slots on the same date must not overlap; a slot must be at least as long as the activity's required duration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The schedule is displayed within 5 seconds of clicking "Generate schedule", assuming the forecast and places data are already in the server cache (project NFR-002).
- **SC-002**: Every activity that has a place and a non-overlapping suitable period appears as a scheduled activity; no such activity is left unscheduled.
- **SC-003**: Every activity without a place, or without any non-overlapping suitable period, appears in the unscheduled list with its reason; no such activity is silently absent.
- **SC-004**: Zero instances of overlapping scheduled activities on the same date in a generated schedule.
- **SC-005**: The Schedule Overview is usable at 320 px width with no horizontal scrolling.
- **SC-006**: An unauthorized caller receives a 403 response and no schedule data.

## Assumptions

- The scheduling algorithm chooses the best date for each activity by selecting the date whose suitable periods contain the longest available non-overlapping slot. When two dates are equally good, the earlier date is preferred.
- Travel time between activities is not considered in feature 008. Feature 009 adds only the travel distance check (project FR-035); travel time is not yet assigned to a roadmap feature (see `specs/009-travel-distance/spec.md`, Clarifications).
- The "Generate schedule" button sends the same plan setup and activities body as the forecast and places endpoints; the server fetches forecast and places from its cache if they are still fresh.
- Each activity is scheduled at most once, even if it has suitable periods on multiple dates.
- An indoor activity that requires no daylight has the period 06:00–22:00 available on every date (consistent with feature 006 and 007 behaviour).
- The schedule is generated fresh on every "Generate schedule" click; no previous result is reused. The schedule store is cleared when the user leaves the Schedule Overview (via Back or the progress bar), so the step 4 progress bar item becomes unvisited again.
- The Schedule Overview URL is `/plan/schedule`. Navigating to it directly without a checked plan redirects to Plan Setup.
- FR-033 (re-detect problems after forecast update) and FR-020–FR-026 (save, edit, delete, duplicate plans) are out of scope for this feature.
- The rate limit shared with forecast and places (30 requests per minute per address, covering location search, setup check, forecast, places and schedule) applies here.
