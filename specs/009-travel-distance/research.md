# Research: 009-travel-distance

**Date**: 2026-11-17 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

The spec's two scope questions were answered on 2026-11-17 (see spec Clarifications), so there are no open NEEDS CLARIFICATION items. The sections below record the technical choices.

## 1. No new packages needed

- **Decision**: No new NuGet or npm package.
- **Rationale**: The distance calculation already exists (`Services/GeoDistance.cs`, haversine, feature 007). Everything else is a change to existing records, DTOs, the mapping profile and the Schedule Overview page.
- **Alternatives considered**: A geospatial library (for example NetTopologySuite). Rejected: one great-circle formula between two points does not justify a dependency (constitution VIII).

## 2. Distance measure: straight-line, from the places' shown positions

- **Decision**: A trip's distance is `GeoDistance.Kilometres` between the two places' `Latitude`/`Longitude`, the values already rounded to 5 decimal places in `NearbyPlace` (about 1 m).
- **Rationale**: It is the same measure as the "3.4 km away" place distance in step 3 (spec Assumptions), so the numbers the user sees are consistent. Using the shown positions means a tester can recompute any trip from the response (spec SC-003).
- **Alternatives considered**:
  - Road distance from a routing service (OSRM, GraphHopper). Rejected: a new external service that the constitution's "External data" constraint does not list, a new client, new failure modes and new tests, for a check the spec defines as straight-line.
  - Unrounded positions from the map data. Rejected: they are not kept after `NearbyPlaceRules` builds the place, and 1 m makes no difference at 0.1 km precision.

## 3. Rounding and the comparison with the maximum

- **Decision**: Round each trip to 0.1 km with `MidpointRounding.AwayFromZero` (the same rounding `NearbyPlaceRules` uses for place distances), then flag the trip when `rounded > maxTravelDistanceKm`. The rounding moves into one shared method, `GeoDistance.RoundToTenth(double km) → decimal`, and `NearbyPlaceRules` uses it too.
- **Rationale**: Comparing the rounded value means that a shown "30.0 km" is never flagged against a 30 km limit, while "30.1 km" always is (spec FR-002, User Story 3 scenario 4). One rounding method keeps place distances and trip distances consistent (constitution I, DRY).
- **Alternatives considered**: Comparing the unrounded value. Rejected: a trip of 30.04 km would show "30.0 km" and still be flagged, which looks wrong to the user.

## 4. Where the travel check runs: a second pass after time slots are assigned

- **Decision**: `PlanScheduler.Assign` stays as it is (plan order, time slots, nearest place). A new static class, `TravelDistanceRules`, runs after it in `PlanScheduleService`. It walks each date's scheduled activities in start-time order, chooses each activity's place and builds its trip. It returns the updated scheduled activities and a `TravelSummary`.
- **Rationale**:
  - The spec says a place choice never changes a time slot (spec Assumptions, FR-009). Two separate passes make that true by design.
  - `PlanScheduler` assigns activities in plan order, not time order, so a later-assigned activity can land between two earlier ones. Only after all slots are fixed is "the previous activity on the same date" known.
  - `PlanScheduler` stays under 200 lines and its feature 008 tests stay valid. The new rules are tested on their own, following `NearbyPlaceRules` and `HourSuitabilityRules`.
- **Alternatives considered**: Choosing places inside `PlanScheduler` while assigning slots. Rejected: the neighbours are not known yet at that point, and it would mix two responsibilities in one class.

## 5. Choosing the place: greedy, first listed place within the maximum

- **Decision**: For each date, in start-time order:
  1. The first activity takes `places[0]` (nearest to the plan location) and has no trip.
  2. Each later activity takes the first of its category's listed places (nearest to the plan location first) whose rounded distance from the previous activity's chosen place is ≤ the maximum, and that trip is not over the limit.
  3. If none fits, it takes `places[0]` and the trip is flagged as over the limit (spec FR-005, clarification Q1).

  The chosen place becomes "the previous place" for the next activity.
- **Rationale**: This is what the spec and SC-002 describe. It is simple to explain and to test. Earlier choices are never revisited.
- **Alternatives considered**:
  - A search over all place combinations per date to minimise the number of flagged trips. Rejected: more complex (up to 5ⁿ combinations), harder to explain, and the spec accepts the greedy result (spec Assumptions).
  - Choosing the candidate closest to the previous place. Rejected: it would move activities away from the plan location even when the nearest place already fits. The spec keeps the nearest place whenever it is within the limit (User Story 2 scenario 1).

## 6. Linking a scheduled activity to its listed places

- **Decision**: `ScheduledActivity` gains a `Guid CategoryId` (set by `PlanScheduler` from the activity). `TravelDistanceRules` looks up the candidate places in the existing `CategoryPlaces` list by that id. `CategoryId` is not added to the response DTO.
- **Rationale**: Activities of the same category share their places (feature 007), and two activities can have the same name, so the name is not a safe key. AutoMapper only checks destination members, so an extra source member needs no mapping change.
- **Alternatives considered**: Storing the candidate place list on `ScheduledActivity`. Rejected: it duplicates `CategoryPlaces` and would be easy to leak into the response by accident.

## 7. Response shape

- **Decision**:
  - Each `scheduled[]` entry gains `travel`: `null` for the first activity of its date, otherwise `{ fromPlaceName, distanceKm, overLimit }`.
  - The schedule gains a top-level `travel` object: `{ maxDistanceKm, tripsOverLimit }`.
  - `maxDistanceKm` is the checked setup's `MaxTravelDistanceKm` (30 when none was sent).
  - Scheduled activities are returned in chronological order (date, then start time) instead of plan order.

  See [contracts/plan-schedule-api.md](contracts/plan-schedule-api.md).
- **Rationale**:
  - The server decides every rule (constitution II). The page only words the values, as with the weather snapshot in feature 008 (spec FR-006).
  - Returning the maximum lets the page write "more than your 30 km limit" without reading the plan setup store, so the text always matches the value that was actually checked.
  - Chronological order is the order in which trips are defined, and the page already sorts by date and time, so nothing breaks.
- **Alternatives considered**: Working out trips and the summary in the browser from the places' positions. Rejected: a business rule in a frontend component (constitution II), and the place choice in section 5 has to happen on the server anyway.

## 8. No change to authorization, rate limiting, errors or persistence

- **Decision**: The check is part of the existing `POST /api/plan-schedule`. The same `PlanCreator` policy, shared `PlanSetup` rate limit, plan recheck, 503 `service` handling and "not stored" rule apply (spec FR-010, FR-011).
- **Rationale**: There is no new protected operation. The existing `PlanScheduleAuthorizationTests` keep covering the endpoint and must still pass. No external service is called, so there are no new failure modes. There is no schema change and no migration.

## 9. Frontend: a "Travel:" part per entry and one status area for the summaries

- **Decision**:
  - Each activity's `<li>` gets a `<span>` with the text "Travel: …", worded by new helpers in `helpers/scheduleText.ts` (`travelText`, `travelSummaryText`).
  - The schedule summaries ("✓ All activities scheduled." and the new travel summary) move into one `role="status"` container, so that there is still only one status region in the page's main content (the layout keeps its own app-wide status region for success banners outside `<main>`).
  - The per-date section is moved from `ScheduleOverviewPage.tsx` into a new `components/scheduledDaySection.tsx`, because the page is already 196 lines and would pass the ~200-line guideline (constitution I).
- **Rationale**: The Schedule Overview is a list per date (spec User Story 1 scenario 5, after the spec was aligned with the feature 008 page). A visible label works at every width and for screen readers without table semantics. A single status region avoids two competing live announcements.
- **Alternatives considered**: Turning the list into a table with a Travel column, as `docs/ux-design.md` sketches. Rejected for this feature: it is a layout redesign of feature 008, not part of FR-035.

## 10. Travel time stays out of scope

- **Decision**: No travel time is estimated, and start and end times never move (spec FR-009, clarification Q2).
- **Rationale**: The roadmap gives feature 009 only FR-035. The travel-time business rule is recorded in the spec Assumptions as later work, and the feature 008 spec note was corrected.
