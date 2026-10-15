import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { RegistrationFieldErrors } from "../types/registration"
import { jsonResponse, renderApp } from "./renderApp"

const labels = {
  email: "Email",
  password: "Password",
  passwordConfirmation: "Confirm password",
} as const

// The visitor is signed out; the first registration request returns these field errors,
// any later one never answers.
function stubValidationErrors(errors: RegistrationFieldErrors) {
  let answered = false
  const fetchMock = vi.fn((path: string) => {
    if (path !== "/api/registration") {
      return Promise.resolve(jsonResponse(401))
    }

    if (answered) {
      return new Promise<Response>(() => {})
    }

    answered = true
    const body = Object.fromEntries(
      Object.entries(errors).map(([field, message]) => [field, [message]]),
    )
    return Promise.resolve(
      jsonResponse(400, {
        title: "One or more request fields are invalid.",
        status: 400,
        errors: body,
      }),
    )
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

async function submitForm(
  values = {
    email: "user@example.com",
    password: "Password123!",
    passwordConfirmation: "Password123!",
  },
) {
  const user = userEvent.setup()
  renderApp("/register")
  await user.type(await screen.findByLabelText("Email"), values.email)
  await user.type(screen.getByLabelText("Password"), values.password)
  await user.type(
    screen.getByLabelText("Confirm password"),
    values.passwordConfirmation,
  )
  await user.click(screen.getByRole("button", { name: "Create account" }))
  return user
}

// The error text linked to a field through aria-describedby.
function describedErrorOf(label: string) {
  const input = screen.getByLabelText(label)
  const ids = input.getAttribute("aria-describedby")?.split(" ") ?? []
  return ids
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .find((text) => text.startsWith("Error:"))
}

describe("RegisterPage validation errors", () => {
  it.each([
    ["email", "Enter your email address."],
    ["email", "Enter a valid email address."],
    ["email", "This email is already registered."],
    ["password", "Enter a password."],
    ["password", "Password must be at least 8 characters."],
    ["passwordConfirmation", "Confirm your password."],
    ["passwordConfirmation", "Passwords do not match."],
  ] as const)(
    "shows the %s message '%s' next to its field, with the Error: prefix",
    async (field, message) => {
      stubValidationErrors({ [field]: message })
      await submitForm()

      const input = screen.getByLabelText(labels[field])
      expect(await screen.findByText(`Error: ${message}`)).toBeInTheDocument()
      expect(describedErrorOf(labels[field])).toBe(`Error: ${message}`)
      expect(input).toHaveAttribute("aria-invalid", "true")
    },
  )

  it("marks only the failing fields as invalid", async () => {
    stubValidationErrors({ email: "This email is already registered." })
    await submitForm()

    await screen.findByText("Error: This email is already registered.")
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    for (const label of ["Password", "Confirm password"]) {
      expect(screen.getByLabelText(label)).not.toHaveAttribute(
        "aria-invalid",
        "true",
      )
      expect(describedErrorOf(label)).toBeUndefined()
    }
  })

  it("keeps the email, clears both passwords and focuses the first invalid field", async () => {
    stubValidationErrors({
      password: "Password must be at least 8 characters.",
      passwordConfirmation: "Passwords do not match.",
    })
    await submitForm({
      email: "user@example.com",
      password: "short",
      passwordConfirmation: "other",
    })

    await screen.findByText("Error: Passwords do not match.", {
      selector: "#registration-password-confirmation-error",
    })
    expect(screen.getByLabelText("Email")).toHaveValue("user@example.com")
    expect(screen.getByLabelText("Password")).toHaveValue("")
    expect(screen.getByLabelText("Confirm password")).toHaveValue("")
    expect(screen.getByLabelText("Password")).toHaveFocus()
  })

  it("focuses the email field when it is the first invalid field", async () => {
    stubValidationErrors({
      email: "Enter a valid email address.",
      passwordConfirmation: "Passwords do not match.",
    })
    await submitForm()

    await screen.findByText("Error: Enter a valid email address.", {
      selector: "#registration-email-error",
    })
    expect(screen.getByLabelText("Email")).toHaveFocus()
  })

  it("shows no error summary when only one field fails", async () => {
    stubValidationErrors({ email: "Enter a valid email address." })
    await submitForm()

    await screen.findByText("Error: Enter a valid email address.")
    expect(
      screen.queryByRole("alert", { name: "Error summary" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /Enter a valid email address/ }),
    ).not.toBeInTheDocument()
  })

  it("lists every message in an announced summary when two or more fields fail", async () => {
    stubValidationErrors({
      email: "Enter a valid email address.",
      password: "Password must be at least 8 characters.",
      passwordConfirmation: "Passwords do not match.",
    })
    await submitForm()

    const summary = await screen.findByRole("alert", { name: "Error summary" })
    const links = within(summary).getAllByRole("link")
    expect(links.map((link) => link.textContent)).toEqual([
      "Error: Enter a valid email address.",
      "Error: Password must be at least 8 characters.",
      "Error: Passwords do not match.",
    ])
  })

  it("moves focus to the field when a summary link is selected", async () => {
    stubValidationErrors({
      email: "Enter a valid email address.",
      passwordConfirmation: "Passwords do not match.",
    })
    const user = await submitForm()
    const summary = await screen.findByRole("alert", { name: "Error summary" })

    await user.click(
      within(summary).getByRole("link", {
        name: "Error: Passwords do not match.",
      }),
    )
    expect(screen.getByLabelText("Confirm password")).toHaveFocus()

    await user.click(
      within(summary).getByRole("link", {
        name: "Error: Enter a valid email address.",
      }),
    )
    expect(screen.getByLabelText("Email")).toHaveFocus()
  })

  it("starts every shown error message with 'Error:'", async () => {
    stubValidationErrors({
      email: "Enter your email address.",
      password: "Enter a password.",
      passwordConfirmation: "Confirm your password.",
    })
    await submitForm()
    await screen.findByRole("alert", { name: "Error summary" })

    const messages = [
      "Enter your email address.",
      "Enter a password.",
      "Confirm your password.",
    ]
    for (const message of messages) {
      for (const element of screen.getAllByText(message, { exact: false })) {
        expect(element.textContent).toBe(`Error: ${message}`)
      }
    }
  })

  it("removes the old messages when the form is submitted again", async () => {
    stubValidationErrors({ email: "Enter a valid email address." })
    const user = await submitForm()
    await screen.findByText("Error: Enter a valid email address.")
    await user.type(screen.getByLabelText("Password"), "Password123!")
    await user.type(screen.getByLabelText("Confirm password"), "Password123!")

    await user.click(screen.getByRole("button", { name: "Create account" }))

    expect(
      screen.queryByText("Error: Enter a valid email address."),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText("Email")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    )
  })
})
