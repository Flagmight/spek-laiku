import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { PlanCategory } from "../types/planActivity"
import {
  jsonResponse,
  renderApp,
  routeFetch,
  signedInUser,
  stubFetch,
} from "./renderApp"
import { openCategories } from "./planCategories"
import {
  daylightActivityForecast,
  forecastDay,
  forecastRoutes,
} from "./forecastFixtures"

function stubRegistration(answer: () => Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string) =>
      path === "/api/registration"
        ? answer()
        : Promise.resolve(jsonResponse(401)),
    ),
  )
}

// Texts linked to the element through aria-describedby, in order.
function descriptionsOf(element: HTMLElement) {
  return (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent)
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Email"), "user@example.com")
  await user.type(screen.getByLabelText("Password"), "Password123!")
  await user.type(screen.getByLabelText("Confirm password"), "Password123!")
}

describe("Register page accessibility", () => {
  it("gives every field a visible label tied to its input", async () => {
    stubFetch(() => jsonResponse(401))
    renderApp("/register")

    expect(await screen.findByLabelText("Email")).toHaveAttribute(
      "type",
      "email",
    )
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password",
    )
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute(
      "type",
      "password",
    )
    for (const label of ["Email", "Password", "Confirm password"]) {
      expect(screen.getByText(label, { selector: "label" })).toBeVisible()
    }
  })

  it("shows the hint 'At least 8 characters.' under Password, linked to it", async () => {
    stubFetch(() => jsonResponse(401))
    renderApp("/register")

    const password = await screen.findByLabelText("Password")
    expect(descriptionsOf(password)).toEqual(["At least 8 characters."])
    expect(screen.getByText("At least 8 characters.")).toBeVisible()
    expect(descriptionsOf(screen.getByLabelText("Email"))).toEqual([])
    expect(descriptionsOf(screen.getByLabelText("Confirm password"))).toEqual(
      [],
    )
  })

  it("links both the hint and the error to Password, hint first", async () => {
    stubRegistration(() =>
      Promise.resolve(
        jsonResponse(400, {
          errors: { password: ["Password must be at least 8 characters."] },
        }),
      ),
    )
    const user = userEvent.setup()
    renderApp("/register")
    await fillForm(user)

    await user.click(screen.getByRole("button", { name: "Create account" }))

    const password = screen.getByLabelText("Password")
    await vi.waitFor(() =>
      expect(descriptionsOf(password)).toEqual([
        "At least 8 characters.",
        "Error: Password must be at least 8 characters.",
      ]),
    )
    expect(password).toHaveAttribute("aria-invalid", "true")
    expect(password).toHaveFocus()
  })

  it("announces the loading text in a status region without moving focus", async () => {
    stubRegistration(() => new Promise<Response>(() => {}))
    const user = userEvent.setup()
    renderApp("/register")
    await fillForm(user)
    const submit = screen.getByRole("button", { name: "Create account" })

    await user.click(submit)

    const status = screen
      .getAllByRole("status")
      .find((region) => region.textContent === "Creating your account…")
    expect(status).toBeDefined()
    expect(screen.getByLabelText("Email")).not.toHaveFocus()
    expect(document.activeElement).not.toBe(status)
  })

  it("announces the server error as an alert", async () => {
    stubRegistration(() => Promise.resolve(jsonResponse(500)))
    const user = userEvent.setup()
    renderApp("/register")
    await fillForm(user)

    await user.click(screen.getByRole("button", { name: "Create account" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Error: Something went wrong. Try again.")
  })

  it("announces the error summary as an alert", async () => {
    stubRegistration(() =>
      Promise.resolve(
        jsonResponse(400, {
          errors: {
            email: ["Enter your email address."],
            passwordConfirmation: ["Confirm your password."],
          },
        }),
      ),
    )
    const user = userEvent.setup()
    renderApp("/register")

    await user.click(
      await screen.findByRole("button", { name: "Create account" }),
    )

    const summary = await screen.findByRole("alert", { name: "Error summary" })
    expect(within(summary).getAllByRole("link")).toHaveLength(2)
  })
})

describe("Log in page accessibility", () => {
  it("links each field's error to the field, so it is read after the label", async () => {
    stubFetch(() =>
      jsonResponse(400, {
        errors: {
          email: ["Enter your email address."],
          password: ["Enter your password."],
        },
      }),
    )
    const user = userEvent.setup()
    renderApp("/login")

    await user.click(await screen.findByRole("button", { name: "Log in" }))

    const email = screen.getByLabelText("Email")
    await vi.waitFor(() =>
      expect(descriptionsOf(email)).toEqual([
        "Error: Enter your email address.",
      ]),
    )
    expect(descriptionsOf(screen.getByLabelText("Password"))).toEqual([
      "Error: Enter your password.",
    ])
    expect(screen.getByText("Email", { selector: "label" })).toBeVisible()
    expect(screen.getByText("Password", { selector: "label" })).toBeVisible()
  })

  it("links the incorrect details message to both fields", async () => {
    stubFetch(() => jsonResponse(401, {}))
    const user = userEvent.setup()
    renderApp("/login")
    await user.type(await screen.findByLabelText("Email"), "user@example.com")
    await user.type(screen.getByLabelText("Password"), "Password123!")

    await user.click(screen.getByRole("button", { name: "Log in" }))

    await screen.findByRole("alert")
    for (const label of ["Email", "Password"]) {
      expect(descriptionsOf(screen.getByLabelText(label))).toEqual([
        "Error: Incorrect email or password.",
      ])
    }
  })
})

describe("Account Suspended page structure", () => {
  const suspendedUser = {
    email: "user@example.com",
    role: "Registered User",
    accountStatus: "Suspended",
  }

  it("has exactly one h1 and a tab title naming the page", async () => {
    stubFetch(() => jsonResponse(200, suspendedUser))
    document.title = ""
    renderApp("/account-suspended")

    const headings = await screen.findAllByRole("heading", { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent("Account suspended")
    await vi.waitFor(() =>
      expect(document.title).toBe("Account suspended - Spėk laiku"),
    )
  })
})

describe.each([
  ["/register", "Register", "Register - Spėk laiku"],
  ["/login", "Log in", "Log in - Spėk laiku"],
  ["/", "Spėk laiku", "Home - Spėk laiku"],
])("page structure of %s", (path, heading, title) => {
  it("has exactly one h1 and a tab title naming the page", async () => {
    stubFetch(() => jsonResponse(401))
    document.title = ""
    renderApp(path)

    const headings = await screen.findAllByRole("heading", { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent(heading)
    await vi.waitFor(() => expect(document.title).toBe(title))
  })

  it("makes 'Skip to main content' the first focusable item and moves focus to the main content", async () => {
    stubFetch(() => jsonResponse(401))
    const user = userEvent.setup()
    renderApp(path)
    await screen.findAllByRole("heading", { level: 1 })

    await user.tab()
    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveFocus()
    await user.keyboard("{Enter}")

    expect(screen.getByRole("main")).toHaveFocus()
  })
})

describe("Activity categories and Access denied page structure", () => {
  it.each([
    ["Administrator", "Activity categories"],
    ["Registered User", "Access denied"],
  ])(
    "for a %s has exactly one h1 and the tab title '%s - Spėk laiku'",
    async (role, heading) => {
      routeFetch({
        ...forecastRoutes,
        "GET /api/auth/me": () => jsonResponse(200, signedInUser(role)),
        "GET /api/admin/categories": () => jsonResponse(200, []),
      })
      document.title = ""
      renderApp("/admin/categories")

      const headings = await screen.findAllByRole("heading", { level: 1 })
      expect(headings).toHaveLength(1)
      expect(headings[0]).toHaveTextContent(heading)
      await vi.waitFor(() =>
        expect(document.title).toBe(`${heading} - Spėk laiku`),
      )
    },
  )
})

describe("Activity categories form accessibility", () => {
  async function openOutdoorForm(save: () => Promise<Response>) {
    routeFetch({
      ...forecastRoutes,
      "GET /api/auth/me": () =>
        jsonResponse(200, signedInUser("Administrator")),
      "GET /api/admin/categories": () => jsonResponse(200, []),
      "POST /api/admin/categories": save,
    })
    const user = userEvent.setup()
    renderApp("/admin/categories")
    await user.click(
      await screen.findByRole("button", { name: "Create category" }),
    )
    await user.click(screen.getByRole("radio", { name: "Outdoor" }))
    return user
  }

  it("gives every field a visible label tied to its input", async () => {
    await openOutdoorForm(() => new Promise<Response>(() => {}))
    const form = screen.getByRole("region", { name: "Create category" })

    const inputs = within(form).getAllByRole("textbox")
    expect(inputs).toHaveLength(7)
    for (const input of [
      ...inputs,
      ...within(form).getAllByRole("radio"),
      within(form).getByRole("checkbox"),
    ]) {
      const label =
        form.querySelector(`label[for="${input.id}"]`) ?? input.closest("label")
      expect(label).not.toBeNull()
      expect(label).toBeVisible()
      expect(label?.textContent?.trim()).not.toBe("")
    }
    expect(within(form).getByRole("group", { name: "Type" })).toBeVisible()
  })

  it.each([
    ["Default duration (h)", "0.5 to 12, in steps of 0.5"],
    ["Max wind (m/s)", "0 to 30"],
    ["Max rain (mm/h)", "0 to 20"],
    ["Min temperature (°C)", "-30 to 45"],
    ["Max temperature (°C)", "-30 to 45"],
  ])("links the range hint to %s", async (label, hint) => {
    await openOutdoorForm(() => new Promise<Response>(() => {}))

    expect(descriptionsOf(screen.getByLabelText(label))).toContain(hint)
  })

  it("announces saving in a status region and the server error as an alert", async () => {
    let respond: (response: Response) => void = () => {}
    const user = await openOutdoorForm(
      () => new Promise<Response>((resolve) => (respond = resolve)),
    )

    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(screen.getByText("Saving category…")).toHaveAttribute(
      "role",
      "status",
    )
    respond(jsonResponse(500))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Error: Something went wrong. Try again.",
    )
  })

  it("announces the list loading in a status region and a load error as an alert", async () => {
    let respond: (response: Response) => void = () => {}
    routeFetch({
      ...forecastRoutes,
      "GET /api/auth/me": () =>
        jsonResponse(200, signedInUser("Administrator")),
      "GET /api/admin/categories": () =>
        new Promise<Response>((resolve) => (respond = resolve)),
    })
    renderApp("/admin/categories")

    expect(
      await screen.findByText("Loading activity categories…"),
    ).toHaveAttribute("role", "status")
    respond(jsonResponse(500))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Error: Activity categories could not be loaded.",
    )
  })
})

const planPeriod = {
  firstDate: "2026-11-04",
  lastDate: "2026-11-10",
  maxDates: 7,
}

const kaunasPlace = {
  id: 598316,
  name: "Kaunas",
  area: "Kaunas County",
  latitude: 54.90156,
  longitude: 23.90909,
}

// A visitor on Plan setup; Continue is refused with an error for every field.
function stubPlanSetup() {
  routeFetch({
    ...forecastRoutes,
    "GET /api/auth/me": () => jsonResponse(401),
    "GET /api/plan-setup/period": () => jsonResponse(200, planPeriod),
    "GET /api/locations?query=Kaun": () =>
      jsonResponse(200, { locations: [kaunasPlace] }),
    "GET /api/plan-activities/categories": () =>
      jsonResponse(200, { categories: [], maxActivities: 10 }),
  })
}

describe("Plan setup and Activity selection page structure", () => {
  it.each([
    ["/plan/setup", "Plan setup"],
    ["/plan/activities", "Activity selection"],
    ["/plan/places", "Places and forecast"],
  ])(
    "%s has exactly one h1 and the tab title '%s - Spėk laiku'",
    async (page, heading) => {
      usePlanActivitiesStore.getState().setChecked([])
      usePlanSetupStore.getState().setChecked({
        location: kaunasPlace,
        dates: ["2026-11-07"],
        maxTravelDistanceKm: 30,
      })
      stubPlanSetup()
      document.title = ""
      renderApp(page)

      const headings = await screen.findAllByRole("heading", { level: 1 })
      expect(headings).toHaveLength(1)
      expect(headings[0]).toHaveTextContent(heading)
      await vi.waitFor(() =>
        expect(document.title).toBe(`${heading} - Spėk laiku`),
      )
    },
  )
})

const kayakingCategory: PlanCategory = {
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

const museumCategory: PlanCategory = {
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

const categoryAnswer = {
  categories: [kayakingCategory, museumCategory],
  maxActivities: 10,
}

type Answer = () => Response | Promise<Response>

describe("Activity selection accessibility", () => {
  function renderActivities(
    categories: Answer = () => jsonResponse(200, categoryAnswer),
    check: Answer = () => new Promise<Response>(() => {}),
  ) {
    usePlanSetupStore.getState().setChecked({
      location: kaunasPlace,
      dates: ["2026-11-07"],
      maxTravelDistanceKm: 30,
    })
    routeFetch({
      ...forecastRoutes,
      "GET /api/auth/me": () => jsonResponse(401),
      "GET /api/plan-activities/categories": categories,
      "POST /api/plan-activities/check": check,
    })
    renderApp("/plan/activities")
  }

  function addBoth() {
    usePlanActivitiesStore.getState().add(kayakingCategory)
    usePlanActivitiesStore.getState().add(museumCategory)
  }

  it("makes every activity a group named after it", async () => {
    addBoth()
    usePlanActivitiesStore.getState().add(museumCategory)
    renderActivities()

    expect(
      await screen.findByRole("group", { name: "Kayaking" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Museum 1" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Museum 2" })).toBeInTheDocument()
  })

  it("gives every field a visible label tied to its input", async () => {
    addBoth()
    renderActivities()
    const group = within(await screen.findByRole("group", { name: "Kayaking" }))

    for (const label of [
      "Duration (h)",
      "Requires daylight",
      "Max wind (m/s)",
      "Max rain (mm/h)",
      "Min temperature (°C)",
      "Max temperature (°C)",
    ]) {
      const input = group.getByLabelText(label)
      expect(
        document.querySelector(`label[for="${input.id}"]`),
      ).toHaveTextContent(label)
    }
  })

  it("names the activity in every Add and Remove button", async () => {
    addBoth()
    renderActivities()
    await openCategories()

    for (const name of [
      "Add Kayaking",
      "Add Museum",
      "Remove Kayaking",
      "Remove Museum",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument()
    }
  })

  it("announces loading in a status region", async () => {
    renderActivities(() => new Promise<Response>(() => {}))

    expect(
      await screen.findByText("Loading activity categories…"),
    ).toHaveAttribute("role", "status")
  })

  it("announces added, removed and checking in status regions", async () => {
    const user = userEvent.setup()
    renderActivities()

    await user.click(
      await screen.findByRole("button", { name: "Add Kayaking" }),
    )
    expect(screen.getByText("Kayaking added.")).toHaveAttribute(
      "role",
      "status",
    )

    await user.click(screen.getByRole("button", { name: "Remove Kayaking" }))
    expect(screen.getByText("Kayaking removed.")).toHaveAttribute(
      "role",
      "status",
    )

    await user.click(screen.getByRole("button", { name: "Add Museum" }))
    await user.click(screen.getByRole("button", { name: "Continue" }))
    expect(screen.getByText("Checking your activities…")).toHaveAttribute(
      "role",
      "status",
    )
  })

  it("announces the category and server errors in alerts", async () => {
    addBoth()
    const user = userEvent.setup()
    renderActivities(
      () => jsonResponse(500),
      () => jsonResponse(500),
    )

    const categoriesError = await screen.findByText(
      "Error: Activity categories could not be loaded.",
    )
    expect(categoriesError).toHaveAttribute("role", "alert")

    await user.click(screen.getByRole("button", { name: "Continue" }))
    const serverError = await screen.findByText(
      "Error: Something went wrong. Try again.",
    )
    expect(serverError.closest('[role="alert"]')).not.toBeNull()
  })

  it("announces an empty plan in an alert", async () => {
    const user = userEvent.setup()
    renderActivities()
    await openCategories()

    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(
      screen.getByText("Error: Add at least one activity."),
    ).toHaveAttribute("role", "alert")
  })

  it("shows a refused value with words as well as colour", async () => {
    addBoth()
    const user = userEvent.setup()
    renderActivities(
      () => jsonResponse(200, categoryAnswer),
      () =>
        jsonResponse(400, {
          errors: {
            "activities[0].durationHours": ["Enter a duration."],
            "activities[1]": ["This activity is no longer available."],
          },
        }),
    )
    await openCategories()

    await user.click(screen.getByRole("button", { name: "Continue" }))

    const summary = await screen.findByRole("alert", { name: "Error summary" })
    expect(within(summary).getAllByRole("link")).toHaveLength(2)
    const kayaking = within(screen.getByRole("group", { name: "Kayaking" }))
    expect(kayaking.getByText("Error: Enter a duration.")).toBeInTheDocument()
    expect(kayaking.getByLabelText("Duration (h)")).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    expect(
      within(screen.getByRole("group", { name: "Museum" })).getByText(
        "Error: This activity is no longer available.",
      ),
    ).toBeInTheDocument()
  })
})

describe("Plan setup accessibility", () => {
  it("gives every field a visible label tied to its input", async () => {
    stubPlanSetup()
    renderApp("/plan/setup")
    await screen.findByRole("heading", { level: 1, name: "Plan setup" })

    for (const label of ["Location", "Maximum travel distance (km)"]) {
      const input = screen.getByLabelText(label)
      const visibleLabel = document.querySelector(`label[for="${input.id}"]`)
      expect(visibleLabel).toHaveTextContent(label)
    }
    // The date picker's visible label is the group's own "Dates" legend (feature 004 FR-021).
    const dates = screen.getByRole("group", { name: "Dates" })
    const datePicker = screen.getByLabelText("Dates")
    const legend = document.getElementById(
      datePicker.getAttribute("aria-labelledby") ?? "",
    )
    expect(legend?.tagName).toBe("LEGEND")
    expect(legend).toHaveTextContent("Dates")
    expect(dates).toContainElement(legend)
  })

  it("makes Location a combobox that points at its list and the highlighted place", async () => {
    stubPlanSetup()
    const user = userEvent.setup()
    renderApp("/plan/setup")
    const location = await screen.findByRole("combobox", { name: "Location" })
    expect(location).toHaveAttribute("aria-autocomplete", "list")
    expect(location).toHaveAttribute("aria-expanded", "false")
    expect(location).not.toHaveAttribute("aria-activedescendant")

    await user.click(location)
    await user.paste("Kaun")
    const listbox = await screen.findByRole("listbox", {
      name: "Location suggestions",
    })
    await user.keyboard("{ArrowDown}")

    expect(location).toHaveAttribute("aria-expanded", "true")
    expect(location).toHaveAttribute("aria-controls", listbox.id)
    const option = screen.getByRole("option", { selected: true })
    expect(location).toHaveAttribute("aria-activedescendant", option.id)
  })

  it("announces loading and counts in status regions", async () => {
    let answer: (response: Response) => void = () => {}
    routeFetch({
      ...forecastRoutes,
      "GET /api/auth/me": () => jsonResponse(401),
      "GET /api/plan-setup/period": () =>
        new Promise<Response>((resolve) => (answer = resolve)),
    })
    usePlanSetupStore.getState().addDate("2026-11-07")
    renderApp("/plan/setup")

    expect(await screen.findByText("Loading available dates…")).toHaveAttribute(
      "role",
      "status",
    )
    answer(jsonResponse(200, planPeriod))
    expect(await screen.findByText("1 date added")).toBeInTheDocument()
    const dates = screen.getByRole("group", { name: "Dates" })
    expect(descriptionsOf(within(dates).getByLabelText("Dates"))).toContain(
      "1 date added",
    )
  })

  it("ties each error to its field, marks the field invalid and starts it with 'Error: '", async () => {
    stubPlanSetup()
    const user = userEvent.setup()
    renderApp("/plan/setup")
    await vi.waitFor(() => expect(screen.getByLabelText("Dates")).toBeEnabled())
    await user.clear(screen.getByLabelText("Maximum travel distance (km)"))
    await user.type(
      screen.getByLabelText("Maximum travel distance (km)"),
      "abc",
    )

    await user.click(screen.getByRole("button", { name: "Continue" }))

    const expectations: [string, string][] = [
      ["Location", "Error: Select a location in Lithuania from the list."],
      ["Dates", "Error: Add at least one date."],
      [
        "Maximum travel distance (km)",
        "Error: Enter a whole number between 1 and 200.",
      ],
    ]
    for (const [label, message] of expectations) {
      const field = screen.getByLabelText(label)
      expect(field).toHaveAttribute("aria-invalid", "true")
      expect(descriptionsOf(field)).toContain(message)
    }
    expect(
      screen.getByRole("alert", { name: "Error summary" }),
    ).toBeInTheDocument()
  })
})

describe("Places and forecast accessibility", () => {
  // A checked setup of one date and checked Kayaking, with one unsuitable hour in the forecast.
  function renderPlaces(answer: Answer = () => jsonResponse(200, forecast())) {
    usePlanSetupStore.getState().setChecked({
      location: kaunasPlace,
      dates: ["2026-11-07"],
      maxTravelDistanceKm: 30,
    })
    const activities = usePlanActivitiesStore.getState()
    activities.add(kayakingCategory)
    const [kayaking] = usePlanActivitiesStore.getState().activities
    activities.setChecked([
      {
        id: kayaking.id,
        categoryId: kayakingCategory.id,
        name: "Kayaking",
        type: "Outdoor",
        durationHours: 2,
        requiresDaylight: true,
        maxWindMs: 8,
        maxRainMmPerHour: 0.5,
        minTemperatureC: 15,
        maxTemperatureC: 35,
      },
    ])
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "POST /api/plan-forecast": answer,
    })
    renderApp("/plan/places")
  }

  function forecast() {
    const day = forecastDay("2026-11-07")
    const activity = daylightActivityForecast([day])
    activity.days[0].hours[6] = {
      start: "12:00",
      suitable: false,
      reasons: ["Too windy: 9.0 m/s, maximum 8.0 m/s"],
    }
    return { updatedAt: "14:05", days: [day], activities: [activity] }
  }

  it("has one h1, an h2 per activity and an h3 per date", async () => {
    renderPlaces()
    await screen.findByText("Forecast updated at 14:05")

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(
      screen.getByRole("heading", { level: 2, name: "Kayaking" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Saturday 7 November 2026",
      }),
    ).toBeInTheDocument()
  })

  it("makes each activity a region named after it", async () => {
    renderPlaces()
    await screen.findByText("Forecast updated at 14:05")

    const region = screen.getByRole("region", { name: "Kayaking" })
    expect(region).toHaveTextContent("Suitable hours: 8 on 1 of 1 date.")
  })

  it.each([
    ["loading", () => new Promise<Response>(() => {}), "Getting the forecast…"],
    [
      "loaded",
      () => jsonResponse(200, forecast()),
      "Forecast updated at 14:05",
    ],
    [
      "failed",
      () => jsonResponse(503, { status: 503, service: "forecast" }),
      "Error: The weather service is unavailable. No forecast is shown.",
    ],
  ] as const)(
    "announces the %s message in the one forecast status region without moving focus",
    async (_case, answer, message) => {
      renderPlaces(answer)

      const region = await screen.findByRole("status", { name: "Forecast" })
      await vi.waitFor(() => expect(region).toHaveTextContent(message))
      expect(region).not.toHaveFocus()
      expect(region).not.toContainElement(document.activeElement as HTMLElement)
    },
  )

  it("gives each hours table a caption and column headers, and every verdict symbols with words", async () => {
    renderPlaces()
    const user = userEvent.setup()
    await screen.findByText("Forecast updated at 14:05")

    await user.click(
      screen.getByRole("button", {
        name: "Show hours for Saturday 7 November 2026, Kayaking",
      }),
    )

    const table = screen.getByRole("table", {
      name: "Hours for Kayaking on Saturday 7 November 2026",
    })
    expect(within(table).getAllByRole("columnheader")).toHaveLength(6)
    for (const row of within(table).getAllByRole("row").slice(1)) {
      expect(row.textContent).toMatch(/★ Suitable|✗ Unsuitable/)
    }
    const noon = within(table)
      .getAllByRole("row")
      .find((row) => row.textContent?.includes("12:00–"))!
    expect(noon).toHaveTextContent("✗ Unsuitable")
    expect(noon).toHaveTextContent("Too windy: 9.0 m/s, maximum 8.0 m/s")
  })

  it("shows the suitable periods and the empty date with symbols and words", async () => {
    renderPlaces()
    await screen.findByText("Forecast updated at 14:05")

    expect(screen.getByText("★ Suitable 08:00–16:00 (8 h)")).toBeInTheDocument()
  })
})

describe("'checked again' notices accessibility", () => {
  it.each([
    [
      "/plan/setup",
      "Your plan setup needs to be checked again. Select Continue.",
    ],
    [
      "/plan/activities",
      "Your activities need to be checked again. Select Continue.",
    ],
  ])("shows the notice on %s in a status region", async (page, notice) => {
    usePlanSetupStore.getState().setChecked({
      location: kaunasPlace,
      dates: ["2026-11-07"],
      maxTravelDistanceKm: 30,
    })
    if (page === "/plan/setup") {
      usePlanSetupStore.getState().markOutdated()
    } else {
      usePlanActivitiesStore.getState().add(kayakingCategory)
      usePlanActivitiesStore.getState().markOutdated()
    }
    stubPlanSetup()
    renderApp(page)

    expect(await screen.findByText(notice)).toHaveAttribute("role", "status")
  })
})
