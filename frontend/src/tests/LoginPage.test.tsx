import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { CurrentUser } from "../types/currentUser"
import { jsonResponse, renderApp } from "./renderApp"

const details = { email: "user@example.com", password: "Password123!" }

const signedInUser: CurrentUser = {
  email: details.email,
  role: "Registered User",
  accountStatus: "Active",
}

const serverErrorMessage = "Error: Something went wrong. Try again."

// The visitor is signed out; every login request is answered by respond.
function stubApi(respond: (init: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn((path: string, init: RequestInit = {}) =>
    path === "/api/auth/login"
      ? respond(init)
      : Promise.resolve(jsonResponse(401)),
  )
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function loginCalls(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls.filter(([path]) => path === "/api/auth/login")
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Email"), details.email)
  await user.type(screen.getByLabelText("Password"), details.password)
}

function submitButton() {
  return screen.getByRole("button", { name: "Log in" })
}

describe("LoginPage", () => {
  it("has the heading, title, labelled fields, button and a link to Register", async () => {
    stubApi(() => Promise.resolve(jsonResponse(401)))
    renderApp("/login")

    expect(
      await screen.findByRole("heading", { level: 1, name: "Log in" }),
    ).toBeInTheDocument()
    expect(document.title).toBe("Log in - Spėk laiku")
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email")
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password",
    )
    expect(submitButton()).toBeInTheDocument()
    expect(
      within(screen.getByRole("main")).getByRole("link", {
        name: "Create an account",
      }),
    ).toHaveAttribute("href", "/register")
  })

  it("opens the home page signed in, with no success banner, after logging in", async () => {
    stubApi(() => Promise.resolve(jsonResponse(200, signedInUser)))
    const user = userEvent.setup()
    renderApp("/login")
    await fillForm(user)

    await user.click(submitButton())

    expect(
      await screen.findByRole("heading", { level: 1, name: "Spėk laiku" }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Success:/)).toBeNull()
    const navigation = within(screen.getByRole("navigation", { name: "Main" }))
    expect(navigation.queryByRole("link", { name: "Log in" })).toBeNull()
    expect(navigation.queryByRole("link", { name: "Register" })).toBeNull()
  })

  it("shows and announces 'Logging you in…' and disables the button while pending", async () => {
    stubApi(() => new Promise<Response>(() => {}))
    const user = userEvent.setup()
    renderApp("/login")
    await fillForm(user)

    await user.click(submitButton())

    const loading = screen.getByText("Logging you in…")
    expect(loading.closest('[role="status"]')).not.toBeNull()
    expect(submitButton()).toBeDisabled()
  })

  it("shows the server error with Retry, keeps both values and Retry sends the same details", async () => {
    let respond = () => Promise.resolve(jsonResponse(500))
    const fetchMock = stubApi(() => respond())
    const user = userEvent.setup()
    renderApp("/login")
    await fillForm(user)

    await user.click(submitButton())

    expect(await screen.findByText(serverErrorMessage)).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toHaveValue(details.email)
    expect(screen.getByLabelText("Password")).toHaveValue(details.password)

    respond = () => Promise.resolve(jsonResponse(200, signedInUser))
    await user.click(screen.getByRole("button", { name: "Retry" }))

    await screen.findByRole("heading", { level: 1, name: "Spėk laiku" })
    const calls = loginCalls(fetchMock)
    expect(calls).toHaveLength(2)
    expect(JSON.parse(calls[1][1]?.body as string)).toEqual(details)
  })
})
