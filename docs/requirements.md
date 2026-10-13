Independent Work 1 – Project Vision, Scope and Requirements
Specification

## Objective

Define what application will be developed, why it is needed, who will
use it, and what the system must do. At this stage, focus primarily on
the problem and required behavior, not implementation details. The main
output is the initial project requirements documentation.

## Required Result

Another person must be able to understand what the project is supposed
to achieve without opening the source code.

## 1. Defining the Project

Create a clear project title and a short project description of
approximately 100–200 words.

The description must explain **what the application is, what problem it
solves, who will use it, and what main value it provides**. Do not use
the technology stack as the project purpose.

**Example:** Instead of “This is an application made using .NET and
React,” write “The application helps university students organize
assignment deadlines, track progress, and identify overdue work.”

,,Spėk laiku” will be a planning application, which checks out for
activities in Lithuania for 1 or more days. Users will be able to create
an activity list, like visiting heritage sites outdoors, picnics, or
indoor activities and then it will specify acceptable weather
conditions.

The system receives an hourly weather forecast and categories of nearby
locations, then evaluates suitable time intervals based on rules
regarding rain, wind, temperature, daylight, and distance. If the
forecast changes, the plan can be recalculated and alternatives can be
proposed.

The application will be used by people in Lithuania, which primarily
targets a family or a group of people to participate in activities.

It will encourage people to go explore Lithuania more and while also
giving them a good time to try out activities.

## 2. Defining the Problem Statement

Describe the problem that currently exists before proposing the
implementation. Explain what users have difficulty doing, why the
problem matters, how the problem is currently handled, and which
limitations exist in the current approach.

The problem statement should be concrete enough that another person can
understand why the application is worth building.

**Example:** Students currently track deadlines across messages,
learning platforms, and personal notes. Because the information is
fragmented, tasks can be overlooked and progress is difficult to see in
one place.

Families and groups in Lithuania find it hard to decide when to do each
activity. Take a family that wants to go kayaking, cycle to a castle and
have a picnic over a weekend. For each activity they must work out which
hours have acceptable rain, wind and temperature, whether it will still
be light, and whether the place is close enough. Doing this for several
activities across several days is slow, and it is easy to get wrong.

A weekend is a limited resource, and a poorly timed outing can be
cancelled or spoiled by weather that was foreseeable. When planning is a
hassle, people default to the same indoor options or stay home, and
nearby outdoor and heritage sites go unvisited.

At present, people handle the problem by hand. They check a weather app
for the forecast, use a map application or search engine to find places,
look up sunrise and sunset separately, read tourism sites for ideas and
settle the plan in a group chat, then compare everything in their heads.

The information is scattered across tools that are not linked to one
another, and weather apps report conditions without saying whether they
suit a particular activity, so a breeze that is fine for a picnic may be
unsafe for kayaking.

## 3. Identifying Target Users and User Roles

Identify the people who will use the application. For every user type
describe the role name, main goal, actions the user needs to perform,
data the role may access, and actions the role must not be allowed to
perform.

Do not create separate roles if they have exactly the same permissions
and responsibilities.

- Possible roles include Visitor, Registered User, Administrator,
  Manager, Teacher, or Student.

**Example:** Registered User: can create and manage only their own
tasks. Administrator: can manage user accounts but does not
automatically own users’ personal tasks.

**Visitor (if they didn’t log into their account)**

Make the application easily accessible, where u can get a weather-based
plan without creating an account.

**Actions:**

- Choosing a location and dates

- Add activities from the predefined categories and set weather
  preferences.

- View the hourly forecast, nearby places.

- Recalculate a plan during the session.

**Data access:**

Public data (weather forecast, map places, predefined activity
categories and their defaults), and the temporary plan of their own
current session.

**Not allowed to perform:**

- Save plans permanently or reopen them later.

- Access or view any other user's plans.

- Share or export plans.

- Access any administration function.

- Can view recommendations.

- Can’t save plans.

**Registered User (logged in)**

They can plan activities for their family or group, save the plans and
adapt them when the forecast changes.

**Actions:**

- Everything a Visitor can do.

- Create, save, edit, duplicate and delete their own plans.

- Share a plan with others (link or invitation) and choose whether
  recipients can only view it or also vote (voting is an optional
  extension).

- Manage their own profile and delete their account.

**Data accessed:**

Their own plans, saved preferences and profile, shared plans, votes, the
same public data.

**Not allowed to perform:**

- View, edit or delete another user's private plans.

- See system-level data such as API usage or other users' account
  information.

- Manage other user accounts.

**Administrator**

Keeps the system running correctly and makes sure the shared content is
accurate, without acting as a user.

**Actions:**

- Manage the predefined activity categories, their default weather
  preferences and their mapping to place categories in map data.

- Manage user accounts (suspend, reactivate, delete on request).

- Monitor the availability and status of the weather and map data
  services, and the error logs.

**Data accessed:**

Account details needed for administration (such as account status and
registration date), system settings and logs, and aggregated statistics.

**Not allowed to perform:**

- Read, edit or delete users personal plans, custom activities or saved
  preferences by default.

- See users passwords.

- Create plans or vote on behalf of a user.

## 4. Defining the Project Goals

Create 3–7 project goals. Goals must describe user or business outcomes,
not implementation technologies.

A project goal should help later decide whether a proposed feature
belongs in the project.

**Example:** Good: “Allow users to manage their personal tasks.” Bad:
“Use PostgreSQL” or “Create five controllers.”

1.  Allow users to create and manage plans for activities.

2.  Help users find a suitable activity based on their location, time
    and activity types.

3.  Let registered users be able to invite other users to their plan and
    let them be able to vote.

4.  Allow registered users to save their own plans.

5.  Allow registered users to manage their own profile.

6.  Let made plans be evaluated by weather activity.

7.  Allow rescheduling activities and suggesting alternatives when
    weather conditions change.

8.  Allow registered users to manage their personal preferences.

9.  Provide users with a clear overview of their complete plan.

## 5. Defining Project Scope

Create two clearly labelled sections: **In Scope** and **Out of Scope**.
In Scope lists functionality that will be implemented during the
project. Out of Scope explicitly lists functionality that will not be
implemented in the current version.

Use the scope to prevent uncontrolled growth of the project during
implementation.

**Example:** In Scope: registration, authentication, task creation, task
status management. Out of Scope: mobile application, payment processing,
real-time chat, external calendar synchronization.

**In Scope:**

- Activity plan creation for one or multiple days.

- Activity selection and management.

- Finding nearby places suitable for selected activities.

- Weather activity suitability evaluation.

- Scheduling activities based on weather, daylight, duration, and
  distance.

- Rescheduling activities and suggesting alternatives when weather
  conditions change.

- Collaborative planning, group voting.

- Registration.

- Profile customization.

- System that checks how much distance the person traveled and suggests
  a different place.

- Detecting problems in existing plans when the weather forecast
  changes.

- Administrator management of activity categories, user accounts and
  service status.

**Out of Scope:**

- Mobile application support.

- Navigation and turn-by-turn routing.

- Activity booking and payment processing.

- External calendar synchronization.

\
6. Defining the MVP
-------------------

Define the **Minimum Viable Product (MVP)** and categorize planned
functionality as Must Have, Should Have, or Could Have.

All Must Have functionality must be completed before significant time is
spent on optional functionality.

**Example:** Must Have: login and personal task management. Should Have:
filtering by status. Could Have: theme customization.

**Must Have:**

- Login and registration

- Activity plan creation for one or multiple days.

- Finding nearby places suitable for selected activities.

- Weather activity suitability evaluation.

- Scheduling activities based on weather, time, duration and distance.

- System that gives all activities in the user’s defined location.

- Distance traveled checker and reevaluation system.

- An administrator page.

- Display location’s name.

- Detect problems with an existing plan

- Selecting a location and dates for a plan.

- Flagging activities that cannot be scheduled, with the reason.

- Blocking features for suspended accounts.

**Should Have:**

- Rescheduling activities and suggesting alternatives when weather
  conditions change.

- Saving plans and editing them.

- Display weather information alongside scheduled activities.

- Administrator’s ability to delete accounts.

- Editing the duration and weather limits of an activity inside a plan.

- Keeping a visitor's plan when the visitor logs in or registers.

- Confirmation before deleting a plan or account, or suspending an
  account.

**Could Have:**

- Collaborative planning, group voting.

- Profile customization.

- Notifications about weather changes.

- Keeping users informed about changes.

## 7. Writing Functional Requirements

Create uniquely identified functional requirements using IDs such as
FR-001, FR-002, and FR-003.

Each requirement must describe one system behaviour, be understandable
without reading source code, be testable, and avoid vague words such as
easy, fast, good, or modern unless the term is made measurable.

Use **MUST** for mandatory requirements. The initial project should
normally contain approximately 10–30 functional requirements, depending
on project size.

**Example:** FR-002: The system MUST prevent registration when the email
address is already associated with another account.

**FR-001:** The system MUST allow a user to create an account using an
email address and password.

**FR-002:** The system MUST prevent account creation when the entered
email address is already associated with an existing account.

**FR-003:** The system MUST allow a registered user to log in using
their email address and password.

**FR-004:** The system MUST allow a registered user to log out of their
account.

**FR-005:** The system MUST allow a registered user to delete their own
account.

**FR-006:** The system MUST allow a Visitor or Registered User to select
activities from the available activity categories.

**FR-007:** The system MUST allow a Visitor or Registered User to select
one or more dates for a plan.

**FR-008:** The system MUST allow a Visitor or Registered User to remove
an activity from their current plan.

**FR-009:** The system MUST retrieve hourly weather forecast data for
the selected location and dates.

**FR-010:** The system MUST display the name and location of each
retrieved place.

**FR-011:** The system MUST determine whether a time interval satisfies
the temperature requirements of an activity.

**FR-012:** The system MUST determine whether a time interval satisfies
the precipitation requirements of an activity.

**FR-013:** The system MUST determine whether a time interval satisfies
the wind requirements of an activity.

**FR-014:** The system MUST exclude time intervals outside daylight
hours when an activity requires daylight.

**FR-015:** The system MUST identify time intervals that satisfy all
required weather conditions for an activity.

**FR-016:** The system MUST consider the specified duration when
assigning an activity to a time interval.

**FR-017:** The system MUST generate a schedule containing the selected
activities and their assigned time intervals.

**FR-018:** The system MUST display the generated schedule in
chronological order.

**FR-019:** The system MUST display the start time, end time, activity,
and location for each scheduled activity.

**FR-020:** The system MUST allow a Registered User to save their
current plan.

**FR-021:** The system MUST allow a Registered User to view their saved
plans.

**FR-022:** The system MUST allow a Registered User to edit their own
saved plans.

**FR-023:** The system MUST allow a Registered User to duplicate their
own saved plans.

**FR-024:** The system MUST allow a Registered User to delete their own
saved plans.

**FR-025:** The system MUST prevent a Registered User from modifying
another user's private plan.

**FR-026:** The system MUST prevent a Visitor from permanently saving a
plan.

**FR-027:** The system MUST allow an Administrator to create and modify
predefined activity categories.

**FR-028:** The system MUST allow an Administrator to configure default
weather requirements for an activity category.

**FR-029:** The system MUST allow an Administrator to suspend a
Registered User account.

**FR-030:** The system MUST allow an Administrator to view the status of
the external weather and map data services.

**FR-031:** The system MUST prevent an Administrator from viewing user
passwords.

**FR-032:** The system MUST prevent an Administrator from creating or
voting on a plan on behalf of a user.

**FR-033:** The system MUST detect when a scheduled activity no longer
meets its weather, daylight, overlap or distance rules after the
forecast is updated, and list each problem with its reason.

**FR-034:** The system MUST recalculate a saved plan with the latest
forecast when the user opens it or selects Recalculate.

**FR-035:** The system MUST calculate the travel distance between
consecutive activities, allow the user to set a maximum travel distance
for a plan between 1 and 200 km, and flag a plan that exceeds it.

**FR-036:** The system MUST flag an activity as unscheduled, with the
reason, when no place or no suitable time interval is found, instead of
removing it.

**FR-037:** The system MUST allow a user to change the duration and
weather limits of an activity inside a plan without changing the
category defaults.

**FR-038:** The system MUST keep a Visitor's current plan when the
Visitor logs in or registers during the same session.

**FR-039:** The system MUST ask for confirmation before a plan is
deleted, an account is deleted, or an account is suspended.

**FR-040:** The system MUST, after login, send a Registered User to the
home page, an Administrator to the service status page, and a suspended
user to the account suspended page, and MUST return the user to the page
they requested before logging in when applicable.

**FR-041:** The system MUST prevent a suspended user from using features
that need an active account and MUST explain why access is blocked.

**FR-042:** The system MUST allow an Administrator to reactivate and
delete user accounts.

**FR-043:** The system MUST allow an Administrator to view recent errors
from the weather and map services.

**FR-044:** The system MUST allow an Administrator to define, for each
activity category, the map place tags used to find nearby places.

**FR-045:** The system MUST reject passwords shorter than 8 characters
and MUST require the password to be entered twice during registration.

**FR-046:** The system MUST require a location in Lithuania chosen from
search results, and between 1 and 7 dates that are not in the past and
fall within the available forecast period.

**FR-047:** The system MUST display the forecast weather conditions for
each scheduled activity.

**FR-048:** The system MUST suggest alternatives for each detected plan
problem, and the user MUST be able to accept or reject each alternative.

## 8. Writing Non-Functional Requirements

Create non-functional requirements using IDs such as NFR-001, NFR-002,
and NFR-003.

Consider security, usability, performance, maintainability,
accessibility, reliability, compatibility, logging, and privacy.
Whenever possible, state a measurable or verifiable expectation.

**Example:** NFR-002: The application MUST provide a usable layout on
desktop and mobile screen sizes without requiring horizontal scrolling
for normal page content.

**NFR-001:** The application MUST display the main planning interface
within 3 seconds under normal network conditions.

**NFR-002:** The application MUST display the generated activity
schedule within 5 seconds after all required weather and location data
has been received.

**NFR-003:** The application MUST provide validation messages when the
user enters invalid or incomplete planning information.

**NFR-004:** The application MUST allow users to complete the core
planning workflow using standard keyboard navigation on supported
desktop browsers.

**NFR-005:** The application MUST use encrypted HTTPS connections for
communication between the client and server.

**NFR-006:** The application MUST NOT expose passwords or authentication
credentials in application logs.

**NFR-007:** The application MUST display an error message when the
weather service or map data service is unavailable instead of displaying
unverified or fabricated data.

**NFR-008:** The application MUST preserve a Registered User's saved
plan when a weather-data request fails during plan recalculation.

**NFR-009:** The application MUST provide form labels for all
user-editable fields used to create or modify a plan.

**NFR-010:** The application MUST provide sufficient visual distinction
between available, unsuitable, and selected time intervals without
relying on color alone.

**NFR-011:** The application MUST provide a usable layout on desktop and
on mobile.

**NFR-012:** The application MUST provide text contrast of at least
4.5:1 for normal text and 3:1 for large text and interface components.

**NFR-013:** The application MUST announce loading, success and error
messages to assistive technology without requiring the user to move
focus.

**NFR-014:** Every page MUST have one main heading, a descriptive page
title and a "Skip to main content" link.

**NFR-015:** Validation errors MUST be shown as text next to the
affected field and associated with that field for assistive technology.

**NFR-016:** An authenticated session MUST end after 30 minutes of
inactivity.

## 9. Defining Main Business Rules

Document rules that determine how the system behaves independently of a
specific user interface. Business rules are especially important because
they later become sources for validation and automated tests.

Use clear statements that identify who or what is affected by the rule.

**Example:** “Only the creator of a task may edit or delete that task.”
Another example: “A booking end date must be later than its start date.”

- Only a Registered User may permanently save a plan.

- Only the owner of a plan may edit or delete that plan.

- A Visitor's plan is available only during the current session.

- An outdoor activity requiring daylight must start after sunrise and
  end before sunset.

- An outdoor activity must not be scheduled when any of its required
  weather conditions are outside the accepted limits.

- Two activities in the same plan must not overlap.

- The start time of an activity at a different location must be later
  than the previous activity's end time plus the required travel time.

- An activity's scheduled time interval must be at least as long as its
  required duration.

- A suggested alternative activity must satisfy its weather and
  scheduling requirements.

- Only an Administrator may modify the default weather requirements of
  predefined activity categories.

- Only an Administrator may suspend or reactivate a Registered User
  account.

- A suspended Registered User may not access features requiring an
  active account.

- A Registered User may access only their own private plans.

- An activity for which no suitable place or time interval is found must
  be flagged as unscheduled and must not be silently removed from the
  plan.

- The distance between consecutive activities in a plan must not exceed
  the maximum travel distance set by the user.

- A Visitor's plan must be kept when the Visitor logs in or registers
  during the same session.

## 10. Identifying Main Data Entities

Create an initial list of important data concepts. For each entity give
its name and briefly describe its purpose.

Do not design the complete database schema yet; focus on identifying the
main business concepts.

**Example:** Task – represents a piece of work created by a user.
Category – groups tasks for filtering. User – represents an
authenticated account.

User - represents a registered account and stores information needed to
identify and manage the user.

Plan - represents a user's activity plan for one or multiple days.

Activity - represents an activity that a user wants to include in a
plan, such as cycling, kayaking, a picnic, or visiting a heritage site.

Activity Category - group activities by type, such as outdoor, indoor,
cycling, water activities, or cultural activities.

Place - represents a physical location where an activity can take place.

Weather Forecast - represents hourly weather conditions for a specific
location and time.

Weather Preference - represents the weather conditions accepted for a
particular activity, such as minimum temperature, maximum wind speed, or
maximum precipitation.

Scheduled Activity - represents an activity assigned to a specific date
and time within a plan, including its location and duration.

Travel Information - represents the estimated travel time or distance
between locations included in the plan.

Plan Recommendation - represents a suggested activity or time interval
that can replace or adjust an unsuitable planned activity.

Administrator - represents a user role responsible for managing
predefined activity categories, weather preferences, user accounts, and
system information.

## 11. Defining Assumptions, Constraints and Dependencies

Document known project assumptions, mandatory constraints, and external
dependencies. Separate assumptions from confirmed requirements.

Typical items include a required backend platform, internet dependency,
API usage limits, supported languages, hosting restrictions, and
required third-party services.

**Example:** Constraint: the backend must use ASP.NET Core. Dependency:
the application uses an external email provider. Assumption: only one
interface language will be supported in the first version.

**Assumptions:**

- The first version will primarily be used in Lithuania.

- The first version will use one interface language.

- Users will have an internet connection while creating or recalculating
  plans.

- A Visitor's temporary plan does not need to be restored after the
  browser session ends.

**Dependencies:**

- Open-Meteo API, required for hourly weather forecast data used to
  evaluate activity suitability.

- OpenStreetMap Overpass API, required for retrieving nearby places and
  activity-related map data.

- Activity recommendations depend on relevant places being available in
  the external map data.

- Schedule generation and weather-based recommendations depend on
  forecast data being available for the selected location and time.

**Constraints:**

- The application MUST use Open-Meteo as the external weather forecast
  API.

- The application MUST use the OpenStreetMap Overpass API for retrieving
  relevant geographic places.

- The server application MUST be developed using ASP.NET Core.

- The client application MUST be developed using react.

- The project MUST be developed using Visual Studio Community.

## 12. Creating the Initial README

Create or update README.md. At this stage it must contain the project
name, short description, problem statement, target users, major
functionality, project status, backend requirement, selected or planned
frontend, and links to project documentation.

The README will be continuously improved in later assignments; it is not
a one-time document.

**Example:** The README can include a “Project status: Requirements and
design phase” line and links to docs/requirements.md and the specs/
directory.

README.md

“Spėk laiku”, weather-based activity planner application

**Short description:**

A web application for families and groups to plan activities in
Lithuania for one or multiple days. The application considers weather
conditions, daylight, activity duration, and travel distance when
creating and adapting activity schedules.

**Problem statement planning:**

Outdoor and indoor activities for a family or group can require
combining information from multiple sources, including weather
forecasts, nearby places, available time, and travel distances. Weather
conditions may also change after a plan has been created.

The application aims to simplify this process by helping users create
activity plans and automatically identify suitable times and alternative
activities based on current weather forecasts and available locations.

**Target users:**

Visitor - can create a temporary activity plan without registering or
logging in.

Registered user - can create, save, edit, duplicate, and delete their
own activity plans.

Administrator - manages predefined activity categories, default weather
preferences, user accounts, and system information.

**Major functionality:**

Activity planning

Weather scheduling

Plan adaptation

Plan management

Administration

**Project status:**

Requirements and design phase.

(links to functional requirements and non-functional requirements)

**Backend requirements:**

The backend MUST be developed using ASP.NET Core.

**Frontend requirements:**

The Frontend MUST use react.

**Project Documentation**

1.  Project definition.

2.  Defined problem statement.

3.  Identified target users and user roles.

4.  Defined project goals.

5.  Defined project scope.

6.  MVP.

7.  Functional Requirements .

8.  Non-Functional Requirements.

9.  Business Rules.

10. Data Entities.

11. Assumptions, Constraints and Dependencies.
