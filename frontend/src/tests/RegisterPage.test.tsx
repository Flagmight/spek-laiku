import { act, fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { registrationTimeoutMs } from "../stores/useRegistrationStore"
import { jsonResponse, renderApp } from "./renderApp"

const details = {
  email: "user@example.com",
  password: "Password123!",
  passwordConfirmation: "Password123!",
}

const serverErrorMessage = "Error: Something went wrong. Try again."

// The visitor is signed out; every registration request is answered by respond.
function stubApi(respond: (init: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn((path: string, init: RequestInit = {}) =>
    path === "/api/registration"
      ? respond(init)
      : Promise.resolve(jsonResponse(401)),
  )
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

// A registration request that only ends when it is aborted.
function hang(init: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    init.signal?.addEventListener("abort", () =>
      reject(new DOMException("The request was aborted.", "AbortError")),
    )
  })
}

function registrationCalls(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls.filter(([path]) => path === "/api/registration")
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Email"), details.email)
  await user.type(screen.getByLabelText("Password"), details.password)
  await user.type(
    screen.getByLabelText("Confirm password"),
    details.passwordConfirmation,
  )
}

function submitButton() {
  return screen.getByRole("button", { name: "Create account" })
}

function expectEnteredValuesKept() {
  expect(screen.getByLabelText("Email")).toHaveValue(details.email)
  expect(screen.getByLabelText("Password")).toHaveValue(details.password)
  expect(screen.getByLabelText("Confirm password")).toHaveValue(
    details.passwordConfirmation,
  )
}

describe("RegisterPage", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe("loading state", () => {
    it("shows and announces 'Creating your account…' and disables submit", async () => {
      stubApi(hang)
      const user = userEvent.setup()
      renderApp("/register")
      await fillForm(user)

      await user.click(submitButton())

      const loading = screen.getByText("Creating your account…")
      expect(loading.closest('[role="status"], [aria-live]')).not.toBeNull()
      expect(submitButton()).toBeDisabled()
    })

    it("shows the server error after 10 seconds without an answer", async () => {
      stubApi(hang)
      const user = userEvent.setup()
      renderApp("/register")
      await fillForm(user)
      vi.useFakeTimers()

      fireEvent.click(submitButton())
      await act(() => vi.advanceTimersByTimeAsync(registrationTimeoutMs))

      expect(screen.getByText(serverErrorMessage)).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
      expect(screen.queryByText("Creating your account…")).toBeNull()
      expectEnteredValuesKept()
    })
  })

  it("opens the home page with the success banner after registering", async () => {
    stubApi(() =>
      Promise.resolve(
        jsonResponse(201, {
          success: true,
          message: "Account created.",
          accountStatus: "Active",
        }),
      ),
    )
    const user = userEvent.setup()
    renderApp("/register")
    await fillForm(user)

    await user.click(submitButton())

    expect(
      await screen.findByRole("heading", { level: 1, name: "Spėk laiku" }),
    ).toBeInTheDocument()
    expect(screen.getByText("✓ Success: Account created.")).toBeInTheDocument()
  })

  it("refreshes the signed-in state after registering", async () => {
    const fetchMock = stubApi(() => Promise.resolve(jsonResponse(201, {})))
    const user = userEvent.setup()
    renderApp("/register")
    await fillForm(user)
    const meCallsBefore = fetchMock.mock.calls.filter(
      ([path]) => path === "/api/auth/me",
    ).length

    await user.click(submitButton())

    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([path]) => path === "/api/auth/me"),
      ).toHaveLength(meCallsBefore + 1),
    )
  })

  it("sets the tab title to 'Register - Spėk laiku' and has one h1, 'Register'", async () => {
    stubApi(hang)
    document.title = ""
    renderApp("/register")

    const headings = await screen.findAllByRole("heading", { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent("Register")
    await vi.waitFor(() => expect(document.title).toBe("Register - Spėk laiku"))
  })

  describe("server error state", () => {
    it.each([
      ["a 500 response", () => Promise.resolve(jsonResponse(500))],
      [
        "a network error",
        () => Promise.reject(new TypeError("Failed to fetch")),
      ],
    ])(
      "shows the message with Retry and keeps the entered values after %s",
      async (_case, respond) => {
        stubApi(respond)
        const user = userEvent.setup()
        renderApp("/register")
        await fillForm(user)

        await user.click(submitButton())

        expect(await screen.findByText(serverErrorMessage)).toBeInTheDocument()
        expect(
          screen.getByRole("button", { name: "Retry" }),
        ).toBeInTheDocument()
        expectEnteredValuesKept()
      },
    )

    it("never shows the server's own text", async () => {
      stubApi(() =>
        Promise.resolve(
          jsonResponse(500, { detail: "Npgsql connection refused." }),
        ),
      )
      const user = userEvent.setup()
      renderApp("/register")
      await fillForm(user)

      await user.click(submitButton())

      await screen.findByText(serverErrorMessage)
      expect(screen.queryByText(/Npgsql/)).toBeNull()
    })

    it("Retry sends the same request again", async () => {
      const fetchMock = stubApi(() => Promise.resolve(jsonResponse(500)))
      const user = userEvent.setup()
      renderApp("/register")
      await fillForm(user)
      await user.click(submitButton())
      await screen.findByText(serverErrorMessage)

      await user.click(screen.getByRole("button", { name: "Retry" }))

      await vi.waitFor(() =>
        expect(registrationCalls(fetchMock)).toHaveLength(2),
      )
      const [first, second] = registrationCalls(fetchMock).map(
        ([, init]) => init?.body,
      )
      expect(JSON.parse(first as string)).toEqual(details)
      expect(second).toBe(first)
    })
  })

  it("sends one request when submit is clicked twice", async () => {
    const fetchMock = stubApi(hang)
    const user = userEvent.setup()
    renderApp("/register")
    await fillForm(user)

    await user.dblClick(submitButton())

    expect(registrationCalls(fetchMock)).toHaveLength(1)
  })
})
