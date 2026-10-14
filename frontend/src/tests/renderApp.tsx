import { render } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import type { InitialEntry } from "react-router-dom"
import { vi } from "vitest"
import { AppRoutes } from "../components/appRoutes"
import { CurrentUserProvider } from "../components/currentUserProvider"

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

export function renderApp(initialEntry: InitialEntry = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CurrentUserProvider>
        <AppRoutes />
      </CurrentUserProvider>
    </MemoryRouter>,
  )
}
