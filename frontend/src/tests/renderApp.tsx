import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import type { InitialEntry } from "react-router-dom"
import { onTestFinished, vi } from "vitest"
import { AppRoutes } from "../components/appRoutes"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import type { CurrentUser } from "../types/currentUser"
import { CurrentLocation } from "./currentLocation"

export function jsonResponse(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// Stubs fetch so every call returns a fresh copy of the given response.
export function stubFetch(createResponse: () => Response) {
  const fetchMock = vi.fn(() => Promise.resolve(createResponse()))
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

export interface RecordedRequest {
  method: string
  path: string
  // The parsed JSON body, or undefined when there is none.
  body: unknown
}

type RouteHandler = (request: RecordedRequest) => Response | Promise<Response>

// Stubs fetch with a handler per "METHOD /path", for example "GET /api/auth/me" or
// "PUT /api/admin/categories/<id>". Each call runs its handler, so it returns a fresh Response.
// Every request is recorded in order. A request with no handler is rejected like a network error
// and fails the test when it finishes.
export function routeFetch(handlers: Record<string, RouteHandler>) {
  const requests: RecordedRequest[] = []
  const unexpected: string[] = []
  onTestFinished(() => {
    if (unexpected.length > 0) {
      throw new Error(`Unexpected requests: ${unexpected.join(", ")}`)
    }
  })

  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const request: RecordedRequest = {
      method: (init?.method ?? "GET").toUpperCase(),
      path: requestPath(input),
      body: parseBody(init?.body),
    }
    requests.push(request)
    const route = `${request.method} ${request.path}`
    const handler = handlers[route]
    if (!handler) {
      unexpected.push(route)
      return Promise.reject(new TypeError(`No handler for ${route}`))
    }

    return Promise.resolve(handler(request))
  })
  vi.stubGlobal("fetch", fetchMock)
  return { fetchMock, requests }
}

function requestPath(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return input
  }

  return input instanceof URL ? input.pathname + input.search : input.url
}

function parseBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== "string") {
    return undefined
  }

  try {
    return JSON.parse(body)
  } catch {
    return body
  }
}

// The /api/auth/me body for a signed-in user.
export function signedInUser(
  role: string = "Registered User",
  accountStatus: CurrentUser["accountStatus"] = "Active",
): CurrentUser {
  return { email: "user@example.com", role, accountStatus }
}

// Starts the signed-in state load, as main.tsx does, then renders the routes.
export function renderApp(initialEntry: InitialEntry = "/") {
  void useCurrentUserStore.getState().refresh()
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

// Like renderApp, and currentLocation() returns the address a guard or page navigated to.
export function renderAppWithLocation(initialEntry: InitialEntry = "/") {
  void useCurrentUserStore.getState().refresh()
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppRoutes />
      <CurrentLocation />
    </MemoryRouter>,
  )
  return {
    currentLocation: () => screen.getByTestId("location").textContent,
  }
}
