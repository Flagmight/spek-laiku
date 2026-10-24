import { render } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import type { InitialEntry } from "react-router-dom"
import { vi } from "vitest"
import { AppRoutes } from "../components/appRoutes"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"

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

// Starts the signed-in state load, as main.tsx does, then renders the routes.
export function renderApp(initialEntry: InitialEntry = "/") {
  void useCurrentUserStore.getState().refresh()
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}
