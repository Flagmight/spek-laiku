import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { PlanCategory } from "../types/planActivity"
import {
  jsonResponse,
  renderApp,
  routeFetch,
  signedInUser as routeSignedInUser,
} from "./renderApp"
import { forecastRoutes } from "./forecastFixtures"

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
      screen.getByRole("link", { name: "Create plan" }),
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

const signedInUser = {
  email: "user@example.com",
  role: "Registered User",
  accountStatus: "Active",
}

// The visitor is signed out; every login request gets the given answer.
function stubLoginApi(answer: () => Response) {
  const fetchMock = vi.fn((path: string) =>
    Promise.resolve(path === "/api/auth/login" ? answer() : jsonResponse(401)),
  )
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

describe("keyboard use of the Log in page", () => {
  it("reaches the skip link, the navigation, the fields, submit and the Register link in that order", async () => {
    stubLoginApi(() => jsonResponse(401))
    const user = userEvent.setup()
    renderApp("/login")
    await screen.findByLabelText("Email")

    const expected = [
      screen.getByRole("link", { name: "Skip to main content" }),
      screen.getByRole("link", { name: "Home" }),
      screen.getByRole("link", { name: "Create plan" }),
      screen.getByRole("link", { name: "Log in" }),
      screen.getByRole("link", { name: "Register" }),
      screen.getByLabelText("Email"),
      screen.getByLabelText("Password"),
      screen.getByRole("button", { name: "Log in" }),
      screen.getByRole("link", { name: "Create an account" }),
    ]
    for (const element of expected) {
      await user.tab()
      expect(element).toHaveFocus()
    }
  })

  it.each(["Email", "Password"])(
    "submits the form when Enter is pressed in %s",
    async (label) => {
      const fetchMock = stubLoginApi(() => jsonResponse(500))
      const user = userEvent.setup()
      renderApp("/login")
      await user.type(await screen.findByLabelText("Email"), "user@example.com")
      await user.type(screen.getByLabelText("Password"), "Password123!")

      await user.click(screen.getByLabelText(label))
      await user.keyboard("{Enter}")

      await vi.waitFor(() =>
        expect(
          fetchMock.mock.calls.filter(([path]) => path === "/api/auth/login"),
        ).toHaveLength(1),
      )
    },
  )
})

describe("keyboard use of Log out", () => {
  it("reaches Log out after Home and logs out with Enter", async () => {
    let signedIn = true
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) => {
        if (path === "/api/auth/logout") {
          signedIn = false
          return Promise.resolve(new Response(null, { status: 204 }))
        }

        return Promise.resolve(
          signedIn ? jsonResponse(200, signedInUser) : jsonResponse(401),
        )
      }),
    )
    const user = userEvent.setup()
    renderApp("/")
    const logOut = await screen.findByRole("button", { name: "Log out" })

    await user.tab() // Skip to main content
    await user.tab()
    expect(screen.getByRole("link", { name: "Home" })).toHaveFocus()
    await user.tab()
    expect(
      within(screen.getByRole("navigation", { name: "Main" })).getByRole(
        "link",
        { name: "Create plan" },
      ),
    ).toHaveFocus()
    await user.tab()
    expect(logOut).toHaveFocus()
    await user.keyboard("{Enter}")

    expect(
      await screen.findByText("✓ Success: You have logged out."),
    ).toBeInTheDocument()
  })
})

describe("keyboard use of the Activity categories page", () => {
  const kayaking = {
    id: "id-kayaking",
    name: "Kayaking",
    type: "Outdoor",
    defaultDurationHours: 2,
    requiresDaylight: true,
    maxWindMs: 8,
    maxRainMmPerHour: 0.5,
    minTemperatureC: 15,
    maxTemperatureC: 35,
    placeTags: ["leisure=slipway", "sport=canoe"],
    version: 1,
  }
  const museum = {
    ...kayaking,
    id: "id-museum",
    name: "Museum",
    type: "Indoor",
    requiresDaylight: false,
    maxWindMs: null,
    maxRainMmPerHour: null,
    minTemperatureC: null,
    maxTemperatureC: null,
    placeTags: ["tourism=museum"],
  }

  function stubAdministrator() {
    return routeFetch({
      ...forecastRoutes,
      "GET /api/auth/me": () =>
        jsonResponse(200, routeSignedInUser("Administrator")),
      "GET /api/admin/categories": () => jsonResponse(200, [kayaking, museum]),
      "POST /api/admin/categories": () => jsonResponse(201, museum),
    })
  }

  it("reaches the skip link, the navigation, Create category and each Edit button in that order", async () => {
    stubAdministrator()
    const user = userEvent.setup()
    renderApp("/admin/categories")
    await screen.findByRole("button", { name: "Edit Museum" })

    const expected = [
      screen.getByRole("link", { name: "Skip to main content" }),
      screen.getByRole("link", { name: "Home" }),
      screen.getByRole("link", { name: "Categories" }),
      screen.getByRole("button", { name: "Log out" }),
      screen.getByRole("button", { name: "Create category" }),
      screen.getByRole("button", { name: "Edit Kayaking" }),
      screen.getByRole("button", { name: "Edit Museum" }),
    ]
    for (const element of expected) {
      await user.tab()
      expect(element).toHaveFocus()
    }
  })

  it("reaches the form fields in page order and changes the type with the arrow keys", async () => {
    stubAdministrator()
    const user = userEvent.setup()
    renderApp("/admin/categories")
    await user.click(
      await screen.findByRole("button", { name: "Edit Kayaking" }),
    )
    expect(screen.getByRole("heading", { name: "Edit Kayaking" })).toHaveFocus()

    const expected = [
      screen.getByLabelText("Name"),
      screen.getByRole("radio", { name: "Outdoor" }),
      screen.getByLabelText("Default duration (h)"),
      screen.getByLabelText("Max wind (m/s)"),
      screen.getByLabelText("Max rain (mm/h)"),
      screen.getByLabelText("Min temperature (°C)"),
      screen.getByLabelText("Max temperature (°C)"),
      screen.getByRole("checkbox", { name: "Requires daylight" }),
      screen.getByLabelText("Map place tags"),
      screen.getByRole("button", { name: "Save" }),
      screen.getByRole("button", { name: "Cancel" }),
    ]
    for (const element of expected) {
      await user.tab()
      expect(element).toHaveFocus()
    }

    screen.getByRole("radio", { name: "Outdoor" }).focus()
    await user.keyboard("{ArrowLeft}")

    expect(screen.getByRole("radio", { name: "Indoor" })).toBeChecked()
    expect(screen.queryByLabelText("Max wind (m/s)")).not.toBeInTheDocument()
  })

  it("creates a category using only the keyboard", async () => {
    const { requests } = stubAdministrator()
    const user = userEvent.setup()
    renderApp("/admin/categories")
    await screen.findByRole("button", { name: "Edit Museum" })
    for (let step = 0; step < 5; step++) {
      await user.tab()
    }
    expect(
      screen.getByRole("button", { name: "Create category" }),
    ).toHaveFocus()
    await user.keyboard("{Enter}")

    await user.tab()
    await user.keyboard("Gallery")
    await user.tab()
    expect(screen.getByRole("radio", { name: "Indoor" })).toHaveFocus()
    await user.keyboard(" ")
    await user.tab()
    await user.keyboard("1.5")
    await user.tab() // Requires daylight stays unchecked
    await user.tab()
    await user.keyboard("tourism=gallery{Enter}")

    expect(
      await screen.findByText("✓ Success: Category saved."),
    ).toBeInTheDocument()
    expect(
      requests.find((request) => request.method === "POST")?.body,
    ).toMatchObject({
      name: "Gallery",
      type: "Indoor",
      defaultDurationHours: 1.5,
      requiresDaylight: false,
      placeTags: "tourism=gallery",
    })
  })
})

const kaunas = {
  id: 598316,
  name: "Kaunas",
  area: "Kaunas County",
  latitude: 54.90156,
  longitude: 23.90909,
}

// A visitor on Plan setup; every search answers with Kaunas, whatever was typed so far.
function stubPlanSetup() {
  const found = () => jsonResponse(200, { locations: [kaunas] })
  return routeFetch({
    ...forecastRoutes,
    "GET /api/auth/me": () => jsonResponse(401),
    "GET /api/plan-setup/period": () =>
      jsonResponse(200, {
        firstDate: "2026-11-04",
        lastDate: "2026-11-10",
        maxDates: 7,
      }),
    "GET /api/locations?query=Ka": found,
    "GET /api/locations?query=Kau": found,
    "GET /api/locations?query=Kaun": found,
    "GET /api/plan-activities/categories": () =>
      jsonResponse(200, { categories: [], maxActivities: 10 }),
    "POST /api/plan-setup/check": () =>
      jsonResponse(200, {
        location: kaunas,
        dates: ["2026-11-07"],
        maxTravelDistanceKm: 30,
      }),
  })
}

describe("keyboard use of the Plan setup page", () => {
  it("reaches the skip link, the navigation, Location, the dates, the distance and Continue in that order", async () => {
    usePlanSetupStore.getState().addDate("2026-11-07")
    stubPlanSetup()
    const user = userEvent.setup()
    renderApp("/plan/setup")
    await waitFor(() => expect(screen.getByLabelText("Date")).toBeEnabled())

    const expected = [
      screen.getByRole("link", { name: "Skip to main content" }),
      screen.getByRole("link", { name: "Home" }),
      screen.getByRole("link", { name: "Create plan" }),
      screen.getByRole("link", { name: "Log in" }),
      screen.getByRole("link", { name: "Register" }),
      // Step 1 of the progress bar is the current page, so it has nothing to focus.
      screen.getByRole("combobox", { name: "Location" }),
      screen.getByLabelText("Date"),
      screen.getByRole("button", { name: "Add date" }),
      screen.getByRole("button", { name: "Remove Sat 7 Nov 2026" }),
      screen.getByLabelText("Maximum travel distance (km)"),
      screen.getByRole("button", { name: "Continue" }),
    ]
    for (const element of expected) {
      await user.tab()
      expect(element).toHaveFocus()
    }
  })

  it("chooses a place, adds a date and continues with the keyboard only", async () => {
    stubPlanSetup()
    const user = userEvent.setup()
    renderApp("/plan/setup")
    const location = await screen.findByRole("combobox", { name: "Location" })
    await waitFor(() => expect(screen.getByLabelText("Date")).toBeEnabled())

    location.focus()
    await user.keyboard("Kaun")
    await screen.findByRole("option", { name: "Kaunas, Kaunas County" })
    await user.keyboard("{ArrowDown}{Enter}")
    expect(location).toHaveValue("Kaunas, Kaunas County")

    await user.tab()
    expect(screen.getByLabelText("Date")).toHaveFocus()
    // The browser's own date picker fills the value; it is keyboard operable.
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-11-07" },
    })
    await user.tab()
    await user.keyboard("{Enter}")
    expect(
      within(screen.getByRole("group", { name: "Dates" })).getByText(
        "Sat 7 Nov 2026",
      ),
    ).toBeInTheDocument()

    await user.tab() // Remove Sat 7 Nov 2026
    await user.tab() // Maximum travel distance
    await user.tab()
    expect(screen.getByRole("button", { name: "Continue" })).toHaveFocus()
    await user.keyboard("{Enter}")

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Activity selection",
      }),
    ).toBeInTheDocument()
  })
})

const kayaking: PlanCategory = {
  id: "category-kayaking",
  name: "Kayaking",
  type: "Outdoor",
  defaultDurationHours: 2,
  requiresDaylight: true,
  maxWindMs: 8,
  maxRainMmPerHour: 0.5,
  minTemperatureC: 15,
  maxTemperatureC: 35,
}

const museum: PlanCategory = {
  id: "category-museum",
  name: "Museum",
  type: "Indoor",
  defaultDurationHours: 2,
  requiresDaylight: false,
  maxWindMs: null,
  maxRainMmPerHour: null,
  minTemperatureC: null,
  maxTemperatureC: null,
}

describe("keyboard use of the Activity selection page", () => {
  function renderActivitySelection() {
    usePlanSetupStore.getState().setChecked({
      location: kaunas,
      dates: ["2026-11-07"],
      maxTravelDistanceKm: 30,
    })
    const fetch = routeFetch({
      ...forecastRoutes,
      "GET /api/auth/me": () => jsonResponse(401),
      "GET /api/plan-activities/categories": () =>
        jsonResponse(200, {
          categories: [kayaking, museum],
          maxActivities: 10,
        }),
      "POST /api/plan-activities/check": () =>
        jsonResponse(200, {
          activities: [
            {
              categoryId: kayaking.id,
              name: "Kayaking",
              type: "Outdoor",
              durationHours: 3,
              requiresDaylight: true,
              maxWindMs: 8,
              maxRainMmPerHour: 0.5,
              minTemperatureC: 15,
              maxTemperatureC: 35,
            },
          ],
        }),
    })
    renderApp("/plan/activities")
    return fetch
  }

  it("reaches the page in the documented order", async () => {
    usePlanActivitiesStore.getState().add(kayaking)
    usePlanActivitiesStore.getState().add(museum)
    renderActivitySelection()
    await screen.findByRole("button", { name: "Add Kayaking" })
    const kayakingGroup = within(
      screen.getByRole("group", { name: "Kayaking" }),
    )
    const museumGroup = within(screen.getByRole("group", { name: "Museum" }))
    const user = userEvent.setup()

    const expected = [
      screen.getByRole("link", { name: "Skip to main content" }),
      screen.getByRole("link", { name: "Home" }),
      screen.getByRole("link", { name: "Create plan" }),
      screen.getByRole("link", { name: "Log in" }),
      screen.getByRole("link", { name: "Register" }),
      screen.getByRole("link", { name: "Plan setup" }),
      screen.getByRole("link", { name: "Back" }),
      screen.getByRole("button", { name: "Add Kayaking" }),
      screen.getByRole("button", { name: "Add Museum" }),
      kayakingGroup.getByLabelText("Duration (h)"),
      kayakingGroup.getByRole("checkbox", { name: "Requires daylight" }),
      kayakingGroup.getByLabelText("Max wind (m/s)"),
      kayakingGroup.getByLabelText("Max rain (mm/h)"),
      kayakingGroup.getByLabelText("Min temperature (°C)"),
      kayakingGroup.getByLabelText("Max temperature (°C)"),
      screen.getByRole("button", { name: "Remove Kayaking" }),
      museumGroup.getByLabelText("Duration (h)"),
      museumGroup.getByRole("checkbox", { name: "Requires daylight" }),
      screen.getByRole("button", { name: "Remove Museum" }),
      screen.getByRole("button", { name: "Continue" }),
    ]
    for (const element of expected) {
      await user.tab()
      expect(element).toHaveFocus()
    }
  })

  it("adds, edits, removes and continues with the keyboard only", async () => {
    const { requests } = renderActivitySelection()
    const addKayaking = await screen.findByRole("button", {
      name: "Add Kayaking",
    })
    const user = userEvent.setup()

    addKayaking.focus()
    await user.keyboard("{Enter}")
    expect(addKayaking).toHaveFocus()
    await user.tab()
    await user.keyboard(" ")
    expect(screen.getByRole("group", { name: "Museum" })).toBeInTheDocument()

    await user.tab()
    const duration = within(
      screen.getByRole("group", { name: "Kayaking" }),
    ).getByLabelText("Duration (h)")
    expect(duration).toHaveFocus()
    await user.keyboard("3")
    expect(duration).toHaveValue("3")

    // Requires daylight, the four limits and Remove Kayaking, then Museum's two fields.
    for (let press = 0; press < 8; press++) {
      await user.tab()
    }
    const removeMuseum = screen.getByRole("button", { name: "Remove Museum" })
    await user.tab()
    expect(removeMuseum).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(screen.queryByRole("group", { name: "Museum" })).toBeNull()
    expect(
      screen.getByRole("heading", { level: 3, name: "Kayaking" }),
    ).toHaveFocus()

    // From the heading: Duration, Requires daylight, the four limits and Remove Kayaking.
    for (let press = 0; press < 7; press++) {
      await user.tab()
    }
    await user.tab()
    expect(screen.getByRole("button", { name: "Continue" })).toHaveFocus()
    await user.keyboard("{Enter}")

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Places and forecast",
      }),
    ).toBeInTheDocument()
    expect(
      requests.filter((sent) => sent.path === "/api/plan-activities/check"),
    ).toHaveLength(1)
  })
})
