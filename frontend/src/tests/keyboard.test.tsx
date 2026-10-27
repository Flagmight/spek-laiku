import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { jsonResponse, renderApp } from "./renderApp"

// The visitor is signed out; every registration request gets the given answer.
function stubApi(answer: () => Response) {
  const fetchMock = vi.fn((path: string) =>
    Promise.resolve(
      path === "/api/registration" ? answer() : jsonResponse(401),
    ),
  )
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function registrationCalls(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls.filter(([path]) => path === "/api/registration")
}

describe("keyboard use of the Register page", () => {
  it("reaches the skip link, the navigation, the three fields and submit in that order", async () => {
    stubApi(() => jsonResponse(201, {}))
    const user = userEvent.setup()
    renderApp("/register")
    await screen.findByLabelText("Email")

    const expected = [
      screen.getByRole("link", { name: "Skip to main content" }),
      screen.getByRole("link", { name: "Home" }),
      screen.getByRole("link", { name: "Log in" }),
      screen.getByRole("link", { name: "Register" }),
      screen.getByLabelText("Email"),
      screen.getByLabelText("Password"),
      screen.getByLabelText("Confirm password"),
      screen.getByRole("button", { name: "Create account" }),
    ]
    for (const element of expected) {
      await user.tab()
      expect(element).toHaveFocus()
    }
  })

  it.each(["Email", "Password", "Confirm password"])(
    "submits the form when Enter is pressed in %s",
    async (label) => {
      const fetchMock = stubApi(() => jsonResponse(500))
      const user = userEvent.setup()
      renderApp("/register")
      await user.type(await screen.findByLabelText("Email"), "user@example.com")
      await user.type(screen.getByLabelText("Password"), "Password123!")
      await user.type(screen.getByLabelText("Confirm password"), "Password123!")

      await user.click(screen.getByLabelText(label))
      await user.keyboard("{Enter}")

      await vi.waitFor(() =>
        expect(registrationCalls(fetchMock)).toHaveLength(1),
      )
    },
  )

  it("lets a visitor register using only the keyboard", async () => {
    stubApi(() => jsonResponse(201, {}))
    const user = userEvent.setup()
    renderApp("/register")
    await screen.findByLabelText("Email")

    await user.tab() // Skip to main content
    await user.keyboard("{Enter}")
    await user.tab()
    expect(screen.getByLabelText("Email")).toHaveFocus()
    await user.keyboard("user@example.com")
    await user.tab()
    await user.keyboard("Password123!")
    await user.tab()
    await user.keyboard("Password123!")
    await user.tab()
    expect(screen.getByRole("button", { name: "Create account" })).toHaveFocus()
    await user.keyboard("{Enter}")

    expect(
      await screen.findByText("✓ Success: Account created."),
    ).toBeInTheDocument()
  })

  it("reaches the error summary links and moves focus to a field with Enter", async () => {
    stubApi(() =>
      jsonResponse(400, {
        errors: {
          email: ["Enter your email address."],
          password: ["Enter a password."],
        },
      }),
    )
    const user = userEvent.setup()
    renderApp("/register")
    await user.click(
      await screen.findByRole("button", { name: "Create account" }),
    )
    const summary = await screen.findByRole("alert", { name: "Error summary" })
    const passwordLink = within(summary).getByRole("link", {
      name: "Error: Enter a password.",
    })

    // Focus is on Email (the first invalid field); the summary comes before it.
    await user.tab({ shift: true })
    expect(passwordLink).toHaveFocus()
    await user.keyboard("{Enter}")

    expect(screen.getByLabelText("Password")).toHaveFocus()
  })

  it("reaches Retry after the submit button and retries with Enter", async () => {
    const fetchMock = stubApi(() => jsonResponse(500))
    const user = userEvent.setup()
    renderApp("/register")
    await user.type(await screen.findByLabelText("Email"), "user@example.com")
    await user.type(screen.getByLabelText("Password"), "Password123!")
    await user.type(screen.getByLabelText("Confirm password"), "Password123!")
    await user.keyboard("{Enter}")
    await screen.findByRole("button", { name: "Retry" })

    screen.getByRole("button", { name: "Create account" }).focus()
    await user.tab()
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus()
    await user.keyboard("{Enter}")

    await vi.waitFor(() => expect(registrationCalls(fetchMock)).toHaveLength(2))
  })
})
