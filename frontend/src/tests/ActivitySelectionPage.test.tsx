import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { PlanCategory } from "../types/planActivity"
import type { CheckedPlanSetup, PlanLocation } from "../types/planSetup"
import { jsonResponse, renderAppWithLocation, routeFetch } from "./renderApp"

const kaunas: PlanLocation = {
  id: 598316,
  name: "Kaunas",
  area: "Kaunas County",
  latitude: 54.90156,
  longitude: 23.90909,
}

const checked: CheckedPlanSetup = {
  location: kaunas,
  dates: ["2026-11-07", "2026-11-08"],
  maxTravelDistanceKm: 30,
}

// A visitor whose setup the server accepted, as Continue leaves it.
function acceptSetup() {
  const store = usePlanSetupStore.getState()
  store.chooseLocation(kaunas)
  store.addDate("2026-11-07")
  store.addDate("2026-11-08")
  store.setChecked(checked)
}

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

const cycling: PlanCategory = {
  id: "category-cycling",
  name: "Cycling",
  type: "Outdoor",
  defaultDurationHours: 3,
  requiresDaylight: true,
  maxWindMs: 10,
  maxRainMmPerHour: 1,
  minTemperatureC: 5,
  maxTemperatureC: 30,
}

// Not alphabetical, so a test can see that the page keeps the server's order.
const categoryList = {
  categories: [kayaking, museum, cycling],
  maxActivities: 10,
}

type CategoriesAnswer = () => Response | Promise<Response>

function render(
  entry = "/plan/activities",
  categoriesAnswer: CategoriesAnswer = () => jsonResponse(200, categoryList),
) {
  routeFetch({
    "GET /api/auth/me": () => jsonResponse(401),
    "GET /api/plan-setup/period": () =>
      jsonResponse(200, {
        firstDate: "2026-11-04",
        lastDate: "2026-11-10",
        maxDates: 7,
      }),
    "GET /api/plan-activities/categories": categoriesAnswer,
  })
  return renderAppWithLocation(entry)
}

function categoriesRegion() {
  return screen.getByRole("region", { name: "Activity categories" })
}

function activityGroup(name: string) {
  return within(screen.getByRole("group", { name }))
}

function addButtons() {
  return within(categoriesRegion()).getAllByRole("button", { name: /^Add / })
}

describe("Activity selection categories and Add", () => {
  beforeEach(() => {
    acceptSetup()
  })

  it("shows and announces the loading text while the categories load", async () => {
    render("/plan/activities", () => new Promise<Response>(() => {}))

    expect(
      await screen.findByText("Loading activity categories…"),
    ).toHaveAttribute("role", "status")
  })

  it("lists the categories in the order sent, each with its type, duration and Add", async () => {
    render()

    await screen.findByRole("button", { name: "Add Kayaking" })
    const items = within(categoriesRegion()).getAllByRole("listitem")
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent("Kayaking")
    expect(items[0]).toHaveTextContent("Outdoor")
    expect(items[0]).toHaveTextContent("2 h")
    expect(items[1]).toHaveTextContent("Museum")
    expect(items[1]).toHaveTextContent("Indoor")
    expect(items[2]).toHaveTextContent("Cycling")
    expect(items[2]).toHaveTextContent("3 h")
    expect(
      addButtons().map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Add Kayaking", "Add Museum", "Add Cycling"])
  })

  it("says no activities are added yet before any Add", async () => {
    render()

    expect(
      await screen.findByText(
        "No activities added yet. Select at least one category to continue.",
      ),
    ).toBeInTheDocument()
  })

  it("adds Kayaking with its category defaults and keeps Add available", async () => {
    const user = userEvent.setup()
    render()

    await user.click(
      await screen.findByRole("button", { name: "Add Kayaking" }),
    )

    const group = activityGroup("Kayaking")
    expect(group.getByLabelText("Duration (h)")).toHaveValue("2")
    expect(
      group.getByRole("checkbox", { name: "Requires daylight" }),
    ).toBeChecked()
    expect(group.getByLabelText("Max wind (m/s)")).toHaveValue("8")
    expect(group.getByLabelText("Max rain (mm/h)")).toHaveValue("0.5")
    expect(group.getByLabelText("Min temperature (°C)")).toHaveValue("15")
    expect(group.getByLabelText("Max temperature (°C)")).toHaveValue("35")
    expect(screen.getByText("Kayaking added.")).toHaveAttribute(
      "role",
      "status",
    )
    expect(screen.getByRole("button", { name: "Add Kayaking" })).toBeEnabled()
    expect(
      screen.queryByText(
        "No activities added yet. Select at least one category to continue.",
      ),
    ).toBeNull()
  })

  it("shows only Duration and Requires daylight for an Indoor activity", async () => {
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole("button", { name: "Add Museum" }))

    const group = activityGroup("Museum")
    expect(group.getByLabelText("Duration (h)")).toHaveValue("2")
    expect(
      group.getByRole("checkbox", { name: "Requires daylight" }),
    ).not.toBeChecked()
    expect(group.getAllByRole("textbox")).toHaveLength(1)
    expect(group.queryByLabelText("Max wind (m/s)")).toBeNull()
  })

  it("numbers a category added twice and keeps each copy's own values", async () => {
    const user = userEvent.setup()
    render()
    const add = await screen.findByRole("button", { name: "Add Cycling" })

    await user.click(add)
    expect(screen.getByText("Cycling added.")).toBeInTheDocument()
    expect(activityGroup("Cycling").getByLabelText("Duration (h)")).toHaveValue(
      "3",
    )

    await user.click(add)
    expect(screen.getByText("Cycling 2 added.")).toBeInTheDocument()

    const firstDuration =
      activityGroup("Cycling 1").getByLabelText("Duration (h)")
    await user.clear(firstDuration)
    await user.type(firstDuration, "4.5")

    expect(firstDuration).toHaveValue("4.5")
    expect(
      activityGroup("Cycling 2").getByLabelText("Duration (h)"),
    ).toHaveValue("3")
  })

  it("disables every Add and says so with 10 activities", async () => {
    for (let count = 0; count < 10; count++) {
      usePlanActivitiesStore.getState().add(kayaking)
    }
    render()

    expect(
      await screen.findByText("You can add up to 10 activities."),
    ).toBeInTheDocument()
    expect(addButtons()).toHaveLength(3)
    for (const button of addButtons()) {
      expect(button).toBeDisabled()
    }
  })

  it("takes the limit from the server, not from a constant", async () => {
    const user = userEvent.setup()
    usePlanActivitiesStore.getState().add(kayaking)
    usePlanActivitiesStore.getState().add(museum)
    render("/plan/activities", () =>
      jsonResponse(200, { ...categoryList, maxActivities: 3 }),
    )
    const add = await screen.findByRole("button", { name: "Add Cycling" })
    expect(add).toBeEnabled()
    expect(screen.queryByText(/You can add up to/)).toBeNull()

    await user.click(add)

    expect(
      screen.getByText("You can add up to 3 activities."),
    ).toBeInTheDocument()
    for (const button of addButtons()) {
      expect(button).toBeDisabled()
    }
  })

  it("shows the error with Retry on a 500, keeps the activities, and Retry loads the list", async () => {
    const user = userEvent.setup()
    usePlanActivitiesStore.getState().add(museum)
    let answer = jsonResponse(500)
    render("/plan/activities", () => answer)

    expect(
      await screen.findByText(
        "Error: Activity categories could not be loaded.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Museum" })).toBeInTheDocument()

    answer = jsonResponse(200, categoryList)
    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(
      await screen.findByRole("button", { name: "Add Kayaking" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Error: Activity categories could not be loaded."),
    ).toBeNull()
    expect(screen.getByRole("group", { name: "Museum" })).toBeInTheDocument()
  })

  it("says so when there are no categories", async () => {
    render("/plan/activities", () =>
      jsonResponse(200, { categories: [], maxActivities: 10 }),
    )

    expect(
      await screen.findByText("No activity categories are available yet."),
    ).toBeInTheDocument()
  })

  it("still shows the setup summary and Back", async () => {
    render()

    await screen.findByRole("button", { name: "Add Kayaking" })
    expect(
      screen.getByText(
        "Kaunas, Kaunas County · Sat 7 Nov 2026, Sun 8 Nov 2026 · Maximum travel distance: 30 km",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/plan/setup",
    )
  })
})

describe("Activity selection Remove", () => {
  beforeEach(() => {
    acceptSetup()
  })

  function addToPlan(...categories: PlanCategory[]) {
    for (const category of categories) {
      usePlanActivitiesStore.getState().add(category)
    }
  }

  function removeButton(name: string) {
    return screen.findByRole("button", { name: `Remove ${name}` })
  }

  it("removes the activity, announces it and moves focus to the next activity", async () => {
    const user = userEvent.setup()
    addToPlan(cycling, museum)
    render()

    await user.click(await removeButton("Cycling"))

    expect(screen.queryByRole("group", { name: "Cycling" })).toBeNull()
    expect(screen.getByRole("group", { name: "Museum" })).toBeInTheDocument()
    expect(screen.getByText("Cycling removed.")).toHaveAttribute(
      "role",
      "status",
    )
    expect(
      screen.getByRole("heading", { level: 3, name: "Museum" }),
    ).toHaveFocus()
  })

  it("moves focus to the previous activity when the last one is removed", async () => {
    const user = userEvent.setup()
    addToPlan(cycling, museum)
    render()

    await user.click(await removeButton("Museum"))

    expect(
      screen.getByRole("heading", { level: 3, name: "Cycling" }),
    ).toHaveFocus()
  })

  it("moves focus to the categories and shows the empty text when none is left", async () => {
    const user = userEvent.setup()
    addToPlan(museum)
    render()

    await user.click(await removeButton("Museum"))

    expect(
      screen.getByRole("heading", { level: 2, name: "Activity categories" }),
    ).toHaveFocus()
    expect(
      screen.getByText(
        "No activities added yet. Select at least one category to continue.",
      ),
    ).toBeInTheDocument()
  })

  it("leaves the other copy with its own values, shown without a number", async () => {
    const user = userEvent.setup()
    addToPlan(cycling, cycling)
    render()
    await removeButton("Cycling 1")
    const secondDuration =
      activityGroup("Cycling 2").getByLabelText("Duration (h)")
    await user.clear(secondDuration)
    await user.type(secondDuration, "4.5")

    await user.click(await removeButton("Cycling 1"))

    expect(screen.getByText("Cycling 1 removed.")).toBeInTheDocument()
    expect(activityGroup("Cycling").getByLabelText("Duration (h)")).toHaveValue(
      "4.5",
    )
    expect(screen.queryByRole("group", { name: "Cycling 2" })).toBeNull()
  })

  it("starts an activity added again with the category defaults", async () => {
    const user = userEvent.setup()
    addToPlan(kayaking)
    render()
    await removeButton("Kayaking")
    const duration = activityGroup("Kayaking").getByLabelText("Duration (h)")
    await user.clear(duration)
    await user.type(duration, "5")

    await user.click(await removeButton("Kayaking"))
    await user.click(screen.getByRole("button", { name: "Add Kayaking" }))

    expect(
      activityGroup("Kayaking").getByLabelText("Duration (h)"),
    ).toHaveValue("2")
  })

  // A live region is only read out when its text changes, so the same message must clear in between.
  it("clears each message after the opposite action, so the same one is announced again", async () => {
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole("button", { name: "Add Museum" }))
    expect(screen.getByText("Museum added.")).toBeInTheDocument()

    await user.click(await removeButton("Museum"))
    expect(screen.queryByText("Museum added.")).toBeNull()
    expect(screen.getByText("Museum removed.")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Add Museum" }))
    expect(screen.queryByText("Museum removed.")).toBeNull()
    expect(screen.getByText("Museum added.")).toBeInTheDocument()
  })
})

const checkRoute = "POST /api/plan-activities/check"

const checkedCycling = {
  categoryId: cycling.id,
  name: "Cycling",
  type: "Outdoor",
  durationHours: 3,
  requiresDaylight: true,
  maxWindMs: 10,
  maxRainMmPerHour: 1,
  minTemperatureC: 5,
  maxTemperatureC: 30,
}

const checkedMuseum = {
  categoryId: museum.id,
  name: "Museum",
  type: "Indoor",
  durationHours: 2,
  requiresDaylight: false,
  maxWindMs: null,
  maxRainMmPerHour: null,
  minTemperatureC: null,
  maxTemperatureC: null,
}

const acceptedPlan = { activities: [checkedCycling, checkedMuseum] }

const continueButton = () => screen.getByRole("button", { name: "Continue" })

describe("Activity selection Continue", () => {
  beforeEach(() => {
    acceptSetup()
  })

  function addCyclingAndMuseum() {
    usePlanActivitiesStore.getState().add(cycling)
    usePlanActivitiesStore.getState().add(museum)
  }

  function renderWithCheck(
    check: () => Response | Promise<Response>,
    categoriesAnswer: CategoriesAnswer = () => jsonResponse(200, categoryList),
  ) {
    const { requests } = routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "GET /api/plan-activities/categories": categoriesAnswer,
      [checkRoute]: check,
    })
    const { currentLocation } = renderAppWithLocation("/plan/activities")
    return {
      currentLocation,
      checks: () => requests.filter((sent) => sent.method === "POST"),
    }
  }

  it("asks for an activity and sends nothing when there are none", async () => {
    const user = userEvent.setup()
    const { checks } = renderWithCheck(() => jsonResponse(200, acceptedPlan))
    await screen.findByRole("button", { name: "Add Museum" })

    await user.click(continueButton())

    expect(
      screen.getByText("Error: Add at least one activity."),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 2, name: "Your activities" }),
    ).toHaveFocus()
    expect(checks()).toHaveLength(0)
  })

  it("removes the 'add an activity' error once an activity is added", async () => {
    const user = userEvent.setup()
    renderWithCheck(() => jsonResponse(200, acceptedPlan))
    await user.click(await screen.findByRole("button", { name: "Add Museum" }))
    await user.click(screen.getByRole("button", { name: "Remove Museum" }))
    await user.click(continueButton())
    expect(
      screen.getByText("Error: Add at least one activity."),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Add Museum" }))
    expect(screen.queryByText("Error: Add at least one activity.")).toBeNull()

    await user.click(screen.getByRole("button", { name: "Remove Museum" }))
    expect(screen.queryByText("Error: Add at least one activity.")).toBeNull()
  })

  it("announces the check, disables Continue and sends the contract's body", async () => {
    const user = userEvent.setup()
    addCyclingAndMuseum()
    const { checks } = renderWithCheck(() => new Promise<Response>(() => {}))
    const duration = await waitFor(() =>
      activityGroup("Cycling").getByLabelText("Duration (h)"),
    )
    await user.clear(duration)
    await user.type(duration, "2,5")

    await user.click(continueButton())

    expect(screen.getByText("Checking your activities…")).toHaveAttribute(
      "role",
      "status",
    )
    expect(continueButton()).toBeDisabled()
    expect(checks()[0].body).toEqual({
      activities: [
        {
          categoryId: cycling.id,
          type: "Outdoor",
          durationHours: null,
          requiresDaylight: true,
          maxWindMs: 10,
          maxRainMmPerHour: 1,
          minTemperatureC: 5,
          maxTemperatureC: 30,
        },
        {
          categoryId: museum.id,
          type: "Indoor",
          durationHours: 2,
          requiresDaylight: false,
          maxWindMs: null,
          maxRainMmPerHour: null,
          minTemperatureC: null,
          maxTemperatureC: null,
        },
      ],
    })
  })

  it("opens step 3 on a 200", async () => {
    const user = userEvent.setup()
    addCyclingAndMuseum()
    const { currentLocation } = renderWithCheck(() =>
      jsonResponse(200, acceptedPlan),
    )
    await screen.findByRole("button", { name: "Add Museum" })

    await user.click(continueButton())

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Places and forecast",
      }),
    ).toBeInTheDocument()
    expect(currentLocation()).toBe("/plan/places")
  })

  it("shows each message at its field, lists them all and focuses the first", async () => {
    const user = userEvent.setup()
    addCyclingAndMuseum()
    renderWithCheck(() =>
      jsonResponse(400, {
        errors: {
          "activities[0].durationHours": [
            "Enter a duration between 0.5 and 12 hours.",
          ],
          "activities[0].minTemperatureC": [
            "Enter a minimum temperature between -30 and 45 °C.",
          ],
          "activities[1].durationHours": [
            "Enter a duration between 0.5 and 12 hours.",
          ],
        },
      }),
    )
    await screen.findByRole("button", { name: "Add Museum" })

    await user.click(continueButton())

    const cyclingDuration = await waitFor(() => {
      const field = activityGroup("Cycling").getByLabelText("Duration (h)")
      expect(field).toHaveFocus()
      return field
    })
    expect(cyclingDuration).toHaveAccessibleDescription(
      "0.5 to 12 Error: Enter a duration between 0.5 and 12 hours.",
    )
    expect(
      activityGroup("Museum").getByText(/^Error: Enter a duration/),
    ).toBeInTheDocument()
    expect(
      activityGroup("Cycling").getByText(
        "Error: Enter a minimum temperature between -30 and 45 °C.",
      ),
    ).toBeInTheDocument()

    const summary = within(screen.getByRole("alert", { name: "Error summary" }))
    expect(
      summary.getAllByRole("link").map((link) => link.textContent),
    ).toEqual([
      "Error: Cycling: Enter a duration between 0.5 and 12 hours.",
      "Error: Cycling: Enter a minimum temperature between -30 and 45 °C.",
      "Error: Museum: Enter a duration between 0.5 and 12 hours.",
    ])
    await user.click(summary.getByRole("link", { name: /^Error: Museum/ }))
    expect(activityGroup("Museum").getByLabelText("Duration (h)")).toHaveFocus()
  })

  it("shows an activity's own message at the top of its group and focuses the group", async () => {
    const user = userEvent.setup()
    addCyclingAndMuseum()
    renderWithCheck(() =>
      jsonResponse(400, {
        errors: {
          "activities[1]": [
            "This activity's category has changed. Remove it and add it again.",
          ],
        },
      }),
    )
    await screen.findByRole("button", { name: "Add Museum" })

    await user.click(continueButton())

    const group = await waitFor(() => {
      const museumGroup = screen.getByRole("group", { name: "Museum" })
      expect(museumGroup).toHaveFocus()
      return museumGroup
    })
    expect(group).toHaveAccessibleDescription(
      "Error: This activity's category has changed. Remove it and add it again.",
    )
    expect(
      activityGroup("Cycling").queryByText(/category has changed/),
    ).toBeNull()
  })

  it("keeps the second activity's errors on it after the first is removed", async () => {
    const user = userEvent.setup()
    addCyclingAndMuseum()
    renderWithCheck(() =>
      jsonResponse(400, {
        errors: {
          "activities[1].durationHours": [
            "Enter a duration between 0.5 and 12 hours.",
          ],
        },
      }),
    )
    await screen.findByRole("button", { name: "Add Museum" })
    await user.click(continueButton())
    await activityGroup("Museum").findByText(/^Error: Enter a duration/)

    await user.click(screen.getByRole("button", { name: "Remove Cycling" }))

    expect(
      activityGroup("Museum").getByText(/^Error: Enter a duration/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 3, name: "Museum" }),
    ).toHaveFocus()
  })

  it("offers Retry after a server error, which sends the same request", async () => {
    const user = userEvent.setup()
    addCyclingAndMuseum()
    let answer = jsonResponse(500)
    const { checks, currentLocation } = renderWithCheck(() => answer)
    await screen.findByRole("button", { name: "Add Museum" })

    await user.click(continueButton())
    expect(
      await screen.findByText("Error: Something went wrong. Try again."),
    ).toBeInTheDocument()

    answer = jsonResponse(200, acceptedPlan)
    await user.click(screen.getByRole("button", { name: "Retry" }))

    await waitFor(() => expect(currentLocation()).toBe("/plan/places"))
    expect(checks()).toHaveLength(2)
    expect(checks()[1].body).toEqual(checks()[0].body)
  })

  it("takes Retry away after a change, so old values cannot be accepted", async () => {
    const user = userEvent.setup()
    addCyclingAndMuseum()
    renderWithCheck(() => jsonResponse(500))
    await screen.findByRole("button", { name: "Add Museum" })
    await user.click(continueButton())
    await screen.findByRole("button", { name: "Retry" })

    await user.type(
      activityGroup("Museum").getByLabelText("Duration (h)"),
      ".5",
    )

    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull()
    expect(
      screen.queryByText("Error: Something went wrong. Try again."),
    ).toBeNull()
  })

  it("still continues with earlier activities when the categories fail to load", async () => {
    const user = userEvent.setup()
    addCyclingAndMuseum()
    const { checks, currentLocation } = renderWithCheck(
      () => jsonResponse(200, acceptedPlan),
      () => jsonResponse(500),
    )
    await screen.findByText("Error: Activity categories could not be loaded.")

    await user.click(continueButton())

    await waitFor(() => expect(currentLocation()).toBe("/plan/places"))
    expect(checks()).toHaveLength(1)
  })
})

interface SentActivity {
  [field: string]: unknown
}

function sentActivities(body: unknown) {
  return (body as { activities: SentActivity[] }).activities
}

describe("Activity selection settings", () => {
  beforeEach(() => {
    acceptSetup()
    usePlanActivitiesStore.getState().add(cycling)
  })

  // The server echoes what it was sent, so step 3 shows the values that really were sent.
  function renderEchoingServer() {
    const { requests } = routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "GET /api/plan-setup/period": () =>
        jsonResponse(200, {
          firstDate: "2026-11-04",
          lastDate: "2026-11-10",
          maxDates: 7,
        }),
      "POST /api/plan-setup/check": () => jsonResponse(200, checked),
      "GET /api/plan-activities/categories": () =>
        jsonResponse(200, categoryList),
      [checkRoute]: (request) =>
        jsonResponse(200, {
          activities: sentActivities(request.body).map((sent) => ({
            ...sent,
            name: "Cycling",
          })),
        }),
    })
    const { currentLocation } = renderAppWithLocation("/plan/activities")
    return {
      currentLocation,
      lastCheck: () =>
        sentActivities(
          requests.filter(
            (sent) => sent.path === "/api/plan-activities/check",
          )[0].body,
        )[0],
    }
  }

  async function replaceText(label: string, text: string) {
    const user = userEvent.setup()
    const field = activityGroup("Cycling").getByLabelText(label)
    await user.clear(field)
    if (text) {
      await user.type(field, text)
    }
    return field
  }

  it("sends the changed values and shows them on step 3", async () => {
    const user = userEvent.setup()
    const { lastCheck } = renderEchoingServer()
    await screen.findByRole("button", { name: "Add Cycling" })
    await replaceText("Duration (h)", "2.5")
    await replaceText("Min temperature (°C)", "18")

    await user.click(continueButton())

    await screen.findByRole("heading", {
      level: 1,
      name: "Places and forecast",
    })
    expect(lastCheck()).toMatchObject({
      durationHours: 2.5,
      minTemperatureC: 18,
    })
    const [item] = within(
      screen.getByRole("list", { name: "Plan activities" }),
    ).getAllByRole("listitem")
    expect(item).toHaveTextContent("2.5 h")
    expect(item).toHaveTextContent("18 to 30 °C")
  })

  it("keeps the values after going to step 1 and back", async () => {
    const user = userEvent.setup()
    renderEchoingServer()
    await screen.findByRole("button", { name: "Add Cycling" })
    await replaceText("Max wind (m/s)", "6.5")

    await user.click(screen.getByRole("link", { name: "Back" }))
    await screen.findByRole("heading", { level: 1, name: "Plan setup" })
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByRole("heading", {
      level: 1,
      name: "Activity selection",
    })

    expect(
      activityGroup("Cycling").getByLabelText("Max wind (m/s)"),
    ).toHaveValue("6.5")
  })

  it("sends false after Requires daylight is cleared", async () => {
    const user = userEvent.setup()
    const { lastCheck } = renderEchoingServer()
    await screen.findByRole("button", { name: "Add Cycling" })

    await user.click(
      activityGroup("Cycling").getByRole("checkbox", {
        name: "Requires daylight",
      }),
    )
    await user.click(continueButton())

    await screen.findByRole("heading", {
      level: 1,
      name: "Places and forecast",
    })
    expect(lastCheck().requiresDaylight).toBe(false)
  })

  it.each([
    ["Duration (h)", "0.5 to 12"],
    ["Max wind (m/s)", "0 to 30"],
    ["Max rain (mm/h)", "0 to 20"],
    ["Min temperature (°C)", "-30 to 45"],
    ["Max temperature (°C)", "-30 to 45"],
  ])("shows the range next to %s", async (label, hint) => {
    renderEchoingServer()
    await screen.findByRole("button", { name: "Add Cycling" })

    expect(
      activityGroup("Cycling").getByLabelText(label),
    ).toHaveAccessibleDescription(hint)
  })

  const fieldMessages = [
    [
      "Duration (h)",
      "durationHours",
      "0.5 to 12",
      "Enter a duration between 0.5 and 12 hours.",
    ],
    [
      "Max wind (m/s)",
      "maxWindMs",
      "0 to 30",
      "Enter a wind limit between 0 and 30 m/s.",
    ],
    [
      "Max rain (mm/h)",
      "maxRainMmPerHour",
      "0 to 20",
      "Enter a rain limit between 0 and 20 mm/h.",
    ],
    [
      "Min temperature (°C)",
      "minTemperatureC",
      "-30 to 45",
      "Enter a minimum temperature between -30 and 45 °C.",
    ],
    [
      "Max temperature (°C)",
      "maxTemperatureC",
      "-30 to 45",
      "Enter a maximum temperature between -30 and 45 °C.",
    ],
  ]

  describe.each(["", "2,5"])("with the text %j", (text) => {
    it.each(fieldMessages)(
      "sends null for %s and shows the server's message at that field",
      async (label, key, hint, message) => {
        const user = userEvent.setup()
        const { requests } = routeFetch({
          "GET /api/auth/me": () => jsonResponse(401),
          "GET /api/plan-activities/categories": () =>
            jsonResponse(200, categoryList),
          [checkRoute]: () =>
            jsonResponse(400, {
              errors: { [`activities[0].${key}`]: [message] },
            }),
        })
        renderAppWithLocation("/plan/activities")
        await screen.findByRole("button", { name: "Add Cycling" })
        const field = await replaceText(label, text)

        await user.click(continueButton())

        await waitFor(() => expect(field).toHaveFocus())
        const check = requests.find((sent) => sent.method === "POST")!
        expect(sentActivities(check.body)[0][key]).toBeNull()
        expect(field).toHaveAttribute("aria-invalid", "true")
        expect(field).toHaveAccessibleDescription(`${hint} Error: ${message}`)
        expect(document.getElementById(`${field.id}-error`)).toHaveTextContent(
          `Error: ${message}`,
        )
        expect(field).toHaveValue(text)
      },
    )
  })

  it("shows the temperature order message at the minimum field", async () => {
    const user = userEvent.setup()
    const message =
      "Minimum temperature must be lower than maximum temperature."
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "GET /api/plan-activities/categories": () =>
        jsonResponse(200, categoryList),
      [checkRoute]: () =>
        jsonResponse(400, {
          errors: { "activities[0].minTemperatureC": [message] },
        }),
    })
    renderAppWithLocation("/plan/activities")
    await screen.findByRole("button", { name: "Add Cycling" })
    const minimum = await replaceText("Min temperature (°C)", "30")
    const maximum = await replaceText("Max temperature (°C)", "20")

    await user.click(continueButton())

    await waitFor(() => expect(minimum).toHaveFocus())
    expect(minimum).toHaveAccessibleDescription(`-30 to 45 Error: ${message}`)
    expect(maximum).toHaveAccessibleDescription("-30 to 45")
  })
})

describe("Activity selection page", () => {
  beforeEach(() => {
    document.title = ""
  })

  it("has one main heading, its tab title and step 2 as the current step", async () => {
    acceptSetup()
    render()

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Activity selection",
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    await waitFor(() =>
      expect(document.title).toBe("Activity selection - Spėk laiku"),
    )
    const progress = within(
      screen.getByRole("navigation", { name: "Plan progress" }),
    )
    expect(progress.getByText("Activities")).toHaveAttribute(
      "aria-current",
      "step",
    )
    expect(progress.getByRole("link", { name: "Plan setup" })).toHaveAttribute(
      "href",
      "/plan/setup",
    )
    expect(progress.getAllByRole("link")).toHaveLength(1)
  })

  it("shows the checked location, dates and distance", async () => {
    acceptSetup()
    render()

    expect(
      await screen.findByText(
        "Kaunas, Kaunas County · Sat 7 Nov 2026, Sun 8 Nov 2026 · Maximum travel distance: 30 km",
      ),
    ).toBeInTheDocument()
  })

  it.each(["Back", "Plan setup"])(
    "opens Plan setup with the same values through %s",
    async (name) => {
      acceptSetup()
      const user = userEvent.setup()
      const { currentLocation } = render()

      await user.click(await screen.findByRole("link", { name }))

      expect(
        await screen.findByRole("heading", { level: 1, name: "Plan setup" }),
      ).toBeInTheDocument()
      expect(currentLocation()).toBe("/plan/setup")
      expect(screen.getByRole("combobox", { name: "Location" })).toHaveValue(
        "Kaunas, Kaunas County",
      )
      expect(
        within(screen.getByRole("group", { name: "Dates" }))
          .getAllByRole("listitem")
          .map((chip) => chip.firstChild?.textContent),
      ).toEqual(["Sat 7 Nov 2026", "Sun 8 Nov 2026"])
    },
  )

  it("sends a user without a checked setup to Plan setup", async () => {
    const { currentLocation } = render()

    expect(
      await screen.findByRole("heading", { level: 1, name: "Plan setup" }),
    ).toBeInTheDocument()
    expect(currentLocation()).toBe("/plan/setup")
  })

  it("needs a new check after the setup changes", async () => {
    acceptSetup()
    usePlanSetupStore.getState().removeDate("2026-11-08")
    const { currentLocation } = render()

    await screen.findByRole("heading", { level: 1, name: "Plan setup" })
    expect(currentLocation()).toBe("/plan/setup")
  })
})
