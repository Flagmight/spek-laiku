import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { LoginFieldErrors } from "../types/login"
import { jsonResponse, renderApp } from "./renderApp"

const details = { email: "user@example.com", password: "Password123!" }
const incorrectMessage = "Error: Incorrect email or password."

// The visitor is signed out; every login request is answered by respond.
function stubLogin(respond: () => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string) =>
      Promise.resolve(
        path === "/api/auth/login" ? respond() : jsonResponse(401),
      ),
    ),
  )
}

function validationErrors(errors: LoginFieldErrors) {
  return () =>
    jsonResponse(400, {
      title: "One or more request fields are invalid.",
      status: 400,
      errors: Object.fromEntries(
        Object.entries(errors).map(([field, message]) => [field, [message]]),
      ),
    })
}

function incorrectCredentials() {
  return jsonResponse(401, {
    title: "Incorrect email or password.",
    status: 401,
    detail: "Incorrect email or password.",
  })
}

async function submitForm(values: { email: string; password: string }) {
  const user = userEvent.setup()
  renderApp("/login")
  const email = await screen.findByLabelText("Email")
  if (values.email) {
    await user.type(email, values.email)
  }
  if (values.password) {
    await user.type(screen.getByLabelText("Password"), values.password)
  }
  await user.click(screen.getByRole("button", { name: "Log in" }))
  return user
}

// Every text linked to a field through aria-describedby.
function describedTextsOf(label: string) {
  const ids =
    screen.getByLabelText(label).getAttribute("aria-describedby")?.split(" ") ??
    []
  return ids.map((id) => document.getElementById(id)?.textContent ?? "")
}

describe("LoginPage validation and failed login", () => {
  it("shows both field messages and a summary whose links move focus to the fields", async () => {
    stubLogin(
      validationErrors({
        email: "Enter your email address.",
        password: "Enter your password.",
      }),
    )
    const user = await submitForm({ email: "", password: "" })

    expect(
      await screen.findAllByText("Error: Enter your email address."),
    ).toHaveLength(2)
    expect(describedTextsOf("Email")).toContain(
      "Error: Enter your email address.",
    )
    expect(describedTextsOf("Password")).toContain(
      "Error: Enter your password.",
    )
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    )

    const summary = screen.getByRole("alert", { name: "Error summary" })
    const links = within(summary).getAllByRole("link")
    expect(links.map((link) => link.textContent)).toEqual([
      "Error: Enter your email address.",
      "Error: Enter your password.",
    ])
    await user.click(links[1])
    expect(screen.getByLabelText("Password")).toHaveFocus()
    await user.click(links[0])
    expect(screen.getByLabelText("Email")).toHaveFocus()
  })

  it("shows no summary for a single field error", async () => {
    stubLogin(validationErrors({ email: "Enter a valid email address." }))
    await submitForm({ email: "not-an-email", password: details.password })

    expect(
      await screen.findByText("Error: Enter a valid email address."),
    ).toBeInTheDocument()
    expect(screen.queryByRole("alert", { name: "Error summary" })).toBeNull()
  })

  it("after a field error keeps the email, clears the password and focuses the first invalid field", async () => {
    stubLogin(validationErrors({ password: "Enter your password." }))
    await submitForm({ email: details.email, password: "x" })

    await screen.findByText("Error: Enter your password.")
    expect(screen.getByLabelText("Email")).toHaveValue(details.email)
    expect(screen.getByLabelText("Password")).toHaveValue("")
    expect(screen.getByLabelText("Password")).toHaveFocus()
  })

  it("shows the incorrect-details message once, linked to both fields", async () => {
    stubLogin(incorrectCredentials)
    await submitForm(details)

    const message = await screen.findByText(incorrectMessage)
    expect(screen.getAllByText(incorrectMessage)).toHaveLength(1)
    expect(message).toHaveAttribute("role", "alert")
    expect(describedTextsOf("Email")).toContain(incorrectMessage)
    expect(describedTextsOf("Password")).toContain(incorrectMessage)
    // At the top of the form: before both fields in document order.
    expect(
      message.compareDocumentPosition(screen.getByLabelText("Email")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it("after incorrect details keeps the email, clears the password and focuses the email field", async () => {
    stubLogin(incorrectCredentials)
    await submitForm(details)

    await screen.findByText(incorrectMessage)
    expect(screen.getByLabelText("Email")).toHaveValue(details.email)
    expect(screen.getByLabelText("Password")).toHaveValue("")
    expect(screen.getByLabelText("Email")).toHaveFocus()
  })

  it("moves focus to the email field again after a second incorrect attempt", async () => {
    stubLogin(incorrectCredentials)
    const user = await submitForm(details)
    await screen.findByText(incorrectMessage)

    await user.type(screen.getByLabelText("Password"), "Another1!")
    await user.click(screen.getByRole("button", { name: "Log in" }))

    await vi.waitFor(() => expect(screen.getByLabelText("Email")).toHaveFocus())
    expect(screen.getByLabelText("Password")).toHaveValue("")
    expect(screen.getAllByText(incorrectMessage)).toHaveLength(1)
  })
})
