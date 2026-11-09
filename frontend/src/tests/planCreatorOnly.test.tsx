import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { CurrentUser } from "../types/currentUser"
import type { PlanLocation } from "../types/planSetup"
import {
  jsonResponse,
  renderApp,
  renderAppWithLocation,
  routeFetch,
  signedInUser,
} from "./renderApp"

const period = { firstDate: "2026-11-04", lastDate: "2026-11-10", maxDates: 7 }

const kaunas: PlanLocation = {
  id: 598316,
  name: "Kaunas",
  area: "Kaunas County",
  latitude: 54.90156,
  longitude: 23.90909,
}

const pages = ["/plan/setup", "/plan/activities", "/plan/places"]

function planRequests(requests: { path: string }[]) {
  return requests.filter(
    (request) =>
      request.path.startsWith("/api/locations") ||
      request.path.startsWith("/api/plan-setup") ||
      request.path.startsWith("/api/plan-activities"),
  )
}

// /api/auth/me answers with the user (or 401 for a visitor); plan requests are answered too, so a
// test can see whether they were sent.
function stubUser(user: CurrentUser | null) {
  return routeFetch({
    "GET /api/auth/me": () =>
      user ? jsonResponse(200, user) : jsonResponse(401),
    "GET /api/plan-setup/period": () => jsonResponse(200, period),
    "GET /api/plan-activities/categories": () =>
      jsonResponse(200, { categories: [], maxActivities: 10 }),
  })
}

// A setup and activities the server accepted, so /plan/activities and /plan/places show their pages
// instead of going back a step.
function acceptSetup() {
  const store = usePlanSetupStore.getState()
  store.chooseLocation(kaunas)
  store.addDate("2026-11-07")
  store.setChecked({
    location: kaunas,
    dates: ["2026-11-07"],
    maxTravelDistanceKm: 30,
  })
  usePlanActivitiesStore.getState().setChecked([])
}

describe("plan pages access", () => {
  it.each(pages)(
    "shows nothing at %s while the signed-in state loads",
    (page) => {
      acceptSetup()
      vi.stubGlobal(
        "fetch",
        vi.fn(() => new Promise<Response>(() => {})),
      )
      renderApp(page)

      expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
    },
  )

  it.each([
    ["/plan/setup", "Plan setup"],
    ["/plan/activities", "Activity selection"],
    ["/plan/places", "Places and forecast"],
  ])("opens %s for a visitor", async (page, heading) => {
    acceptSetup()
    stubUser(null)
    renderApp(page)

    expect(
      await screen.findByRole("heading", { level: 1, name: heading }),
    ).toBeInTheDocument()
  })

  it.each([
    ["/plan/setup", "Plan setup"],
    ["/plan/activities", "Activity selection"],
    ["/plan/places", "Places and forecast"],
  ])("opens %s for an Active Registered User", async (page, heading) => {
    acceptSetup()
    stubUser(signedInUser("Registered User"))
    renderApp(page)

    expect(
      await screen.findByRole("heading", { level: 1, name: heading }),
    ).toBeInTheDocument()
  })

  it.each(pages)(
    "shows Access denied to an Active Administrator at %s and sends no plan request",
    async (page) => {
      acceptSetup()
      const { requests } = stubUser(signedInUser("Administrator"))
      const { currentLocation } = renderAppWithLocation(page)

      expect(
        await screen.findByRole("heading", { level: 1, name: "Access denied" }),
      ).toBeInTheDocument()
      expect(currentLocation()).toBe(page)
      expect(planRequests(requests)).toHaveLength(0)
    },
  )

  it.each([
    ["/plan/setup", "Registered User"],
    ["/plan/setup", "Administrator"],
    ["/plan/activities", "Registered User"],
    ["/plan/activities", "Administrator"],
    ["/plan/places", "Registered User"],
    ["/plan/places", "Administrator"],
  ])(
    "sends a Suspended %s at %s to the Account suspended page",
    async (page, role) => {
      acceptSetup()
      const { requests } = stubUser(signedInUser(role, "Suspended"))
      const { currentLocation } = renderAppWithLocation(page)

      await waitFor(() => expect(currentLocation()).toBe("/account-suspended"))
      expect(planRequests(requests)).toHaveLength(0)
    },
  )

  it("shows Access denied after a Continue answered with 403 once the user is read again", async () => {
    let administrator = false
    routeFetch({
      "GET /api/auth/me": () =>
        jsonResponse(
          200,
          signedInUser(administrator ? "Administrator" : "Registered User"),
        ),
      "GET /api/plan-setup/period": () => jsonResponse(200, period),
      "GET /api/locations?query=Kaun": () =>
        jsonResponse(200, { locations: [kaunas] }),
      "POST /api/plan-setup/check": () => {
        // The account was made an Administrator in the meantime.
        administrator = true
        return jsonResponse(403)
      },
    })
    const user = userEvent.setup()
    renderApp("/plan/setup")
    const location = await screen.findByRole("combobox", { name: "Location" })
    await waitFor(() => expect(screen.getByLabelText("Date")).toBeEnabled())
    await user.click(location)
    await user.paste("Kaun")
    await user.click(await screen.findByRole("option"))
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-11-07" },
    })
    await user.click(screen.getByRole("button", { name: "Add date" }))

    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(
      await screen.findByRole("heading", { level: 1, name: "Access denied" }),
    ).toBeInTheDocument()
  })
})
