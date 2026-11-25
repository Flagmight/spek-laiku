import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanEditStore } from "../stores/usePlanEditStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import styles from "../styles.css?inline"
import type { PlanCategory } from "../types/planActivity"
import { jsonResponse, renderApp, routeFetch, signedInUser } from "./renderApp"
import { accountList, activeUser, suspendedUser } from "./adminAccountsFixtures"
import { openCategories } from "./planCategories"
import {
  acceptMuseumPlan,
  longPlanName,
  savedPlanId,
  savedPlanRoutes,
  savedPlanSummaries,
  twoProblemRoutes,
} from "./savedPlansFixtures"
import { forecastRoutes } from "./forecastFixtures"
import { placesRoutes } from "./placesFixtures"
import { acceptKayakingAndMuseum, placesStepRoutes } from "./placesStep"

// jsdom applies stylesheet rules but does no layout, so these tests check the CSS rules
// behind the 320 px requirements. The real size check is the manual quickstart step at 320 px.

const minimumTarget = 44
const minimumInputText = 16

let styleElement: HTMLStyleElement

beforeEach(() => {
  styleElement = document.createElement("style")
  styleElement.textContent = styles
  document.head.append(styleElement)
})

afterEach(() => {
  styleElement.remove()
})

function px(value: string) {
  expect(value).toMatch(/^\d+(\.\d+)?px$/)
  return parseFloat(value)
}

function expectTouchTarget(element: Element) {
  const style = getComputedStyle(element)
  // min-height has no effect on inline elements.
  expect(style.display).not.toBe("inline")
  expect(px(style.minHeight)).toBeGreaterThanOrEqual(minimumTarget)
  expect(px(style.minWidth)).toBeGreaterThanOrEqual(minimumTarget)
}

// Renders the Register page with errors in two fields, so the error summary links are shown.
async function renderRegisterPageWithErrors() {
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string) =>
      Promise.resolve(
        path === "/api/registration"
          ? jsonResponse(400, {
              errors: {
                email: ["Enter a valid email address."],
                password: ["Password must be at least 8 characters."],
              },
            })
          : jsonResponse(401),
      ),
    ),
  )
  const user = userEvent.setup()
  renderApp("/register")
  await user.click(
    await screen.findByRole("button", { name: "Create account" }),
  )
  await screen.findByRole("alert", { name: "Error summary" })
}

describe("layout at 320 px", () => {
  it("makes every field full width, at least 44 px tall, with 16 px text", async () => {
    await renderRegisterPageWithErrors()

    for (const label of ["Email", "Password", "Confirm password"]) {
      const style = getComputedStyle(screen.getByLabelText(label))
      expect(style.width).toBe("100%")
      expect(style.boxSizing).toBe("border-box")
      expect(px(style.minHeight)).toBeGreaterThanOrEqual(minimumTarget)
      expect(px(style.fontSize)).toBeGreaterThanOrEqual(minimumInputText)
    }
  })

  it("makes the submit button full width and a 44 × 44 px target", async () => {
    await renderRegisterPageWithErrors()

    const submit = screen.getByRole("button", { name: "Create account" })
    expect(getComputedStyle(submit).width).toBe("100%")
    expect(getComputedStyle(submit).boxSizing).toBe("border-box")
    expectTouchTarget(submit)
  })

  it("makes every link and button on the page a 44 × 44 px target", async () => {
    await renderRegisterPageWithErrors()

    const targets = [
      ...screen.getAllByRole("link"),
      ...screen.getAllByRole("button"),
    ]
    expect(targets.length).toBeGreaterThanOrEqual(6)
    for (const target of targets) {
      expectTouchTarget(target)
    }
    expect(
      within(screen.getByRole("alert", { name: "Error summary" })).getAllByRole(
        "link",
      ),
    ).toHaveLength(2)
  })

  it("makes the Retry and Dismiss buttons 44 × 44 px targets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) =>
        Promise.resolve(
          path === "/api/registration" ? jsonResponse(500) : jsonResponse(401),
        ),
      ),
    )
    const user = userEvent.setup()
    renderApp({ pathname: "/register", state: { successMessage: "Saved." } })
    await user.click(
      await screen.findByRole("button", { name: "Create account" }),
    )

    expectTouchTarget(await screen.findByRole("button", { name: "Retry" }))
    expectTouchTarget(screen.getByRole("button", { name: "Dismiss" }))
  })

  it("wraps long text instead of widening the page", () => {
    expect(getComputedStyle(document.body).overflowWrap).toBe("anywhere")
  })

  it("sets no fixed width wider than 320 px", () => {
    const widths = [
      ...styles.matchAll(/(?:^|[\s;{])(?:min-|max-)?width:\s*([\d.]+)px/g),
    ].map((match) => parseFloat(match[1]))
    for (const width of widths) {
      expect(width).toBeLessThanOrEqual(320)
    }
  })

  it("sizes form buttons to their text only from 40em wide", () => {
    // The full-width rule is the base rule; only a min-width media query may change it.
    expect(styles).toMatch(
      /@media \(min-width: 40em\) \{\s*form button \{\s*width: auto;/,
    )
  })
})

// Renders the Log in page with errors in both fields, so the error summary links are shown.
async function renderLoginPageWithErrors() {
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string) =>
      Promise.resolve(
        path === "/api/auth/login"
          ? jsonResponse(400, {
              errors: {
                email: ["Enter your email address."],
                password: ["Enter your password."],
              },
            })
          : jsonResponse(401),
      ),
    ),
  )
  const user = userEvent.setup()
  renderApp("/login")
  await user.click(await screen.findByRole("button", { name: "Log in" }))
  await screen.findByRole("alert", { name: "Error summary" })
}

describe("Log in page at 320 px", () => {
  it("uses the Register page field rules: full width, at least 44 px tall, 16 px text", async () => {
    await renderLoginPageWithErrors()

    for (const label of ["Email", "Password"]) {
      const style = getComputedStyle(screen.getByLabelText(label))
      expect(style.width).toBe("100%")
      expect(style.boxSizing).toBe("border-box")
      expect(px(style.minHeight)).toBeGreaterThanOrEqual(minimumTarget)
      expect(px(style.fontSize)).toBeGreaterThanOrEqual(minimumInputText)
    }
  })

  it("makes the submit button full width and a 44 × 44 px target", async () => {
    await renderLoginPageWithErrors()

    const submit = screen.getByRole("button", { name: "Log in" })
    expect(getComputedStyle(submit).width).toBe("100%")
    expectTouchTarget(submit)
  })

  it("makes every link and button on the page, including 'Create an account', a 44 × 44 px target", async () => {
    await renderLoginPageWithErrors()

    const targets = [
      ...screen.getAllByRole("link"),
      ...screen.getAllByRole("button"),
    ]
    expect(targets).toContain(
      screen.getByRole("link", { name: "Create an account" }),
    )
    for (const target of targets) {
      expectTouchTarget(target)
    }
  })
})

describe("Account Suspended page at 320 px", () => {
  it("makes Home and Log out 44 × 44 px targets, and Log out is not stretched like a form button", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(200, {
            email: "user@example.com",
            role: "Registered User",
            accountStatus: "Suspended",
          }),
        ),
      ),
    )
    renderApp("/account-suspended")
    await screen.findByRole("heading", { level: 1, name: "Account suspended" })

    const logOut = screen.getByRole("button", { name: "Log out" })
    for (const target of [...screen.getAllByRole("link"), logOut]) {
      expectTouchTarget(target)
    }
    expect(getComputedStyle(logOut).width).not.toBe("100%")
  })
})

// Opens the create form as an Active Administrator with Outdoor selected, so every field is shown.
async function renderCategoriesPageWithForm() {
  routeFetch({
    ...forecastRoutes,
    ...placesRoutes,
    "GET /api/auth/me": () => jsonResponse(200, signedInUser("Administrator")),
    "GET /api/admin/categories": () =>
      jsonResponse(200, [
        {
          id: "id-museum",
          name: "Museum",
          type: "Indoor",
          defaultDurationHours: 2,
          requiresDaylight: false,
          maxWindMs: null,
          maxRainMmPerHour: null,
          minTemperatureC: null,
          maxTemperatureC: null,
          placeTags: ["tourism=museum"],
          version: 1,
        },
      ]),
  })
  const user = userEvent.setup()
  renderApp("/admin/categories")
  await user.click(
    await screen.findByRole("button", { name: "Create category" }),
  )
  await user.click(screen.getByRole("radio", { name: "Outdoor" }))
  return screen.getByRole("region", { name: "Create category" })
}

describe("Activity categories page at 320 px", () => {
  it("shows the list and the form in one column, list first", async () => {
    const form = await renderCategoriesPageWithForm()
    const list = screen.getByRole("list", { name: "Activity categories" })
    const layout = form.closest(".categories-layout")

    expect(layout).not.toBeNull()
    expect(getComputedStyle(layout!).display).toBe("grid")
    // One column: no column template below 40em.
    expect(getComputedStyle(layout!).gridTemplateColumns).toBe("none")
    expect(
      list.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it("shows the list and the form side by side from 40em wide", () => {
    expect(styles).toMatch(
      /@media \(min-width: 40em\) \{[^@]*\.categories-layout\.with-form \{\s*grid-template-columns: minmax\(0, 2fr\) minmax\(0, 3fr\);/,
    )
  })

  it("uses the Register page field rules: full width, at least 44 px tall, 16 px text", async () => {
    const form = await renderCategoriesPageWithForm()

    const inputs = within(form).getAllByRole("textbox")
    expect(inputs).toHaveLength(7)
    for (const input of inputs) {
      const style = getComputedStyle(input)
      expect(style.width).toBe("100%")
      expect(style.boxSizing).toBe("border-box")
      expect(px(style.minHeight)).toBeGreaterThanOrEqual(minimumTarget)
      expect(px(style.fontSize)).toBeGreaterThanOrEqual(minimumInputText)
    }
  })

  it("keeps the radio buttons and the checkbox small and makes their labels 44 × 44 px targets", async () => {
    const form = await renderCategoriesPageWithForm()

    for (const choice of [
      ...within(form).getAllByRole("radio"),
      within(form).getByRole("checkbox"),
    ]) {
      expect(getComputedStyle(choice).width).not.toBe("100%")
      const label =
        choice.closest("label") ??
        form.querySelector(`label[for="${choice.id}"]`)
      expectTouchTarget(label!)
    }
  })

  it("makes Save and Cancel full width and every link and button a 44 × 44 px target", async () => {
    const form = await renderCategoriesPageWithForm()

    for (const name of ["Save", "Cancel"]) {
      const button = within(form).getByRole("button", { name })
      expect(getComputedStyle(button).width).toBe("100%")
    }
    const targets = [
      ...screen.getAllByRole("link"),
      ...screen.getAllByRole("button"),
    ]
    expect(targets).toContain(
      screen.getByRole("button", { name: "Edit Museum" }),
    )
    for (const target of targets) {
      expectTouchTarget(target)
    }
  })
})

// Plan setup with one date chip, and Kaunas offered for "Kaun".
async function renderPlanSetupWithChip() {
  usePlanSetupStore.getState().addDate("2026-11-07")
  routeFetch({
    ...forecastRoutes,
    ...placesRoutes,
    "GET /api/auth/me": () => jsonResponse(401),
    "GET /api/plan-setup/period": () =>
      jsonResponse(200, {
        firstDate: "2026-11-04",
        lastDate: "2026-11-10",
        maxDates: 7,
      }),
    "GET /api/locations?query=Kaun": () =>
      jsonResponse(200, {
        locations: [
          {
            id: 598316,
            name: "Kaunas",
            area: "Kaunas County",
            latitude: 54.90156,
            longitude: 23.90909,
          },
        ],
      }),
  })
  renderApp("/plan/setup")
  await vi.waitFor(() =>
    expect(screen.getByLabelText("Dates", { selector: "input" })).toBeEnabled(),
  )
}

describe("Plan setup page at 320 px", () => {
  it("stacks the dates and the distance, and lets the date chips wrap", async () => {
    await renderPlanSetupWithChip()

    const fields = screen.getByRole("group", { name: "Dates" }).parentElement!
    expect(fields).toHaveClass("plan-fields")
    expect(getComputedStyle(fields).display).toBe("grid")
    expect(getComputedStyle(fields).gridTemplateColumns).toBe("none")
    const chips = screen
      .getByRole("button", {
        name: "Remove Sat 7 Nov 2026",
      })
      .closest("ul")!
    expect(getComputedStyle(chips).display).toBe("flex")
    expect(getComputedStyle(chips).flexWrap).toBe("wrap")
  })

  it("shows the compact step line and hides the list of steps visually only", async () => {
    await renderPlanSetupWithChip()

    const progress = screen.getByRole("navigation", { name: "Plan progress" })
    const steps = within(progress).getByRole("list")
    expect(getComputedStyle(steps).position).toBe("absolute")
    expect(getComputedStyle(steps).clipPath).toBe("inset(50%)")
    // Still in the accessibility tree, unlike display: none.
    expect(getComputedStyle(steps).display).not.toBe("none")
    const compact = within(progress).getByText("Step 1 of 4: Plan setup")
    expect(getComputedStyle(compact).display).not.toBe("none")
    expect(
      compact.querySelectorAll(".plan-progress-segments span"),
    ).toHaveLength(4)
  })

  it("makes Add date and Continue full width, and keeps Remove small", async () => {
    await renderPlanSetupWithChip()

    for (const name of ["Add date", "Continue"]) {
      expect(getComputedStyle(screen.getByRole("button", { name })).width).toBe(
        "100%",
      )
    }
    const remove = screen.getByRole("button", { name: "Remove Sat 7 Nov 2026" })
    expect(getComputedStyle(remove).width).toBe("auto")
  })

  it("makes every link, button and suggestion a 44 px target and uses 16 px input text", async () => {
    await renderPlanSetupWithChip()
    const user = userEvent.setup()
    await user.click(screen.getByRole("combobox", { name: "Location" }))
    await user.paste("Kaun")
    const option = await screen.findByRole("option")

    for (const target of [
      ...screen.getAllByRole("link"),
      ...screen.getAllByRole("button"),
    ]) {
      expectTouchTarget(target)
    }
    expect(getComputedStyle(option).display).toBe("flex")
    expect(px(getComputedStyle(option).minHeight)).toBeGreaterThanOrEqual(
      minimumTarget,
    )
    for (const label of ["Location", "Dates", "Maximum travel distance (km)"]) {
      const style = getComputedStyle(
        screen.getByLabelText(label, { selector: "input" }),
      )
      expect(px(style.fontSize)).toBeGreaterThanOrEqual(minimumInputText)
      expect(px(style.minHeight)).toBeGreaterThanOrEqual(minimumTarget)
    }
  })

  it("shows the four steps, the fields side by side and the date picker in a row from 40em wide", () => {
    const wide = styles.slice(styles.indexOf("@media (min-width: 40em)"))

    expect(wide).toMatch(
      /\.plan-progress ol \{[^}]*position: static;[^}]*display: flex;/,
    )
    expect(wide).toMatch(/\.plan-progress-compact \{\s*display: none;/)
    expect(wide).toMatch(
      /\.plan-fields \{\s*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 14rem\);/,
    )
    expect(wide).toMatch(/\.date-picker \{\s*flex-direction: row;/)
    // The Date label keeps its own line, so the input beside the button never squeezes it.
    expect(wide).toMatch(/\.date-picker label \{\s*flex-basis: 100%;/)
  })
})

const kayaking: PlanCategory = {
  id: "category-kayaking",
  name: "Kayaking",
  type: "Outdoor",
  defaultDurationHours: 2,
  requiresDaylight: true,
  maxWindMs: 8,
  maxRainMmPerHour: 0.5,
  minTemperatureC: 15,
  maxTemperatureC: 35,
}

function acceptPlanSetup() {
  usePlanSetupStore.getState().setChecked({
    location: {
      id: 598316,
      name: "Kaunas",
      area: "Kaunas County",
      latitude: 54.90156,
      longitude: 23.90909,
    },
    dates: ["2026-11-07"],
    maxTravelDistanceKm: 30,
  })
}

async function renderActivitySelection(
  categories: () => Response = () =>
    jsonResponse(200, { categories: [kayaking], maxActivities: 10 }),
) {
  acceptPlanSetup()
  usePlanActivitiesStore.getState().add(kayaking)
  routeFetch({
    ...forecastRoutes,
    ...placesRoutes,
    "GET /api/auth/me": () => jsonResponse(401),
    "GET /api/plan-activities/categories": categories,
  })
  renderApp("/plan/activities")
  return screen.findByRole("group", { name: "Kayaking" })
}

describe("Activity selection at 320 px", () => {
  it("shows the categories first and then the activities, in one column", async () => {
    const group = await renderActivitySelection()
    const categories = screen.getByRole("region", {
      name: "Activity categories",
    })
    const layout = group.closest(".activity-selection-layout")!

    expect(getComputedStyle(layout).display).toBe("grid")
    expect(getComputedStyle(layout).gridTemplateColumns).toBe("none")
    expect(
      categories.compareDocumentPosition(group) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it("puts each setting on its own row", async () => {
    const group = await renderActivitySelection()

    for (const field of within(group).getAllByRole("textbox")) {
      expect(getComputedStyle(field.closest(".form-field")!).display).toBe(
        "block",
      )
      expect(getComputedStyle(field).width).toBe("100%")
      expect(px(getComputedStyle(field).fontSize)).toBeGreaterThanOrEqual(
        minimumInputText,
      )
    }
  })

  it("lets an activity group shrink to the screen", async () => {
    const group = await renderActivitySelection()

    expect(getComputedStyle(group).minWidth).toBe("0px")
  })

  it("makes Add, Remove and Continue full width", async () => {
    await renderActivitySelection()
    await openCategories()

    for (const name of ["Add Kayaking", "Remove Kayaking", "Continue"]) {
      const button = screen.getByRole("button", { name })
      expect(getComputedStyle(button).width).toBe("100%")
    }
  })

  it("makes Retry full width when the categories fail", async () => {
    await renderActivitySelection(() => jsonResponse(500))

    const retry = await screen.findByRole("button", { name: "Retry" })
    expect(getComputedStyle(retry).width).toBe("100%")
    expectTouchTarget(retry)
  })

  it("makes every link and button a 44 × 44 px target", async () => {
    await renderActivitySelection()
    await openCategories()

    for (const target of [
      ...screen.getAllByRole("link"),
      ...screen.getAllByRole("button"),
    ]) {
      expectTouchTarget(target)
    }
  })

  it("keeps a disabled Add looking disabled", async () => {
    await renderActivitySelection(() =>
      jsonResponse(200, { categories: [kayaking], maxActivities: 1 }),
    )

    await openCategories()
    const add = screen.getByRole("button", { name: "Add Kayaking" })
    await vi.waitFor(() => expect(add).toBeDisabled())
    expect(getComputedStyle(add).backgroundColor).toBe("rgb(154, 165, 177)")
  })

  it("shows the compact step line for step 2", async () => {
    await renderActivitySelection()

    const progress = screen.getByRole("navigation", { name: "Plan progress" })
    const compact = within(progress).getByText("Step 2 of 4: Activities")
    expect(
      compact.querySelectorAll(".plan-progress-segments span"),
    ).toHaveLength(4)
    expect(compact.querySelectorAll(".done")).toHaveLength(2)
  })

  it("shows the categories and the activities side by side from 40em wide", () => {
    const wide = styles.slice(styles.indexOf("@media (min-width: 40em)"))

    expect(wide).toMatch(
      /\.activity-selection-layout,[^{]*\{\s*grid-template-columns: minmax\(0, 2fr\) minmax\(0, 3fr\);\s*align-items: start;/,
    )
    expect(wide).toMatch(/\.activity-selection-layout button \{\s*width: auto;/)
  })
})

describe("Places and forecast at 320 px", () => {
  async function renderPlaces() {
    acceptPlanSetup()
    usePlanActivitiesStore.getState().setChecked([
      {
        id: "a",
        categoryId: kayaking.id,
        name: "Kayaking",
        type: "Outdoor",
        durationHours: 2,
        requiresDaylight: true,
        maxWindMs: 8,
        maxRainMmPerHour: 0.5,
        minTemperatureC: 15,
        maxTemperatureC: 35,
      },
    ])
    routeFetch({
      ...forecastRoutes,
      ...placesRoutes,
      "GET /api/auth/me": () => jsonResponse(401),
    })
    renderApp("/plan/places")
    await screen.findByRole("heading", {
      level: 1,
      name: "Places and forecast",
    })
  }

  it("shows the compact step line for step 3", async () => {
    await renderPlaces()

    const progress = screen.getByRole("navigation", { name: "Plan progress" })
    const compact = within(progress).getByText(
      "Step 3 of 4: Places and forecast",
    )
    expect(compact.querySelectorAll(".done")).toHaveLength(3)
  })

  it("makes every link a 44 × 44 px target", async () => {
    await renderPlaces()

    for (const target of screen.getAllByRole("link")) {
      expectTouchTarget(target)
    }
  })

  it("shows the activities as a plain list", async () => {
    await renderPlaces()

    const list = screen.getByRole("list", { name: "Plan activities" })
    expect(list).toHaveClass("plan-activities-summary")
    // jsdom does not expand the list-style shorthand, so the rule itself is checked.
    expect(styles).toMatch(
      /\.plan-activities-summary \{[^}]*padding: 0;[^}]*list-style: none;/,
    )
  })
})

describe("Places and forecast hours at 320 px", () => {
  const kaunas = {
    id: 598316,
    name: "Kaunas",
    area: "Kaunas County",
    latitude: 54.90156,
    longitude: 23.90909,
  }

  // Step 3 with one checked Kayaking activity, its forecast details open and its first date's hours open.
  async function renderOpenHours() {
    usePlanSetupStore.getState().setChecked({
      location: kaunas,
      dates: ["2026-11-07"],
      maxTravelDistanceKm: 30,
    })
    usePlanActivitiesStore.getState().setChecked([
      {
        id: "a",
        categoryId: "category-kayaking",
        name: "Kayaking",
        type: "Outdoor",
        durationHours: 2,
        requiresDaylight: true,
        maxWindMs: 8,
        maxRainMmPerHour: 0.5,
        minTemperatureC: 15,
        maxTemperatureC: 35,
      },
    ])
    routeFetch({
      ...forecastRoutes,
      ...placesRoutes,
      "GET /api/auth/me": () => jsonResponse(401),
    })
    const user = userEvent.setup()
    renderApp("/plan/places")
    await user.click(
      await screen.findByRole("button", {
        name: "Show forecast details, Kayaking",
      }),
    )
    await user.click(
      screen.getByRole("button", {
        name: "Show hours for Saturday 7 November 2026, Kayaking",
      }),
    )
    return screen.getByRole("table", { name: /^Hours for/ })
  }

  it("shows each hour as a card with a border", async () => {
    const table = await renderOpenHours()

    expect(getComputedStyle(table).display).toBe("block")
    const [, firstHour] = within(table).getAllByRole("row")
    expect(getComputedStyle(firstHour).display).toBe("block")
    expect(getComputedStyle(firstHour).borderStyle).toBe("solid")
    for (const cell of within(firstHour).getAllByRole("cell")) {
      expect(getComputedStyle(cell).display).toBe("block")
    }
  })

  it("shows every cell's label, so each value reads 'Label: value'", async () => {
    const table = await renderOpenHours()

    const [, firstHour] = within(table).getAllByRole("row")
    const labels = firstHour.querySelectorAll(".cell-label")
    expect([...labels].map((label) => label.textContent)).toEqual([
      "Time: ",
      "Temperature: ",
      "Rain: ",
      "Wind: ",
      "Daylight: ",
      "Suitability: ",
    ])
    for (const label of labels) {
      expect(getComputedStyle(label).display).not.toBe("none")
    }
  })

  it("keeps the header row in the table but hidden on phones", async () => {
    const table = await renderOpenHours()

    expect(within(table).getAllByRole("columnheader")).toHaveLength(6)
    const header = table.querySelector("thead")!
    expect(getComputedStyle(header).position).toBe("absolute")
    // The rule may be shared with the plan overview in one selector list (feature 007).
    expect(styles).toMatch(
      /\.forecast-hours thead[^{]*\{[^}]*overflow: hidden;[^}]*clip-path: inset\(50%\);/,
    )
  })

  it("makes Show and Hide full-width 44 × 44 px targets", async () => {
    await renderOpenHours()

    const hide = screen.getByRole("button", {
      name: "Hide hours for Saturday 7 November 2026, Kayaking",
    })
    expect(getComputedStyle(hide).width).toBe("100%")
    expectTouchTarget(hide)
  })

  it("wraps long reasons instead of widening the page", () => {
    // jsdom does no layout, so the rule behind "no horizontal scrolling at 320 px" is checked.
    // The rule may be shared with the plan overview in one selector list (feature 007).
    expect(styles).toMatch(
      /\.forecast-hours td[,\s][^{]*\{[^}]*overflow-wrap: anywhere;/,
    )
  })

  it("shows a real table with its header row and no cell labels from 40em wide", () => {
    const wide = styles.slice(styles.indexOf("@media (min-width: 40em)"))

    expect(wide).toMatch(/\.forecast-hours \{\s*display: table;/)
    expect(wide).toMatch(
      /\.forecast-hours thead \{[^}]*display: table-header-group;[^}]*clip-path: none;/,
    )
    expect(wide).toMatch(/\.forecast-hours tr \{\s*display: table-row;/)
    expect(wide).toMatch(/\.cell-label \{\s*display: none;/)
    // Shared with the other step 3 buttons in one selector list (feature 007).
    expect(wide).toMatch(/\.forecast-date button[^{]*\{\s*width: auto;/)
  })

  it("frames the 'checked again' notice instead of relying on colour", () => {
    expect(styles).toMatch(
      /\.recheck-notice \{[^}]*border: 2px solid[^}]*border-left-width: 8px;/,
    )
  })
})

describe("Places and forecast overview and places at 320 px", () => {
  async function renderStep(places?: Parameters<typeof placesStepRoutes>[0]) {
    acceptKayakingAndMuseum()
    routeFetch(placesStepRoutes(places))
    renderApp("/plan/places")
    await screen.findByRole("table", { name: "Plan overview" })
  }

  function overview() {
    return screen.getByRole("table", { name: "Plan overview" })
  }

  it("shows each overview row as a card with a border, its heading as the title", async () => {
    await renderStep()

    const table = overview()
    expect(getComputedStyle(table).display).toBe("block")
    const [, kayakingRow] = within(table).getAllByRole("row")
    expect(getComputedStyle(kayakingRow).display).toBe("block")
    expect(getComputedStyle(kayakingRow).borderStyle).toBe("solid")
    expect(
      getComputedStyle(within(kayakingRow).getByRole("rowheader")).display,
    ).toBe("block")
    for (const cell of within(kayakingRow).getAllByRole("cell")) {
      expect(getComputedStyle(cell).display).toBe("block")
    }
    expect(getComputedStyle(table.querySelector("thead")!).position).toBe(
      "absolute",
    )
  })

  it("shows every cell's label, so each value reads 'Label: value'", async () => {
    await renderStep()

    const [, kayakingRow] = within(overview()).getAllByRole("row")
    expect(
      within(kayakingRow)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["Place: Nemuno slipway", "Sat 7 Nov: ★ 08:00–16:00 (8 h)"])
    for (const label of kayakingRow.querySelectorAll(".cell-label")) {
      expect(getComputedStyle(label).display).not.toBe("none")
    }
  })

  it("makes Remove, Change activity and Show forecast details full-width 44 × 44 px targets", async () => {
    await renderStep()

    for (const name of [
      "Remove, Museum",
      "Change activity, Museum",
      "Show forecast details, Kayaking",
    ]) {
      const button = screen.getByRole("button", { name })
      expect(getComputedStyle(button).width).toBe("100%")
      expectTouchTarget(button)
    }
  })

  it("makes the places' Retry a full-width 44 × 44 px target", async () => {
    await renderStep(() =>
      jsonResponse(503, { status: 503, service: "places" }),
    )

    const retry = await screen.findByRole("button", { name: "Retry" })
    expect(getComputedStyle(retry).width).toBe("100%")
    expectTouchTarget(retry)
  })

  it("lists the places without bullets, each map link a 44 × 44 px target", async () => {
    await renderStep()

    const link = screen.getByRole("link", {
      name: "View on map, Nemuno slipway (opens in a new tab)",
    })
    const list = link.closest("ul")!
    expect(getComputedStyle(list).listStyle).toContain("none")
    expectTouchTarget(link)
  })

  it("wraps long place names and overview cells instead of widening the page", () => {
    // jsdom does no layout, so the rules behind "no horizontal scrolling at 320 px" are checked.
    expect(styles).toMatch(/\.place-name \{[^}]*overflow-wrap: anywhere;/)
    expect(styles).toMatch(
      /\.plan-overview td,\s*\.saved-plans td \{[^}]*overflow-wrap: anywhere;/,
    )
  })

  // The saved plans table (feature 010) shares these rules, so its selector is grouped with each one.
  it("shows the overview as a real table without cell labels from 40em wide", () => {
    const wide = styles.slice(styles.indexOf("@media (min-width: 40em)"))

    expect(wide).toMatch(
      /\.plan-overview,\s*\.saved-plans \{\s*display: table;/,
    )
    expect(wide).toMatch(
      /\.plan-overview thead,\s*\.saved-plans thead \{[^}]*display: table-header-group;[^}]*clip-path: none;/,
    )
    expect(wide).toMatch(
      /\.plan-overview tr,\s*\.saved-plans tr \{\s*display: table-row;/,
    )
    expect(wide).toMatch(/\.cell-label \{\s*display: none;/)
  })
})

describe("Schedule overview at 320 px", () => {
  function acceptPlan() {
    usePlanSetupStore.getState().setChecked({
      location: {
        id: 598316,
        name: "Kaunas",
        area: "Kaunas County",
        latitude: 54.90156,
        longitude: 23.90909,
      },
      dates: ["2026-11-15"],
      maxTravelDistanceKm: 30,
    })
    usePlanActivitiesStore.getState().setChecked([
      {
        id: "a",
        categoryId: "cat-k",
        name: "Kayaking",
        type: "Outdoor",
        durationHours: 2,
        requiresDaylight: true,
        maxWindMs: 8,
        maxRainMmPerHour: 0.5,
        minTemperatureC: 15,
        maxTemperatureC: 35,
      },
    ])
  }

  async function renderSchedule() {
    acceptPlan()
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "POST /api/plan-schedule": () =>
        jsonResponse(200, {
          generatedScheduleId: "6f1c2a8e-3b7d-4e55-9a10-0c4f2d9b7e31",
          scheduled: [
            {
              activityName: "Kayaking",
              date: "2026-11-15",
              startTime: "10:00",
              endTime: "12:00",
              place: {
                name: "Slipway",
                latitude: 54.89,
                longitude: 23.93,
                distanceKm: 3.4,
                area: "Kaunas",
              },
              weather: {
                temperatureC: 18.5,
                rainMmPerHour: 0.2,
                windMs: 3.1,
                isIndoor: false,
              },
              travel: null,
            },
          ],
          unscheduled: [],
          travel: { maxDistanceKm: 30, tripsOverLimit: 0 },
        }),
    })
    renderApp("/plan/schedule")
    await screen.findByRole("heading", { level: 1, name: "Schedule overview" })
  }

  it("shows the compact step line for step 4", async () => {
    await renderSchedule()

    const progress = screen.getByRole("navigation", { name: "Plan progress" })
    const compact = within(progress).getByText("Step 4 of 4: Schedule")
    expect(compact.querySelectorAll(".done")).toHaveLength(4)
  })

  it("makes every link a 44 × 44 px target", async () => {
    await renderSchedule()

    for (const target of screen.getAllByRole("link")) {
      expectTouchTarget(target)
    }
  })

  it("makes the Retry button a 44 × 44 px target when the schedule fails", async () => {
    acceptPlan()
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "POST /api/plan-schedule": () => jsonResponse(500),
    })
    renderApp("/plan/schedule")

    const retry = await screen.findByRole("button", { name: "Retry" })
    expectTouchTarget(retry)
  })

  it("wraps long activity and weather text instead of widening the page", () => {
    // jsdom does no layout; the global rule ensures schedule text wraps at 320 px.
    expect(styles).toMatch(/body \{[^}]*overflow-wrap: anywhere;/)
  })

  it("lets a long travel text wrap inside its entry", async () => {
    const longName =
      "Kauno marių regioninio parko Pažaislio vienuolyno prieplauka"
    acceptPlan()
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "POST /api/plan-schedule": () =>
        jsonResponse(200, {
          generatedScheduleId: "6f1c2a8e-3b7d-4e55-9a10-0c4f2d9b7e31",
          scheduled: [
            {
              activityName: "Kayaking",
              date: "2026-11-15",
              startTime: "13:00",
              endTime: "15:00",
              place: {
                name: "Slipway",
                latitude: 54.89,
                longitude: 23.93,
                distanceKm: 3.4,
                area: "Kaunas",
              },
              weather: {
                temperatureC: 18.5,
                rainMmPerHour: 0.2,
                windMs: 3.1,
                isIndoor: false,
              },
              travel: {
                fromPlaceName: longName,
                distanceKm: 142.5,
                overLimit: true,
              },
            },
          ],
          unscheduled: [],
          travel: { maxDistanceKm: 30, tripsOverLimit: 1 },
        }),
    })
    renderApp("/plan/schedule")

    const travel = await screen.findByText(new RegExp(`from ${longName}`))
    // jsdom does no layout: the travel text inherits the page-wide wrapping rule, and nothing
    // on its way up to the list keeps it on one line or gives it a fixed width (spec SC-006).
    expect(getComputedStyle(document.body).overflowWrap).toBe("anywhere")
    for (
      let element: HTMLElement | null = travel;
      element && element.tagName !== "MAIN";
      element = element.parentElement
    ) {
      expect(getComputedStyle(element).whiteSpace).not.toBe("nowrap")
      expect(element.style.width).toBe("")
    }
  })
})

// Feature 010 spec User Story 7, SC-006: the saved plan screens at 320 px.
describe("Saved plans at 320 px", () => {
  it("makes the plan name field full width with 16 px text, and Save and Cancel 44 × 44 px", async () => {
    acceptMuseumPlan()
    routeFetch(savedPlanRoutes())
    const user = userEvent.setup()
    renderApp("/plan/schedule")
    await user.click(await screen.findByRole("button", { name: "Save plan" }))

    const style = getComputedStyle(screen.getByLabelText("Plan name"))
    expect(style.width).toBe("100%")
    expect(px(style.fontSize)).toBeGreaterThanOrEqual(minimumInputText)
    for (const name of ["Save", "Cancel"]) {
      expectTouchTarget(screen.getByRole("button", { name }))
    }
  })

  it("shows My plans as cards that wrap an 80-character name", async () => {
    routeFetch(savedPlanRoutes(savedPlanSummaries(2, () => longPlanName)))
    renderApp("/plans")

    const table = await screen.findByRole("table", { name: "Your saved plans" })
    expect(getComputedStyle(table).display).toBe("block")
    const row = within(table).getAllByRole("row")[1]
    expect(getComputedStyle(row).display).toBe("block")
    const name = within(row).getByRole("rowheader")
    expect(getComputedStyle(name).overflowWrap).toBe("anywhere")
    expect(within(row).getByText("Location:")).toBeVisible()
    for (const link of within(table).getAllByRole("link")) {
      expectTouchTarget(link)
    }
  })

  it("keeps the Home block's links 44 × 44 px", async () => {
    routeFetch(savedPlanRoutes(savedPlanSummaries(2)))
    renderApp("/")

    const block = await screen.findByRole("region", {
      name: "Your saved plans",
    })
    await within(block).findByRole("table")
    for (const link of within(block).getAllByRole("link")) {
      expectTouchTarget(link)
    }
  })

  it("wraps a long plan name in the plan page's breadcrumbs and setup", async () => {
    routeFetch(savedPlanRoutes())
    renderApp(`/plans/${savedPlanId}`)

    const breadcrumbs = await screen.findByRole("navigation", {
      name: "Breadcrumb",
    })
    const current = within(breadcrumbs).getByText(longPlanName)
    expect(getComputedStyle(current).overflowWrap).toBe("anywhere")
    expect(
      getComputedStyle(within(breadcrumbs).getByRole("list")).flexWrap,
    ).toBe("wrap")
    for (const link of within(breadcrumbs).getAllByRole("link")) {
      expectTouchTarget(link)
    }
    expect(
      getComputedStyle(screen.getByText("Kaunas, Kaunas County")).overflowWrap,
    ).toBe("anywhere")
  })
})

// Feature 011 User Story 6: plan management at 320 px. jsdom does no layout, so these check the CSS rules.
describe("Plan management at 320 px", () => {
  it("keeps My plans' row actions 44 × 44 px inside the cards", async () => {
    routeFetch(savedPlanRoutes(savedPlanSummaries(2, () => longPlanName)))
    renderApp("/plans")

    const table = await screen.findByRole("table", { name: "Your saved plans" })
    const buttons = within(table).getAllByRole("button")
    expect(buttons).toHaveLength(4)
    for (const button of buttons) {
      expectTouchTarget(button)
    }
    expect(getComputedStyle(within(table).getAllByRole("row")[1]).display).toBe(
      "block",
    )
  })

  it("covers the page with the dialog and keeps it within the screen", async () => {
    routeFetch(savedPlanRoutes(savedPlanSummaries(1, () => longPlanName)))
    const user = userEvent.setup()
    renderApp("/plans")
    await user.click(
      await screen.findByRole("button", { name: `Delete ${longPlanName}` }),
    )

    const dialog = screen.getByRole("dialog")
    const backdrop = getComputedStyle(dialog.parentElement!)
    expect(backdrop.position).toBe("fixed")
    expect(getComputedStyle(dialog).maxWidth).toBe("28rem")
    expect(getComputedStyle(dialog).width).toBe("100%")
    expect(getComputedStyle(dialog).overflowWrap).toBe("anywhere")
    for (const button of within(dialog).getAllByRole("button")) {
      expectTouchTarget(button)
    }
  })

  it("wraps the plan page's actions and keeps them 44 × 44 px", async () => {
    routeFetch(savedPlanRoutes())
    renderApp(`/plans/${savedPlanId}`)

    const edit = await screen.findByRole("button", { name: "Edit plan" })
    expect(getComputedStyle(edit.parentElement!).flexWrap).toBe("wrap")
    for (const button of within(edit.parentElement!).getAllByRole("button")) {
      expectTouchTarget(button)
    }
  })

  it("makes the Rename field full width with 16 px text, and Save and Cancel 44 × 44 px", async () => {
    routeFetch(savedPlanRoutes())
    const user = userEvent.setup()
    renderApp(`/plans/${savedPlanId}`)
    await user.click(await screen.findByRole("button", { name: "Rename" }))

    const style = getComputedStyle(screen.getByLabelText("Plan name"))
    expect(style.width).toBe("100%")
    expect(px(style.fontSize)).toBeGreaterThanOrEqual(minimumInputText)
    for (const name of ["Save", "Cancel"]) {
      expectTouchTarget(screen.getByRole("button", { name }))
    }
  })

  it("keeps Cancel editing 44 × 44 px in the editing notice", async () => {
    acceptMuseumPlan()
    usePlanEditStore.getState().start({
      planId: savedPlanId,
      planName: longPlanName,
      ownerEmail: "user@example.com",
    })
    routeFetch({
      ...savedPlanRoutes(),
      "GET /api/plan-setup/period": () =>
        jsonResponse(200, {
          firstDate: "2026-11-14",
          lastDate: "2026-11-20",
          maxDates: 7,
        }),
    })
    renderApp("/plan/setup")

    expectTouchTarget(
      await screen.findByRole("button", { name: "Cancel editing" }),
    )
  })
})

// Feature 012 User Story 7: the plan check at 320 px. jsdom does no layout, so these check the CSS rules.
describe("Plan check at 320 px", () => {
  it("gives Recalculate the full width and keeps it a 44 × 44 px target", async () => {
    routeFetch(twoProblemRoutes())
    renderApp(`/plans/${savedPlanId}`)

    const recalculate = await screen.findByRole("button", {
      name: "Recalculate",
    })
    expect(getComputedStyle(recalculate).flexBasis).toBe("100%")
    expectTouchTarget(recalculate)
  })

  it("shows each problem as a card that wraps, with a 44 × 44 px link", async () => {
    routeFetch(twoProblemRoutes())
    renderApp(`/plans/${savedPlanId}`)

    const region = await screen.findByRole("region", { name: "Plan check" })
    const links = await within(region).findAllByRole("link")
    expect(links).toHaveLength(2)
    for (const link of links) {
      expectTouchTarget(link)
      const card = getComputedStyle(link.closest("li")!)
      expect(card.overflowWrap).toBe("anywhere")
      expect(card.borderStyle).toBe("solid")
    }
    const reasons = document.querySelector(
      "#scheduled-entry-0 .entry-problems",
    )!
    expect(getComputedStyle(reasons).display).toBe("block")
    expect(getComputedStyle(reasons).overflowWrap).toBe("anywhere")
  })

  it("sizes Recalculate to its text only from 40em wide", () => {
    expect(styles).toMatch(
      /@media \(min-width: 40em\) \{[^@]*\.plan-actions \.plan-recalculate \{\s*flex-basis: auto;/,
    )
  })
})

describe("Plan check actions", () => {
  it("keeps Recalculate looking disabled while a check runs", async () => {
    routeFetch({
      ...savedPlanRoutes(),
      [`GET /api/plans/${savedPlanId}/check`]: () =>
        new Promise<Response>(() => {}),
    })
    renderApp(`/plans/${savedPlanId}`)

    const recalculate = await screen.findByRole("button", {
      name: "Recalculate",
    })
    expect(recalculate).toBeDisabled()
    expect(getComputedStyle(recalculate).backgroundColor).toBe(
      "rgb(154, 165, 177)",
    )
  })
})

// Feature 014 User Story 5 scenario 5: User accounts at 320 px. jsdom does no layout, so these check the CSS rules.
describe("User accounts at 320 px", () => {
  const longEmail = `${"long-name.".repeat(8)}user@example.com`

  function stubAccounts() {
    routeFetch({
      "GET /api/auth/me": () =>
        jsonResponse(200, signedInUser("Administrator")),
      "GET /api/admin/accounts": () =>
        jsonResponse(
          200,
          accountList([{ ...activeUser, email: longEmail }, suspendedUser]),
        ),
    })
  }

  it("shows each account as a card with labelled values that wrap a long email", async () => {
    stubAccounts()
    renderApp("/admin/users")

    const table = await screen.findByRole("table", { name: "User accounts" })
    expect(getComputedStyle(table).display).toBe("block")
    const row = within(table).getAllByRole("row")[1]!
    expect(getComputedStyle(row).display).toBe("block")
    const email = within(row).getByRole("rowheader")
    expect(email).toHaveTextContent(longEmail)
    expect(getComputedStyle(email).overflowWrap).toBe("anywhere")
    for (const label of ["Role:", "Status:", "Registered:"]) {
      expect(within(row).getByText(label)).toBeVisible()
    }
    // The status is a word, never a colour alone.
    expect(row).toHaveTextContent("Status: Active")
  })

  it("makes the account buttons full width and at least 44 × 44 px", async () => {
    stubAccounts()
    renderApp("/admin/users")

    const table = await screen.findByRole("table", { name: "User accounts" })
    for (const button of within(table).getAllByRole("button")) {
      expect(getComputedStyle(button).width).toBe("100%")
      expectTouchTarget(button)
    }
  })

  it("makes the search field full width with 16 px text and Search full width", async () => {
    stubAccounts()
    renderApp("/admin/users")
    await screen.findByRole("table", { name: "User accounts" })

    const field = getComputedStyle(screen.getByLabelText("Search by email"))
    expect(field.width).toBe("100%")
    expect(px(field.fontSize)).toBeGreaterThanOrEqual(minimumInputText)
    const search = screen.getByRole("button", { name: "Search" })
    expect(getComputedStyle(search).width).toBe("100%")
    expectTouchTarget(search)
  })
})
