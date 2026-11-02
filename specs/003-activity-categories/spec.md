# Feature Specification: Activity Category Management

**Feature Branch**: `003-activity-categories`
**Created**: 2026-11-02
**Status**: Draft
**Input**: An administrator creates and edits the predefined activity categories, their default weather limits and the map place tags used to find nearby places for each category (project FR-027, FR-028, FR-044), following Journey 4, Flow 6, Screen 9, Form 6 and the Admin: Activity Categories states, navigation and responsive rules in `docs/ux-design.md`.

## Clarifications

### Session 2026-11-02

- Q: Is a category itself the activity a user picks, or does it group several named activities? → A: The category is the activity. Each category, such as "Kayaking", "Picnic" or "Heritage site", is what a user adds to a plan, with its own defaults and map place tags. There are no named activities inside a category (FR-024).
- Q: What categories exist when the application is first installed? → A: A starter set of five categories (Cycling, Kayaking, Picnic, Heritage site, Museum) with the defaults and tags in FR-025, added once at first setup. The administrator can edit them like any other category (FR-025).
- Q: If two administrators edit the same category at the same time, what should happen when the second one saves? → A: The second save is refused with "Error: This category was changed by someone else. Reload it and try again." and the form keeps that administrator's values (FR-026).
- Q: Should the system write a log entry each time an administrator creates or changes a category? → A: No. Only technical failures while saving are logged; successful creates and changes are not logged and no history is kept (FR-022).
- Q: Should a map place tag be allowed to match any value of a key (for example `historic=*`), or must each tag name one exact value? → A: Exact key=value pairs only; "*" and a key on its own are refused (FR-009).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Create an activity category (Priority: P1)

As an administrator, I want to create an activity category with its type, default duration, default weather limits and map place tags, so that visitors and registered users can later pick it when they plan their day.

**Why this priority**: Without categories nobody can add an activity to a plan (feature 005) or find places for it (feature 007). Creating a category is the smallest piece of this feature that delivers value.

**Independent Test**: An Active Administrator opens the Activity categories page, creates an Outdoor category "Swimming" with valid values, and sees it in the list with the banner "✓ Success: Category saved."

**Acceptance Scenarios**:

1. **Given** an Active Administrator and no categories, **When** they open the Activity categories page, **Then** they see "No categories yet. Create the first category." and a "Create category" button.
2. **Given** the Activity categories page, **When** the administrator selects "Create category", **Then** an empty form opens with the heading "Create category" and keyboard focus moves to that heading.
3. **Given** the create form, **When** the administrator enters the name "Swimming", selects the type Outdoor, a default duration of 2 hours, maximum wind 8 m/s, maximum rain 0.5 mm/h, minimum temperature 18 °C, maximum temperature 35 °C, checks "Requires daylight", enters the map place tags "leisure=bathing_place, sport=swimming" and selects "Save", **Then** the category is stored, the banner "✓ Success: Category saved." is shown until dismissed, the form closes and "Swimming" appears in the list.
4. **Given** the create form, **When** the administrator selects the type Indoor, **Then** the wind, rain and temperature fields are not shown and are not required, and the category is saved without weather limits.
5. **Given** the create form, **When** the administrator selects "Cancel", **Then** the form closes and nothing is saved.
6. **Given** a submitted form, **When** the server has not answered yet, **Then** "Saving category…" is shown and announced to screen readers and the "Save" button is disabled.
7. **Given** a submitted form, **When** the server fails, does not answer within 10 seconds, or the network fails, **Then** "Error: Something went wrong. Try again." is shown with a Retry button, the entered values are kept, and selecting Retry sends the same values again.

---

### User Story 2 - Edit a category's defaults and map place tags (Priority: P1)

As an administrator, I want to change an existing category's name, type, default duration, weather limits and map place tags, so that the defaults offered to users stay correct (Journey 4).

**Why this priority**: Project FR-027 and FR-028 require modifying categories and their default weather requirements, and Journey 4 is about correcting a wrong limit.

**Independent Test**: With the starter category "Kayaking" stored, the administrator selects it, changes the maximum wind from 8 to 6 m/s and the tags to "leisure=slipway", saves, and on reopening the category sees the new values.

**Acceptance Scenarios**:

1. **Given** the list of categories, **When** the administrator selects "Edit" for "Kayaking", **Then** the form opens with the heading "Edit Kayaking", every field shows the stored value, and keyboard focus moves to the heading.
2. **Given** the edit form, **When** the administrator changes values and selects "Save", **Then** the new values are stored, "✓ Success: Category saved." is shown until dismissed, the form closes and the list shows the updated category.
3. **Given** an Outdoor category, **When** the administrator changes its type to Indoor and saves, **Then** its weather limits are removed and the category no longer has any.
4. **Given** an Indoor category, **When** the administrator changes its type to Outdoor, **Then** the weather limit fields appear empty and must be filled before the category can be saved.
5. **Given** the edit form, **When** the administrator selects "Cancel", **Then** the form closes and the stored values are unchanged.
6. **Given** the list, **When** it is shown, **Then** categories are listed in alphabetical order by name, each with its name, its type and an "Edit" button that names the category for assistive technology (for example "Edit Kayaking").
7. **Given** a newly installed application, **When** an Active Administrator opens the Activity categories page for the first time, **Then** the five starter categories from FR-025 are listed with their defaults and tags.
8. **Given** two administrators who opened the edit form for "Kayaking", **When** the first saves a change and then the second saves, **Then** the second sees "Error: This category was changed by someone else. Reload it and try again.", the first administrator's change stays stored, and selecting "Reload" fills the form with the stored values.

---

### User Story 3 - Understand invalid category values (Priority: P1)

As an administrator, I want a clear message next to each wrong value, so that I can correct it without guessing the allowed ranges.

**Why this priority**: Categories feed the weather checks of every later feature. Out-of-range or malformed values would break planning for everyone, so they must never be stored.

**Independent Test**: The administrator submits an empty create form, then a form with out-of-range limits and malformed tags, and each time sees the expected messages and nothing is stored.

**Acceptance Scenarios**:

1. **Given** the create form, **When** the administrator submits it empty, **Then** "Error: Enter a category name.", "Error: Select a type.", "Error: Enter a duration between 0.5 and 12 hours." and "Error: Enter tags in the form key=value, for example leisure=slipway." appear next to their fields, an error summary at the top of the form lists every message with links that move focus to the fields, and nothing is stored.
2. **Given** an Outdoor category form, **When** the wind, rain or temperature values are missing or outside their ranges, **Then** the messages from FR-006 appear next to the affected fields.
3. **Given** an Outdoor category form, **When** the minimum temperature is equal to or higher than the maximum temperature, **Then** "Error: Minimum temperature must be lower than maximum temperature." appears next to the minimum temperature field.
4. **Given** the form, **When** the name is already used by another category, ignoring letter case and spaces around it, **Then** "Error: A category with this name already exists." appears next to the name field.
5. **Given** the form, **When** the map place tags contain an entry that is not a key=value pair (for example "slipway" or "leisure="), **Then** the tags message appears next to the tags field.
6. **Given** a failed validation, **When** the messages are shown, **Then** every entered value is kept and keyboard focus moves to the first invalid field.

---

### User Story 4 - Only active administrators can manage categories (Priority: P1)

As the project owner, I want only active administrators to see and change categories, so that the shared defaults cannot be changed by anyone else.

**Why this priority**: Business rule "Only an Administrator may modify the default weather requirements of predefined activity categories" and constitution principle IV (backend authorization for every protected operation).

**Independent Test**: Open the Activity categories page and send create and edit requests as a visitor, a Registered User, a Suspended Administrator and an Active Administrator, and check that only the Active Administrator succeeds.

**Acceptance Scenarios**:

1. **Given** a signed-in Active Administrator, **When** they look at the navigation, **Then** they see "Categories" and selecting it opens the Activity categories page.
2. **Given** a visitor, Registered User or Suspended user, **When** they look at the navigation, **Then** they do not see "Categories".
3. **Given** a visitor, **When** they open the Activity categories page address, **Then** they are sent to the Log in page with "Log in to continue.", and after logging in as an Active Administrator the Activity categories page opens.
4. **Given** a signed-in Active Registered User, **When** they open the Activity categories page address, **Then** the Access Denied page is shown and no category data is shown.
5. **Given** a signed-in Suspended user (Registered User or Administrator), **When** they open the Activity categories page address, **Then** they are sent to the Account Suspended page.
6. **Given** anyone who is not a signed-in Active Administrator, **When** they send a request to list, create or change categories directly to the server, **Then** the request is refused and nothing is shown or changed.

---

### User Story 5 - Manage categories with keyboard, screen reader and on a phone (Priority: P2)

As an administrator who uses a keyboard, a screen reader or a phone, I want to manage categories in the same way as everyone else.

**Why this priority**: Accessibility and mobile use are project-wide requirements (NFR-004, NFR-011 to NFR-015), but the page works without them for most administrators.

**Independent Test**: An administrator creates and edits a category using only the keyboard, and the Activity categories page is usable on a 320 px wide screen without horizontal scrolling.

**Acceptance Scenarios**:

1. **Given** the Activity categories page, **When** an administrator moves through it with the keyboard only, **Then** every button, field and link can be reached and used in a logical order.
2. **Given** a validation error, **When** a screen reader user reaches the affected field, **Then** the field's label, its allowed range and its error message are announced.
3. **Given** a desktop screen, **When** the page is open with the form, **Then** the list is on the left and the form on the right; **Given** a phone-sized screen, **Then** the list comes first, the form below it, fields and buttons are full width, every button and link is at least 44 × 44 px and input text is at least 16 px.
4. **Given** the Activity categories or Access Denied page, **When** a keyboard user presses Tab once, **Then** the first focused item is "Skip to main content"; each page has exactly one main heading and a browser tab title that names the page ("Activity categories - Spėk laiku", "Access denied - Spėk laiku").

### Edge Cases

- Name with spaces around it: the spaces are removed before checking the length and uniqueness and before storing it.
- Name that differs from an existing one only in letter case ("kayaking" and "Kayaking"): treated as the same name and refused.
- The administrator edits or renames a starter category: the change is kept; starter categories are never added again or reset, even when the application restarts.
- Renaming a category to its own current name, or changing only its letter case: allowed.
- Map place tags with spaces around pairs or commas, or an empty entry between two commas ("leisure=slipway, , sport=canoe"): spaces are removed and empty entries are ignored; at least one pair must remain.
- The same tag entered twice: stored once.
- A wildcard value or a key on its own ("historic=*" or "historic"): refused with the tags message; each tag must name one exact value (FR-009).
- Map place tags longer than 200 characters as entered: refused with "Error: Map place tags can be at most 200 characters."
- A number with more than one decimal place, a duration that is not a multiple of 0.5 (for example 1.3), or text in a number field: refused with that field's range message.
- Boundary values (wind 0 and 30, rain 0 and 20, temperatures -30 and 45, duration 0.5 and 12): accepted.
- Two administrators edit the same category at the same time: the first save is stored; the second is refused with "Error: This category was changed by someone else. Reload it and try again.", nothing is overwritten and the second administrator's values stay in the form (FR-026).
- Two administrators create categories with the same name at about the same time: only one is stored; the other sees "Error: A category with this name already exists."
- The category being edited no longer exists on the server: the administrator sees "Error: Something went wrong. Try again." and the list is reloaded.
- The administrator's session expires while the form is open: on "Save" they are sent to the Log in page with "Your session has expired. Log in again." and unsaved values are lost; after logging in they return to the Activity categories page.
- The administrator selects "Edit" for another category, or "Create category", while a form with unsaved changes is open: the open form is replaced without a warning and the unsaved changes are lost.
- The Save button is pressed twice quickly: one category is created or updated once.
- The category list cannot be loaded: "Error: Activity categories could not be loaded." is shown with a Retry button, and the "Create category" button is not shown until the list loads.

## Requirements _(mandatory)_

IDs in this specification are local to this feature. The related project requirements are listed in the traceability table at the end.

### Functional Requirements

- **FR-001**: The system MUST provide an Activity categories page with the main heading "Activity categories" that lists every category in alphabetical order by name, showing each category's name and type with an "Edit" button, and offers a "Create category" button. When there are no categories, it MUST show "No categories yet. Create the first category." together with the "Create category" button.
- **FR-002**: The system MUST let an Active Administrator create a category and edit any existing category through one form with these fields: Name, Type (Indoor or Outdoor), Default duration (h), Requires daylight, and Map place tags; and, only for Outdoor categories, Max wind (m/s), Max rain (mm/h), Min temperature (°C) and Max temperature (°C). Every field MUST have a visible label, and number fields MUST show their allowed range.
- **FR-003**: The system MUST require a name of 2 to 60 characters after spaces around it are removed, and MUST refuse a name that is already used by another category when compared without regard to letter case. Messages: "Enter a category name." (empty or only spaces), "Category name must be between 2 and 60 characters." (too short or too long), "A category with this name already exists." (duplicate).
- **FR-004**: The system MUST require a type, Indoor or Outdoor, with no type selected by default when creating. Message: "Select a type."
- **FR-005**: The system MUST require a default duration between 0.5 and 12 hours in steps of 0.5. Message: "Enter a duration between 0.5 and 12 hours."
- **FR-006**: For an Outdoor category the system MUST require all four weather limits, each a number with at most one decimal place: maximum wind 0 to 30 m/s ("Enter a wind limit between 0 and 30 m/s."), maximum rain 0 to 20 mm/h ("Enter a rain limit between 0 and 20 mm/h."), minimum temperature -30 to 45 °C ("Enter a minimum temperature between -30 and 45 °C."), maximum temperature -30 to 45 °C ("Enter a maximum temperature between -30 and 45 °C."). The minimum temperature MUST be lower than the maximum temperature ("Minimum temperature must be lower than maximum temperature.", shown next to the minimum temperature field). The same ranges and messages are used by Activity settings (Form 4) in feature 005.
- **FR-007**: For an Indoor category the system MUST NOT show, require or store weather limits. When a category's type changes from Outdoor to Indoor, its stored weather limits MUST be removed when it is saved.
- **FR-008**: "Requires daylight" MUST be an optional checkbox for both types, unchecked by default when creating.
- **FR-009**: The system MUST require map place tags as one or more key=value pairs separated by commas, at most 200 characters as entered. Spaces around pairs, keys and values are removed, empty entries between commas are ignored and repeated pairs are stored once. A key and a value MUST each be at least one character and contain only letters, digits, "_", ":" and "-". Messages: "Enter tags in the form key=value, for example leisure=slipway." (empty, or any entry is not a valid pair) and "Map place tags can be at most 200 characters." (too long).
- **FR-010**: The system MUST check all category input on the server, even if the browser also checks it, and MUST NOT store a category unless every field is valid.
- **FR-011**: The system MUST show each validation problem as text next to the affected field, linked to it for assistive technology. When more than one field is invalid, it MUST also show an error summary at the top of the form listing every message as a link that moves keyboard focus to its field, and announce it. After a failed validation it MUST keep every entered value and move keyboard focus to the first invalid field. Every error message MUST start with "Error:", added by the frontend.
- **FR-012**: After a category is created or changed, the system MUST show the banner "✓ Success: Category saved." that stays until dismissed, close the form and show the updated list. "Cancel" MUST close the form without saving.
- **FR-013**: Opening the create or edit form MUST move keyboard focus to the form's heading: "Create category", or "Edit <category name>" for an existing category. On narrow screens the form MUST be scrolled into view.
- **FR-014**: While the list is loading, the system MUST show "Loading activity categories…" (never a spinner alone) and announce it. If loading fails or takes more than 10 seconds, it MUST show "Error: Activity categories could not be loaded." with a Retry button.
- **FR-015**: While a save is in progress, the system MUST show "Saving category…", announce it without moving focus and disable the "Save" button. If the save fails for a technical reason, takes more than 10 seconds, or the network fails, the system MUST show "Error: Something went wrong. Try again." with a Retry button that sends the same values again, keep the entered values and show no technical details. A second "Save" while one is in progress MUST be ignored.
- **FR-016**: Only a signed-in Active Administrator may list, create or change categories through this feature. The server MUST refuse every such request from anyone else, whatever the browser shows.
- **FR-017**: The system MUST show "Categories" in the navigation only to a signed-in Active Administrator, linking to the Activity categories page.
- **FR-018**: A visitor who opens the Activity categories page MUST be sent to the Log in page with "Log in to continue." and returned to the Activity categories page after logging in (using the redirect from feature 002). A signed-in Suspended user MUST be sent to the Account Suspended page.
- **FR-019**: The system MUST provide an Access Denied page with the main heading "Access denied", the text "You do not have permission to open this page." and a link to the home page, and MUST show it to a signed-in Active user who is not an Administrator and opens the Activity categories page. Later features use the same page for their own refused pages.
- **FR-020**: The Activity categories and Access Denied pages MUST each have exactly one main heading, a browser tab title in the form "<Page> - Spėk laiku" ("Activity categories - Spėk laiku", "Access denied - Spėk laiku"), and a "Skip to main content" link as the first focusable item, and MUST be usable by keyboard and screen reader.
- **FR-021**: The Activity categories page MUST show the list on the left and the form on the right on desktop, and the list first with the form below it on screens down to 320 px wide, with full-width fields and buttons and no horizontal scrolling.
- **FR-022**: The system MUST write a log entry when a category save fails for a technical reason. Category changes made successfully are not logged, and no category history is kept.
- **FR-023**: A category MUST NOT be deleted through this feature.
- **FR-024**: Each category MUST be one kind of activity that a user can add to a plan, with its own name, defaults and map place tags. A category MUST NOT contain a list of named activities.
- **FR-025**: When the application is first set up and has no categories, the system MUST add these starter categories once. They MUST be stored and validated like any other category, and MUST NOT be added again or reset after an administrator changes them.

  | Name          | Type    | Duration (h) | Requires daylight | Max wind (m/s) | Max rain (mm/h) | Min / max temperature (°C) | Map place tags |
  | ------------- | ------- | ------------ | ----------------- | -------------- | --------------- | -------------------------- | -------------- |
  | Cycling       | Outdoor | 2            | Yes               | 10             | 1               | 5 / 32                     | highway=cycleway, route=bicycle |
  | Kayaking      | Outdoor | 2            | Yes               | 8              | 0.5             | 15 / 35                    | leisure=slipway, sport=canoe |
  | Picnic        | Outdoor | 1.5          | Yes               | 8              | 0               | 15 / 32                    | tourism=picnic_site, leisure=picnic_table |
  | Heritage site | Outdoor | 1.5          | Yes               | 15             | 2               | 0 / 35                     | historic=castle, historic=manor, historic=monument, historic=archaeological_site |
  | Museum        | Indoor  | 2            | No                | –              | –               | –                          | tourism=museum |

- **FR-026**: The system MUST refuse to save changes to a category that was changed by someone else after the edit form was opened. It MUST then show "Error: This category was changed by someone else. Reload it and try again." at the top of the form, store nothing, keep the administrator's entered values in the form, and offer a "Reload" button that replaces them with the latest stored values. The refusal MUST be decided on the server.

### Key Entities

- **Activity Category**: a predefined kind of activity that a user adds to a plan (for example "Kayaking"), shared by all users. The project entities "Activity" and "Activity Category" meet here: the activity in a plan (feature 005) is created from one category. Name (2 to 60 characters, unique without regard to letter case), type (Indoor or Outdoor), default duration in hours, whether it requires daylight, its weather limits (Outdoor only) and its map place tags.
- **Weather Limits** (part of an Outdoor category): maximum wind (m/s), maximum rain (mm/h), minimum and maximum temperature (°C). These are the defaults that feature 005 prefills when a user adds the activity to a plan.
- **Map Place Tag** (part of a category): one key=value pair, such as `leisure=slipway`, used by feature 007 to find nearby places. A place matches a category when it has at least one of the category's tags (feature 007 may refine this; see Assumptions).
- **User Account** (from features 001 and 002): read to check that the user is an Active Administrator. Not changed by this feature.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An administrator can create a new Outdoor category with all its values in under 2 minutes.
- **SC-002**: An administrator can find a category and correct one weather limit in under 1 minute (Journey 4).
- **SC-003**: 100% of attempts to list, create or change categories by anyone other than an Active Administrator are refused, whether made through the page or directly to the server.
- **SC-004**: 0 stored categories have a value outside the ranges in FR-003 to FR-009, a duplicate name, or an Outdoor type without all four weather limits.
- **SC-005**: Creating and editing a category can be completed using only the keyboard, and every field label, range and error is announced by a screen reader.
- **SC-006**: The Activity categories and Access Denied pages fit a 320 px wide screen with no horizontal scrolling.

## Assumptions

- Journey 4 uses the broad name "Water activities". Because a category is one activity (FR-024), the starter set uses specific names such as "Kayaking"; an administrator may still name a category broadly.
- The starter defaults and tags in FR-025 are sensible starting values, not researched limits; administrators are expected to adjust them.
- The empty state ("No categories yet.") is still needed for an installation where the starter set is not added, for example in automated tests.
- Administrator accounts are created or promoted outside the application, as in feature 002 (by changing the account's role in the database). Tests set them up directly.
- Visitors and Registered Users do not see categories in this feature. Reading the categories to pick activities, and prefilling a plan's activity from its category, belong to feature 005 Activity Selection and Limits.
- Using the map place tags to search for places belongs to feature 007 Nearby Places. This feature stores and checks the tags only; it does not contact the map service and does not check whether a tag exists in the map data. A place matches when it has at least one of the tags; feature 007 may refine this.
- A change to a category affects only activities added to a plan after the change. Activities already in a plan, including saved plans (feature 010), keep their own values (Journey 4 final state, project FR-037).
- The administrator's landing page after login stays the home page, and Home stays in the administrator's navigation, until feature 015 adds Service status.
- The UX navigation lists "Service status" and "Users" for administrators; those items are added by features 015 and 014. The UX Access Denied page links to Home and My plans; the My plans link is added by feature 010.
- Numbers are entered with a decimal point. The interface uses one language.
- The number of categories stays small (well under 100), so the list has no search, filter or paging.
- Form 6 does not give messages for an empty name, a name of the wrong length, temperatures out of range or tags that are too long; this specification adds them in the style of the existing messages.

## Dependencies

- Feature 002 User Login and Logout (merged): sign-in, the user's role and account status, the "Log in to continue." redirect with return to the requested page, the Account Suspended page, and the signed-in navigation.
- Feature 001 User Registration (merged): page layout with the skip link, success banner and error summary.
- Related UX material: Journey 4, Flow 6 (Admin category), Screen 9 (Admin, activity category), Form 6, Form 4 (shared ranges and messages), section 6 (Admin: Activity Categories states and the rules for all screens), section 7 (navigation by role and redirects) and section 8 (responsive layout) of `docs/ux-design.md`.
- Features 005 and 007 depend on this feature.

## Scope Boundaries

**In scope**: the Activity categories page with its list, create and edit form, validation and messages; the five starter categories; the default duration, daylight setting, weather limits and map place tags of each category; administrator-only access on the server and in the browser; the "Categories" navigation item; and the Access Denied page.

**Out of scope**: named activities inside a category, deleting or hiding categories, category history or audit log, reordering categories, icons or descriptions for categories, showing categories to visitors and registered users (feature 005), searching map data with the tags or checking that tags exist (feature 007), the Service status and Users pages and their navigation items (features 015 and 014), and a Not Found page.

## Traceability to project requirements

| Source                                                     | Covered by                        |
| ---------------------------------------------------------- | --------------------------------- |
| FR-027 (create and modify predefined categories)           | FR-001 to FR-005, FR-010 to FR-015, FR-023 to FR-026 |
| FR-028 (default weather requirements per category)         | FR-006 to FR-008                  |
| FR-044 (map place tags per category)                       | FR-009                            |
| Business rule: only an Administrator modifies category defaults | FR-016 to FR-019             |
| FR-041 (suspended users blocked)                           | FR-016, FR-018                    |
| NFR-003, NFR-015 (validation messages next to the field)   | FR-003 to FR-011                  |
| NFR-004 (keyboard use)                                     | FR-013, FR-020                    |
| NFR-009 (form labels)                                      | FR-002                            |
| NFR-011 (desktop and mobile layout)                        | FR-021                            |
| NFR-013 (announce loading and status)                      | FR-011, FR-014, FR-015            |
| NFR-014 (heading, page title, skip link)                   | FR-020                            |
| Constitution III (authorization test for each protected operation) | FR-016                    |
| Constitution IV (server-side validation and authorization) | FR-010, FR-016                    |
| UX design section 6 (Admin: Activity Categories states, Forbidden) | FR-001, FR-012, FR-014, FR-015, FR-019 |
| UX design section 7 (navigation by role and redirects)     | FR-017, FR-018                    |
| UX design section 8 (responsive layout)                    | FR-013, FR-021                    |
