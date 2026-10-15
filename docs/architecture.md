# Independent Work 3 - Software Architecture and AI Development Specification

## Objective

Define how the application will technically be built and establish a
structured Spec-Driven Development workflow for working with AI coding
assistants. The project uses Spec Kit. The constitution is created once
for the whole project; individual features then follow their own
specification and implementation cycle.

## Required Result

The project must have an explicit engineering constitution, a
non-duplicative AGENTS.md, and a repeatable AI-assisted workflow where
implementation begins from reviewed specifications rather than an
unrestricted prompt.

Answers 3 - Software Architecture and AI Development Specification

## 1. Selecting and Documenting the Technology Stack

The backend MUST use the **latest stable version of .NET and ASP.NET
Core available when the project is initialized**.

Select and document the frontend framework or technology, database,
ORM/data-access approach, testing frameworks, important libraries, and
external services.

Every major dependency must have a clear reason for being included. Do
not add a library only because an AI assistant suggested it.

**Example:** Frontend: React because the student needs a component-based
SPA. Data access: Entity Framework Core because the project uses a
relational database and needs migrations.

**Backend platform**\
The backend uses the latest stable version of .NET and ASP.NET Core
available when the project was initialized: .NET 10 (Long Term Support),
SDK version 10.0.401. Preview versions are not used.

**Technology stack**

| Area | Technology | Reason |
|----|----|----|
| Backend | ASP.NET Core Web API on .NET 10 (C#) | Required by the project rules, and the latest stable version. |
| Frontend | React with TypeScript, built with Vite | React is the project's chosen frontend. TypeScript catches mismatches between the frontend and the API's request and response types. |
| Frontend routing | React Router | The planning workflow has many pages, and the navigation rules need real routes and redirects. |
| Frontend styling | Plain CSS (CSS modules) | The wireframes are simple, so a UI library is not needed. |
| Database | PostgreSQL | The data (users, plans, activities, scheduled activities) is relational. It is free and runs the same on a developer machine, in Docker and in GitHub Actions. |
| Data access | Entity Framework Core with migrations (Npgsql provider) | Required by the project rules (no custom repository layer). Migrations keep schema changes in Git. |
| Authentication | ASP.NET Core Identity | Required by the project rules. No custom password handling. |
| Object mapping | AutoMapper | Required by the project rules for DTO and entity mapping. |
| Validation | Data annotations and checks in application services | The server validates all input (NFR-003). No extra validation library is needed. |
| External services | Open-Meteo forecast API, Open-Meteo geocoding API, OpenStreetMap Overpass API, called through HttpClient created by IHttpClientFactory | Open-Meteo and Overpass are mandatory. The geocoding API provides the location search for plan setup. |
| Caching and resilience | In-memory cache, plus timeouts on external calls | Reduces calls to public APIs and supports NFR-002, NFR-007 and NFR-008. |
| Logging | ILogger\<T\> with the built-in providers | Required by the project rules. Passwords and keys are never logged (NFR-006). |
| Backend tests | xUnit and Microsoft.AspNetCore.Mvc.Testing | Standard for ASP.NET Core. API tests also verify authorization rules. |
| Frontend tests | Vitest and React Testing Library | Works with Vite. Finding fields by label also checks accessibility (NFR-009). |
| Code quality | .NET analyzers and dotnet format; ESLint with the jsx-a11y plugin; Prettier | Enforces the code style and accessibility rules automatically. |
| Version control and CI | Git, GitHub and GitHub Actions | Required by the project rules. CI builds and tests each Pull Request. |
| Specification workflow | Spec Kit | Required by the course. |
| Development tools | Visual Studio Community (backend), Visual Studio Code (frontend, optional) | Visual Studio Community is a project constraint. |
| Local database setup | Docker Compose (PostgreSQL only) | Anyone can create the database with one command, which keeps the repository reproducible. |

## 2. Defining the Application Architecture

Create an architecture diagram showing at least the user, frontend,
backend/API, and database. Add external services if the project uses
them.

Define the responsibilities of the frontend, API layer,
business/application logic, data access/infrastructure, and database.
Business rules must not be hidden inside UI components or
database-specific code.

**Example:** A simple diagram may be “User → Frontend → ASP.NET Core API
→ Application Services → Database”, with an external email service
connected to the backend.

“Spėk laiku" consists of a React frontend and an ASP.NET Core REST API.
The frontend calls the API over HTTPS, controllers pass requests to
application services that contain the business rules, and the services
use Entity Framework Core to access the PostgreSQL database. The backend
also calls Open-Meteo and the OpenStreetMap Overpass API on behalf of
the frontend.

<img src="media/image1.png" style="width:6.79167in;height:3.39583in" />

**3. Defining the Repository Structure**

Document the expected project directory structure. Every major directory
must have a clear responsibility and the actual repository should follow
the documented structure.

The exact structure may differ from the example as long as it is
deliberate and understandable.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr>
<th>/<br />
├── backend/<br />
├── frontend/<br />
├── tests/<br />
├── docs/<br />
├── specs/<br />
├── .github/<br />
├── AGENTS.md<br />
└── README.md</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**Example:** backend/ contains ASP.NET Core source code, frontend/
contains the selected UI application, tests/ contains automated tests,
and specs/ contains feature specifications.

**Repository structure**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr>
<th><p>/<br />
/</p>
<p>├── backend/</p>
<p>│ ├── src/</p>
<p>│ │ └── SpekLaiku.Api/</p>
<p>│ │ ├── Controllers/</p>
<p>│ │ ├── Services/</p>
<p>│ │ ├── Clients/</p>
<p>│ │ ├── DTOs/</p>
<p>│ │ │ ├── Requests/</p>
<p>│ │ │ └── Responses/</p>
<p>│ │ ├── Mapping/</p>
<p>│ │ ├── Entities/</p>
<p>│ │ ├── Data/</p>
<p>│ │ ├── Migrations/</p>
<p>│ │ └── Program.cs</p>
<p>│ └── tests/</p>
<p>│ ├── SpekLaiku.UnitTests/</p>
<p>│ └── SpekLaiku.IntegrationTests/</p>
<p>├── frontend/</p>
<p>│ ├── src/</p>
<p>│ │ ├── pages/</p>
<p>│ │ ├── components/</p>
<p>│ │ ├── hooks/</p>
<p>│ │ ├── helpers/</p>
<p>│ │ ├── api/</p>
<p>│ │ ├── types/</p>
<p>│ │ └── tests/</p>
<p>│ └── package.json</p>
<p>├── specs/</p>
<p>├── docs/</p>
<p>├── .specify/</p>
<p>├── .github/</p>
<p>│ └── workflows/</p>
<p>├── AGENTS.md</p>
<p>├── README.md</p>
<p>└── .gitignore</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**Responsibility of each directory**

| Directory | Accessible by |
|----|----|
| backend/src/SpekLaiku.Api/ | The ASP.NET Core Web API project. |
| Controllers/ | Thin controllers: routes, HTTP status codes, authenticated user, calling services. No business rules. |
| Services/ | Application services with the business logic (suitability, scheduling, plan checks, plans, categories, accounts, service status). |
| Clients/ | HTTP clients for Open-Meteo (forecast and geocoding) and Overpass. Services use them through dependency injection. |
| DTOs/Requests/, DTOs/Responses/ | Request and response objects at the API boundary. Entities are never returned directly. |
| Mapping/ | AutoMapper profiles between entities and DTOs. They contain no business rules. |
| Entities/ | Database entity classes. |
| Data/ | ApplicationDbContext and entity configuration. |
| Migrations/ | EF Core migrations, committed in the same branch as the schema change. |
| Program.cs | Application startup: dependency injection, authentication, middleware, configuration. |
| backend/tests/SpekLaiku.UnitTests/ | Unit tests for services and business rules, without a database or network. |
| backend/tests/SpekLaiku.IntegrationTests/ | API tests against a test database, including authorization tests, with external services replaced by fake responses. |
| frontend/src/pages/ | One component per screen (Plan Setup, Schedule Overview, My Plans and so on). |
| frontend/src/components/ | Reusable interface parts (form fields, tables, banners, navigation). |
| frontend/src/hooks/ | Reusable React hooks, for example loading data. |
| frontend/src/helpers/ | Small framework-independent helper functions. |
| frontend/src/api/ | The single API client. Pages never call fetch directly. |
| frontend/src/types/ | TypeScript types that mirror the API's DTOs. |
| frontend/src/tests/ | Frontend tests. |
| frontend/package.json | Frontend dependencies and the lint, test and build scripts. |
| specs/ | Spec Kit feature specifications, one folder per feature (for example specs/001-user-registration/), with the plan and tasks. |
| docs/ | Project documents: requirements, UX design (flows and wireframes), architecture. |
| .specify/ | Spec Kit files, including the constitution. Generated by Spec Kit. |
| .github/workflows/ | GitHub Actions: backend and frontend CI. |
| AGENTS.md | Practical instructions for AI agents working in the repository. |
| README.md | Purpose, prerequisites, setup, startup, migrations, tests and configuration. |
| .gitignore | Excludes build output, dependencies, local settings and secrets. |

The actual repository follows this structure. A change to the structure
updates this section in the same Pull Request.

**(Make files like the tree)**

**4. Initializing Spec Kit**

Initialize Spec Kit in the repository using the supported integration
selected for the project. Verify that the generated files and
directories are created correctly.

Commit initialization as a separate change so the repository history
clearly shows when the specification workflow was introduced.

| chore(spec-kit): initialize specification workflow |
|----------------------------------------------------|

**Example:** After initialization, inspect the generated specification
directories before creating the first feature. Do not immediately ask
the AI to generate the complete application.

Spec Kit was initialized in the repository root with the Specify CLI
version 1.0.13 using the GitHub Copilot integration and the PowerShell
script type:

specify init . --integration copilot --script ps

After initialization I inspected the generated files:

- .specify/ was created. It contains the folders integrations, memory,
  scripts, templates and workflows, and the files init-options.json,
  integration.json and .gitignore.

- The Copilot command files were created in .github/skills/, one folder
  for each command (speckit-constitution, speckit-specify,
  speckit-clarify, speckit-plan, speckit-tasks, speckit-analyze,
  speckit-implement, and others), each with a SKILL.md file.

- The existing backend/, frontend/, docs/ and specs/ folders were not
  changed.

Initialization was committed on its own with the message
chore(spec-kit): initialize specification workflow, after the repository
structure (chore: add repository structure) and the README and
.gitignore (chore: add README and gitignore). No application code was
generated at this stage. The first feature is created only after the
project constitution exists.

<img src="media/image2.png" style="width:5.72708in;height:3.92801in" />

## 5. Creating the Project Constitution

Create the constitution before feature implementation. The constitution
defines **stable project-wide engineering principles** and MUST NOT
describe one individual feature.

The constitution must contain explicit principles covering code quality,
application architecture, testing, security, version control,
documentation, AI-assisted development, and simplicity/maintainability.

Use enforceable language such as **MUST**, **MUST NOT**, or justified
**SHOULD**. Avoid vague principles such as “code should be good.”

The constitution must also explain how it may be changed, how changes
are versioned, how compliance is checked, and when exceptions are
allowed.

**Required companion file - \`AGENTS.md\`:** create a root-level
AGENTS.md for practical AI-agent instructions. It MUST NOT duplicate the
constitution. Instead, it should reference the constitution and explain
how an AI agent should work in this repository.

AGENTS.md should include the repository map, important setup/build/test
commands, feature workflow, where specifications are stored, how an
agent verifies changes, which generated or sensitive files it must not
edit/commit, and any repository-specific conventions needed to complete
work safely.

If a rule already exists in the constitution, AGENTS.md should normally
reference it instead of copying the complete rule. The constitution
answers **“What principles govern this project?”** while AGENTS.md
answers **“How should an AI agent operate inside this repository?”**.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr>
<th># AGENTS.md (example structure)<br />
<br />
## Project map<br />
- backend/: ASP.NET Core application<br />
- frontend/: user interface<br />
- specs/: feature specifications<br />
<br />
## Required references<br />
- Follow the project constitution in
.specify/memory/constitution.md.<br />
<br />
## Common commands<br />
- dotnet restore<br />
- dotnet build<br />
- dotnet test<br />
- &lt;frontend install/test/build commands&gt;<br />
<br />
## Working rules<br />
- Start each feature from updated main.<br />
- Work only in the feature branch for the active spec.<br />
- Review the diff and run required checks before suggesting a
commit.<br />
- Never add secrets or local environment files.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**Example:** Constitution rule: “Business logic MUST NOT be implemented
in API controllers.” AGENTS.md should not repeat the whole principle; it
can say “Follow architecture principles from the constitution and place
new business rules in the application/service layer.”

The constitution is in .specify/memory/constitution.md (version 1.0.0,
ratified 2026-10-05). It was created once for the whole project with
/speckit-constitution and does not describe any individual feature. It
has eight core principles written with MUST / MUST NOT language:

1.  **Code quality:** SOLID, DRY, KISS and YAGNI. A production C# class
    MUST NOT exceed 200 lines. Naming conventions are fixed, and generic
    names such as Manager or Helper MUST NOT be used. Formatting and
    static analysis (.editorconfig, .NET analyzers, ESLint, Prettier)
    MUST pass.

2.  **Application architecture:** Controllers MUST stay thin. Business
    rules and queries MUST be in application services. No custom
    repository layer over EF Core. Dependencies come through dependency
    injection. External services (Open-Meteo, Overpass) are called only
    through backend clients. Entities MUST NOT be returned from the API,
    only DTOs mapped with AutoMapper. Every schema change is an EF Core
    migration committed in the same branch.

3.  **Testing (non-negotiable):** Every feature MUST have backend and
    frontend tests. Every protected operation MUST have an authorization
    test. Tests MUST be deterministic, with external services replaced
    by fake responses. Tests MUST NOT be disabled or weakened to pass
    CI.

4.  **Security:** ASP.NET Core Identity MUST be used, with no custom
    password hashing. Authorization MUST be enforced on the backend, and
    all input validated on the server. Secrets MUST NOT be committed or
    logged. HTTPS and restricted CORS are required. Errors are handled
    centrally, with no stack traces shown to users. OWASP risks are
    considered.

5.  **Version control:** One branch per feature, from an updated main.
    Pull Requests are required. Commits follow Conventional Commits and
    are logical steps. The diff is reviewed before every commit. Merged
    branches are deleted.

6.  **Documentation:** The specification comes before code. The README
    stays current. Documentation changes are in the same Pull Request as
    the code.

7.  **AI-assisted development:** A specification, plan and tasks MUST
    exist before AI implementation. The student is responsible for all
    AI output. Every Pull Request gets a separate recorded AI review.
    AGENTS.md MUST reference the constitution instead of copying it.

8.  **Simplicity and maintainability:** The simplest design is
    preferred. No speculative features. Every dependency needs a written
    justification. A fresh clone MUST build and pass tests by following
    the README.

The constitution also contains additional constraints (technology
baseline, external data, accessibility, repository structure) and a
development workflow with quality gates.

**Governance:**

- *Amendments:* only through a Pull Request that states the reason and
  updates the version and the Last Amended date.

- *Versioning:* MAJOR for removing or redefining a principle, MINOR for
  adding a principle or materially extending one, PATCH for wording.

- *Compliance:* checked in every Pull Request by the author and the AI
  review, and in the consistency analysis before implementation.

- *Exceptions:* written in the feature plan with the rule, reason,
  smallest scope and date. They are never allowed for secrets handling,
  backend authorization or server-side validation.

**AGENTS.md**

AGENTS.md is in the repository root. It answers "how should an AI agent
work in this repository?" and refers to the constitution for the
principles instead of copying them. It contains:

- required references (the constitution, the General Project Rules, and
  approved specifications in specs/)

- a project map

- backend and frontend commands (dotnet restore/build/test/format, EF
  migration command, npm ci/lint/test/build, Docker Compose for
  PostgreSQL)

- the five-step feature workflow

- a pre-commit verification checklist

- files an agent must not edit or commit (secrets, build output, merged
  migrations, .specify/, the constitution)

- repository conventions (file naming, no direct fetch in pages, new
  business rules go in Services/, DTOs only, faked external calls in
  tests)

- actions an agent must not perform (generate the whole app at once, add
  unjustified packages, commit to main, force-push, weaken tests)

## 6. Breaking the Application into Features

Create a list of independently implementable features. A feature should
deliver a coherent piece of user value and be small enough to specify,
implement, review, and test separately.

Do not use technical layers such as Backend, Database, Controllers, or
Frontend as feature names.

**Example:** Good features: User Registration, User Login, Task
Creation, Task Editing, Task Search. Bad features: Database,
Controllers, Frontend.

| \# | Feature (branch name) | User value | Requirements | Priority | Depends on |
|----|----|----|----|----|----|
| 001 | User Registration (001-user-registration) | A visitor creates an account. | FR-001, FR-002, FR-046 | Must | none |
| 002 | User Login and Logout (002-user-login) | A user signs in and out and lands on the right page for their role. | FR-003, FR-004, FR-041 | Must | 001 |
| 003 | Activity Category Management (003-activity-categories) | An administrator defines the categories and default weather limits. | FR-027, FR-028, FR-044 | Must | 002 |
| 004 | Plan Location and Dates (004-plan-location-dates) | A user chooses a place in Lithuania and the days to plan. | FR-007, FR-046 | Must | none |
| 005 | Activity Selection and Limits (005-activity-selection) | A user picks activities and sets their weather limits and duration. | FR-006, FR-008, FR-011 to FR-014, FR-016, FR-038 | Must | 003, 004 |
| 006 | Hourly Forecast (006-hourly-forecast) | A user sees which hours suit each activity. | FR-009, FR-015 | Must | 004, 005 |
| 007 | Nearby Places (007-nearby-places) | A user sees places for each activity, and what to do when none is found. | FR-010, FR-037 | Must | 004, 005 |
| 008 | Schedule Generation (008-schedule-generation) | A user gets a schedule that fits the weather, daylight and activity durations. | FR-017 to FR-019, FR-037, FR-048 | Must | 006, 007 |
| 009 | Travel Distance Check (009-travel-distance) | The schedule respects the maximum distance between activities. | FR-037 | Must | 008 |
| 010 | Save and View Plans (010-save-view-plans) | A user saves a plan, including a visitor's plan after login, and sees it later. | FR-020, FR-021, FR-025, FR-039 | Should | 002, 008 |
| 011 | Plan Management (011-plan-management) | A user edits, duplicates and deletes their own plans. | FR-022 to FR-024, FR-032, FR-040 | Should | 010 |
| 012 | Plan Problem Detection (012-plan-problems) | A user is told when a forecast change breaks a plan, with the reason. | FR-033, FR-035 | Must | 010 |
| 013 | Alternative Suggestions (013-alternatives) | A user gets alternatives for a problem and accepts or rejects them. | FR-048 | Should | 012 |
| 014 | Administrator Account Access Management (014-admin-accounts) | An administrator manages user account status. The MVP supports suspending and reactivating accounts and blocking suspended users. Account deletion is a Should Have capability and may be implemented after the MVP. | FR-029, FR-041, FR-042 | Must | 002 |
| 015 | Service Status and Error Log (015-service-status) | An administrator checks the weather and map services and recent errors. | FR-030, FR-043 | Should | 006, 007 |
| 016 | Account Deletion (016-account-deletion) | A user deletes their own account and plans. | FR-005 | Should | 002, 010 |

## 7. Creating a Feature Specification with /speckit-specify

For each feature create a dedicated Spec Kit specification. The
specification describes **WHAT and WHY**, not detailed implementation
technology.

It should include the feature name, user stories, priorities, acceptance
scenarios, edge cases, functional requirements, success criteria,
important entities, assumptions, dependencies, and scope boundaries.

Functional requirements should use stable IDs such as FR-001. Success
criteria should be measurable and technology-independent.

**Example:** Prefer “An authenticated user can create a task and see it
in the task list” over “The React component calls the .NET endpoint.”

The specification contains:

- **Four user stories:** register with valid details (P1), understand
  and fix invalid details (P1), registration is not offered to signed-in
  users (P2), and register with keyboard, screen reader and on a phone
  (P2).

- **Acceptance scenarios** in Given-When-Then form for each story,
  including negative cases such as an invalid email, a short password,
  mismatched passwords and a duplicate email.

- **Edge cases:** emails that differ only by letter case, spaces around
  the email, over-long input, a double submit and a failure while
  creating the account.

- **Functional requirements** with stable IDs (FR-001 to FR-018), for
  example FR-005: " The system MUST allow a registered user to delete
  their own account.”

- **Measurable success criteria** (SC-001 to SC-006), for example
  SC-001: "A visitor who enters valid details can complete registration
  in under 1 minute."

- **Key entity:** User Account.

- **Assumptions, dependencies and scope boundaries.** Email
  confirmation, password reset and the login screens are out of scope.
  The feature has no dependencies, and features 002, 010 and 016 depend
  on it.

- **Two open questions** marked \[NEEDS CLARIFICATION\] (email
  confirmation, and whether to reveal that an email is already
  registered), which are resolved in the clarification step.

- **A traceability table** linking the specification to the project
  requirements (FR-001, FR-002, FR-046 and the related non-functional
  requirements).

## 8. Writing User Stories Correctly

Every significant feature specification should contain user stories.
Each story must identify the actor, user goal, value/reason, priority,
and an independent way to verify the behaviour.

Use priorities such as P1 for essential, P2 for important, and P3 for
optional/later.

**Example:** As an authenticated user, I want to create a task so that I
can keep track of work that I need to complete. Priority: P1.
Independent verification: a user can create one valid task and see it
after page reload.

**Feature 001 - User Registration**

The User Registration feature allows a Visitor to create an account in
the “Spėk laiku” application. The feature must provide clear validation
when registration information is invalid, prevent registration when the
user is already signed in, and support accessible registration using a
keyboard, screen reader, and mobile phone.

**US-001 - Register with valid details**

**User story:**

As a Visitor, I want to register an account using valid registration
details so that I can become a Registered User and access features that
require an account.

**Priority:** P1

**Independent verification:**\
A Visitor enters a valid email address, a password that satisfies the
password requirements, and matching password confirmation, submits the
registration form, and the account is successfully created.

**US-002 - Understand and fix invalid registration details**

**User story:**

As a Visitor, I want the registration form to clearly identify invalid
or missing information so that I can understand what is wrong and
correct my details before submitting the form again.

**Priority:** P1

**Independent verification:**\
A Visitor submits invalid registration information, such as an invalid
email address, a password that does not meet the requirements,
mismatched passwords, or an already registered email address, and the
application displays a clear validation message that allows the user to
correct the problem.

**US-003 - Registration is not offered to signed-in users**

**User story:**

As a Registered User, I want the application to prevent me from
accessing the registration process while I am already signed in so that
I do not attempt to create another account unnecessarily.

**Priority:** P2

**Independent verification:**\
A Registered User who attempts to access the registration page is
prevented from completing registration and is directed to the
appropriate authenticated part of the application.

**US-004 - Register using different input methods and devices**

**User story:**

As a Visitor, I want to complete registration using a keyboard, screen
reader, or mobile phone so that I can create an account regardless of
how I access the application.

**Priority:** P2

**Independent verification:**\
A Visitor can navigate and complete the registration form using keyboard
controls, the form provides meaningful information to a screen reader,
and the registration form can be completed on a mobile phone.

## 9. Writing Acceptance Scenarios

Important behaviour must have acceptance scenarios using **Given -
When - Then**. Include both successful and relevant negative cases.

Acceptance scenarios should describe observable behaviour, not internal
classes or methods.

**Example:** Given an authenticated user, when the user submits valid
task data, then the task is stored and displayed in the user’s task
list. Negative case: when a user attempts to edit another user’s task,
the operation is rejected.

**US-001 - Register with valid details**

**Scenario 1: Successful registration**

**Given** a Visitor is on the registration page and has entered a valid
email address, a password that satisfies the password requirements, and
matching password confirmation

**When** the Visitor submits the registration form

**Then** the account is created successfully and the Visitor becomes a
Registered User

**Scenario 2: Registration with an invalid email**

**Given** a Visitor is on the registration page and has entered an
invalid email address with an otherwise valid password

**When** the Visitor submits the registration form

**Then** the registration is rejected and a validation message
identifies the email as invalid

**Scenario 3: Registration with a password that is too short**

**Given** a Visitor has entered a valid email address and a password
shorter than the required minimum length

**When** the Visitor submits the registration form

**Then** the registration is rejected and a validation message explains
that the password does not meet the required length

**Scenario 4: Registration with mismatched passwords**

**Given** a Visitor has entered a valid email address, a valid password,
and a different password in the confirmation field

**When** the Visitor submits the registration form

**Then** the registration is rejected and a validation message indicates
that the passwords do not match

**US-002 - Understand and fix invalid registration details**

**Scenario 5: Missing required information**

**Given** a Visitor is on the registration page and one or more required
fields are empty

**When** the Visitor submits the registration form

**Then** the registration is rejected and the relevant fields display
clear validation messages

**Scenario 6: Visitor corrects invalid information**

**Given** a Visitor has submitted invalid registration information and
the application has displayed validation messages

**When** the Visitor corrects the invalid information and submits the
form again

**Then** the application accepts the corrected information if all
registration requirements are satisfied and creates the account

**Scenario 7: Duplicate email address**

**Given** an account already exists using the email address entered by
the Visitor

**When** the Visitor submits the registration form using that email
address

**Then** the registration is rejected and the Visitor is informed that
the registration cannot be completed with that email address

**US-003 - Registration is not offered to signed-in users**

**Scenario 8: Registered User attempts to access registration**

**Given** a Registered User is already signed in

**When** the Registered User attempts to access the registration page

**Then** the application does not allow the user to complete another
registration and directs the user to the appropriate authenticated area

**US-004 - Register using different input methods and devices**

**Scenario 9: Registration using keyboard navigation**

**Given** a Visitor is using a keyboard without a mouse

**When** the Visitor navigates through the registration form and submits
valid information

**Then** the Visitor can complete the registration process using
standard keyboard controls

**Scenario 10: Registration using a screen reader**

**Given** a Visitor is using a screen reader

**When** the Visitor navigates through the registration form

**Then** the form fields, controls, instructions, and validation
messages provide meaningful information to the screen reader

**Scenario 11: Registration on a mobile phone**

**Given** a Visitor opens the registration page on a mobile phone

**When** the Visitor enters valid registration information and submits
the form

**Then** the registration form can be completed successfully without
requiring desktop-only interaction

## 10. Clarifying the Specification

Use the Spec Kit clarification stage before technical planning. Resolve
ambiguities related to feature scope, user roles, data, workflows,
security, errors, edge cases, and external dependencies.

Implementation should not begin while important unresolved clarification
markers remain, unless the instructor explicitly approves the
uncertainty.

**Example:** If the spec says “users can delete tasks” but does not
state whether completed tasks can be deleted, clarify that rule before
writing the implementation plan.

**1. Email Confirmation**

**Question**

Does the application require a newly registered user to confirm their
email address before the account can be used?

**Decision**

No. Email confirmation is out of scope for Feature 001 - User
Registration.

**Reason**

The current registration requirements only require the user to provide a
valid email address and password and successfully create an account.
Email verification is not defined as part of the approved registration
workflow.

**Result**

After successful registration, the user account is created without
requiring an email-confirmation step.

**Status:** Resolved

**2. Duplicate Email Message**

**Question**

Should the application explicitly tell a Visitor that the entered email
address is already registered?

**Decision**

**The application should provide a clear validation message explaining
that the registration cannot be completed because the email address
cannot be used for a new account.**

**Reason**

The user must understand what went wrong and how to correct the
registration information. This supports US-002, which requires users to
understand and fix invalid registration details.

**Result**

When a Visitor attempts to register using an email address that is
already associated with an account, registration is rejected and an
understandable validation message is displayed.

**Status:** Resolved

**3. Password Requirements**

**Question**

What password requirements must be satisfied during registration?

**Decision**

The password must be **at least 8 characters**. The Visitor must enter
the password twice, and both values must match.

**Result**

Registration is rejected when:

- the password contains fewer than 8 characters;

- the password confirmation does not match the password.

**Status:** Resolved

**4. Registration User Role**

**Question**

Who is allowed to use the registration feature?

**Decision**

Only a **Visitor** can register a new account.

A user who is already authenticated as a Registered User should not be
able to complete another registration.

**Result**

The registration workflow is available to Visitors. Registered Users are
redirected to the appropriate authenticated area instead of creating
another account.

**Status:** Resolved

**5. Required Registration Information**

**Question**

What information is required to register an account?

**Decision**

The registration process requires:

- Email address

- Password

- Password confirmation

All required information must be valid before the account can be
created.

**Result**

If required information is missing or invalid, registration is rejected
and the relevant validation information is displayed.

**Status:** Resolved

**6. Duplicate Submission**

**Question**

What should happen if the Visitor submits the registration form more
than once?

**Decision**

The application must prevent an accidental double submission from
creating multiple accounts.

**Result**

Repeated submission of the same registration request must not create
duplicate accounts.

**Status:** Resolved

**7. Registration Failure**

**Question**

What should happen if an unexpected failure occurs while creating the
account?

**Decision**

The account must not be presented as successfully created if the
registration operation fails.

**Result**

The Visitor receives an understandable error message and can attempt
registration again.

**Status:** Resolved

**8. Accessibility Clarification**

**Question**

What accessibility behaviour is required for the registration workflow?

**Decision**

The registration workflow must be usable with:

- standard keyboard navigation;

- a screen reader;

- a mobile phone.

Validation information must be understandable to users and associated
with the relevant form fields.

**Result**

Accessibility is part of the registration feature and is covered by
US-004 and its acceptance scenarios.

**Status:** Resolved

## 11. Creating the Technical Plan with /speckit-plan

The plan describes **HOW** the approved feature will be implemented.
Document the language/version, important libraries, frontend approach,
database/storage, testing approach, target platform, technical
constraints, relevant application structure, important components, API
changes, and data-model changes.

The plan must include a **Constitution Check**. If the proposed design
conflicts with a constitution principle, change the design or document
and obtain approval for a justified exception before implementation.

**Example:** If the plan proposes putting validation logic directly in a
controller while the constitution requires business rules in services,
the plan must be corrected before tasks are generated.

**1. Technology Stack**

The project uses the following technologies:

- **Backend:** ASP.NET Core Web API on .NET 10.

- **Frontend:** React with TypeScript using Vite.

- **Frontend routing:** React Router.

- **Database:** PostgreSQL.

- **Data access:** Entity Framework Core.

- **Testing:** Automated backend unit and integration tests, together
  with appropriate frontend tests.

The project specification requires ASP.NET Core for the backend and
React for the frontend.

**2. Feature Architecture**

The User Registration feature will follow the existing application
architecture.

The registration workflow will contain:

1.  A registration user interface in the React frontend.

2.  Client-side validation for immediately detectable input errors.

3.  A backend registration endpoint.

4.  Application/business logic responsible for validating registration
    rules.

5.  A user-account data model stored in PostgreSQL.

6.  Automated tests for successful and unsuccessful registration cases.

The technical implementation must preserve the separation between the
user interface, application logic, and data access.

**3. Frontend Implementation**

A dedicated registration page will provide fields for:

- Email address

- Password

- Password confirmation

The page will:

- provide clear labels for all fields;

- display validation messages next to the relevant fields;

- support keyboard navigation;

- provide meaningful information to screen readers;

- work on mobile phone screen sizes;

- prevent obvious invalid submissions where appropriate.

The frontend will communicate with the backend registration
functionality rather than creating accounts directly.

**4. Backend Implementation**

The backend will expose a registration operation that accepts the
required registration information.

The backend will be responsible for enforcing the registration rules,
including:

- valid email format;

- password minimum length of 8 characters;

- matching password confirmation;

- preventing duplicate email registration;

- creating the user account only when all required validation succeeds.

Backend validation is required even when equivalent validation exists in
the frontend so that the registration rules cannot be bypassed by
directly calling the backend.

**5. User Account Data**

The User Account is the main entity required by this feature.

The account must contain the information necessary to identify the
registered user and authenticate the account later.

The user's password must **not be stored as plain text**. A secure
password-hashing mechanism must be used before the password is stored.

The registration feature does not introduce additional entities that are
not required by the approved specification.

**6. API Behaviour**

The registration API will support the following observable behaviour:

**Successful request**

When valid registration information is submitted and the email address
is not already registered:

1.  The backend validates the request.

2.  A new user account is created.

3.  The password is stored securely rather than as plain text.

4.  The frontend receives a successful response.

5.  The user can continue as a Registered User.

**Invalid request**

When registration information is invalid:

1.  The backend rejects the request.

2.  The account is not created.

3.  The frontend displays an understandable validation message.

**Duplicate email**

When the submitted email address is already associated with an account:

1.  The registration request is rejected.

2.  No second account is created.

3.  The frontend displays an appropriate error message.

**7. Security**

Security requirements are applied to the registration workflow.

The implementation must:

- never store plain-text passwords;

- validate registration data on the backend;

- prevent duplicate accounts for the same email address;

- prevent unauthenticated manipulation of account-creation rules;

- avoid exposing sensitive account information unnecessarily.

The registration endpoint must not trust validation performed only by
the frontend.

**8. Accessibility**

The registration interface must support the accessibility requirements
defined for the feature.

The implementation will ensure that:

- form fields have meaningful labels;

- keyboard navigation can reach and operate all required controls;

- validation errors are presented as text;

- validation messages are associated with their relevant fields;

- screen-reader users can understand the registration workflow;

- the interface remains usable on mobile devices.

These requirements correspond to the accessibility expectations already
identified in the project documentation.

**9. Error Handling**

The registration feature must handle both expected validation errors and
unexpected failures.

**Expected errors**

Examples include:

- invalid email;

- missing required information;

- password shorter than 8 characters;

- mismatched passwords;

- duplicate email address.

These errors should be presented clearly to the user.

**Unexpected errors**

If account creation fails because of an unexpected server or database
problem:

- the account must not be reported as successfully created;

- the user should receive an understandable error message;

- sensitive technical information must not be exposed to the user.

**10. Testing Plan**

The feature must include automated tests covering both successful and
unsuccessful behaviour.

**Backend unit tests**

Tests should cover:

- valid registration;

- invalid email;

- password shorter than 8 characters;

- mismatched passwords;

- duplicate email;

- missing required information.

**Backend integration tests**

Integration tests should verify that:

- a valid registration creates a user account;

- invalid registration does not create an account;

- duplicate email registration is rejected;

- the stored password is not plain text.

**Frontend tests**

Frontend testing should verify:

- registration fields are displayed;

- validation messages are displayed correctly;

- invalid input prevents an appropriate submission;

- successful registration is handled correctly.

**Accessibility checks**

The registration page should also be checked for:

- keyboard navigation;

- meaningful form labels;

- validation-message association;

- screen-reader usability;

- mobile layout.

**11. Data and Database Changes**

The User Registration feature requires storage for user accounts.

The database must support:

- a unique identifier for each user account;

- a unique email address;

- securely stored password information;

- any other account information required by the existing User Account
  entity.

A unique database constraint should be used for the email address so
that duplicate accounts cannot be created through concurrent requests.

**12. Dependencies**

The feature depends on:

- the existing project backend;

- the existing React frontend;

- the PostgreSQL database;

- the project's authentication/account model.

The feature does not require email confirmation because that
functionality was explicitly clarified as out of scope.

**13. Constitution Check**

Before implementation, the technical plan must be checked against the
project constitution and general project rules.

The plan satisfies the relevant principles by:

- keeping business logic outside the UI;

- using the approved ASP.NET Core and React architecture;

- including automated tests;

- protecting passwords;

- keeping the feature within its approved scope;

- avoiding unnecessary dependencies;

- supporting accessibility;

- keeping the specification separate from implementation details.

The project rules require a Constitution Check during technical
planning.

**14. Out-of-Scope Technical Work**

The following will not be implemented as part of Feature 001:

- email confirmation;

- password reset;

- social-media authentication;

- two-factor authentication;

- changing an existing user's email;

- login functionality.

These features may be addressed by separate features if they are
included in the project scope later.

**15. Implementation Readiness**

Feature 001 - User Registration is ready for implementation after:

1.  The user stories have been reviewed.

2.  Acceptance scenarios have been defined.

3.  Specification ambiguities have been resolved.

4.  This technical plan has been reviewed against the project
    constitution.

5.  The implementation tasks have been created and linked to the
    relevant user stories.

The implementation should not begin until the specification, technical
plan, and task list are sufficiently consistent.

## 12. Reviewing Supporting Design Artifacts

When relevant, review the planning artifacts generated for the feature,
such as research.md, data-model.md, API/interface contracts, and
quickstart.md.

AI-generated architectural decisions remain suggestions until the
student inspects and accepts them.

**Example:** If data-model.md introduces a many-to-many relationship
that was not needed by the specification, question and simplify it
before implementation.

**1. Research review (research.md)**

**What was checked:** Every technical decision in research.md was
compared with the approved stack and the constitution.

Findings:

- Account creation and password hashing must use ASP.NET Core Identity
  (UserManager), as the stack and constitution require. No custom
  hashing code is allowed. Any "hash the password manually" wording in
  the plan or tasks is replaced with "use Identity".

- No new libraries beyond the approved stack are introduced. Every
  dependency has a reason.

- The duplicate-email approach relies on a database unique index as the
  final guard against concurrent requests, not only an application-level
  check.

**Review result:** Accepted after correcting the password-hashing
wording to refer to Identity.\
**Status:** Accepted with changes.

**2. Data model review (data-model.md)**

**What was checked:** Entities, fields, constraints and relationships
against the specification's single key entity, User Account.

**Findings:**

- The only entity is the User Account, implemented by extending
  Identity's user type, stored in the Identity users table.

- Required data: unique identifier, email, normalized email and password
  hash. No plain-text password field exists.

- A **unique index on the normalized email** is required, so addresses
  that differ only by letter case count as duplicates (spec edge case).

- No extra tables, roles or relationships are needed for this feature.
  Role assignment (Visitor/Registered User/Administrator) is handled by
  the later login/admin features.

**Review result:** Consistent with the specification. No many-to-many
relationships or speculative fields were found.\
**Status: Accepted**

**3. API contract review (contracts/)**

**What was checked:** Request and response behaviour against the
acceptance scenarios and clarification decisions.

| Case | Expected observable behaviour |
|----|----|
| Valid registration | Success response; account created; user can continue as a Registered User |
| Invalid or missing fields (Scenarios 2 to 5) | 400 response with field-level error messages; no account created |
| Duplicate email (Scenario 7) | Rejected with a clear message that does not expose unnecessary account details; no second account |
| Unexpected failure | Generic 500 response with a safe message and no technical details; account not reported as created |

**Findings:**

- The contract contains one operation only (register). No unnecessary
  endpoints.

- Request fields are email, password and password confirmation. The
  contract uses DTOs, and the entity is never returned.

- Email is trimmed and compared case-insensitively before the duplicate
  check (spec edge cases).

- Password alignment is resolved: the project requirement is at least 8
  characters, with confirmation entered twice. No additional
  128-character project requirement is introduced.

**Review result:** Consistent with the user stories and acceptance
scenarios after the password-length rule is aligned.\
**Status: Accepted with changes**

**4. Frontend design review**

**What was checked:** The registration page against US-001 to US-004.

**Findings:**

- One page (e.g. frontend/src/pages/RegisterPage) with email, password,
  confirmation and a submit button, calling the backend only through the
  single API client in frontend/src/api/.

- Every input has a label. Error text appears next to its field and is
  linked to it (aria-describedby).

- The submit button is disabled while a request is in progress, which
  covers the double-submit clarification. The server-side duplicate
  protection still applies.

- A signed-in user who opens the page is redirected, which covers
  Scenario 8.

- Layout works on a phone-sized screen.

**Review result:** Supports all four user stories. No extra interface
functionality is needed.\
**Status: Accepted**

**5. Security review**

**Findings:**

- Passwords are hashed by Identity and never stored or logged in plain
  text.

- All validation is repeated on the backend. The frontend is never
  trusted.

- Error responses reveal no stack traces or database details.

- The duplicate-email message is an accepted trade-off. It tells the
  visitor the address cannot be used (needed for US-002) but should not
  show account details. Note that this lets someone check whether an
  address is registered. Record this as a known limitation.

- Registration is unauthenticated by design. Consider rate limiting
  later, and keep it out of scope for this feature.

**Review result:** Consistent with the constitution's security
principle.\
**Status: Accepted**

**6. Accessibility review**

**Findings:** The design covers keyboard operation, labels, text-based
errors linked to fields, a screen-reader-friendly error summary and
mobile layout. This corresponds to US-004 and Scenarios 9 to 11, and the
frontend tests use label-based queries to help enforce it.

**Status: Accepted**

**7. Quickstart review (quickstart.md)**

**What was checked:** Whether the steps can be followed on a clean
machine.

**Findings:**

- It lists starting PostgreSQL with Docker Compose, applying EF Core
  migrations, starting the API and the frontend, and running the backend
  and frontend tests.

- Commands match those in README.md and AGENTS.md, with no conflicting
  instructions.

- It contains no real secrets or connection-string passwords.

**Status: Accepted**

**8. Scope and complexity review**

**Included:** registration, validation, duplicate handling, password
rules, error handling, signed-in redirect, accessibility.\
**Excluded:** email confirmation, password reset, two-factor
authentication, social login, changing email, login.

No out-of-scope functionality or extra entities, services or
dependencies were found. The only changes made were the Identity wording
and the password-length alignment.

**9. Corrections incorporated before the tasks stage**

1.  Replace "hash the password" with "use Identity's UserManager" in
    plan.md and the related task (T007).

2.  Align the password-length rule to Independent Work 1: at least 8
    characters, with confirmation entered twice; no additional maximum
    is introduced.

3.  T025 covers email trimming and case-insensitive handling with tests.

4.  T026 covers double-submit prevention with client-side disabling and
    server/database uniqueness protection.

5.  T027 covers the signed-in redirect test for Scenario 8.

**10. Final review result**

All findings identified during the supporting review have been resolved.

The password requirement is consistently defined as a minimum of 8
characters and password confirmation, matching FR-045. T007 uses ASP.NET
Core Identity UserManager rather than custom password hashing. Email
trimming and case-insensitive duplicate handling are covered by
implementation and automated tests. Double-submission protection is
covered by frontend and server-side safeguards. The signed-in
registration redirect is covered by an automated test for Scenario 8.

The specification, technical plan, task list, and test plan are
consistent and all approved user stories and acceptance scenarios have
corresponding implementation or verification work.

**Status: PASS**

Approved for implementation.

## 13. Creating the Implementation Tasks with /speckit-tasks

Generate tasks.md. Tasks must be small, concrete, verifiable,
dependency-aware, and connected to the relevant user story when
appropriate.

Each task should have a unique ID, one clear action, and the expected
file or directory when possible. Avoid tasks such as “Implement
backend”, “Finish feature”, or “Fix everything”.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr>
<th>- [ ] T001 Create Task entity in backend/src/...<br />
- [ ] T002 [US1] Implement task creation service in
backend/src/...<br />
- [ ] T003 [US1] Add POST /api/tasks endpoint in backend/src/...</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**Example:** A useful task is “T014 \[US2\] Add authorization test that
rejects editing another user’s task in tests/...”. This is clearer than
“Add security”.

**Phase 1 - Data Model**

**T001 - Define the User Account entity**

**User story:** US-001

**Action:** Create the User Account entity required to store
registered-user information.

**Expected location:** backend/src/SpekLaiku.Api.

**Verification:** The project builds successfully and the User Account
entity contains the required account fields.

**Dependency:** None.

**T002 - Add a unique constraint for email**

**User story:** US-002

**Action:** Configure the database model so that each user account has a
unique email address.

**Expected location:** Backend data-access/database configuration.

**Verification:** The database schema contains a uniqueness constraint
for the email address.

**Dependency:** T001.

**T003 - Create the database migration for User Accounts**

**User story:** US-001

**Action:** Create and apply the database migration required for the
User Account entity and email uniqueness constraint.

**Expected location:** Backend database migrations.

**Verification:** The migration can be applied successfully and creates
the required database structure.

**Dependency:** T001, T002.

**Phase 2 - Registration Validation and Business Logic**

**T004 - Define the registration request model**

**User story:** US-001

**Action:** Create the request model containing email, password, and
password confirmation.

**Expected location:** Backend application/API models.

**Verification:** The backend can receive all required registration
fields through the registration request.

**Dependency:** T001.

**T005 - Implement registration input validation**

**User story:** US-001, US-002

**Action:** Implement validation for required fields, email format,
minimum password length, and matching password confirmation.

**Expected location:** Backend application/validation layer.

**Verification:** Invalid registration requests are rejected with
appropriate validation results.

**Dependency:** T004.

**T006 - Implement duplicate email validation**

**User story:** US-002

**Action:** Check whether the submitted email address is already
associated with an existing account.

**Expected location:** Backend registration/application service.

**Verification:** Registration using an existing email address is
rejected and no second account is created.

**Dependency:** T002, T004.

**T007 - Implement secure password storage**

**User story:** US-001

**Action:** Use ASP.NET Core Identity's UserManager to create/manage the
user account and password; do not implement custom password hashing.

**Expected location:** Backend authentication/account service.

**Verification:** Registration creates the account through ASP.NET Core
Identity UserManager and no custom password-hashing implementation
exists in the feature.

**Dependency:** T004

**T008 - Implement account creation**

**User story:** US-001

**Action:** Create the User Account when all registration validation
succeeds.

**Expected location:** Backend application/service layer.

**Verification:** A valid registration request creates exactly one new
User Account.

**Dependency:** T005, T006, T007.

**Phase 3 - Registration API**

**T009 - Create the registration endpoint**

**User story:** US-001, US-002

**Action:** Create the backend API endpoint that accepts registration
requests and returns the appropriate success or validation result.

**Expected location:** Backend API/controller or endpoint directory.

**Verification:** A valid request reaches the registration logic and an
invalid request receives an appropriate error response.

**Dependency:** T005, T006, T008.

**T010 - Handle registration failures**

**User story:** US-002

**Action:** Implement appropriate handling for expected validation
failures and unexpected account-creation failures.

**Expected location:** Backend API/application error-handling layer.

**Verification:** Failed registration does not report a successful
account creation and the client receives an appropriate response.

**Dependency:** T009.

**Phase 4 - Registration Interface**

**T011 - Create the registration page**

**User story:** US-001

**Action:** Create the frontend registration page containing email,
password, and password-confirmation fields.

**Expected location:** Frontend registration feature/page directory.

**Verification:** The registration page displays all required fields and
the registration control.

**Dependency:** None.

**T012 - Add accessible form labels**

**User story:** US-004

**Action:** Add meaningful labels and accessible associations for all
registration fields and controls.

**Expected location:** Frontend registration component.

**Verification:** A screen reader can identify each registration field
and its purpose.

**Dependency:** T011.

**T013 - Add client-side validation messages**

**User story:** US-002

**Action:** Display understandable validation messages for invalid or
missing registration information.

**Expected location:** Frontend registration component/validation logic.

**Verification:** Submitting invalid information displays a clear
message next to the relevant field.

**Dependency:** T011.

**T014 - Connect the registration page to the registration API**

**User story:** US-001

**Action:** Connect the registration form to the backend registration
endpoint.

**Expected location:** Frontend registration API/service layer.

**Verification:** Submitting valid registration information sends the
request to the backend and handles the successful response.

**Dependency:** T009, T011.

**T015 - Display backend registration errors**

**User story:** US-002

**Action:** Display backend validation errors, including duplicate-email
errors, in the registration interface.

**Expected location:** Frontend registration component.

**Verification:** When the backend rejects registration, the relevant
error is displayed to the Visitor.

**Dependency:** T010, T014.

**Phase 5 - Signed-in User Protection**

**T016 - Prevent signed-in users from registering**

**User story:** US-003

**Action:** Prevent an already authenticated Registered User from
completing the registration workflow.

**Expected location:** Frontend routing/authentication handling and
backend authorization where required.

**Verification:** A signed-in Registered User cannot create another
account through the registration workflow.

**Dependency:** T009, T011.

**Phase 6 - Accessibility and Responsive Behavior**

**T017 - Verify keyboard registration**

**User story:** US-004

**Action:** Ensure all registration controls can be reached and operated
using standard keyboard navigation.

**Expected location:** Frontend registration page.

**Verification:** A Visitor can complete the registration workflow
without using a mouse.

**Dependency:** T012, T014.

**T018 - Verify screen-reader registration**

**User story:** US-004

**Action:** Verify that the registration fields, instructions, controls,
and validation messages provide meaningful information to a screen
reader.

**Expected location:** Frontend registration page.

**Verification:** A Visitor using a screen reader can understand and
complete the registration workflow.

**Dependency:** T012, T013, T015.

**T019 - Verify mobile registration**

**User story:** US-004

**Action:** Ensure the registration interface remains usable on a mobile
phone.

**Expected location:** Frontend registration styles/layout.

**Verification:** A Visitor can enter registration information and
submit the form on a mobile device.

**Dependency:** T011, T014.

**Phase 7 - Testing**

**T020 - Add backend registration tests**

**User story:** US-001, US-002

**Action:** Add automated backend tests for successful registration and
the main validation failures.

**Expected location:** Backend test project.

**Verification:** Tests pass for valid registration, invalid email,
short password, mismatched passwords, missing fields, and duplicate
email.

**Dependency:** T008, T009, T010.

**T021 - Add registration integration tests**

**User story:** US-001, US-002

**Action:** Add integration tests covering the registration API and
database behaviour.

**Expected location:** Backend integration-test project.

**Verification:** A valid request creates an account, while invalid and
duplicate requests do not create an account.

**Dependency:** T003, T009.

**T022 - Add frontend registration tests**

**User story:** US-001, US-002

**Action:** Add frontend tests for registration fields, validation
messages, successful submission, and backend errors.

**Expected location:** Frontend test directory.

**Verification:** The frontend tests pass for the defined registration
behaviours.

**Dependency:** T013, T014, T015.

**T023 - Perform accessibility verification**

**User story:** US-004

**Action:** Verify keyboard navigation, screen-reader behaviour, labels,
validation messages, and mobile usability.

**Expected location:** Registration feature.

**Verification:** All accessibility acceptance scenarios from Task 9 can
be completed successfully.

**Dependency:** T017, T018, T019.

**T024 - Align password length with Independent Work 1**

**User story:** US-001, US-002

**Action:** Change the registration specification, API contract,
validation and tests to require a password of at least 8 characters,
with no additional 128-character project requirement.

**Expected location:** Registration specification, contract, backend
validation and tests.

**Verification:** The feature rejects passwords shorter than 8
characters and accepts longer valid passwords consistently across the
specification and tests.

**Dependency:** T005, T013, T020, T021, T022

**T025 - Handle email trimming and case-insensitive comparison**

**User story:** US-001, US-002

**Action:** Trim leading and trailing whitespace from registration email
addresses and treat email addresses case-insensitively when checking for
duplicate accounts.

**Expected location:** Backend registration service and Identity/user
configuration.

**Verification:** user@example.com is normalized to user@example.com,
and USER@example.com is rejected when user@example.com already exists.

**Dependency:** T006, T009

**T026 - Prevent duplicate registration submission**

**User story:** US-001, US-002

**Action:** Prevent accidental double submission in the frontend and
retain the server/database uniqueness guard for concurrent requests.

**Expected location:** Registration frontend and backend/Identity
persistence layer.

**Verification:** Repeated or concurrent submission cannot create more
than one account for the same normalized email address.

**Dependency:** T003, T011, T021, T022

**T027 - Test signed-in registration redirect**

**User story:** US-003

**Action:** Add an automated test proving that an already signed-in user
cannot complete registration and is redirected to the appropriate
authenticated area.

**Expected location:** Frontend routing test and, where applicable,
registration endpoint authorization test.

**Verification:** Scenario 8 passes and the signed-in user is not
allowed to create another account.

**Dependency:** T016, T022

## 14. Analyzing the Specification Before Implementation

Use the Spec Kit analysis stage to verify consistency between the
constitution, feature specification, technical plan, and task list.

Check for missing requirements, requirements without implementation
tasks, contradictory requirements, tasks not connected to the
specification, architecture violations, missing tests, and unclear
dependencies.

Implementation begins only when the specification, plan, and tasks are
sufficiently consistent.

**Example:** If FR-006 requires users to filter tasks by status but no
task implements filtering and no test verifies it, add the missing
implementation and test tasks before coding starts.

**1. Constitution and Architecture Check**

The proposed implementation was compared with the project rules and
architecture.

The feature:

- uses the approved ASP.NET Core backend;

- uses the approved React frontend;

- uses PostgreSQL for persistent user data;

- keeps business logic outside the frontend;

- does not introduce unnecessary technical dependencies;

- includes automated testing;

- follows the project's security requirements;

- supports the required accessibility behaviour.

**Result:** No architecture violations were identified.

**Status: PASS**

**2. User Story Coverage**

All four User Registration user stories from Task 8 were checked against
the technical plan and implementation tasks.

| **User Story** | **Covered by Tasks** | **Status** |
|----|----|----|
| US-001 - Register with valid details | T001-T015, T020-T022 | PASS |
| US-002 - Understand and fix invalid details | T004-T010, T013-T015, T020-T022 | PASS |
| US-003 - Registration is not offered to signed-in users | T016 | PASS |
| US-004 - Register using keyboard, screen reader and phone | T012, T017-T019, T023 | PASS |

**Result:** Every approved user story has corresponding implementation
work.

**3. Acceptance Scenario Coverage**

The acceptance scenarios from Task 9 were compared with the
implementation tasks.

The implementation plan covers:

- successful registration;

- invalid email;

- short password;

- mismatched passwords;

- missing required information;

- correcting invalid information;

- duplicate email;

- signed-in user attempting registration;

- keyboard navigation;

- screen-reader support;

- mobile registration.

**Result:** All acceptance scenarios have corresponding implementation
or verification tasks.

**Status: PASS**

**4. Functional Requirement Coverage**

The registration-related functional requirements were checked against
the feature specification and task list.

The main requirements covered include:

- registration using a valid email address;

- password validation;

- password confirmation;

- duplicate email prevention;

- appropriate handling of registration errors;

- access restrictions for already authenticated users.

The existing project documentation identifies Registration as Flow 1 and
connects it to the relevant registration requirements.

**Result:** No registration requirement was identified without
corresponding implementation work.

**Status: PASS**

**5. Edge Case Coverage**

The feature specification identifies important edge cases including:

- emails differing only by letter case;

- spaces around the email;

- over-long input;

- double submission;

- failure while creating the account.

These cases were reviewed against the implementation plan.

**6. Security Check**

The security-related implementation was reviewed.

The plan requires:

- passwords to be stored securely;

- backend validation;

- unique email handling;

- no exposure of sensitive technical information;

- prevention of unauthorized registration behaviour.

**Result:** The security requirements are represented in the technical
plan and implementation tasks.

**Status: PASS**

**7. Accessibility Check**

The accessibility requirements were compared with the user stories,
acceptance scenarios, technical plan, and task list.

The implementation includes tasks for:

- keyboard navigation;

- screen-reader support;

- meaningful labels;

- validation messages;

- mobile usability.

The project requirements also specify that validation errors should
appear as text next to the relevant field and be linked to that field.

**Result:** Accessibility requirements have corresponding implementation
and verification tasks.

**Status: PASS**

**8. Task Dependency Check**

The implementation tasks were reviewed to ensure that dependencies are
clear.

The main dependency sequence is:

**User Account model → Database → Validation → Registration logic → API
→ Frontend → Accessibility → Tests**

Tasks that do not depend on completed backend functionality can be
developed independently where appropriate.

**Result:** No blocking dependency conflicts were identified.

**Status: PASS**

**9. Scope Check**

The implementation task list was compared with the clarified scope.

**In scope**

- User registration

- Registration validation

- Duplicate email handling

- Password validation

- Password confirmation

- Registration error handling

- Signed-in-user protection

- Keyboard accessibility

- Screen-reader support

- Mobile registration

**Out of scope**

- Email confirmation

- Password reset

- Two-factor authentication

- Social-media login

- Changing an existing user's email

- Login functionality

**Result:** No unnecessary out-of-scope functionality was identified in
the implementation tasks.

**Status: PASS**

**10. Test Coverage Check**

The technical plan and task list include:

- backend unit tests;

- backend integration tests;

- frontend tests;

- accessibility verification.

The tests cover both successful and relevant negative registration
cases.

**Result:** No major missing test category was identified.

**Status: PASS**

**11. Contradiction Check**

The following documents were compared:

1.  Feature 001 specification

2.  User stories

3.  Acceptance scenarios

4.  Clarification decisions

5.  Technical plan

6.  Supporting design review

7.  Implementation tasks

No contradictions were identified between these documents.

In particular:

- the specification does not require email confirmation;

- the implementation tasks do not introduce email confirmation;

- the registration requirements consistently require password
  validation;

- duplicate email handling is represented consistently;

- accessibility requirements appear in the user stories, acceptance
  scenarios, plan, and tasks.

**Status: PASS**
