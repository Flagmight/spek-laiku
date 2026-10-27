import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  Link,
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { Layout } from "../components/layout"
import { SignedInOnly } from "../components/signedInOnly"
import { SignedOutOnly } from "../components/signedOutOnly"
import { HomePage } from "../pages/HomePage"
import { LoginPage } from "../pages/LoginPage"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import type { CurrentUser } from "../types/currentUser"
import { jsonResponse } from "./renderApp"

const details = { email: "user@example.com", password: "Password123!" }

const activeUser: CurrentUser = {
  email: details.email,
  role: "Registered User",
  accountStatus: "Active",
}

// Shows the current address so a test can check where the guard sent the user.
function CurrentLocation() {
  const { pathname, search } = useLocation()
  return <output data-testid="location">{pathname + search}</output>
}

// No real route needs login yet, so a test-only /protected page stands in for one.
function renderWithProtectedRoute(initialEntry: string) {
  void useCurrentUserStore.getState().refresh()
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route
            path="login"
            element={
              <SignedOutOnly>
                <LoginPage />
              </SignedOutOnly>
            }
          />
          <Route
            path="protected"
            element={
              <SignedInOnly>
                <h1>Protected page</h1>
              </SignedInOnly>
            }
          />
        </Route>
      </Routes>
      <CurrentLocation />
      <Link to="/protected">Open protected page</Link>
    </MemoryRouter>,
  )
}

// The server keeps a session from a successful login until logout or endSession().
function stubApi(signedInAtStart = false) {
  let signedIn = signedInAtStart
  const fetchMock = vi.fn((path: string) => {
    if (path === "/api/auth/login") {
      signedIn = true
      return Promise.resolve(jsonResponse(200, activeUser))
    }

    if (path === "/api/auth/logout") {
      signedIn = false
      return Promise.resolve(new Response(null, { status: 204 }))
    }

    return Promise.resolve(
      signedIn ? jsonResponse(200, activeUser) : jsonResponse(401),
    )
  })
  vi.stubGlobal("fetch", fetchMock)
  return {
    // Like a session that expired on the server while the app was open.
    endSession: () => {
      signedIn = false
    },
  }
}

async function logIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Email"), details.email)
  await user.type(screen.getByLabelText("Password"), details.password)
  await user.click(screen.getByRole("button", { name: "Log in" }))
}

describe("SignedInOnly", () => {
  it("sends a visitor to log in with returnTo and 'Log in to continue.'", async () => {
    stubApi()
    renderWithProtectedRoute("/protected")

    const message = await screen.findByText("Log in to continue.")
    expect(message).toHaveAttribute("role", "status")
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/login?returnTo=%2Fprotected",
    )
    expect(screen.queryByText("Protected page")).not.toBeInTheDocument()
  })

  it("opens the protected page after an Active user logs in", async () => {
    stubApi()
    const user = userEvent.setup()
    renderWithProtectedRoute("/protected")

    await logIn(user)

    expect(
      await screen.findByRole("heading", { level: 1, name: "Protected page" }),
    ).toBeInTheDocument()
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/protected$/)
  })

  it("opens the home page when returnTo points to another site", async () => {
    stubApi()
    const user = userEvent.setup()
    renderWithProtectedRoute("/login?returnTo=https://evil.example")

    await logIn(user)

    expect(
      await screen.findByRole("heading", { level: 1, name: "Spėk laiku" }),
    ).toBeInTheDocument()
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/)
  })

  it("says the session expired when a signed-in user's session has ended, then returns after login", async () => {
    const { endSession } = stubApi(true)
    const user = userEvent.setup()
    renderWithProtectedRoute("/")
    await screen.findByRole("button", { name: "Log out" })
    endSession()

    await user.click(screen.getByRole("link", { name: "Open protected page" }))

    const message = await screen.findByText(
      "Your session has expired. Log in again.",
    )
    expect(message).toHaveAttribute("role", "status")
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/login?returnTo=%2Fprotected",
    )

    await logIn(user)

    expect(
      await screen.findByRole("heading", { level: 1, name: "Protected page" }),
    ).toBeInTheDocument()
  })

  it("says 'Log in to continue.' after a logout, not that the session expired", async () => {
    stubApi(true)
    const user = userEvent.setup()
    renderWithProtectedRoute("/")
    await user.click(await screen.findByRole("button", { name: "Log out" }))
    await screen.findByText("✓ Success: You have logged out.")

    await user.click(screen.getByRole("link", { name: "Open protected page" }))

    expect(await screen.findByText("Log in to continue.")).toBeInTheDocument()
    expect(
      screen.queryByText("Your session has expired. Log in again."),
    ).toBeNull()
  })
})
