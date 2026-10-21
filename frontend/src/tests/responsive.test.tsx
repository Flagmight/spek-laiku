import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import styles from "../styles.css?inline"
import { jsonResponse, renderApp } from "./renderApp"

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
