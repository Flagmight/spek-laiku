# Feature Specification: Plan Management

**Feature Branch**: `011-plan-management`

**Created**: 2026-11-19

**Status**: Draft

**Input**: Feature 011 from the roadmap (`docs/architecture.md`). "Plan Management: a Registered User edits, duplicates and deletes their own saved plans. Covers FR-022 (edit own saved plans), FR-023 (duplicate own saved plans), FR-024 (delete own saved plans) and FR-039 (confirmation before a plan is deleted). FR-025 (cannot modify another user's private plan) stays enforced for these operations. Priority: Should. Depends on 010 Save and View Plans." Recalculating a saved plan with the latest forecast and detecting problems (FR-033, FR-034, feature 012), alternatives (FR-048, feature 013) and deleting plans together with the account (FR-005, feature 016) are out of scope.

## Clarifications

### Session 2026-11-19

- Q: When a user selects "Edit plan" on a saved plan, what should they be able to change? → A: Everything. The planning steps reopen with the location, dates, maximum travel distance and activities filled in, the user regenerates the schedule, and **Save changes** replaces the saved plan (Journey 2 in `docs/ux-design.md`).
- Q: While editing a saved plan, should the Schedule Overview also offer "Save as new plan" next to **Save changes**? → A: No. Only **Save changes**, which replaces the plan. A user who wants to keep the original duplicates it first.
- Q: What "Saved on" date and time should a duplicated plan show? → A: The original's "Saved on" date and time, because the copy holds the same schedule made with that forecast. The copy is listed directly above its original on My plans.
- Q: If the same plan is changed in two places (for example two browser tabs) and both save, what should happen to the second save? → A: Last save wins, with no warning or conflict check.
- Q: Should the plan page also have a separate "Rename" action that changes only the name and keeps the saved schedule exactly as it is? → A: Yes, on the plan page only (not on My plans rows). The schedule and "Saved on" date and time are unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Delete a plan I no longer need (Priority: P1)

An Active Registered User deletes one of their saved plans from My plans or from the plan page. The system asks for confirmation first, and after confirmation the plan is gone for good.

**Why this priority**: Project FR-024 and FR-039. Without deleting, the list of saved plans only grows, and a user cannot remove a plan they no longer want kept under their account. It is the simplest of the three operations and needs nothing else from this feature.

**Independent Test**: As a user with two saved plans, select "Delete" on "Weekend in Kaunas" in My plans. Check that the confirmation "Delete 'Weekend in Kaunas'? This cannot be undone." is shown. Select "Cancel" and check that the plan is still listed. Select "Delete" again and confirm, and check that "Plan deleted." is shown, the plan is no longer listed, and its address shows "This plan no longer exists.".

**Acceptance Scenarios**:

1. **Given** an Active Registered User on My plans, **Then** each plan row (or card at 320 px) shows "Open", "Duplicate" and "Delete" actions.
2. **Given** the user opens one of their plans, **Then** the plan page shows the actions "Edit plan", "Rename", "Duplicate" and "Delete".
3. **Given** the user selects "Delete" for a plan, **Then** a confirmation dialog opens with "Delete '<plan name>'? This cannot be undone." and the buttons **Delete** and **Cancel**, and nothing is deleted yet.
4. **Given** the confirmation dialog, **When** the user selects **Cancel**, presses Escape or closes the dialog, **Then** nothing is deleted and focus returns to the "Delete" button that opened it.
5. **Given** the confirmation dialog opened from My plans, **When** the user selects **Delete**, **Then** the plan is deleted, "Plan deleted." is shown and announced, the plan disappears from the list, and focus moves to the next plan's "Open" action, or to the main heading when no plan follows. When it was the last plan, the empty state "No saved plans yet." with **New plan** is shown.
6. **Given** the confirmation dialog opened from the plan page, **When** the user selects **Delete**, **Then** the plan is deleted and the user is taken to My plans, where "Plan deleted." is shown and announced.
7. **Given** a deleted plan, **Then** it no longer appears on My plans or in the Home "Your saved plans" block, and opening its address shows the Not Found page with "This plan no longer exists." and links to Home and My plans.
8. **Given** the delete fails because of a server error, a 10 second timeout or a network failure, **Then** "Error: Plan could not be deleted. Try again." is shown with a Retry button, and the plan stays listed and unchanged.

---

### User Story 2 - Duplicate a plan (Priority: P1)

An Active Registered User makes a copy of one of their saved plans, for example to keep the original and try a changed version, or to reuse a plan they liked.

**Why this priority**: Project FR-023. Duplicate is also the way to keep an original while editing a copy, because editing (User Story 3) replaces the plan it changes.

**Independent Test**: As a user with the saved plan "Weekend in Kaunas", select "Duplicate" in My plans. Check that "Plan duplicated." is shown, that a plan named "Copy of Weekend in Kaunas" is listed directly above the original, and that opening it shows the same setup, schedule and unscheduled activities as the original.

**Acceptance Scenarios**:

1. **Given** the user selects "Duplicate" on My plans or the plan page, **Then** a new saved plan is created under the same user, without a confirmation, with the name "Copy of <original name>".
2. **Given** an original name so long that "Copy of <original name>" would be longer than 80 characters, **Then** the end of the original name is cut so the copy's name is at most 80 characters (80, or 79 when the cut would split a character such as an emoji in two).
3. **Given** the copy, **Then** it has the same plan setup, activities, schedule, unscheduled activities, summaries and "Saved on" date and time as the original. It is a separate plan: later editing, renaming or deleting one of them does not change the other.
4. **Given** the duplicate succeeds from My plans, **Then** "Plan duplicated." is shown and announced, and the copy is listed directly above its original. **Given** it succeeds from the plan page, **Then** the copy's plan page opens with "Plan duplicated." shown and announced.
5. **Given** the user selects "Duplicate" again while the first request is still running, **Then** only one copy is created. The action is not available again until the request ends.
6. **Given** the duplicate fails because of a server error, a 10 second timeout or a network failure, **Then** "Error: Plan could not be duplicated. Try again." is shown with a Retry button and no copy is listed.
7. **Given** a copy of a copy, **Then** its name is "Copy of Copy of <name>", cut to 80 characters as above.

---

### User Story 3 - Edit a saved plan (Priority: P1)

An Active Registered User opens one of their saved plans and selects "Edit plan". The plan's location, dates, maximum travel distance and activities open in the planning steps, already filled in. The user changes what they want (for example adds or removes an activity, changes dates or an activity's limits), generates the schedule again and selects "Save changes". The saved plan is replaced by the new version.

**Why this priority**: Project FR-022 and Journey 2 ("Remove or add an activity → recalculate → save") in `docs/ux-design.md`. It is the main reason to come back to a saved plan.

**Independent Test**: As a user with the saved plan "Weekend in Kaunas" (Kayaking and Picnic), open it and select "Edit plan". Check that Plan Setup shows the saved location, dates and maximum travel distance, and that Activity Selection shows Kayaking and Picnic with their saved durations and limits. Remove Picnic, add Museum, continue, generate the schedule and select "Save changes". Check that "✓ Success: Changes saved." is shown, that the plan page now shows Kayaking and Museum, and that My plans still lists one "Weekend in Kaunas", not two.

**Acceptance Scenarios**:

1. **Given** the user selects "Edit plan" on the plan page, **Then** Plan Setup opens filled with the plan's location, dates and maximum travel distance, and the plan's activities with their saved durations, weather limits and daylight setting are loaded into Activity Selection.
2. **Given** the user is editing a saved plan, **Then** every planning step shows the notice "Editing '<plan name>'. Your saved plan is not changed until you save." with a **Cancel editing** button.
3. **Given** the user selects **Cancel editing**, **Then** the changes are discarded, the plan page of the saved plan opens, and the saved plan is unchanged.
4. **Given** the user is editing, **Then** each planning step works and checks its values exactly as when creating a new plan (features 004 to 009), including the date rules: dates in the past or outside the forecast period are shown with the usual messages ("Dates cannot be in the past.", "Forecast is not available that far ahead.") and must be removed or replaced before the user can continue.
5. **Given** the user has generated a new schedule while editing, **Then** the Schedule Overview shows a **Save changes** button instead of "Save plan".
6. **Given** the user selects **Save changes**, **Then** a form opens with "Plan name" filled with the current name and the buttons "Save changes" and "Cancel". The name follows the rules of feature 010 (1 to 80 characters after trimming, with the same messages).
7. **Given** a valid name, **When** the user confirms "Save changes", **Then** the saved plan's name, setup, activities and schedule are replaced by the ones shown, its "Saved on" date and time becomes now, "✓ Success: Changes saved." is shown and announced with a link "Open plan", and editing ends. The plan keeps its address, and My plans still lists it once, now ordered by its new saved time.
8. **Given** the generated schedule has no scheduled activity, **Then** **Save changes** is not offered, as "Save plan" is not offered in feature 010.
9. **Given** the save fails because of a server error, a 10 second timeout or a network failure, **Then** "Error: Changes could not be saved. Try again." is shown with a Retry button, the entered name and the schedule are kept, and the saved plan is unchanged.
10. **Given** more than 30 minutes have passed since the schedule was generated, **When** the user saves, **Then** the save is refused with "Generate the schedule again to save it." and a **Generate again** button, as in feature 010, and the saved plan is unchanged.

---

### User Story 4 - Rename a saved plan (Priority: P2)

An Active Registered User changes the name of a saved plan without changing its schedule.

**Why this priority**: Part of project FR-022. Editing (User Story 3) also lets the user change the name, but only together with a new schedule, which may differ because the forecast has changed. Renaming alone keeps the schedule exactly as saved.

**Independent Test**: Open "Weekend in Kaunas", select "Rename", enter "Kaunas trip" and save. Check that "✓ Success: Plan renamed." is shown, the main heading, page title and breadcrumbs show "Kaunas trip", and the schedule and "Saved on" date are unchanged.

**Acceptance Scenarios**:

1. **Given** the user selects "Rename" on the plan page, **Then** a form opens with "Plan name" filled with the current name and the buttons "Save" and "Cancel".
2. **Given** a valid name, **When** the user selects "Save", **Then** the plan's name is changed, "✓ Success: Plan renamed." is shown and announced, and the heading, page title and breadcrumbs show the new name. The schedule and the "Saved on" date and time are not changed.
3. **Given** an empty name, a name of only spaces or a name longer than 80 characters after trimming, **Then** the feature 010 messages "Enter a plan name." or "Plan name can be at most 80 characters." are shown next to the field and nothing is changed.
4. **Given** the user selects "Cancel" or presses Escape, **Then** the form closes and the name is unchanged.
5. **Given** the rename fails because of a server error, a 10 second timeout or a network failure, **Then** "Error: Plan could not be renamed. Try again." is shown with a Retry button, and the entered name is kept.

---

### User Story 5 - Nobody else can change my plans (Priority: P1)

Only the owner can edit, rename, duplicate or delete a saved plan. Visitors, other Registered Users, Administrators and Suspended users cannot.

**Why this priority**: Project FR-025 and the constitution's security principle (ownership checks on the server for every protected operation). Deleting or replacing someone else's plan would destroy their data.

**Independent Test**: As user A, save a plan and note its id. As user B, send edit (save changes), rename, duplicate and delete requests for that plan directly to the server. Check that each is refused with the Access Denied result and that user A's plan is unchanged and has no copy. Repeat as a Visitor, an Administrator and a Suspended user.

**Acceptance Scenarios**:

1. **Given** user B sends a save changes, rename, duplicate or delete request for user A's plan, **Then** it is refused with the Access Denied (403) result, no plan data is returned, and user A's plan is unchanged and not copied.
2. **Given** a Visitor sends any of these requests, **Then** it is refused as not signed in. **Given** a Visitor opens the plan page, **Then** they are sent to Log in with "Log in to continue." (feature 010).
3. **Given** an Administrator, **Then** any of these requests is refused with the Access Denied (403) result (project FR-032).
4. **Given** a Suspended user, **Then** any of these requests is blocked and the Account Suspended page explains why (project FR-041).
5. **Given** a request for a plan that does not exist (for example already deleted), **Then** it is refused with the Not Found result "This plan no longer exists." and nothing is created or changed.
6. **Given** a duplicate request, **Then** the copy is always stored under the signed-in owner. A request cannot choose another owner.

---

### User Story 6 - Manage plans on a phone and with assistive technology (Priority: P2)

Deleting, duplicating, renaming and editing a plan can be done at 320 px width, with only a keyboard, or with a screen reader.

**Why this priority**: Constitution accessibility constraint, project NFR-009 to NFR-015 and the accessibility rules in `docs/ux-design.md` (dialogs, repeated actions).

**Independent Test**: At 320 px with a keyboard and screen reader, on My plans duplicate a plan, delete the copy through the confirmation dialog, then open a plan and rename it with an empty name, fix the error and save.

**Acceptance Scenarios**:

1. **Given** a 320 px viewport, **Then** My plans shows each plan as a card with the plan name as the title and "Open", "Duplicate" and "Delete" below it, and the plan page actions, the Rename form, the Save changes form and the confirmation dialog have no horizontal scrolling.
2. **Given** the delete confirmation dialog, **Then** focus moves into it when it opens, stays inside it while it is open, Escape closes it like **Cancel**, and focus returns to the button that opened it when it closes without deleting.
3. **Given** the plan actions on My plans, **Then** each names its plan for screen readers ("Open Weekend in Kaunas", "Duplicate Weekend in Kaunas", "Delete Weekend in Kaunas").
4. **Given** deleting, duplicating, renaming or saving changes, **Then** the pending, success and error states are announced by screen readers without moving focus.
5. **Given** a validation error in the Rename or Save changes form, **Then** the message is shown as text next to the field, the field is marked invalid for screen readers, and focus moves to the field.

---

### Edge Cases

- The user selects **Delete** in the confirmation dialog twice quickly: the plan is deleted once and "Plan deleted." is shown once.
- The plan was deleted in another tab, and the user then selects Delete, Duplicate or Rename for it: "This plan no longer exists." is shown, the plan is removed from the list shown, and nothing is created.
- The plan was deleted in another tab while the user was editing it, and the user selects **Save changes**: the save is refused with "This plan no longer exists. Save it as a new plan instead." with a **Save plan** button that opens the feature 010 Save plan form with the entered name, so the new schedule is not lost.
- The same plan is edited or renamed in two tabs: each save replaces the plan with what that tab sends, and the last save is kept.
- The user selects "Edit plan" while the tab already holds an unsaved plan in progress (created through Plan Setup but not saved): a confirmation asks "Editing this plan replaces the plan you have not saved. Continue?" with **Continue** and **Cancel**. **Cancel** keeps the plan in progress and stays on the plan page.
- The user saves a plan (or saves changes) and then selects "Edit plan" on another plan without changing anything in between: no confirmation is shown, because nothing unsaved would be lost.
- The user starts editing plan A and then selects "Edit plan" on plan B: editing switches to plan B after the same confirmation, and the changes to plan A are discarded. Plan A is unchanged.
- While editing, the user leaves the planning steps (for example to Home or My plans) without saving: the edit stays in the tab session as the plan in progress, with its notice, until it is saved, cancelled, replaced, the user logs out or the tab is closed. The saved plan is unchanged.
- The session expires while editing: after logging in again in the same tab, the user returns to the step they were on with the edit kept, as in feature 010 for an unsaved plan. If another account logs in instead, the edit is discarded and that account cannot save it over the first account's plan (User Story 5).
- A saved plan whose dates have all passed: "Edit plan" is still offered. Plan Setup shows the past dates with "Dates cannot be in the past." and the user replaces them before continuing.
- An Administrator changed or renamed an activity category after the plan was saved: while editing, the plan's activities keep the name, duration and limits they were saved with, as in feature 010 FR-015, and are checked against the current activity rules when the user continues from Activity Selection, as for any plan.
- The user changes nothing while editing and saves: the plan is still replaced by the newly generated schedule, which may differ from the saved one because the forecast has changed.
- The user regenerates the schedule several times while editing: only the schedule shown when **Save changes** is confirmed is saved.
- A plan name with leading or trailing spaces, or with characters such as `<script>`, in Rename, Save changes or a copy's name: spaces are trimmed before the length check, and the name is stored and shown as plain text, never run as code.
- The user deletes the plan they are currently editing (for example from My plans in the same tab): the edit is discarded and the editing notice is no longer shown.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an Active Registered User to delete one of their own saved plans from My plans and from the plan page (project FR-024). A deleted plan MUST be removed permanently and MUST no longer appear on My plans, on Home, or at its address, which MUST show the Not Found result "This plan no longer exists.".
- **FR-002**: The system MUST ask for confirmation before deleting a plan, with "Delete '<plan name>'? This cannot be undone." and the buttons **Delete** and **Cancel** (project FR-039, `docs/ux-design.md` section 9). **Cancel**, Escape or closing the dialog MUST delete nothing.
- **FR-003**: After a delete from My plans, the system MUST show "Plan deleted." and remove the plan from the list; after a delete from the plan page, it MUST open My plans and show "Plan deleted.". When the delete fails because of a server error, a 10 second timeout or a network failure, it MUST show "Error: Plan could not be deleted. Try again." with a Retry button and keep the plan.
- **FR-004**: The system MUST allow an Active Registered User to duplicate one of their own saved plans from My plans and from the plan page, without a confirmation (project FR-023). The copy MUST be a new, separate saved plan of the same user with the same setup, activities, schedule, unscheduled activities, summaries and "Saved on" date and time as the original.
- **FR-005**: The copy's name MUST be "Copy of <original name>", with the end of the original name cut so the whole name is at most 80 characters.
- **FR-006**: After a duplicate from My plans, the system MUST show "Plan duplicated." and list the copy directly above its original; after a duplicate from the plan page, it MUST open the copy's plan page and show "Plan duplicated.". One user action MUST create at most one copy. When the duplicate fails because of a server error, a 10 second timeout or a network failure, it MUST show "Error: Plan could not be duplicated. Try again." with a Retry button.
- **FR-007**: The system MUST allow an Active Registered User to edit one of their own saved plans (project FR-022): "Edit plan" on the plan page MUST open the planning steps filled with the plan's location, dates, maximum travel distance and activities with their saved durations, weather limits and daylight setting.
- **FR-008**: While a saved plan is being edited, every planning step MUST show "Editing '<plan name>'. Your saved plan is not changed until you save." with **Cancel editing**, which MUST discard the changes and open the saved plan's page. The planning steps MUST check all values as for a new plan (features 004 to 009).
- **FR-009**: While editing, the Schedule Overview MUST offer **Save changes** instead of "Save plan", only when the schedule has at least one scheduled activity. **Save changes** MUST open a form with "Plan name" filled with the current name, checked with the feature 010 name rules and messages.
- **FR-010**: Confirming **Save changes** MUST replace the saved plan's name, setup, activities and schedule with the ones shown, set its "Saved on" date and time to now, keep its address, and show "✓ Success: Changes saved." with an "Open plan" link. It MUST NOT create a second plan.
- **FR-011**: The replacing schedule MUST be one the system itself generated, under the same rule as saving in feature 010 FR-004: the save changes request MUST refer to a generated schedule remembered on the server for 30 minutes and send only the plan name, and the server MUST NOT accept setup, activity, time, place, weather or travel values from the browser. An expired or unknown schedule MUST be refused with "Generate the schedule again to save it." and a **Generate again** button, and the saved plan MUST stay unchanged.
- **FR-012**: When saving changes fails because of a server error, a 10 second timeout or a network failure, the system MUST show "Error: Changes could not be saved. Try again." with a Retry button, keep the entered name and the schedule, and leave the saved plan unchanged. When the plan no longer exists, it MUST show "This plan no longer exists. Save it as a new plan instead." with a **Save plan** button that opens the feature 010 Save plan form.
- **FR-013**: Starting to edit a plan while the tab holds another plan in progress that has not been saved (an unsaved plan, or an edit of another plan) MUST first ask "Editing this plan replaces the plan you have not saved. Continue?" with **Continue** and **Cancel**. A plan in progress that has not changed since its last successful Save plan or Save changes counts as saved and needs no confirmation. An edit in progress MUST be kept in the browser tab session like any plan in progress (feature 010 FR-007) and MUST be cleared on logout or when the tab is closed.
- **FR-014**: The system MUST allow an Active Registered User to rename one of their own saved plans from the plan page. The new name MUST follow the feature 010 name rules and messages. Renaming MUST NOT change the schedule or the "Saved on" date and time. On success it MUST show "✓ Success: Plan renamed." and update the heading, page title and breadcrumbs; on a server error, a 10 second timeout or a network failure it MUST show "Error: Plan could not be renamed. Try again." with a Retry button.
- **FR-015**: Deleting, duplicating, renaming and saving changes MUST be allowed only for an Active Registered User and only for their own plans. The server MUST check ownership on every request (project FR-025): another user's plan MUST give the Access Denied (403) result without any plan data and without changing or copying the plan; a plan that does not exist MUST give the Not Found result "This plan no longer exists."; Visitors MUST be refused as not signed in; Administrators MUST get the Access Denied result (project FR-032); Suspended users MUST be blocked as in project FR-041.
- **FR-016**: A copy MUST always be stored under the signed-in user. The server MUST ignore or refuse any owner given in a request.
- **FR-017**: Deleting, duplicating and renaming MUST NOT call the weather or map data services. Editing calls them only through the planning steps, as for a new plan.
- **FR-018**: Plan names MUST be shown as plain text and MUST never be run as code.
- **FR-019**: My plans MUST show "Open", "Duplicate" and "Delete" for each plan, and the plan page MUST show "Edit plan", "Rename", "Duplicate" and "Delete". On My plans each action MUST name its plan for screen readers (for example "Delete Weekend in Kaunas").
- **FR-020**: The confirmation dialogs MUST move focus inside when opened, keep focus inside while open, close with Escape like **Cancel**, and return focus to the button that opened them. The Rename and Save changes forms, My plans, the plan page and the dialogs MUST be usable at 320 px without horizontal scrolling, with only a keyboard and with a screen reader, MUST announce pending, success and error states, and MUST show validation errors as text next to the field (project NFR-009 to NFR-015).

### Key Entities

- **Saved Plan** (from feature 010, extended): a plan kept under one Registered User's account. It now can be renamed, replaced by an edited version (new name, setup, activities, schedule and saved time, same address), copied, and deleted permanently. Only its owner can do any of this.
- **Plan Copy**: a new Saved Plan made by duplicating. It has its own address and owner (the same user), the name "Copy of <original name>", and the same content and "Saved on" date and time as the original at the moment of copying. It has no link to the original afterwards.
- **Plan Edit** (in the browser tab session): the plan in progress when it was loaded from a saved plan. It is the Current Plan from features 004 to 010, plus a reference to the saved plan it will replace and that plan's name for the editing notice. It belongs to no account until it is saved.
- **Generated Schedule Record** (from feature 010): a schedule the system generated, remembered for 30 minutes. Saving changes refers to it in the same way as saving a new plan.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An Active Registered User can delete a plan, including the confirmation, in under 10 seconds from selecting "Delete".
- **SC-002**: An Active Registered User can duplicate a plan with one action, and the copy is listed within 2 seconds.
- **SC-003**: A user can open a saved plan for editing, change one activity, generate the schedule and save the changes in under 3 minutes, without entering the location, dates or other activities again.
- **SC-004**: In 100% of cases, a copy opened later shows the same setup, schedule, unscheduled activities and summaries as its original, and after saving changes My plans lists the edited plan once, with the new content.
- **SC-005**: In every authorization test, 100% of delete, duplicate, rename and save changes requests from Visitors, Administrators, Suspended users and non-owners are refused, and 0 plans of another user are changed, copied or deleted.
- **SC-006**: 0 plans are deleted without the user confirming in the dialog.
- **SC-007**: Deleting, duplicating, renaming and editing are usable at 320 px width with no horizontal scrolling, and with a keyboard and screen reader only.

## Assumptions

- Editing follows Journey 2 in `docs/ux-design.md`: the user changes the plan in the same planning steps as a new plan, generates the schedule again and saves. The regenerated schedule uses the latest forecast, like any new schedule. Recalculating a saved plan without editing it, detecting what no longer works and listing the problems (project FR-033, FR-034) belong to feature 012, and alternatives (FR-048) to feature 013.
- "Save changes" replaces the plan. There is no "Save as new plan" while editing. A user who wants to keep the original duplicates it first and edits the copy (User Story 2).
- A copy keeps the original's "Saved on" date and time because it holds the same schedule, which was made with the forecast of that time. The plan page note from feature 010 ("This is your plan as saved on <date>. The forecast may have changed since.") therefore stays correct for copies.
- Deleting is permanent. There is no undo, trash or restore, as the confirmation text says.
- Deleting a plan does not need a confirmation beyond the dialog (no typing the name). Duplicating and renaming need no confirmation because they lose no data.
- Edits in two tabs are not merged and no conflict is shown; the last save is kept. Expected use is one person editing their own plan.
- No limit on the number of saved plans or copies per user is set in this feature, as in feature 010.
- Deleting all of a user's plans when the account is deleted belongs to feature 016.
- The Access Denied (403) and Not Found ("This plan no longer exists.") results, the "Log in to continue." redirect and the plan name rules are the ones built in features 002 and 010.
- Times are shown in Lithuanian time, as in features 006 to 010.
- Out of scope: sharing plans and voting, recalculating or checking a saved plan against the latest forecast (feature 012), alternatives (feature 013), deleting the account (feature 016), undoing a delete, choosing the copy's name before duplicating, bulk actions on several plans, and showing a history of changes to a plan.
