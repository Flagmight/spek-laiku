import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { jsonResponse, renderApp, stubFetch } from "./renderApp"

function stubRegistration(answer: () => Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string) =>
      path === "/api/registration"
        ? answer()
        : Promise.resolve(jsonResponse(401)),
    ),
  )
}

// Texts linked to the element through aria-describedby, in order.
function descriptionsOf(element: HTMLElement) {
  return (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent)
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Email"), "user@example.com")
  await user.type(screen.getByLabelText("Password"), "Password123!")
  await user.type(screen.getByLabelText("Confirm password"), "Password123!")
}

describe("Register page accessibility", () => {
  it("gives every field a visible label tied to its input", async () => {
    stubFetch(() => jsonResponse(401))
    renderApp("/register")

    expect(await screen.findByLabelText("Email")).toHaveAttribute(
      "type",
      "email",
    )
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password",
    )
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute(
      "type",
      "password",
    )
    for (const label of ["Email", "Password", "Confirm password"]) {
      expect(screen.getByText(label, { selector: "label" })).toBeVisible()
    }
  })

  it("shows the hint 'At least 8 characters.' under Password, linked to it", async () => {
    stubFetch(() => jsonResponse(401))
    renderApp("/register")

    const password = await screen.findByLabelText("Password")
    expect(descriptionsOf(password)).toEqual(["At least 8 characters."])
    expect(screen.getByText("At least 8 characters.")).toBeVisible()
    expect(descriptionsOf(screen.getByLabelText("Email"))).toEqual([])
    expect(descriptionsOf(screen.getByLabelText("Confirm password"))).toEqual(
      [],
    )
  })

  it("links both the hint and the error to Password, hint first", async () => {
    stubRegistration(() =>
      Promise.resolve(
        jsonResponse(400, {
          errors: { password: ["Password must be at least 8 characters."] },
        }),
      ),
    )
    const user = userEvent.setup()
    renderApp("/register")
    await fillForm(user)

    await user.click(screen.getByRole("button", { name: "Create account" }))

    const password = screen.getByLabelText("Password")
    await vi.waitFor(() =>
      expect(descriptionsOf(password)).toEqual([
        "At least 8 characters.",
        "Error: Password must be at least 8 characters.",
      ]),
    )
    expect(password).toHaveAttribute("aria-invalid", "true")
    expect(password).toHaveFocus()
  })

  it("announces the loading text in a status region without moving focus", async () => {
    stubRegistration(() => new Promise<Response>(() => {}))
    const user = userEvent.setup()
    renderApp("/register")
    await fillForm(user)
    const submit = screen.getByRole("button", { name: "Create account" })

    await user.click(submit)

    const status = screen
      .getAllByRole("status")
      .find((region) => region.textContent === "Creating your account…")
    expect(status).toBeDefined()
    expect(screen.getByLabelText("Email")).not.toHaveFocus()
    expect(document.activeElement).not.toBe(status)
  })

  it("announces the server error as an alert", async () => {
    stubRegistration(() => Promise.resolve(jsonResponse(500)))
    const user = userEvent.setup()
    renderApp("/register")
    await fillForm(user)

    await user.click(screen.getByRole("button", { name: "Create account" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Error: Something went wrong. Try again.")
  })

  it("announces the error summary as an alert", async () => {
    stubRegistration(() =>
      Promise.resolve(
        jsonResponse(400, {
          errors: {
            email: ["Enter your email address."],
            passwordConfirmation: ["Confirm your password."],
          },
        }),
      ),
    )
    const user = userEvent.setup()
    renderApp("/register")

    await user.click(
      await screen.findByRole("button", { name: "Create account" }),
    )

    const summary = await screen.findByRole("alert", { name: "Error summary" })
    expect(within(summary).getAllByRole("link")).toHaveLength(2)
  })
})

describe.each([
  ["/register", "Register", "Register - Spėk laiku"],
  ["/", "Spėk laiku", "Home - Spėk laiku"],
])("page structure of %s", (path, heading, title) => {
  it("has exactly one h1 and a tab title naming the page", async () => {
    stubFetch(() => jsonResponse(401))
    document.title = ""
    renderApp(path)

    const headings = await screen.findAllByRole("heading", { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent(heading)
    await vi.waitFor(() => expect(document.title).toBe(title))
  })

  it("makes 'Skip to main content' the first focusable item and moves focus to the main content", async () => {
    stubFetch(() => jsonResponse(401))
    const user = userEvent.setup()
    renderApp(path)
    await screen.findAllByRole("heading", { level: 1 })

    await user.tab()
    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveFocus()
    await user.keyboard("{Enter}")

    expect(screen.getByRole("main")).toHaveFocus()
  })
})
