---

description: "Task list for feature 005 Activity Selection and Limits"
---

# Tasks: Activity Selection and Limits

**Input**: Design documents from `/specs/005-activity-selection/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/plan-activities-api.md, quickstart.md

**Tests**: Required. Constitution principle III requires backend tests for business logic and API behaviour, frontend tests for the relevant screens, and an authorization test for every protected operation. Within each story, write the tests first and confirm they fail before the implementation tasks.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested on its own. The P1 stories come first, in the order their dependencies need: US1 (pick), US3 (remove), US4 (Continue and step 3), US2 (settings and their messages, which need Continue), US6 (access). Then the P2 stories US5 (session) and US7 (keyboard, screen reader, phone). Commands are in `AGENTS.md`. Backend commands run from the repository root with `.\SpekLaiku.slnx`; frontend commands run from `frontend/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: The user story the task belongs to (US1 to US7, as numbered in `spec.md`)
- Paths are from the repository root. `Api/` below is short for `backend/src/SpekLaiku.Api/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the starting point. No new package, no migration and no new folder.

- [ ] T001 From the repository root, run `dotnet build .\SpekLaiku.slnx` and `dotnet test .\SpekLaiku.slnx`. From `frontend/`, run `npm run lint`, `npm test` and `npm run build`. This confirms the baseline after feature 004 passes before any change. Record any pre-existing failure instead of fixing it in this feature.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The request and result shapes, the validation rules, the response mapping, and the frontend activity types, store and names, which every story uses.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Backend

- [ ] T002 [P] Create the request DTOs in `Api/DTOs/Requests/`:
  - `PlanActivitiesCheckRequest.cs`: `public sealed record PlanActivitiesCheckRequest(List<PlanActivityRequest>? Activities)`.
  - `PlanActivityRequest.cs`: `public sealed record PlanActivityRequest(Guid? CategoryId, string? Type, decimal? DurationHours, bool RequiresDaylight, decimal? MaxWindMs, decimal? MaxRainMmPerHour, decimal? MinTemperatureC, decimal? MaxTemperatureC)`.
  - Comment that the numbers are `decimal?` so a missing value gets the field message instead of a request error, and that `Type` is the type the activity was added with (research section 4).
- [ ] T003 [P] Create the service records in `Api/Services/` (see `data-model.md`):
  - `CheckedPlanActivity.cs`: `public sealed record CheckedPlanActivity(Guid CategoryId, string Name, ActivityType Type, decimal DurationHours, bool RequiresDaylight, decimal? MaxWindMs, decimal? MaxRainMmPerHour, decimal? MinTemperatureC, decimal? MaxTemperatureC)`.
  - `PlanActivitiesResult.cs`: `Succeeded`, `Activities` (`IReadOnlyList<CheckedPlanActivity>`) and `Errors` (`IReadOnlyList<KeyValuePair<string, string>>`), with `Success(...)` and `Invalid(...)` factories, following `PlanSetupResult.cs`.
- [ ] T004 Create `Api/Services/PlanActivityValidator.cs`, a static class (research section 4, `data-model.md` Validation rules).
  - Constants: `MaxActivities = 10` and the messages `"Add at least one activity."`, `"You can add up to 10 activities."`, `"This activity is no longer available. Remove it."`, `"This activity's category has changed. Remove it and add it again."`.
  - `public static bool HasValidCount(PlanActivitiesCheckRequest request, out KeyValuePair<string, string>? error)`: missing or empty list gives `activities` "Add at least one activity."; more than 10 gives `activities` "You can add up to 10 activities.".
  - `public static PlanActivitiesResult Validate(PlanActivitiesCheckRequest request, IReadOnlyDictionary<Guid, ActivityCategory> categories)`. It assumes a valid count and goes through the activities by position `i`:
    1. A `CategoryId` that is null or not in `categories` gives `activities[i]` "This activity is no longer available. Remove it." and skips the activity.
    2. A `Type` that is not exactly `"Indoor"` or `"Outdoor"`, or differs from the stored category's type, gives `activities[i]` "This activity's category has changed. Remove it and add it again." and skips the activity.
    3. Otherwise `activities[i].durationHours` uses `ActivityLimitRules.CheckDuration`. For an Outdoor category, `activities[i].maxWindMs`, `.maxRainMmPerHour`, `.minTemperatureC` and `.maxTemperatureC` use `CheckMaxWind`, `CheckMaxRain`, `CheckMinTemperature` and `CheckMaxTemperature`; when both temperatures are valid on their own, `CheckTemperatureOrder` puts its message on `.minTemperatureC`. Follow the shape of `ActivityCategoryValidator`.
  - Errors are reported together, in position order and within an activity in the order `activity`, `durationHours`, `maxWindMs`, `maxRainMmPerHour`, `minTemperatureC`, `maxTemperatureC`.
  - On success it returns a `CheckedPlanActivity` per activity in request order, with the stored `Name` and `Type` and the request's values. For Indoor the four limits are `null`, whatever the request contains.
  - Do not copy any range or message from `ActivityLimitRules`. Keep the class under 200 lines.
- [ ] T005 Add `backend/tests/SpekLaiku.UnitTests/PlanActivityValidatorTests.cs`, covering every row of `data-model.md` (Validation rules) and these cases:
  - `HasValidCount`: null list, empty list and 11 activities each give only the `activities` message; 1 and 10 are valid.
  - Boundaries accepted: 0.5 and 12 h, 0 and 30 m/s, 0 and 20 mm/h, -30 and 45 °C. Refused: 0.25 h, 12.5 h, 1.25 m/s, min = max, and each limit missing for Outdoor.
  - An unknown category id and a changed type each give only the `activities[i]` message for that activity, while another invalid activity still gets its field messages.
  - `Type` `"outdoor"` (wrong case) counts as changed.
  - The same category twice with different settings gives two results in request order.
  - An Indoor activity with limits in the request is accepted, with the limits returned as `null`.
  - The name and type come from the dictionary, not the request.
  - The keys come in the documented order.
- [ ] T006 [P] Create the response DTOs in `Api/DTOs/Responses/` (`contracts/plan-activities-api.md`):
  - `PlanCategoryResponse.cs`: `(Guid Id, string Name, string Type, decimal DefaultDurationHours, bool RequiresDaylight, decimal? MaxWindMs, decimal? MaxRainMmPerHour, decimal? MinTemperatureC, decimal? MaxTemperatureC)`. Comment that it has no place tags or version on purpose (research section 1).
  - `PlanCategoriesResponse.cs`: `(IReadOnlyList<PlanCategoryResponse> Categories, int MaxActivities)`. Comment that `MaxActivities` is sent so the page holds no copy of the limit (constitution I).
  - `CheckedPlanActivityResponse.cs`: `(Guid CategoryId, string Name, string Type, decimal DurationHours, bool RequiresDaylight, decimal? MaxWindMs, decimal? MaxRainMmPerHour, decimal? MinTemperatureC, decimal? MaxTemperatureC)`.
  - `CheckedPlanActivitiesResponse.cs`: `(IReadOnlyList<CheckedPlanActivityResponse> Activities)`.
- [ ] T007 Create `Api/Mapping/PlanActivityMappingProfile.cs`: `ActivityCategory` → `PlanCategoryResponse` and `CheckedPlanActivity` → `CheckedPlanActivityResponse`, each with `Type` mapped from `source.Type.ToString()`, following `ActivityCategoryMappingProfile`. No rules.
- [ ] T008 Add `backend/tests/SpekLaiku.UnitTests/PlanActivityMappingTests.cs`, following `ActivityCategoryMappingTests.cs`:
  - the configuration is valid;
  - an Outdoor and an Indoor category map with `"Outdoor"` and `"Indoor"` and `null` limits for Indoor;
  - a `CheckedPlanActivity` maps every field;
  - `typeof(PlanCategoryResponse)` has no property named `PlaceTags` or `Version`.

### Frontend

- [ ] T009 [P] Create `frontend/src/types/planActivity.ts` with `PlanCategory`, `PlanActivity`, `CheckedPlanActivity`, `PlanActivityField` and `PlanActivityErrors` exactly as in `data-model.md` (Frontend types). Import `ActivityType` from `types/activityCategory.ts`. Add `PlanActivityRequest` and `PlanActivitiesCheckRequest` matching the contract's request.
- [ ] T010 Create `frontend/src/stores/usePlanActivitiesStore.ts`, a Zustand store **without persistence yet** (persistence comes in US5), with the fields and actions in `data-model.md` (Plan activities store):
  - `add(category)` appends `{ id: crypto.randomUUID(), categoryId, name, type, durationText: String(defaultDurationHours), requiresDaylight, ... }`, writing each Outdoor limit with `String(value)` and Indoor limits as `""`. It holds **no** activity limit: the category list disables Add at the server's `maxActivities`, and the server refuses more on Continue (constitution I).
  - `remove(id)` and `update(id, changes)` set `checked` to `null`.
  - `setChecked` does not count as a change.
  - `clear()` returns to the initial state.
  - Export `initialPlanActivitiesState`.
- [ ] T011 Add `frontend/src/tests/usePlanActivitiesStore.test.ts`. Cover:
  - `add` copies the Outdoor defaults as text, and an Indoor category gets empty limits;
  - two adds of the same category give two activities with different ids;
  - `remove` and `update` change only the named activity and clear `checked`;
  - `setChecked` keeps the activities;
  - `clear` empties everything.
- [ ] T012 [P] Create `frontend/src/helpers/planActivityNames.ts`: `planActivityNames(activities: { id: string; categoryId: string; name: string }[]): Record<string, string>`, so it names both `PlanActivity` (step 2) and `CheckedPlanActivity` (step 3). The name is `name` when its `categoryId` appears once, otherwise `"<name> <n>"` with `n` counting from 1 in list order among activities with that `categoryId` (research section 3). Add `frontend/src/tests/planActivityNames.test.ts`: one Cycling gives "Cycling"; Cycling, Picnic, Cycling gives "Cycling 1", "Picnic", "Cycling 2"; after removing the first Cycling the other is "Cycling" again; two categories with the same name but different ids are numbered separately by id.
- [ ] T013 In `frontend/src/tests/setup.ts`, reset `usePlanActivitiesStore` to `initialPlanActivitiesState` after each test, next to the existing plan store resets.

**Checkpoint**: The rules, shapes, mapping, store and names exist and are tested.

---

## Phase 3: User Story 1 - Pick activities for the plan (Priority: P1) 🎯 MVP

**Goal**: The Activity selection step lists the categories, and Add puts an activity with the category defaults into the plan, as often as wanted up to 10.

**Independent Test**: With a checked setup, open the Activity selection step, add Kayaking and Museum, and check that both appear under the plan's activities with the category defaults filled in.

### Tests for User Story 1 ⚠️

- [ ] T014 [P] [US1] Add `backend/tests/SpekLaiku.IntegrationTests/PlanCategoriesEndpointTests.cs` (collection `PostgreSqlCollection`). The shared database holds the starter categories and categories added by other tests, so add your own with `PostgreSqlApiFactory.UniqueCategoryName` and check only those. As a Visitor, cover:
  - `GET /api/plan-activities/categories` gives `200` with `categories`, containing an added Outdoor category with every value and an added Indoor category with `null` limits, and `maxActivities` equal to `PlanActivityValidator.MaxActivities` (10);
  - two added categories come in name order;
  - the raw JSON of a category has exactly the keys `id`, `name`, `type`, `defaultDurationHours`, `requiresDaylight`, `maxWindMs`, `maxRainMmPerHour`, `minTemperatureC`, `maxTemperatureC` (no `placeTags`, no `version`).
- [ ] T015 [P] [US1] Add `frontend/src/tests/planActivitiesApi.test.ts` (list part) and `frontend/src/tests/usePlanCategoriesStore.test.ts` (fake timers, `routeFetch`). Cover:
  - `200` returns `{ categories, maxActivities }`, and any other status throws `ApiError(status)`;
  - the store goes `loading` → `loaded` with the categories and `maxActivities`, or `error` on `500`, a network error and no answer within 10 s;
  - `load()` again after an error retries;
  - `reset()` aborts a pending load and drops its result.
- [ ] T016 [P] [US1] Extend `frontend/src/tests/ActivitySelectionPage.test.tsx` (categories and Add part), with `renderApp("/plan/activities")`, a checked setup in `usePlanSetupStore` and `routeFetch` answering `GET /api/plan-activities/categories`. The route answers `{ "categories": [...], "maxActivities": 10 }`. Replace the feature 004 test that the step contains nothing else (spec FR-020 supersedes feature 004 FR-024), and say so in the commit message so the review does not read it as a deleted test. Cover:
  - "Loading activity categories…" while loading;
  - the categories in the order sent, each with its name, type and duration (for example "Kayaking", "Outdoor", "2 h") and a button named "Add Kayaking";
  - "No activities added yet. Select at least one category to continue." before any Add;
  - Add Kayaking: a group named "Kayaking" with Duration (h) "2", Requires daylight checked, Max wind (m/s) "8", Max rain (mm/h) "0.5", Min temperature (°C) "15" and Max temperature (°C) "35", "Kayaking added." in the status region, and "Add Kayaking" still enabled;
  - Add Museum (Indoor): only Duration and Requires daylight;
  - Add Cycling twice: groups "Cycling 1" and "Cycling 2", "Cycling 2 added.", and typing in one Duration leaves the other unchanged;
  - with 10 activities every Add button is disabled and "You can add up to 10 activities." is shown;
  - with `maxActivities: 3` from the server, Add is disabled at 3 and the text says "You can add up to 3 activities.", showing the limit comes from the server and not from a constant;
  - on a `500`, "Error: Activity categories could not be loaded." with Retry, while earlier activities stay shown; Retry loads the list;
  - an empty list shows "No activity categories are available yet.";
  - the setup summary and Back from feature 004 are still shown.

### Implementation for User Story 1

- [ ] T017 [US1] Create `Api/Services/PlanActivityService.cs` (`ApplicationDbContext`, `ActivityCategoryService`) with `ListCategoriesAsync(CancellationToken)` returning `ActivityCategoryService.ListAsync`, so the order rule stays in one place. Register it with `AddScoped<PlanActivityService>()` in `Api/Program.cs`, next to the plan setup services.
- [ ] T018 [US1] Create `Api/Controllers/PlanActivitiesController.cs`: `[ApiController]`, `[Route("api/plan-activities")]`, `[Authorize(Policy = AuthorizationPolicies.PlanCreator)]`, `[ProducesResponseType(StatusCodes.Status403Forbidden)]`, with no rate limiting attribute and a comment why (research section 8). `GET categories` returns `200` with `new PlanCategoriesResponse(mapper.Map<PlanCategoryResponse[]>(categories), PlanActivityValidator.MaxActivities)`.
- [ ] T019 [P] [US1] Create `frontend/src/api/planActivitiesApi.ts` with `listPlanCategories(signal?: AbortSignal): Promise<{ categories: PlanCategory[]; maxActivities: number }>` using `apiFetch("/api/plan-activities/categories", { signal })`. `200` returns the body; any other status throws `ApiError(status)`.
- [ ] T020 [US1] Create `frontend/src/stores/usePlanCategoriesStore.ts` following `usePlanPeriodStore.ts`: `status: "loading" | "loaded" | "error"`, `categories`, `maxActivities: number | null` (`null` until loaded), `load()` with a 10 s timeout and the latest load winning, `reset()`, and an exported initial state. Reset it in `frontend/src/tests/setup.ts`.
- [ ] T021 [P] [US1] In `frontend/src/components/weatherLimitFields.tsx`, add an `idPrefix: string` prop (ids become `${idPrefix}-${field}`) and change `errors` to `Partial<Record<keyof WeatherLimitValues, string>>`. In `frontend/src/components/categoryForm.tsx`, pass `idPrefix="category"`. The category form's ids and tests stay unchanged (research section 9).
- [ ] T022 [US1] Create `frontend/src/components/planCategoryList.tsx`, under about 200 lines:
  - a section with `<h2 id="plan-categories-heading" tabIndex={-1}>` "Activity categories";
  - "Loading activity categories…" in a status region while loading;
  - "Error: Activity categories could not be loaded." with Retry (calls `usePlanCategoriesStore.getState().load()`) on error;
  - "No activity categories are available yet." when loaded and empty;
  - otherwise a list with each category's name, type and "<duration> h", and a button "Add" with `aria-label` "Add <name>" that calls `usePlanActivitiesStore.getState().add(category)`;
  - every Add disabled and "You can add up to <maxActivities> activities." shown when the plan has `maxActivities` activities, using only the value from `usePlanCategoriesStore` (no constant in the browser);
  - after Add, "<shown name> added." in a status region, using `planActivityNames` for the new activity.
- [ ] T023 [US1] Create `frontend/src/components/planActivitySettings.tsx`, under about 200 lines. For one `PlanActivity` and its shown name, it renders:
  - `<fieldset id="activity-<id>">` with a `<legend>` that contains `<h3 id="activity-<id>-heading" tabIndex={-1}>` with the shown name;
  - Duration (h) as a `TextField` (`id="activity-<id>-durationHours"`, `inputMode="decimal"`, hint "0.5 to 12");
  - a "Requires daylight" checkbox;
  - for Outdoor, `WeatherLimitFields` with `idPrefix="activity-<id>"`.
  - Each change calls `usePlanActivitiesStore.getState().update(id, ...)`.
  - It takes an `errors` prop (`Partial<Record<PlanActivityField, string>>`, empty for now) and passes field errors on.
- [ ] T024 [US1] Create `frontend/src/components/planActivitiesForm.tsx` (first version): a section with `<h2>` "Your activities", "No activities added yet. Select at least one category to continue." when there are none, and one `PlanActivitySettings` per activity with its name from `planActivityNames`. Continue comes in US4.
- [ ] T025 [US1] Change `frontend/src/pages/ActivitySelectionPage.tsx`:
  - keep the title, `<h1>`, `PlanProgress current={2}`, `PlanSetupSummary`, Back and the redirect without a checked setup;
  - add `<div className="activity-selection-layout">` with `PlanCategoryList` and `PlanActivitiesForm`;
  - on mount, call `usePlanCategoriesStore.getState().load()`; on unmount, reset it (not `usePlanActivitiesStore`);
  - update the top comment.

**Checkpoint**: A visitor adds activities with their defaults, including the same category twice.

---

## Phase 4: User Story 3 - Remove an activity from the plan (Priority: P1)

**Goal**: Each activity can be removed, with an announcement and sensible focus, and the numbering of repeated categories follows.

**Independent Test**: Add Cycling and Picnic, remove Cycling, and check that only Picnic remains.

### Tests for User Story 3 ⚠️

- [ ] T026 [P] [US3] Extend `frontend/src/tests/ActivitySelectionPage.test.tsx` (Remove part). Cover:
  - "Remove Cycling" removes it, announces "Cycling removed." and moves focus to the next activity's heading (Picnic);
  - removing the last activity moves focus to the "Activity categories" heading and shows the empty text;
  - removing "Cycling 1" leaves the other with its own Duration, shown as "Cycling";
  - a removed activity added again has the category defaults.

### Implementation for User Story 3

- [ ] T027 [US3] Add Remove:
  - In `frontend/src/components/planActivitySettings.tsx`, add a "Remove" button with `aria-label` "Remove <shown name>" that calls an `onRemove` prop.
  - In `frontend/src/components/planActivitiesForm.tsx`, `onRemove` calls `usePlanActivitiesStore.getState().remove(id)`, announces "<shown name> removed." in a status region, and then focuses `activity-<next id>-heading` (the activity after it, or before it when it was last) or `plan-categories-heading` when none is left (spec FR-009).

**Checkpoint**: Activities can be added and removed.

---

## Phase 5: User Story 4 - Continue to the next step with valid activities (Priority: P1)

**Goal**: Continue checks every activity on the server and opens the first version of step 3; errors are shown on the right activity and field.

**Independent Test**: Add two activities with valid settings, select "Continue", and check that step 3 opens and lists both activities with their settings.

### Tests for User Story 4 ⚠️

- [ ] T028 [P] [US4] Add `backend/tests/SpekLaiku.UnitTests/PlanActivityServiceTests.cs` with the EF Core in-memory database, following `ActivityCategoryServiceTests.cs`. Cover:
  - `ListCategoriesAsync` returns the stored categories in name order;
  - `CheckAsync` with two stored categories, one used twice, returns three results in request order with the stored names;
  - an unknown id gives the `activities[i]` message;
  - a request with 0 or 11 activities returns only the `activities` message without a query (pass a context that was already disposed: the call must not throw);
  - after a check with changed values, the stored category's values are unchanged.
- [ ] T029 [P] [US4] Add `backend/tests/SpekLaiku.IntegrationTests/PlanActivitiesCheckEndpointTests.cs` (collection `PostgreSqlCollection`, own categories with unique names). As a Visitor, cover:
  - `200` with the contract body in request order, including one category twice with different settings and an Indoor activity sent with limits (returned as `null`);
  - `400` with keys and messages in contract order for one invalid duration, an unknown category id (a new `Guid`) and a changed type in one request;
  - `400` `activities` for an empty list and for 11 activities;
  - `400` `request` for a string where a number belongs and for a `categoryId` that is not a GUID;
  - the response uses the category's current name after it is renamed in the database between two checks.
- [ ] T030 [P] [US4] Extend `frontend/src/tests/planActivitiesApi.test.ts` (check part) and add `frontend/src/tests/usePlanActivitiesCheckStore.test.ts` (fake timers, `routeFetch`, following `usePlanSetupCheckStore.test.ts`). Cover:
  - `checkPlanActivities` maps `200` to `checked`, `400` to `invalid` with every `activities` key, a `400` without such keys throws, `403` to `forbidden`, and other statuses throw `ApiError`;
  - the store is `pending` and ignores a second submit;
  - on `checked` it calls `usePlanActivitiesStore.getState().setChecked` with the server's activities matched to the sent ids;
  - on `invalid`, `activities[1].durationHours` is stored under the second sent activity's id, `activities[0]` under the first one's `activity` key, and `activities` under `list`;
  - `serverError` after a `500`, a network error and 10 s without an answer, not before; Retry sends the same request;
  - `403` refreshes the current user;
  - an answer for activities changed while the check ran is dropped (status `idle`, nothing checked);
  - `reset()` aborts a pending check.
- [ ] T031 [P] [US4] Extend `frontend/src/tests/ActivitySelectionPage.test.tsx` (Continue part). Cover:
  - Continue with no activities shows "Error: Add at least one activity." and sends no request;
  - Continue with activities shows "Checking your activities…", disables Continue and sends the request body from `contracts/plan-activities-api.md` (text such as "2,5" sent as `null`);
  - on `200`, `/plan/places` opens;
  - on `400`, each message appears next to its field with "Error: ", an error summary lists every message as a link to its field, and focus moves to the first invalid field;
  - an `activities[i]` message appears at the top of that activity's group;
  - after removing the first activity, errors for the second activity stay on it;
  - a `500` shows "Error: Something went wrong. Try again." with Retry, which sends the same request;
  - when the categories fail to load (`500`) but the plan already has activities from earlier in the session, Continue still sends them and opens `/plan/places` (spec edge case).
- [ ] T032 [P] [US4] Add `frontend/src/tests/PlacesAndForecastPage.test.tsx`. Cover:
  - with a checked setup and checked activities: the `<h1>` "Places and forecast", the title "Places and forecast - Spėk laiku", the progress bar with "Places and forecast" current and links for "Plan setup" and "Activities", the setup summary, and each activity with name, type, duration, daylight and Outdoor limits;
  - Back opens Activity selection with every activity kept;
  - without checked activities it redirects to `/plan/activities`, and without a checked setup to `/plan/setup`;
  - changing an activity after continuing and opening `/plan/places` again redirects to `/plan/activities`.

### Implementation for User Story 4

- [ ] T033 [US4] In `Api/Services/PlanActivityService.cs`, add `CheckAsync(PlanActivitiesCheckRequest, CancellationToken)`:
  1. `PlanActivityValidator.HasValidCount`; on failure return `PlanActivitiesResult.Invalid` with that error and no query.
  2. Otherwise collect the distinct non-null ids, read them in one `AsNoTracking` query into a dictionary (research section 5), and return `PlanActivityValidator.Validate(request, categories)`.
  - Keep the class under 200 lines.
- [ ] T034 [US4] In `Api/Controllers/PlanActivitiesController.cs`, add `POST check`: `200` with `new CheckedPlanActivitiesResponse(mapper.Map<CheckedPlanActivityResponse[]>(result.Activities))`, or `400` with `ValidationProblemDetails` (title "One or more request fields are invalid.", keys in result order), the same as `PlanSetupController.Check`.
- [ ] T035 [P] [US4] Create the request and field helpers, with tests:
  - `frontend/src/helpers/planActivityRequest.ts`: `planActivitiesRequest(activities): PlanActivitiesCheckRequest`. It uses `parseDecimal` for each number, sends `null` limits for Indoor, and passes `type` and `requiresDaylight` through.
  - `frontend/src/helpers/planActivityFieldIds.ts`:
    - `activityFieldId(id, field)` gives `activity-<id>-<field>`, with `activity-<id>` for `"activity"`;
    - `planActivitySummaryErrors(errors, activities, names)` returns `{ fieldId, message }[]` in page order: the `list` message (field id `plan-activities-heading`), then per activity `activity`, `durationHours`, `maxWindMs`, `maxRainMmPerHour`, `minTemperatureC`, `maxTemperatureC`. Each message is prefixed with the shown name, for example "Cycling 2: Enter a duration between 0.5 and 12 hours.".
  - Add `frontend/src/tests/planActivityRequest.test.ts` and `frontend/src/tests/planActivityFieldIds.test.ts`.
- [ ] T036 [US4] Add `checkPlanActivities(request, signal)` to `frontend/src/api/planActivitiesApi.ts`, returning `{ kind: "checked"; activities } | { kind: "invalid"; errors: Record<string, string> } | { kind: "forbidden" }`. A `400` keeps the first message of every key starting with `activities`; a `400` without such keys throws. Other statuses throw `ApiError`, following `planSetupApi.ts`.
- [ ] T037 [US4] Create `frontend/src/stores/usePlanActivitiesCheckStore.ts` following `usePlanSetupCheckStore.ts` (research section 6): status, errors, `lastRequest` (the sent activities with ids), `submit(activities)`, `retry()`, `reset()`, a 10 s timeout, and a subscription to `usePlanActivitiesStore` that drops the answer when `activities` changed while the check ran. Turn `activities[i]` and `activities[i].<field>` keys into `byActivity[<sent id>]`, and `activities` into `list`. Reset it in `frontend/src/tests/setup.ts`.
- [ ] T038 [US4] Extend `frontend/src/components/planActivitiesForm.tsx` with Continue:
  - a `<form noValidate>` with `ErrorSummary` from `planActivitySummaryErrors`;
  - `<h2 id="plan-activities-heading" tabIndex={-1}>`;
  - with no activities, Continue shows "Error: Add at least one activity." under the heading without a request;
  - otherwise it calls `submit` and navigates to `/plan/places` on success;
  - "Checking your activities…" in a status region while pending, with Continue disabled;
  - "Error: Something went wrong. Try again." with Retry on `serverError`;
  - after a failed check, focus moves to the first summary field;
  - pass each activity's errors to `PlanActivitySettings`, which shows the `activity` message under the legend (`id="activity-<id>-error"`, linked with `aria-describedby`), with "Error: " added by `formatErrorMessage`.
  - On unmount, reset the check store. Split helpers out if the file passes about 200 lines.
- [ ] T039 [P] [US4] Create `frontend/src/components/planActivitiesSummary.tsx`: from `CheckedPlanActivity[]`, with shown names from `planActivityNames(checked)` (so repeated categories appear as "Cycling 1" and "Cycling 2" on step 3 too), a list where each item shows the name, the type, "<n> h", "Requires daylight" or "No daylight needed", and for Outdoor "Wind up to <n> m/s · Rain up to <n> mm/h · <min> to <max> °C".
- [ ] T040 [US4] Create `frontend/src/pages/PlacesAndForecastPage.tsx` (research section 7):
  - `usePageTitle("Places and forecast")`, `<h1>` "Places and forecast", `<PlanProgress current={3} />`, `PlanSetupSummary`, `PlanActivitiesSummary` and a Back link to `/plan/activities`;
  - `<Navigate to="/plan/setup" replace />` without `usePlanSetupStore` `checked`, and `<Navigate to="/plan/activities" replace />` without `usePlanActivitiesStore` `checked`.
  - In `frontend/src/components/appRoutes.tsx` add `plan/places` inside `PlanCreatorOnly`. In `frontend/src/components/planProgress.tsx` give "Activities" the path `/plan/activities`.

**Checkpoint**: The plan goes from step 1 through step 2 to step 3 with every value checked on the server.

---

## Phase 6: User Story 2 - Change an activity's duration and weather limits in this plan (Priority: P1)

**Goal**: Every setting can be changed for this plan only, and every Form 4 message appears next to its field.

**Independent Test**: Add Picnic, change its minimum temperature to 18 °C and its duration to 2.5 h, continue, and check that the next step shows 18 °C and 2.5 h while the Picnic category still has 15 °C and 1.5 h.

### Tests for User Story 2 ⚠️

- [ ] T041 [P] [US2] Extend `frontend/src/tests/ActivitySelectionPage.test.tsx` (settings part). Cover:
  - changed Duration and Min temperature are sent and shown on step 3;
  - values are kept after going to step 1 and back;
  - clearing "Requires daylight" sends `false`;
  - each Form 4 message from a `400` (duration, wind, rain, minimum, maximum, temperature order) appears next to its own field with "Error: ", for an empty field and for "2,5";
  - each field shows its range hint ("0.5 to 12", "0 to 30", "0 to 20", "-30 to 45").
- [ ] T042 [P] [US2] Extend `backend/tests/SpekLaiku.IntegrationTests/PlanActivitiesCheckEndpointTests.cs`. Cover:
  - a check with values different from the category's defaults leaves the category unchanged when read again through `GET /api/admin/categories/{id}` as an Active Administrator;
  - the boundary values from T005 through the endpoint (one accepted and one refused request).

### Implementation for User Story 2

- [ ] T043 [US2] Complete the settings in `frontend/src/components/planActivitySettings.tsx` so T041 and T042 pass:
  - each field shows its range hint ("0.5 to 12" for Duration; the weather hints come from `WeatherLimitFields`);
  - each field's error has the id `<field id>-error` and is linked from the input with `aria-describedby`, next to the hint;
  - the "Requires daylight" checkbox calls `update(id, { requiresDaylight })`, and `planActivitiesRequest` sends it;
  - every text change calls `update(id, { <field>Text })`, so each copy of a category keeps its own values.
  
  Do not change `ActivityLimitRules` or add range checks in the browser (research section 9).

**Checkpoint**: Settings are per plan, and every message points at the right field.

---

## Phase 7: User Story 6 - Only visitors and active registered users can select activities (Priority: P1)

**Goal**: Both endpoints and both pages follow the plan access rule.

**Independent Test**: Request the categories for planning and the activity check as each caller type; only a Visitor and an Active Registered User are allowed.

### Tests for User Story 6 ⚠️

- [ ] T044 [P] [US6] Add `backend/tests/SpekLaiku.IntegrationTests/PlanActivitiesAuthorizationTests.cs`, a theory over both endpoints (`GET /api/plan-activities/categories` and `POST /api/plan-activities/check` with a valid body), following `PlanSetupAuthorizationTests.cs`. Cover every row of the authorization table in `contracts/plan-activities-api.md`: a Visitor and an Active Registered User get `200`; a Suspended Registered User, an Active and a Suspended Administrator, and a cookie whose account was deleted get `403`.
- [ ] T045 [P] [US6] Extend `frontend/src/tests/planCreatorOnly.test.tsx` with `/plan/places`: an Active Administrator sees Access denied, a Suspended user goes to Account suspended, and nothing is shown while the signed-in state loads.

### Implementation for User Story 6

- [ ] T046 [US6] Make T044 and T045 pass. The policy is already on `PlanActivitiesController` (T018) and the route is inside `PlanCreatorOnly` (T040); fix only what the tests show.

**Checkpoint**: Access is enforced on the server and shown correctly in the browser.

---

## Phase 8: User Story 5 - Keep the activities while planning in this session (Priority: P2)

**Goal**: The activities survive a reload and a login in the same tab, stay when the setup changes, and are cleared on logout.

**Independent Test**: Add two activities, change one setting, reload, then log in in the same tab: both are still there. Log out: they are gone.

### Tests for User Story 5 ⚠️

- [ ] T047 [P] [US5] Extend `frontend/src/tests/usePlanActivitiesStore.test.ts`. Cover:
  - the data is written to `sessionStorage` under `spek-laiku-plan-activities` and read back after `persist.rehydrate()`;
  - actions are not stored;
  - a stored value of another version is dropped.
- [ ] T048 [P] [US5] Extend `frontend/src/tests/planSetupSession.test.tsx`. Cover:
  - activities and a changed setting are kept after a re-render of the app from `sessionStorage`, after logging in and after registering in the same tab;
  - they are cleared after a successful logout;
  - changing a date on Plan setup keeps them.

### Implementation for User Story 5

- [ ] T049 [US5] In `frontend/src/stores/usePlanActivitiesStore.ts`, wrap the store in `persist` as in `usePlanSetupStore.ts`: `name: "spek-laiku-plan-activities"` (exported as `planActivitiesStorageKey`), `version: 1`, `createJSONStorage(() => sessionStorage)`, `partialize` storing only `activities` and `checked`, and `migrate: () => initialPlanActivitiesState`. Comment the reason (research section 2).
- [ ] T050 [US5] In `frontend/src/stores/useLogoutStore.ts`, after a successful logout call `usePlanActivitiesStore.getState().clear()` next to the plan setup clear, with a comment citing spec FR-019.

**Checkpoint**: The whole current plan lives for the tab session.

---

## Phase 9: User Story 7 - Select activities with keyboard, screen reader and on a phone (Priority: P2)

**Goal**: Both steps work with the keyboard and a screen reader, and on a 320 px screen.

**Independent Test**: At 320 px width, using only the keyboard, add two activities, change one setting, remove one and continue, without horizontal scrolling.

### Tests for User Story 7 ⚠️

- [ ] T051 [P] [US7] Extend `frontend/src/tests/keyboard.test.tsx` with tests that on Activity selection the tab order is: skip link, navigation, progress links, Back, each "Add <name>" in list order, then per activity Duration, Requires daylight, the weather fields and "Remove <name>", then Continue. Also cover completing Add, edit, Remove and Continue with the keyboard only.
- [ ] T052 [P] [US7] Extend `frontend/src/tests/accessibility.test.tsx` and `frontend/src/tests/layout.test.tsx`. Cover, for Activity selection and Places and forecast:
  - one `<h1>`, the page titles and the skip link;
  - every activity group is a `group` named after the activity;
  - every field has a label;
  - Add and Remove buttons name their activity;
  - loading, added, removed, checking and error messages are in live regions;
  - errors are text, not colour alone.
- [ ] T053 [P] [US7] Extend `frontend/src/tests/responsive.test.tsx`. Check that from 40em `.activity-selection-layout` has two columns (categories, then activities). Below 40em, check that:
  - it is one column with each setting on its own row;
  - buttons are full width with 44 × 44 px targets and 16 px input text;
  - the compact progress shows "Step 2 of 4: Activities" and "Step 3 of 4: Places and forecast".

### Implementation for User Story 7

- [ ] T054 [US7] In `frontend/src/styles.css`, add the Activity selection and Places and forecast styles, reusing the existing form, fieldset, button and breakpoint rules instead of copying them:
  - `.activity-selection-layout` as one column, and from 40em `grid-template-columns: minmax(0, 2fr) minmax(0, 3fr)` with `align-items: start`;
  - the category list rows with name, type and duration and the Add button;
  - activity fieldsets with spacing between them;
  - the step 3 activity list.

**Checkpoint**: All stories work for keyboard, screen reader and phone users.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T055 [P] Update `README.md` with an "Activity selection" section:
  - the steps `/plan/activities` and `/plan/places`;
  - adding a category more than once;
  - up to 10 activities;
  - changed settings apply only to the plan;
  - the activities live only in the browser tab and are cleared on logout;
  - who can use it.
  
  Add to the status line that feature 005 is implemented. No migration step is needed.
- [ ] T056 [P] Update `docs/ux-design.md`:
  - add the Activity Selection states "No activity categories are available yet.", "Checking your activities…" and "You can add up to 10 activities." and the first Places and Forecast state (setup and activities summary only, feature 006 and 007 add the rest);
  - check that the traceability rows for Activity Selection list FR-006, FR-008 and FR-037 as in `docs/architecture.md`, and fix any difference (constitution VI).
- [ ] T057 [P] Check that every new or changed C# class is under 200 lines (constitution I), especially `PlanActivityValidator.cs`, `PlanActivityService.cs` and `PlanActivitiesController.cs`. Check that every new React page or component is under about 200 lines, especially `planActivitiesForm.tsx`, `planActivitySettings.tsx` and `planCategoryList.tsx`. Split by responsibility if not.
- [ ] T058 Run `dotnet format .\SpekLaiku.slnx --verify-no-changes`, `dotnet build .\SpekLaiku.slnx` and `dotnet test .\SpekLaiku.slnx` from the repository root. Run `npm run lint`, `npm run format:check`, `npm test` and `npm run build` from `frontend/` (run the frontend tests on their own, not at the same time as the backend tests). Fix any failure without weakening tests or checks.
- [ ] T059 Review `git diff main...HEAD`. Check that:
  - there are no unintended files (no `bin/`, `obj/`, `node_modules/`, local settings or debug code);
  - there is no migration and no new package;
  - `appsettings.Development.json` is unchanged.

  Then list the quickstart Manual Validation steps for the user to run before the Pull Request.
- [ ] T060 Run a separate AI-assisted review of the branch (for example `/code-review` and `/security-review`) and apply or reject each finding with a short reason. Then prepare the Pull Request description for the user (constitution V, VII and Quality Gates). It must include:
  - a link to `specs/005-activity-selection/spec.md` and a summary of the change;
  - the tests and checks run (T058 and the manual quickstart steps), and "no migration";
  - screenshots of Activity selection (desktop and 320 px) with activities, with errors and with the categories error, and of Places and forecast;
  - the review tool, important findings, changes made and findings not applied.

  The user opens and merges the Pull Request.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories. Inside it:
  - T002 and T003 before T004; T004 before T005;
  - T003 and T006 before T007; T007 before T008;
  - T009 before T010, T011 and T012; T010 before T011 and T013.
- **US1 (Phase 3)**: Depends on Foundational. T017 before T018; T019 before T020; T021 before T023; T022, T023 and T024 before T025.
- **US3 (Phase 4)**: Depends on US1 (the activity groups).
- **US4 (Phase 5)**: Depends on US1 and US3. The backend tasks T028, T029, T033 and T034 need only Foundational and T017/T018; T035 before T036 and T038; T036 before T037; T037 and T039 before T038 and T040.
- **US2 (Phase 6)**: Depends on US4 (Continue, error display and step 3).
- **US6 (Phase 7)**: Depends on US4 (both endpoints and `/plan/places`).
- **US5 (Phase 8)**: Depends on US1 (the store) and US4 (`checked`). It can run alongside US2 and US6; T049 and T050 touch different files from theirs.
- **US7 (Phase 9)**: Depends on US1 to US6 (the tests check the final pages).
- **Polish (Phase 10)**: Depends on all stories.

### Within Each User Story

- Tests are written first and must fail before the implementation tasks.
- Backend: service → controller.
- Frontend: helper → API → store → component → page → route.

### Parallel Opportunities

- Foundational: T002, T003, T006, T009 and T012 touch different files; T005 and T008 follow their classes.
- US1: T014, T015 and T016 (tests) in parallel; then T019 and T021 alongside the backend tasks T017 and T018.
- US4: T028 to T032 (tests) in parallel; T035 and T039 alongside T033 and T034.
- US2: T041 and T042 in parallel.
- US6: T044 and T045 in parallel.
- US5: T047 and T048 in parallel.
- US7: T051 to T053 in parallel.
- Polish: T055 to T057 in parallel; then T058, T059 and T060 in order.

---

## Parallel Example: User Story 1

```text
# All tests for User Story 1 together:
Task: "T014 PlanCategoriesEndpointTests in backend/tests/SpekLaiku.IntegrationTests/PlanCategoriesEndpointTests.cs"
Task: "T015 planActivitiesApi and usePlanCategoriesStore tests in frontend/src/tests/"
Task: "T016 ActivitySelectionPage categories and Add tests in frontend/src/tests/ActivitySelectionPage.test.tsx"

# Independent pieces together:
Task: "T017 PlanActivityService.ListCategoriesAsync in backend/src/SpekLaiku.Api/Services/PlanActivityService.cs"
Task: "T019 listPlanCategories in frontend/src/api/planActivitiesApi.ts"
Task: "T021 shared WeatherLimitFields in frontend/src/components/weatherLimitFields.tsx"
```

## Parallel Example: User Story 4

```text
Task: "T028 PlanActivityServiceTests in backend/tests/SpekLaiku.UnitTests/PlanActivityServiceTests.cs"
Task: "T029 PlanActivitiesCheckEndpointTests in backend/tests/SpekLaiku.IntegrationTests/PlanActivitiesCheckEndpointTests.cs"
Task: "T030 planActivitiesApi and usePlanActivitiesCheckStore tests in frontend/src/tests/"
Task: "T031 ActivitySelectionPage Continue tests in frontend/src/tests/ActivitySelectionPage.test.tsx"
Task: "T032 PlacesAndForecastPage tests in frontend/src/tests/PlacesAndForecastPage.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2. The rules, shapes, mapping, store and names are in place and tested.
2. Complete Phase 3 (US1): a visitor sees the categories and adds activities with their defaults.
3. **STOP and VALIDATE** with the US1 independent test, then review the diff.

### Incremental Delivery

1. US1 → pick activities (MVP).
2. US3 → remove activities.
3. US4 → Continue, server check and step 3.
4. US2 → every setting and its message.
5. US6 → access on both endpoints and `/plan/places`.
6. US5 → session storage and clearing on logout.
7. US7 → keyboard, screen reader and 320 px.
8. Polish → documentation, size check, full checks, diff review, AI review and Pull Request description.

Implement one phase at a time and stop after each phase for a diff review. Commit only when asked, with Conventional Commit messages such as `feat(activity-selection): add plan activity validation`.

---

## Notes

- [P] tasks touch different files and do not depend on unfinished tasks.
- No migration and no new package. No external service is involved.
- Integration tests share one database with the starter categories and categories from other tests. Each test adds its own categories with `UniqueCategoryName` and checks only those.
- Every range and message comes from `ActivityLimitRules` (feature 003). The browser holds no range.
- API messages have no "Error: " prefix; the frontend adds it.
