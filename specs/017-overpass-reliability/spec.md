# Feature Specification: Map Data Service Reliability

**Feature Branch**: `017-overpass-reliability`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Make the nearby-places lookup (OpenStreetMap Overpass, features 007 to 009) more reliable. On 2026-11-19 the public map data server answered 502 Bad Gateway for every query and the public mirrors failed or did not answer in time, so 'Places and forecast' showed 'Error: The map data service is unavailable. No places are shown.' and no schedule could be generated. Feature 009 also noted that the map data server's address is hard-coded and that the 4-second wait is tight for the public server. Scope: (1) the map data server's address comes from configuration; (2) a configurable, more realistic wait that still keeps the place request within the page's 10-second limit; (3) an optional fallback map data server that is tried when the main one fails or does not answer in time, before the error is shown; (4) documentation and scripts for running a local copy of the map data service in a container with map data for Lithuania only, for development and outages. Add the feature as row 017 at the end of the feature list in `docs/architecture.md`."

## Clarifications

### Session 2026-11-24

- Q: In what order should the four stories be built, given that the local copy (story 4) is wanted first? → A: Story 2, then story 4, then story 1, then story 3. Story 4 rises to P1 with story 2, story 1 becomes P2 and story 3 becomes P3, because the public map data server was still not answering on 2026-11-24 and manual playtesting is blocked until the application can use a local copy.
- Q: How much memory may the local copy of the map data service use on a developer's machine? → A: At most 2 GB while it is running and answering requests, so it fits on an 8 GB developer machine next to the database, the application and the browser. The one-time first loading of the map data may use more; the README states how much.
- Q: Should the local copy start together with the database (`docker compose up -d`) or only when the developer starts it on purpose? → A: Only on purpose, with its own command. (The repository has no `docker-compose.yml`; the database is the developer's own PostgreSQL. So no existing setup step, such as starting the database, the API, the frontend or the tests, starts the local copy.)

## User Scenarios & Testing *(mandatory)*

**Build order**: User Story 2, then User Story 4, then User Story 1, then User Story 3. The stories keep their numbers; the order and priorities below decide what is built first. User Story 4 depends on User Story 2, because the application can use the local copy only once the map data server address comes from configuration and "http" is allowed in development.

### User Story 1 - Get places when the main map data server is down (Priority: P2)

A Visitor or Active Registered User opens step 3, "Places and forecast", or generates a schedule while the main map data server is failing. When a fallback map data server is configured and answers, the user sees the places and the schedule as usual, without an error and without doing anything different.

**Why this priority**: On 2026-11-19 the public map data server failed for every request, so no plan could get places or a schedule. This is the failure the feature exists to survive for users of a deployed application (project NFR-007 still applies when both servers fail). It comes after User Stories 2 and 4 because a fallback needs a second working server, and the local copy is the one the project can rely on.

**Independent Test**: Configure a fake main map data server that answers "502 Bad Gateway" and a fake fallback server with three museums near Kaunas. Open step 3 for a Kaunas plan with Museum and check that the three museums are listed and no error is shown; then generate the schedule and check that it uses those places.

**Acceptance Scenarios**:

1. **Given** a fallback server is configured, **When** the main server fails, does not answer in time or cannot be reached, **Then** the same place request is sent to the fallback server, and when it answers, step 3 shows its places exactly as feature 007 describes, with no error.
2. **Given** the fallback server answered, **Then** "Places updated at HH:MM" shows the time the fallback's answer was received, and the user is not shown which server answered.
3. **Given** the main server answers, **Then** the fallback server is not contacted.
4. **Given** both servers fail, **Then** step 3 shows "Error: The map data service is unavailable. No places are shown." with "Retry", exactly as feature 007 FR-009 describes, and the schedule step shows its existing map data error (feature 008).
5. **Given** no fallback server is configured, **When** the main server fails, **Then** the error is shown as today, without waiting any longer.
6. **Given** a server failure, **Then** it is recorded with its time, the kind of failure and which configured server failed (main or fallback), without the user's identity, so that an administrator can review it later (feature 015).

---

### User Story 2 - Point the application at another map data server without a code change (Priority: P1)

The person who runs the application (a developer on their machine, or whoever deploys it) chooses the main map data server, and optionally a fallback server, in the application's configuration. When nothing is configured, the application keeps using the public OpenStreetMap map data server, as it does today.

**Why this priority**: The address is hard-coded today, so an outage or a slow public server can only be worked around by changing the code. Every other story in this feature depends on the address being configurable.

**Independent Test**: Start the application with the main server set to a fake server's address and check that place requests reach that server; start it with no setting and check that the public server's address is used; start it with an invalid address and check that it refuses to start with a message that names the setting.

**Acceptance Scenarios**:

1. **Given** no map data server setting, **When** the application starts, **Then** it uses the public OpenStreetMap map data server, with the same behaviour as features 007 to 009.
2. **Given** a main server address in the configuration, **Then** every place request goes to that address and no other, unless the fallback of User Story 1 is used.
3. **Given** a setting that is not a valid absolute web address, a fallback address equal to the main address, or a waiting time outside the allowed range (FR-006), **When** the application starts, **Then** it refuses to start and reports which setting is wrong, without showing any credential.
4. **Given** an address that uses plain "http" instead of "https", **Then** it is accepted only when the application runs in its development environment; otherwise the application refuses to start and reports the setting.
5. **Given** a place request from the browser, **Then** the map data server address is never taken from the request; it comes only from the configuration.

---

### User Story 3 - Wait long enough for a slow server, but never past the page's limit (Priority: P3)

When the map data server is slow but working, the application waits longer than today's 4 seconds before giving up, so a busy public server can still answer. Every request that needs places still ends in time for the page to show either the places or the error before its 10-second limit.

**Why this priority**: Feature 009 found that 4 seconds is often too short for the public server. Waiting longer helps only when it still fits within the page's limit, so the two rules belong together. It comes last because a slow but working server is a smaller problem than a server that does not answer at all, which User Stories 4 and 1 address.

**Independent Test**: With a fake main server that answers after 5 seconds and no fallback, open step 3 and check that the places are shown. With a fake main server that never answers and a fake fallback that never answers, check that the place request ends with the map data error within 9 seconds of reaching the server.

**Acceptance Scenarios**:

1. **Given** the main server answers within its waiting time (by default 6 seconds), **Then** its places are shown.
2. **Given** the main server does not answer within its waiting time and a fallback is configured, **Then** the fallback gets only the time that is left before the request's deadline (FR-007), and when no useful time is left it is not contacted.
3. **Given** any combination of slow, failing or silent servers, a location lookup that is not reused, and a forecast that is not reused on the schedule step, **Then** the place request (step 3) and the schedule request (step 4) end within 9 seconds of reaching the server, so the browser gets the places, the schedule or an error before its 10-second limit.
4. **Given** the waiting time is changed in the configuration, **Then** the new value is used without a code change, and the 9-second deadline still applies.

---

### User Story 4 - Run a local copy of the map data service for Lithuania (Priority: P1)

A developer who cannot reach a working public map data server (an outage, no TLS 1.3 support on Windows 10, or a slow network) follows the README to run their own copy of the map data service on their machine, loaded with the map data for Lithuania only, and points the application at it through configuration. Step 3 and the schedule then work against that copy.

**Why this priority**: It makes development and playtesting independent of the public service and of the developer's operating system. Users of a deployed application do not depend on it, but on 2026-11-24 the public server was still not answering and no place or schedule could be tested by hand, so it is built right after User Story 2.

**Independent Test**: On a machine without access to the public map data server, follow the README section from a fresh clone to start the local copy, set the main server address to it, open step 3 for a Kaunas plan with Museum and Cycling, and check that places are listed.

**Acceptance Scenarios**:

1. **Given** the README and the provided script, **When** a developer starts the local copy for the first time, **Then** it downloads the Lithuania map data and loads it without further manual steps, and the README states the expected download size, disk space, memory and loading time.
2. **Given** the local copy is running, **When** the developer sets it as the main (or fallback) server in their local configuration, **Then** step 3 shows places from it for locations in Lithuania.
3. **Given** the local copy, **Then** the README explains how to check that it is ready, how to stop and remove it, and how to refresh its map data with a newer download.
4. **Given** the local copy, **Then** the application's automated tests and CI do not use it; they keep using fake map data responses (constitution III).
5. **Given** an API run directly on Windows 10 (not in a Linux container), **When** it uses the local copy, **Then** places are shown, because the local copy does not need TLS 1.3.
6. **Given** the local copy has loaded its map data and is running, **Then** it uses at most 2 GB of memory (FR-015); the README states the higher memory use of the one-time first loading.
7. **Given** a developer follows the existing setup (database, API, frontend, tests) without the local copy's own command, **Then** the local copy is not started and no map data is downloaded (FR-015).

---

### Edge Cases

- The main server answers "200" but reports that its own time or memory limit was hit (feature 007 research): this is a failure, so the fallback is tried.
- The main server answers with places for some categories and fails for another: the whole place request is a failure of the main server, and the fallback is asked for every category (feature 007 FR-009, all or nothing).
- The main server fails at once (for example "502 Bad Gateway" within a second): the fallback gets its own full waiting time when that much time is left before the deadline (FR-007). It is not limited to the main server's unused waiting time.
- The fallback answers after the deadline: the answer is ignored and the error is shown.
- The main server answers with no matching places: that is a successful answer, so the fallback is not asked and the activities show "No place found" (feature 007 FR-019).
- Places of a location were received earlier from either server and are still fresh (feature 007 FR-012): they are reused, and no server is contacted.
- The main and fallback servers are given in different letter case or with and without a trailing slash: they are treated as the same address and the application refuses to start (FR-003).
- The request is refused by the application's own request limit (feature 007 FR-011): neither server is contacted and nothing is recorded as a server failure.
- The local copy is still loading its data when the application asks it for places: it fails or does not answer, and this is handled like any other server failure (fallback, then the error).
- A location outside Lithuania is asked from the local copy: not possible through the application, because plan locations are limited to Lithuania (feature 004); the local copy simply has no places there.

## Requirements *(mandatory)*

### Functional Requirements

**Configuration**

- **FR-001**: The address of the main map data server MUST be read from the application's configuration. When it is not set, the application MUST use the public OpenStreetMap map data server (`https://overpass-api.de/`), so the behaviour of features 007 to 009 stays the same without any setting.
- **FR-002**: The configuration MAY name one fallback map data server. When it does not, no fallback is used.
- **FR-003**: When the application starts, it MUST check the map data settings and refuse to start, with a message that names the wrong setting and contains no credential, when an address is not an absolute web address, when an address uses "http" outside the development environment, when the fallback address is the same as the main address (compared without letter case or a trailing slash), or when a waiting time is outside the range of FR-006.
- **FR-004**: The map data server addresses MUST come only from the configuration, never from a browser request or any other user input.
- **FR-005**: The map data settings MUST be documented in the README with their defaults, and local values MUST NOT be committed (constitution VI).

**Waiting and the deadline**

- **FR-006**: Each map data server MUST have a waiting time read from the configuration, by default 6 seconds for the main server and 6 seconds for the fallback server. A waiting time MUST be at least 1 second and at most 8 seconds.
- **FR-007**: Every request that needs places, the place request of step 3 (feature 007) and the schedule request of step 4 (features 008 and 009), MUST end within 9 seconds of reaching the server, including the location lookup and, for the schedule, the forecast, whether or not they are reused. The location lookup and the forecast keep their own time limits (features 004 and 006), which together are at most 9 seconds. When they use up the time, the request ends after them plus the server's own processing time, which is still before the browser's 10-second limit. A map data server MUST be asked only for the time left before that deadline, or its own waiting time when that is shorter. When less than 1 second is left, the server MUST NOT be contacted and the request MUST fail as a map data failure.
- **FR-008**: This feature replaces the fixed 4-second wait of feature 007 FR-009 with FR-006 and FR-007. Everything else in feature 007 FR-009, including the error message, "Retry", the all-or-nothing rule and the browser's 10-second limit, MUST stay the same.

**Fallback**

- **FR-009**: When a fallback is configured and the main server fails, does not answer within its time, cannot be reached, or answers with an error or an incomplete answer, the server MUST send the same place request to the fallback server within the same user request, before any error is shown.
- **FR-010**: When the main server answers successfully, including an answer with no matching places, the fallback server MUST NOT be contacted.
- **FR-011**: Places received from the fallback server MUST be treated exactly like places from the main server: the same rules for matching, distance, limits, reuse and freshness (feature 007 FR-005 to FR-007 and FR-012). The browser MUST NOT be told which server answered.
- **FR-012**: When both servers fail, or the main server fails and no fallback is configured, the existing map data error MUST be shown (feature 007 FR-009 on step 3, and the schedule's map data error from feature 008 on step 4).
- **FR-013**: Each failed attempt MUST be recorded separately with its time, the kind of failure and whether it was the main or the fallback server, without the user's identity (extends feature 007 FR-010; reviewed in feature 015). A request refused by the application's own request limit MUST NOT contact any server and MUST NOT be recorded as a server failure (feature 007 FR-011).
- **FR-014**: One user request MUST contact each configured server at most once, so "Retry" in the browser stays the only way to ask the main server again.

**Local copy of the map data service**

- **FR-015**: The repository MUST provide a script and a README section that start a local copy of the map data service in a container on the developer's machine, loaded with the OpenStreetMap map data for Lithuania only, without manual steps other than running the script. Once its map data is loaded, the local copy MUST use at most 2 GB of memory while it runs and answers requests, and the script MUST set that limit on the running container. The one-time first loading of the map data MAY use more memory. The local copy MUST start only when the developer runs its own command; no other setup step (starting the database, the API or the frontend, or running the tests) may download map data or start it.
- **FR-016**: The README MUST state the download size, disk space, the 2 GB memory limit while running, the peak memory and expected time of the first loading; how to check that the local copy is ready; how to set it as the main or fallback server in local configuration; how to stop and remove it; and how to refresh its map data.
- **FR-017**: The local copy MUST NOT be needed to build the application, run the automated tests or pass CI. Automated tests MUST keep using fake map data responses (constitution III).

**Roadmap**

- **FR-018**: `docs/architecture.md` MUST list this feature as row 017 at the end of the feature list, after feature 016, without changing the numbers of planned features.

### Key Entities

- **Map Data Server**: a server that answers place searches in the OpenStreetMap map data: its address, its role (main or fallback) and its waiting time. Configured, not stored in the database.
- **Request Deadline**: the 9-second limit from the moment a request that needs places reaches the server, shared by the location lookup, the forecast (on the schedule step) and every map data server attempt.
- **Map Data Failure Record** (from feature 007): its time and kind of failure, now with the server role that failed.
- **Local Map Data Copy**: a developer-run copy of the map data service with the Lithuania map data, used only through configuration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When the main map data server fails and a working fallback is configured, 100% of place and schedule requests show places instead of the map data error.
- **SC-002**: In a test set of slow, failing and silent main and fallback servers, with and without reused location and forecast data, 100% of place and schedule requests end within 9 seconds of reaching the server, apart from the server's own processing time (FR-007).
- **SC-003**: When the main server answers within 6 seconds, its places are shown in 100% of attempts, where today they fail after 4 seconds.
- **SC-004**: Changing the main or fallback server needs only a configuration change: 0 lines of code changed.
- **SC-005**: 100% of invalid map data settings in a test set stop the application at start-up with a message that names the wrong setting.
- **SC-006**: A developer following the README from a fresh clone, without access to the public map data server, sees places on step 3 for a Kaunas plan using the local copy, while the local copy uses at most 2 GB of memory.
- **SC-007**: With no map data setting at all, every existing automated test for features 007 to 009 still passes unchanged, apart from tests that check the old 4-second wait.

## Assumptions

- **Default server unchanged.** With no setting, the application keeps using `https://overpass-api.de/`, so existing deployments and developer machines behave as before.
- **No default fallback.** Public mirrors have their own usage rules and were also failing on 2026-11-19, so none is configured by default. Whoever runs the application chooses one, for example their own local copy.
- **Waiting times.** 6 seconds gives a busy public server more time than today's 4 seconds. The 9-second request deadline leaves about 1 second before the browser's 10-second limit, so the browser always gets an answer instead of its own timeout. The deadline limits the map data attempts. The location lookup (5 seconds) and the forecast (4 seconds) keep their own limits. In the worst case on the schedule step, they use the full 9 seconds, the map data server is not contacted, and the request ends a few milliseconds after 9 seconds, well before 10 seconds. The page's 10-second limit is not changed.
- **Fallback only within the deadline.** A fallback after a slow main server gets only the time that is left. The fallback helps most when the main server fails quickly (as on 2026-11-19, "502" within a fraction of a second).
- **One attempt per server.** Automatic retries of the same server are not added; the user's "Retry" stays the way to try again (feature 007 FR-009), which keeps the load on public servers low.
- **"http" in development only.** A local copy usually runs without a certificate, so "http" is allowed only in the development environment. Production traffic to external services stays on HTTPS.
- **Local copy data.** The local copy holds a snapshot of the Lithuania map data from the day it was downloaded. Map places change rarely, and the snapshot is real OpenStreetMap data, not invented data; the README explains how to refresh it. "Places updated at" still shows when the places were received from the local copy.
- **Configuration is trusted.** The addresses are set by whoever runs the application, not by users, so they are not a way for a user to make the server call other addresses.
- No database change is needed. No new user-facing text is added.

## Dependencies

- Feature 007 Nearby Places (merged): the place request, the map data error, "Retry", the all-or-nothing rule, reuse and freshness, failure records and the request limit. This feature replaces its fixed 4-second wait (FR-009) with FR-006 and FR-007.
- Feature 008 Schedule Generation (merged) and feature 009 Travel Distance Check (merged): the schedule request that also gets places, and its map data error.
- Feature 004 Plan Location and Dates (merged): locations limited to Lithuania, and the location lookup inside the deadline.
- Feature 006 Hourly Forecast (merged): the forecast inside the schedule request's deadline.
- Feature 015 Service Status and Error Log (planned): reviews the failure records, now with the server role.
- The OpenStreetMap map data service and the Lithuania map data extract it is loaded from, for the local copy.

## Scope Boundaries

**In scope**: configurable main and fallback map data servers; their waiting times and the 9-second request deadline for place and schedule requests; trying the fallback within the same request; recording each failed attempt with its server role; checking the settings at start-up; the local copy script and README section; and row 017 in the feature list.

**Out of scope**: more than one fallback server; automatic retries of the same server; choosing the faster server or spreading requests between servers; changing the browser's 10-second limit; telling the user which server answered; the administrator's service status and error log pages (feature 015); a fallback or configurable address for the weather or location search services (Open-Meteo); showing old places when every server fails (NFR-007 forbids it); and running the local copy in production.

## Traceability

| Project requirement | Covered by |
|---|---|
| FR-010 (display the name and location of each retrieved place) | FR-009 to FR-012, User Story 1 |
| NFR-007 (error instead of unverified or fabricated data when the service is unavailable) | FR-011, FR-012, User Story 1 |
| FR-043 (record map service errors for later review) | FR-013, User Story 1 |
| FR-049 (limit requests that reach external services) | FR-013, FR-014 |
| NFR-002 (schedule within 5 seconds once the data has been received) | FR-007, User Story 3 |
| Feature 009 notes (hard-coded address, tight 4-second wait) | FR-001 to FR-008, User Stories 2 and 3 |
| Outage of 2026-11-19 and Windows 10 TLS 1.3 limit | FR-009 to FR-017, User Stories 1 and 4 |
