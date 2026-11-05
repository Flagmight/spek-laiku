import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import styles from "../styles.css?inline"
import { jsonResponse, renderApp, routeFetch, signedInUser } from "./renderApp"

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
  await vi.waitFor(() => expect(screen.getByLabelText("Date")).toBeEnabled())
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
    for (const label of ["Location", "Date", "Maximum travel distance (km)"]) {
      const style = getComputedStyle(screen.getByLabelText(label))
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
