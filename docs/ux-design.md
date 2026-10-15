# Independent Work 2 – User Experience, User Flows and Wireframes

## Objective

Transform requirements into a clear description of how users interact
with the application. Important user flows must be understandable before
implementation begins.

## Required Result

The student must be able to demonstrate how a user completes the
application’s most important activities before those activities are
programmed.

# Answers 2 – User Experience, User Flows and Wireframes

## 1. Creating a Screen Inventory

Create a list of all major application screens or pages. For each screen
state its purpose and which user roles may access it.

Use the inventory to verify that required workflows have an interface
and that restricted screens are identified early.

**Example:** Task Details – shows one task, its status, due date, and
allowed actions. Accessible to the task owner; administrative access
must be explicitly justified.

| Page | Purpose | Accessible by |
|----|----|----|
| Home | Introduces the application and lets the user start creating a new plan or access an existing one. | All users |
| Register | Creates an account with email and password. | Visitor |
| Login | Signs in with email and password. | Visitor |
| Plan Setup | Choose location (Lithuania) and one or more dates. | Visitor, Registered User |
| Activity Selection | Pick activities from categories, set duration and weather limits (temperature, rain, wind, daylight), remove activities. | Visitor, Registered User |
| Places and Forecast | Shows the places found for the chosen activities (name and location) and the hourly forecast with suitable and unsuitable hours. Lets the user remove or change an activity when no place is found, then generate the schedule. | Visitor, Registered User |
| Schedule Overview | The generated plan in chronological order: start, end, activity, location, weather and travel distance. Includes the "Recalculate" action. | Visitor (session only), Registered User |
| Plan Problems and Alternatives | Lists conflicts with the current plan (bad weather, overlap, too far) and suggests replacement activities or times. | Visitor, Registered User |
| My Plans | Lists saved plans with open, duplicate and delete actions. | Registered User (own plans only) |
| Plan Details / Edit | Views and edits one saved plan. | Plan owner |
| Shared Plan and Voting | Opens a plan via link or invitation, view-only or vote (optional extension). | Registered User (invited) |
| Profile | Edit profile and preferences, delete account. | Registered User |
| Admin: Service Status | Shows Open-Meteo and Overpass availability and error logs. | Administrator |
| Admin: Activity Categories | Create and edit categories, their default weather limits and their OSM place mapping. | Administrator |
| Admin: User Accounts | Lists accounts, with suspend, reactivate and delete. | Administrator |
| Access Denied (403) and Not Found (404) | Handles forbidden or missing pages and plans. | All users |
| Account Suspended | Explains that the account is suspended and that features needing an active account are blocked. | Suspended Registered User |

## 2. Defining Main User Journeys

Create at least three major user journeys. A journey shows how a user
achieves a meaningful goal across multiple steps.

Each journey must identify the starting point, user goal, individual
steps, and expected final state.

**Example:** Visitor → Registration → Login → Dashboard → Create Task →
Task appears in Task List.

**Journey 1: Visitor creates a weather-based plan**

- **Starting point:** Home, not logged in.

- **Goal:** Get a schedule for a weekend of activities without creating
  an account.

- **Steps:**

  1.  Home → "Create plan".

  2.  Plan Setup: choose a location in Lithuania and two dates.

  3.  Activity Selection: add kayaking, a heritage visit and a picnic;
      set duration and weather limits (defaults are prefilled from the
      category).

  4.  Nearby Places: the system retrieves places for each activity and
      shows their names and locations.

  5.  Hourly Forecast: the user reviews which hours are suitable.

  6.  Schedule Overview: the user generates the schedule.

- **Final state:** A chronological schedule with start time, end time,
  activity, location and weather is shown. It exists only for the
  current session. A "Log in to save" prompt is offered instead of a
  save button.

**Journey 2: Registered user saves and later edits a plan**

- **Starting point:** Schedule Overview from Journey 1 (a Visitor with a
  finished plan).

- **Goal:** Keep the plan and come back to change it.

- **Steps:**

  1.  Click "Save plan" → redirected to Register (or Login).

  2.  Register with email and password → the session plan is carried
      over.

  3.  Schedule Overview: click "Save plan" and give the plan a name.

  4.  Later: Login → My Plans → open the plan in Plan Details / Edit.

  5.  Remove or add an activity → recalculate → save.

- **Final state:** The updated plan is stored under the user's account
  and visible only to them. Duplicating and deleting are available from
  My Plans.

**Journey 3: Plan adapts after the forecast changes**

- **Starting point:** My Plans, with a saved plan whose forecast has
  since changed.

- **Goal:** Find out what no longer works and fix it.

- **Steps:**

  1.  Open the plan → the system recalculates using the latest forecast.

  2.  Plan Problems and Alternatives lists the conflicts, e.g. "Kayaking
      Saturday 10:00: wind 9 m/s exceeds your limit of 6 m/s" or "Travel
      to the second location is too far".

  3.  For each problem the system suggests a new time or a replacement
      activity that satisfies its own weather and schedule rules.

  4.  The user accepts one suggestion and rejects another.

  5.  Schedule Overview is updated and the user saves.

- **Final state:** The saved plan has no unresolved conflicts, or the
  remaining conflicts are clearly marked. If the weather service is
  down, the saved plan stays unchanged and an error is shown.

**Journey 4: Administrator maintains an activity category**

- **Starting point:** Login as Administrator → Admin: Service Status.

- **Goal:** Correct the default weather limits for "Water activities".

- **Steps:**

  1.  Open Admin: Activity Categories.

  2.  Select the category and edit the maximum wind speed and rain
      limit.

  3.  Check the OSM place mapping for the category.

  4.  Save.

  5.  Check Service Status to confirm Open-Meteo and Overpass are
      available.

- **Final state:** New plans use the updated defaults. Existing saved
  plans keep their own settings, and the Administrator cannot see or
  change any user's plans.

**Journey 5: Group voting on a plan**

- **Starting point:** Schedule Overview of a saved plan.

- **Goal:** Let the group choose between options.

- **Steps:**

  1.  Owner selects "Share" and chooses view-only or vote.

  2.  A family member opens the link, logs in or registers, and lands on
      Shared Plan and Voting.

  3.  They vote on alternatives.

  4.  The owner sees the result in Plan Details and applies the winning
      option.

- **Final state:** The plan remains owned and controlled by the owner.
  Recipients can view the shared plan and, when voting access is
  enabled, vote on the available alternatives. Recipients cannot edit or
  delete the plan.

## 3. Creating User Flow Diagrams

Create diagrams for the main workflows. Show screens, user actions,
important decisions, validation failures, success paths, and navigation
destinations.

Complex features should have their own flow rather than being hidden
inside one unreadable diagram.

**Example:** For login, include both “credentials valid → dashboard” and
“credentials invalid → error message → remain on login page.”

**Flow 1: Registration:**

<img src="media/image1.png" style="width:4.27083in;height:5.6875in" />

**Flow 2: Login**

<img src="media/image2.png" style="width:4.5in;height:5.20833in" />

**Flow 3: Create plan**

<img src="media/image3.png" style="width:6.45833in;height:9.28125in" />

**Flow 4: Save plan**

<img src="media/image4.png" style="width:6.23958in;height:9.03125in" />

**Flow 5: Recalculate**

<img src="media/image5.png" style="width:6.36458in;height:8.85417in" />

**\**

**Flow 6: Admin category**

<img src="media/image6.png" style="width:6.65625in;height:8.59375in" />

**\**

## 4. Creating Low-Fidelity Wireframes

Create low-fidelity wireframes for all major screens using Figma,
Penpot, diagrams, or another suitable tool.

Wireframes must show navigation, page hierarchy, forms, buttons, lists,
important data, and actions available to users. Visual branding is not
the goal at this stage.

**Example:** A Task List wireframe should show the page title, create
button, filter controls, list/table of tasks, and the actions available
for each task.

**Screen 1: Home**

<img src="media/image7.png" style="width:6.8in;height:3.49722in" />

**Screen 2: Registration\**
<img src="media/image8.png" style="width:6.8in;height:2.63264in" />

**Screen 3: Log in\**
<img src="media/image9.png" style="width:6.8in;height:2.10278in" />

**Screen 4: Plan setup (step 1)**

<img src="media/image10.png" style="width:6.8in;height:3.41389in" />

**Screen 5: Activity selection (step 2)**

<img src="media/image11.png" style="width:6.8in;height:4.67153in" />

**Screen 6: Places and forecast (step
3)**<img src="media/image12.png" style="width:6.8in;height:5.0625in" />

**Screen 7: Schedule
overview**<img src="media/image13.png" style="width:6.8in;height:4.43194in" />

**Screen 8: My plans**

<img src="media/image14.png" style="width:6.8in;height:2.37153in" />

**Screen 9: Admin, activity category**

<img src="media/image15.png" style="width:6.8in;height:3.16944in" />

## 5. Defining Form Behavior

For every important form specify fields, required and optional fields,
input restrictions, validation messages, submit action, successful
result, and unsuccessful result.

Do not define only what a form looks like; define how it behaves.

**Example:** Email: required, valid email format, maximum length
defined, duplicate address rejected during registration, and the user
receives a clear validation message.

**Form 1: Register**

| Field | Required | Restrictions | Validation |
|----|----|----|----|
| Email | Yes | Valid email format, max 254 characters, unique | "Enter a valid email address." / "This email is already registered." |
| Password | Yes | At least 8 characters | “Password must be at least 8 characters” |
| Confirm password | Yes | Must match password | “Passwords do not match” |

**Form 2: Log in**

| Field    | Required | Restrictions       | Validation                 |
|----------|----------|--------------------|----------------------------|
| Email    | Yes      | Valid email format | "Enter your email address” |
| Password | Yes      | Not empty          | “Enter password”           |

**Form 3: Plan setup**

| Field | Required | Restrictions | Validation |
|----|----|----|----|
| Location | Yes | Must be picked from search results inside Lithuania, not free text | "Select a location in Lithuania from the list." |
| Maximum travel distance (km) | No | Whole number 1 to 200, default 30 | "Enter a whole number between 1 and 200." |
| Dates | Yes (at least 1) | Max 7 dates, not in the past, within the available forecast period. | "Add at least one date." / "Dates cannot be in the past." / "Forecast is not available that far ahead." / "This date is already added." |

**Form 4: Activity settings**

| Field | Required | Restrictions | Validation |
|----|----|----|----|
| Duration (h) | Yes | 0.5 to 12 in steps of 0.5 | "Enter a duration between 0.5 and 12 hours." |
| Max wind (m/s) | Outdoor only | 0 to 30 | "Enter a wind limit between 0 and 30 m/s." |
| Max rain (mm/h) | Outdoor only | 0 to 20 | "Enter a rain limit between 0 and 20 mm/h." |
| Min / max temperature (°C) | Outdoor only | -30 to 45, min lower than max | "Minimum temperature must be lower than maximum temperature." |
| Requires daylight | No | Checkbox, default from the category | \- |

**Form 5: Save plan**

| Field | Required | Restrictions | Validation |
|----|----|----|----|
| Plan name | Yes | 1 to 80 characters after trimming, not only spaces. Names need not be unique | "Enter a plan name." / "Plan name can be at most 80 characters." |

**Form 6: Admin activity category (create or edit)**

| Field | Required | Restrictions | Validation |
|----|----|----|----|
| Name | Yes | 2 to 60 characters, unique | "A category with this name already exists." |
| Type | Yes | Indoor or Outdoor | "Select a type." |
| Max wind, max rain | Outdoor only | Same ranges as Form 4 | Same messages as Form 4 |
| Min / max temperature | Outdoor only | Same rules as Form 4 | Same message as Form 4 |
| Default duration (h) | Yes | 0.5 to 12 | Same message as Form 4 |
| Requires daylight | No | Checkbox | \- |
| Map place tags | Yes | One or more key=value pairs separated by commas, max 200 characters | "Enter tags in the form key=value, for example leisure=slipway." |

## 6. Designing Application States

For relevant screens define normal, loading, empty, validation error,
server error, unauthorized, not-found, and success states.

A screen is not complete if only the successful state has been designed.

**Example:** Task List empty state: display “No tasks yet” and a visible
action to create the first task instead of showing an unexplained blank
area.

**Rules for all screens:**

| State | Behavior |
|----|----|
| Loading | Show a text message with a spinner (never a spinner alone), disable the submit button, and announce the message to screen readers. After 10 seconds, switch to the server error state. |
| Validation error | Show the field messages from step 5 under each field, move focus to the first invalid field, and keep what the user typed (except passwords). |
| Server error | Show "Error: Something went wrong. Try again." with a **Retry** button. Never show stack traces or database details. |
| External service unavailable | Show "Error: The weather service is unavailable. No forecast is shown." (or "map data service"), with Retry. No guessed or old data is displayed (NFR-007). Saved plans stay unchanged (NFR-008). |
| Unauthorized (not logged in) | Redirect to Log in with "Log in to continue." After login, return to the page the user wanted. |
| Forbidden (logged in, no permission) | Show the Access Denied (403) page, with links to Home and My plans. |
| Not found | Show the Not Found (404) page. |
| Success | Show "✓ Success: …" in a banner that stays until dismissed, not one that disappears by itself. |

**Screen-specific states:**

| State | Behavior |  |
|----|----|----|
| Home | Loading | "Loading your saved plans…" in the saved plans block only. |
|  | Empty (logged in) | "No saved plans yet." with a **Create your first plan** button. |
|  | Server error | "Error: Saved plans could not be loaded." with Retry. The rest of the page still works. |
| Register | Success | Account created, user goes to Home. |
|  | Unauthorized | A logged-in user opening Register is redirected to Home. |
| Log in | Validation / failure | "Incorrect email or password." and the user stays on the page. |
|  | Suspended | User goes to the Account Suspended screen. |
|  | Unauthorized | A logged-in user opening Log in is redirected to Home. |
| Plan Setup | Loading | "Searching locations…" while the user types in Location. |
|  | Empty | "No location found. Check the spelling or try a larger town." |
|  | Server error | "Error: Location search is unavailable. Try again later." |
| Activity Selection | Loading | "Loading activity categories…" |
|  | Empty | "No activities added yet. Select at least one category to continue." |
|  | Server error | "Error: Activity categories could not be loaded." with Retry. |
| Places and Forecast | Loading | "Getting the forecast and nearby places…" and **Generate schedule** is disabled. |
|  | Empty (per activity) | "No place found" row with **Remove** and **Change activity**. |
|  | Service unavailable | The matching service message, **Generate schedule** disabled, Retry available. |
| Schedule Overview | Loading | "Generating your schedule…" |
|  | Partial | An activity without a suitable time shows "No suitable time found" and is flagged. |
|  | Empty | "No suitable time found for any activity. Change the dates or the weather limits." with **Back**. |
|  | Success | "✓ Success: Plan saved." with a link to My Plans. |
|  | Unauthorized | A visitor clicking save is sent to Log in, and the plan is kept. |
|  | Server error | "Error: Plan could not be saved. Try again." and the plan stays in the session. |
| Plan Problems and Alternatives | Loading | "Checking your plan against the latest forecast…" |
|  | Empty | "✓ No problems found. Your plan fits the current forecast." |
|  | No alternative | "No alternative found for this activity. Keep it or remove it." |
|  | Service unavailable | "Error: The forecast could not be updated. Your saved plan is unchanged." |
|  | Success | "✓ Success: Changes applied." |
| My Plans | Loading | Placeholder rows with "Loading your plans…" |
|  | Empty | "No saved plans yet." with a **New plan** button. |
|  | Success | "Plan duplicated." / "Plan deleted." |
|  | Confirmation | Delete asks "Delete 'Weekend in Kaunas'? This cannot be undone." with **Delete** and **Cancel**. |
|  | Forbidden / not found | Opening another user's plan by URL gives 403. A deleted plan gives 404 ("This plan no longer exists."). |
| Admin: Activity Categories | Empty | "No categories yet. Create the first category." |
|  | Success | "✓ Success: Category saved." |
|  | Forbidden | A non-administrator gets Access Denied. |
| Admin: Service Status | Loading | "Checking services…" |
|  | Server error | "Error: Service status could not be read." with Retry. |
| Admin: User Accounts | Empty | "No accounts match your search." |
|  | Confirmation | "Suspend email@example? They will lose access until reactivated." and the same style for delete. |
| Account Suspended | Shown when | A suspended user logs in, or tries to use a feature that needs an active account. |
| 403 / 404 | Normal | Messages and links as in the wireframes plan: Home, My plans. |

## 7. Designing Navigation

Define primary navigation, any necessary secondary navigation, behaviour
for authenticated and unauthenticated users, and role-dependent
navigation.

A user should be able to understand where they are, where they can go,
and how to return to a previous meaningful location.

**Example:** Unauthenticated users see Home, Login, and Register.
Authenticated users see Dashboard, Tasks, Profile, and Logout. Admin
appears only for authorized administrators.

Navigation follows the wireframes: a top bar on desktop

1.  Primary navigation by role

| Item                   | Visitor | Registered User | Administrator | Suspended User |
|------------------------|---------|-----------------|---------------|----------------|
| Home                   | ✓       | ✓               | –             | ✓              |
| Create plan            | ✓       | ✓               | –             | –              |
| My plans               | –       | ✓               | –             | –              |
| Profile *(Could Have)* | –       | ✓               | –             | –              |
| Service status         | –       | –               | ✓             | –              |
| Categories             | –       | –               | ✓             | –              |
| Users                  | –       | –               | ✓             | –              |
| Log in / Register      | ✓       | –               | –             | –              |
| Log out                | –       | ✓               | ✓             | ✓              |

2\. Secondary navigation

| Element | Where it appears | What it does |
|----|----|----|
| Breadcrumbs | Every screen below the top level, e.g. Home › My plans › Weekend in Kaunas | Shows where the user is. Each earlier item is a link. |
| Progress bar | Plan Setup, Activity Selection, Places and Forecast, Schedule Overview | Shows step 1 to 4 of the plan. Completed steps can be clicked to go back, later steps cannot be skipped to. |
| Back button | Bottom of each wizard step, and "‹ Back to …" at the top on mobile | Goes to the previous step and keeps entered data. |
| Tabs | Admin pages (if grouped later) | Switches between views of the same screen. |
| Row actions | My Plans, Admin lists | Open, Duplicate, Delete and similar actions for one item. |

3\. Behaviour for authenticated and unauthenticated users

| Situation | Result |
|----|----|
| Visitor opens My plans, Profile or an admin page | Redirected to Log in with "Log in to continue." After login, the user goes to the page they asked for. |
| Logged-in user opens Log in or Register | Redirected to Home. |
| After login | Registered User goes to Home. Administrator goes to Service status. Suspended account goes to Account Suspended. |
| After log out | Goes to Home, with a Visitor menu. Plan data in the session is cleared. |
| Registered User opens an admin page | Access Denied (403). |
| Session expires | Redirected to Log in with "Your session has expired. Log in again." |
| Suspended user opens any feature that needs an active account | Redirected to Account Suspended. |

## 8. Considering Responsive Design

Show how important screens behave on at least desktop and narrow/mobile
screen widths.

Normal content must remain usable without horizontal scrolling unless
horizontal scrolling is an intentional requirement for a specific data
view.

**Example:** On mobile, a wide task table can become stacked task cards
with the most important fields visible first instead of shrinking text
until it is unreadable.

1.  **Breakpoints**

| Layout | Width | Used for |
|----|----|----|
| Desktop | 1024 px and wider | Top navigation bar, tables, two-column areas |
| Narrow / mobile | Below 1024 px | "☰ Menu", stacked cards, single column |

2.  **General rules**

| Element | Desktop | Narrow / mobile |
|----|----|----|
| Navigation | Links in the top bar | "☰ Menu" button that opens a full-width list |
| Breadcrumbs | Full path | One "‹ Back to …" link |
| Progress bar | Four labelled steps | "Step 2 of 4: Activities" with four segments |
| Tables | Columns with a header row | One card per row. The most important field is the card title, and the other fields are listed as "Label: value". |
| Row actions | Small buttons in the last column | Buttons below the card, wrapping onto more lines if needed |
| Buttons | Inline, sized to their text | Full width, stacked |
| Forms | Fields side by side where they are related | One field per row, labels above |
| Two-column areas | Side by side | Stacked, with the same reading order |
| Banners | Full width of the content | Same, with text wrapping |
| Touch targets | \- | At least 44 × 44 px |
| Text | \- | Inputs use at least 16 px text so mobile browsers do not zoom |

3.  **Screen-by-screen behavior**

| Screen | On desktop | On mobile |
|----|----|----|
| Home | Three step tiles in a row, saved plans as a table | Tiles stacked, saved plans as cards |
| Register / Log in | Single centred-width form | Same form, full-width fields and buttons |
| Plan Setup | Distance and date fields side by side, date chips in a row | Fields stacked, date chips wrap onto new lines |
| Activity Selection | Categories on the left, activity settings on the right | Categories first, then the settings, all in one column. Each setting is on its own row. |
| Places and Forecast | Tables grouped by activity | Each place or hour becomes a card. Suitable and unsuitable still use ★ and ✗ with words. |
| Schedule Overview | Table grouped by day, columns Time / Activity / Place / Weather / Travel | Day heading, then one card per activity with the time shown first |
| Plan Problems and Alternatives | Option table with details | Options as cards. Choosing one is a large tap target. |
| My Plans | Table with Open, Duplicate, Delete in the last column | Plan name as card title, the buttons below it. Delete still asks for confirmation. |
| Admin: Activity Categories | List on the left, edit form on the right | List first, form below. Editing a category scrolls to the form. |
| Admin: Service Status / Users | Tables | Cards with the status as a word ("✓ Available", "✗ Unavailable") |

**4. Intentional exceptions**

There are no horizontal-scroll data views. The hourly forecast is the
widest table, so it turns into cards on mobile instead of scrolling. If
you later add a full-day forecast overview with many columns, state it
here as an exception.

**5. Testing the responsive rules**

- Check the main workflow (Plan Setup to Schedule Overview) at 1280 px,
  768 px, 390 px and 320 px.

- No horizontal scrollbar appears at any of these widths.

- Zooming the page to 200% (and 400% on a 1280 px screen) keeps all
  content readable and usable.

- Both keyboard and touch can complete the whole flow.

## 9. Including Basic Accessibility Requirements

The design must consider readable labels, keyboard-accessible controls,
meaningful button names, clear content hierarchy, semantic structure,
and validation that is not communicated only by colour.

Accessibility decisions made here should later be reflected in the
implementation.

**Example:** Use a visible “Delete task” button label and an associated
accessible name instead of an unlabeled trash-can icon that can only be
understood visually.

1.  Labels and form fields

| Rule | Design decision |
|----|----|
| Every input has a visible label | Labels sit above the field, never only as placeholder text. Required fields end with \*, and the form explains "\* = required". |
| Hints and errors are linked to their field | The hint and error text are connected to the input (aria-describedby), so a screen reader reads them with the field. |
| Related inputs are grouped | The date chips and the activity settings are each a labelled group (fieldset with a legend, or a named region). |
| Checkboxes and radio options | A label can be clicked as well as the box itself. Radio groups (the alternatives) have a group label. |

1.  Keyboard use

| Rule | Design decision |
|----|----|
| All controls work with the keyboard | Links, buttons, menu, tabs, chips, table row actions and the progress bar can be reached with Tab and used with Enter or Space. |
| Logical tab order | The order follows the visual order: menu, then the page content, then the buttons. |
| Visible focus | The focused item has a clear outline (at least 2 px) that is never removed. |
| Skip link | A "Skip to main content" link is the first focusable item on every page. |
| Dialogs | The delete and suspend confirmations trap focus inside, close with Esc, and return focus to the button that opened them. |
| Mobile menu | Opens and closes with the keyboard, and focus moves into the list when it opens. |
| No keyboard traps | The user can always leave a control with the keyboard. |

2.  Names and wording for controls

| Rule | Design decision |
|----|----|
| Meaningful button names | Buttons say what they do: "Save plan", "Remove Picnic", "Delete my account". |
| No icon-only buttons | Every icon button has a visible text label. If an icon is ever used alone, it gets an accessible name. |
| Repeated actions are distinguishable | In tables, "Open", "Duplicate" and "Delete" get a hidden suffix with the plan name for screen readers, e.g. "Delete Weekend in Kaunas". |
| Links describe their target | "View all plans", not "Click here". |
| Decorative symbols | ✓ ✗ ★ ⚠ ℹ are always followed by words, so the meaning never depends on the symbol. |

3.  Structure and semantics

| Rule | Design decision |
|----|----|
| One h1 per page | The page title in the wireframe. Sections use h2, sub-sections h3, with no skipped levels. |
| Landmarks | Each page has header and nav (top bar), main and, if used, footer. The breadcrumbs sit in a nav named "Breadcrumb". |
| Real tables for tabular data | Schedules, forecasts and lists use proper table markup with header cells. On mobile, the card layout keeps the "Label: value" text, so the meaning is the same. |
| Current page marked | The active menu item and the current breadcrumb use aria-current, in addition to bold and underline. |
| Page title | The browser tab title names the screen, e.g. "Schedule Overview - Spėk laiku". |
| Language | The page declares its language (lang). |

4.  Errors, warnings and status messages

| Rule | Design decision |
|----|----|
| Errors not shown by colour alone | Each error starts with "Error:" and sits beside its field. |
| Error summary | After a failed submit, focus moves to the first invalid field. Forms with several errors also show a short list at the top, with links to each field. |
| Status updates are announced | Loading, success and service-error messages appear in a live region (role="status" or role="alert" for errors), so a screen reader reads them without moving focus. |
| Suitability is not only a colour | Hourly forecast and schedule slots use ★ Suitable, ✓, ✗ Unsuitable, with the reason in words (NFR-010). |
| Banners stay until dismissed | They do not disappear by themselves, so there is enough time to read them. |
| Timeouts | If the session is about to expire, the user is warned and can continue. |

5.  Visual design

| Rule | Design decision |
|----|----|
| Color contrast | Normal text has a contrast ratio of at least 4.5:1, large text and interface borders at least 3:1. |
| Text size | Body text at least 16 px, resizable to 200% without losing content. |
| Spacing and targets | Touch targets are at least 44 × 44 px on mobile. Rows and buttons have enough space to avoid accidental taps. |
| Motion | No automatic animation. If a spinner is used, it also has the loading text. |
| Reading level | Messages use short, plain sentences and say what to do next. |

## 10. Tracing Wireframes to Requirements

Connect major screens and flows to requirements from Independent Work 1.
If a wireframe introduces new behaviour, update the requirements before
implementation.

Do not silently add product functionality only through a design mock-up.

**Example:** If the wireframe adds “Archive task” but no functional
requirement exists for archiving, create a new FR requirement and update
the scope before development.

Each major screen and flow is traced to requirements from Independent
Work 1. Behaviors that the design introduced was added to Independent
Work 1 as new requirements before implementation.

**Screens to requirements**

| Screen | Requirements |
|----|----|
| Register | FR-001, FR-002, FR-045 |
| Log in | FR-003, FR-040 |
| Home | FR-006, FR-021 |
| Plan Details / Edit | FR-022, FR-034 |
| Plan Setup | FR-035, FR-046, FR-007 |
| Activity Selection | FR-006, FR-008, FR-011 to FR-014, FR-016, FR-037 |
| Places and Forecast | FR-009 to FR-015, FR-036 |
| Schedule Overview | FR-017 to FR-019, FR-034 to FR-036, FR-047 |
| Plan Problems and Alternatives | FR-033, FR-048 |
| My Plans | FR-020, FR-021, FR-023, FR-024, FR-025 |
| Admin: Activity Categories | FR-027, FR-028, FR-044 |
| Admin: Service Status | FR-030, FR-043 |
| Admin: User Accounts | FR-029, FR-039, FR-042 |
| Account Suspended | FR-041 |

**Flows to requirements**

| Flow                   | Requirements                                     |
|------------------------|--------------------------------------------------|
| Flow 1: Registration   | FR-001, FR-002, FR-045                           |
| Flow 2: Login          | FR-003, FR-004, FR-040, FR-041                   |
| Flow 3: Create plan    | FR-006 to FR-019, FR-035, FR-036, FR-046, FR-047 |
| Flow 4: Save plan      | FR-020, FR-025, FR-038                           |
| Flow 5: Recalculate    | FR-033 to FR-036, FR-047, FR-048                 |
| Flow 6: Admin category | FR-027, FR-028, FR-044                           |

**Requirements introduced or refined by the wireframes**

The wireframes introduced or refined the following behaviours. Their
traceability is recorded using the authoritative requirement IDs from
Independent Work 1. Any genuinely new requirement was added to
Independent Work 1 before implementation.

| ID | New requirements | Introduced By |
|----|----|----|
| FR-022 | Edit own saved plans | Plan Details / Edit |
| FR-033 | Detect plan problems after a forecast change | Plan Problems and Alternatives |
| FR-034 | Recalculate saved plan with latest forecast. | Plan Details / Edit |
| FR-035 | Calculate travel distance and enforce maximum | Plan Setup / Schedule |
| FR-036 | Flag an activity as unscheduled, with the reason | Places and Forecast |
| FR-037 | Change duration and weather limits inside a plan | Activity Selection |
| FR-038 | Keep a visitor's plan when they log in or register | Schedule Overview |
| FR-039 | Confirm before deleting a plan or account, or suspending an account | My Plans, Admin: User Accounts |
| FR-040 | Redirect after login by role and to the requested page | Log in |
| FR-041 | Block suspended users and explain why | Account Suspended |
| FR-042 | Administrator reactivates and deletes accounts | Admin: User Accounts |
| FR-043 | Administrator views recent service errors | Admin: Service Status |
| FR-044 | Administrator defines map place tags per category | Admin: Activity Categories |
| FR-045 | Password minimum + confirmation | Register |
| FR-046 | Location in Lithuania from search results; 1 to 7 valid dates | Plan Setup |
| FR-047 | Display forecast weather for each scheduled activity | Schedule Overview |
| FR-048 | Suggest alternatives and accept/reject | Plan Problems and Alternatives |
| NFR-012 | Text contrast of at least 4.5:1 (3:1 for large text and components) | Section 9 |
| NFR-013 | Loading, success and error messages announced to assistive technology | Section 9 |
| NFR-014 | One main heading, a page title and a skip link on every page | Section 9 |
| NFR-015 | Validation errors as text next to the field, linked to it | Sections 5 and 9 |
| NFR-016 | Inactive session ends after 30 minutes | Section 9 |
