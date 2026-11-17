# Feature Specification: Travel Distance Check

**Feature Branch**: `009-travel-distance`

**Created**: 2026-11-17

**Status**: Draft

**Input**: Feature 009 from the roadmap. The generated schedule (feature 008) must respect the maximum travel distance the user set in Plan Setup (feature 004, 1 to 200 km, default 30). The system calculates the travel distance between consecutive activities, shows it on the Schedule Overview, and flags a plan where a trip between two activities is longer than the maximum (project FR-035). Saving, editing and recalculating plans (FR-020 to FR-026, FR-033, FR-034) and alternative suggestions (FR-048) are out of scope.

## Clarifications

### Session 2026-11-17

- Q: When none of an activity's listed places is within the maximum travel distance from the previous activity's place, should the activity keep its nearest place with the trip flagged, or be moved to the unscheduled list with the reason "Too far from the previous activity"? → A: Keep the nearest place and flag the trip as over the limit. The plan may exceed the limit, but it is clearly marked (project FR-035 "flag a plan that exceeds it").
- Q: Should this feature also estimate travel time and leave room for it between activities at different places (project business rule on travel time), or check only travel distance? → A: Distance only. Travel time is out of scope for feature 009 and is recorded as later work; the feature 008 note that said travel time would be added in 009 is corrected.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See how far I travel between activities (Priority: P1)

A Visitor or Active Registered User generates a schedule. On the Schedule Overview each activity shows how far it is from the activity before it on the same day, so the user can see how much travelling the day involves.

**Why this priority**: This is the core of project FR-035 ("calculate the travel distance between consecutive activities"). The UX design already has a Travel column in the Schedule Overview. Without the distances the user cannot judge whether the day can be done.

**Independent Test**: Generate a schedule for one date with three activities at three different places. Check that the first activity of the day shows "Start of the day", and that the second and third each show their distance from the previous activity's place in km to one decimal place.

**Acceptance Scenarios**:

1. **Given** a generated schedule, **When** a date has two or more scheduled activities, **Then** every activity after the first shows "<distance> km from <previous place name>", with the distance rounded to 0.1 km.
2. **Given** a generated schedule, **Then** the first scheduled activity of each date shows "Start of the day" instead of a distance.
3. **Given** two consecutive activities on the same date at the same place, **Then** the second shows "0.0 km from <place name>".
4. **Given** unscheduled activities, **Then** they have no travel distance and are not counted as stops between scheduled activities.
5. **Given** any viewport, **Then** the travel information is a labelled part of the activity's entry in the schedule list ("Travel: Start of the day" or "Travel: 4.2 km from Kaunas Castle"), after the place and the weather. (The Schedule Overview from feature 008 is a list per date, not a table, so there is no separate Travel column.)

---

### User Story 2 - Keep the schedule within my maximum travel distance (Priority: P1)

When the nearest place of an activity is too far from the previous activity, the system picks another listed place for that activity that keeps the trip within the user's maximum travel distance, so the schedule stays within the limit whenever the listed places allow it.

**Why this priority**: The roadmap says "the schedule respects the maximum distance between activities", and a project business rule says the distance between consecutive activities must not exceed the maximum. Flagging a trip the system could easily have avoided would make the schedule less useful.

**Independent Test**: Use a plan with a 10 km maximum and two activities on the same date. The second activity's nearest place is 18 km from the first activity's place, but its third listed place is 6 km away. Generate the schedule and check that the second activity uses the third place and its trip is not flagged.

**Acceptance Scenarios**:

1. **Given** an activity whose nearest place is within the maximum from the previous activity's place, **Then** the nearest place is used (same as feature 008).
2. **Given** an activity whose nearest place is farther than the maximum from the previous activity's place, but another of its listed places is within the maximum, **Then** the first listed place (in nearest-to-plan-location order) that is within the maximum is used.
3. **Given** an activity none of whose listed places is within the maximum from the previous activity's place, **Then** the activity stays scheduled at its nearest place and its trip is flagged as over the limit (User Story 3). It is not moved to the unscheduled list.
4. **Given** the first scheduled activity of a date, **Then** its nearest place is used, because places are already searched within the maximum travel distance of the plan's location.

---

### User Story 3 - Know when the plan goes over my maximum travel distance (Priority: P1)

If a trip between two consecutive activities is still longer than the maximum, the plan is clearly flagged: a summary at the top of the Schedule Overview, and a marker on each trip that is too long.

**Why this priority**: Project FR-035 ("flag a plan that exceeds it"). The user must be able to see, without calculating anything, that the plan breaks their own limit, and where.

**Independent Test**: Use a plan with a 5 km maximum and two activities on the same date whose listed places are all more than 5 km apart. Generate the schedule. Check that the summary says one trip is longer than the limit, and that the second activity's travel line is marked "✗" with the distance and the limit.

**Acceptance Scenarios**:

1. **Given** a trip longer than the maximum, **Then** that activity's travel line shows "✗ <distance> km from <previous place name>, more than your <maximum> km limit".
2. **Given** at least one trip longer than the maximum, **Then** the top of the Schedule Overview shows "✗ <n> trip(s) longer than your <maximum> km limit." next to the existing scheduling summary.
3. **Given** no trip longer than the maximum, **Then** the top of the Schedule Overview shows "✓ All trips within your <maximum> km limit." (only when at least one date has two or more scheduled activities).
4. **Given** a trip exactly equal to the maximum (after rounding to 0.1 km), **Then** it is not flagged.
5. **Given** the flag, **Then** it uses the "✗" symbol and words, never colour alone.

---

### User Story 4 - Use the travel information on a phone and with assistive technology (Priority: P2)

The travel distances and the over-the-limit flag can be read at 320 px width, with only a keyboard, or with a screen reader.

**Why this priority**: Constitution accessibility constraint and project NFR-009 to NFR-013. The travel information is part of the schedule, the app's main output.

**Independent Test**: At 320 px width with a screen reader, read a schedule that has one trip over the limit. Check that the summary and the flagged activity's travel line are both announced, with no horizontal scrolling.

**Acceptance Scenarios**:

1. **Given** a 320 px viewport, **Then** the travel information wraps inside the activity's entry without horizontal scrolling.
2. **Given** a screen reader, **Then** each scheduled activity row or card is announced with its travel information after the place, and the travel summary is announced as part of the schedule's status text.
3. **Given** the travel information in an activity's entry, **Then** it starts with the visible label "Travel:", so it is understandable without seeing the surrounding layout.

---

### Edge Cases

- A date with only one scheduled activity: it shows "Start of the day", and no trip is checked for that date.
- A schedule where no date has two or more scheduled activities: there is no travel summary. Only the existing scheduling summary is shown.
- Activities on different dates are never consecutive. The first activity of each date is not compared with the last activity of the previous date.
- All activities unscheduled: the existing "No suitable time found for any activity…" view is shown, with no travel information.
- Two activities in the same category on the same date: they may use the same place. The trip is 0.0 km and is never flagged.
- The user wants a different maximum: they go back to Plan Setup, change "Maximum travel distance (km)" and generate the schedule again. The new maximum is used.
- A plan sent without a maximum travel distance uses the default of 30 km, as in feature 004.
- The weather or map data service is unavailable, or the plan is out of date: same behaviour as feature 008. No travel information is shown without a generated schedule.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST calculate, for each scheduled activity except the first on its date, the straight-line travel distance from the place of the previous scheduled activity on the same date (chronological order) to its own place (project FR-035).
- **FR-002**: The system MUST round each travel distance to 0.1 km, and compare the rounded value with the plan's maximum travel distance. A trip is over the limit only when the rounded distance is strictly greater than the maximum.
- **FR-003**: The system MUST use the maximum travel distance from the checked plan setup (1 to 200 km, default 30) for the check. The maximum used is the `maxTravelDistanceKm` of the setup in the schedule request, after the same server check as feature 004 (a whole number from 1 to 200; when it is missing, 30 is used).
- **FR-004**: When choosing the place for a scheduled activity that is not the first on its date, the system MUST use the first of the activity's listed places (nearest to the plan location first) whose distance from the previous activity's place is within the maximum. The first activity of each date MUST use its nearest place.
- **FR-005**: When none of an activity's listed places is within the maximum from the previous activity's place, the system MUST keep the activity scheduled at its nearest place and flag the trip as over the limit. The activity MUST NOT be moved to the unscheduled list, and no new unscheduled reason is added.
- **FR-006**: The system MUST return, for each scheduled activity, its travel distance from the previous activity (none for the first of the date), the previous place's name, and whether the trip is over the limit. It MUST also return the plan's maximum travel distance and the number of trips over the limit.
- **FR-007**: The Schedule Overview MUST show the travel information in each scheduled activity's entry, labelled "Travel:", as described in User Stories 1 and 3: "Start of the day", "<distance> km from <previous place name>", or the "✗ … more than your <maximum> km limit" flag.
- **FR-008**: The Schedule Overview MUST show a travel summary at the top when at least one date has two or more scheduled activities: "✓ All trips within your <maximum> km limit." or "✗ <n> trip(s) longer than your <maximum> km limit.".
- **FR-009**: The system MUST check only travel distance in this feature. It MUST NOT estimate travel time or change any activity's start or end time because of travel; time slots stay exactly as feature 008 assigns them.
- **FR-010**: The travel check MUST be part of the existing schedule generation. It MUST NOT add a new endpoint or call any additional external service. The existing PlanCreator authorization, shared rate limit, plan recheck and service-unavailable behaviour of feature 008 MUST continue to apply unchanged.
- **FR-011**: The travel information MUST NOT be stored between sessions (saving belongs to feature 010). It is cleared together with the schedule when the user leaves the Schedule Overview, as in feature 008.
- **FR-012**: The travel information and the flag MUST be readable at 320 px without horizontal scrolling, MUST be announced by screen readers, and MUST NOT rely on colour alone (project NFR-009 to NFR-013).

### Key Entities

- **Trip**: the move between two consecutive scheduled activities on the same date. It has a from place, a to place, a straight-line distance in km (0.1 km precision) and an over-the-limit indicator. It belongs to the later activity of the pair.
- **Maximum Travel Distance**: the plan setting from feature 004 (1 to 200 km, default 30). It is the upper limit for every trip in the plan.
- **Travel Summary**: the plan-level result of the check: the maximum used and how many trips are over it.
- **Scheduled Activity** (from feature 008, extended): it now also carries its trip from the previous activity, if any. Its place may be a listed place other than the nearest, when that keeps the trip within the maximum.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In every generated schedule, 100% of trips longer than the maximum travel distance are flagged, and 0 trips within the maximum are flagged.
- **SC-002**: Whenever at least one of an activity's listed places is within the maximum from the previous activity's place, that activity's trip is not over the limit.
- **SC-003**: Every displayed travel distance is within 0.1 km of the straight-line distance between the two places.
- **SC-004**: The schedule, including the travel information, is still displayed within 5 seconds of clicking "Generate schedule" when the forecast and places are already cached (project NFR-002, same as feature 008).
- **SC-005**: A user can tell from the top of the Schedule Overview whether the plan goes over their maximum travel distance, without reading individual activities.
- **SC-006**: The travel information is usable at 320 px width with no horizontal scrolling, and with a keyboard and screen reader only.

## Assumptions

- Travel distance is the straight-line (great-circle) distance between the two places' positions, the same measure the app already uses for each place's distance from the plan location (feature 007). Road or route distance is not used, because it would need a routing service that the project does not use.
- "Consecutive activities" means scheduled activities next to each other on the same date in start-time order. The user is assumed to start each date fresh, so no trip is counted between dates, and no trip is counted from the plan location to the first activity. Places are already searched within the maximum travel distance of the plan location (feature 007), so that first trip could not be over the limit anyway.
- Time slots are assigned first, exactly as in feature 008. Places are then chosen date by date in start-time order, so a place choice never changes a time slot. The place choice is greedy: each activity takes the first listed place that fits after the previous activity's place, and the system does not reconsider earlier choices.
- Only the places already listed for each activity in the "Places and forecast" step (up to 5, feature 007) are considered. No new place search is made for the schedule.
- The place distance shown for each activity (feature 008) is still its distance from the plan location, so the user can match it with the places list in step 3.
- Plan Problem Detection ("Travel to the second location is too far" after a forecast change, feature 012) and alternative suggestions (feature 013) are out of scope. This feature only checks a newly generated schedule.
- Travel time is out of scope. The project business rule "The start time of an activity at a different location must be later than the previous activity's end time plus the required travel time" is not enforced by this feature. It is not yet assigned to a roadmap feature and must be picked up by a later feature.
- The maximum travel distance can only be changed on Plan Setup (feature 004). The Schedule Overview shows it but does not let the user change it.
