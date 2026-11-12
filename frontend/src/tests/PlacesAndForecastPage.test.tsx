import { cleanup, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { CheckedPlanActivity, PlanCategory } from "../types/planActivity"
import type { PlanForecast } from "../types/planForecast"
import type { PlanLocation } from "../types/planSetup"
import {
  answerForecast,
  daylightActivityForecast,
  forecastDay,
  planForecast,
} from "./forecastFixtures"
import { openStreetMapLink } from "../helpers/openStreetMapLink"
import {
  answerPlaces,
  lampedziai,
  nemunoSlipway,
  planPlaces,
} from "./placesFixtures"
import { jsonResponse, renderAppWithLocation, routeFetch } from "./renderApp"
import type { RecordedRequest } from "./renderApp"

const kaunas: PlanLocation = {
  id: 598316,
  name: "Kaunas",
  area: "Kaunas County",
  latitude: 54.90156,
  longitude: 23.90909,
}

const cycling: PlanCategory = {
  id: "category-cycling",
  name: "Cycling",
  type: "Outdoor",
  defaultDurationHours: 2.5,
  requiresDaylight: true,
  maxWindMs: 10,
  maxRainMmPerHour: 0.5,
  minTemperatureC: 5,
  maxTemperatureC: 30,
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

function acceptSetup() {
  usePlanSetupStore.getState().setChecked({
    location: kaunas,
    dates: ["2026-11-07"],
    maxTravelDistanceKm: 30,
  })
}

function checkedFrom(category: PlanCategory, id: string): CheckedPlanActivity {
  return {
    id,
    categoryId: category.id,
    name: category.name,
    type: category.type,
    durationHours: category.defaultDurationHours,
    requiresDaylight: category.requiresDaylight,
    maxWindMs: category.maxWindMs,
    maxRainMmPerHour: category.maxRainMmPerHour,
    minTemperatureC: category.minTemperatureC,
    maxTemperatureC: category.maxTemperatureC,
  }
}

// Activities the server accepted, as Continue on step 2 leaves them.
function acceptActivities(...categories: PlanCategory[]) {
  const store = usePlanActivitiesStore.getState()
  categories.forEach((category) => store.add(category))
  store.setChecked(
    usePlanActivitiesStore
      .getState()
      .activities.map((activity, index) =>
        checkedFrom(categories[index], activity.id),
      ),
  )
}

type Handler = (request: RecordedRequest) => Response | Promise<Response>

// By default the forecast is answered for the checked dates, every activity suitable in daylight, and every
// category has two places.
function render(
  answer: Handler = answerForecast,
  moreRoutes: Record<string, Handler> = {},
) {
  const routes = routeFetch({
    "POST /api/plan-places": answerPlaces,
    ...moreRoutes,
    "GET /api/auth/me": () => jsonResponse(401),
    "GET /api/plan-setup/period": () =>
      jsonResponse(200, {
        firstDate: "2026-11-04",
        lastDate: "2026-11-10",
        maxDates: 7,
      }),
    "GET /api/plan-activities/categories": () =>
      jsonResponse(200, { categories: [cycling, museum], maxActivities: 10 }),
    "POST /api/plan-forecast": answer,
  })
  return { ...renderAppWithLocation("/plan/places"), ...routes }
}

function forecastRequests(requests: RecordedRequest[]) {
  return requests.filter((request) => request.path === "/api/plan-forecast")
}

function heading(name: string) {
  return screen.findByRole("heading", { level: 1, name })
}

// The activities only, not the dates and periods listed inside each one.
function activityItems() {
  const list = screen.getByRole("list", { name: "Plan activities" })
  return within(list)
    .getAllByRole("listitem")
    .filter((item) => item.parentElement === list)
}

describe("Places and forecast page (first version)", () => {
  beforeEach(() => {
    document.title = ""
  })

  it("has its heading, tab title and step 3 as the current step", async () => {
    acceptSetup()
    acceptActivities(cycling)
    render()

    await heading("Places and forecast")
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    await waitFor(() =>
      expect(document.title).toBe("Places and forecast - Spėk laiku"),
    )
    const progress = within(
      screen.getByRole("navigation", { name: "Plan progress" }),
    )
    expect(progress.getByText("Places and forecast")).toHaveAttribute(
      "aria-current",
      "step",
    )
    expect(progress.getByRole("link", { name: "Plan setup" })).toHaveAttribute(
      "href",
      "/plan/setup",
    )
    expect(progress.getByRole("link", { name: "Activities" })).toHaveAttribute(
      "href",
      "/plan/activities",
    )
  })

  it("shows the setup and each activity with its settings", async () => {
    acceptSetup()
    acceptActivities(cycling, museum)
    render()
    await heading("Places and forecast")
    await screen.findByText("Places updated at 14:05")

    expect(
      screen.getByText(
        "Kaunas, Kaunas County · Sat 7 Nov 2026 · Maximum travel distance: 30 km",
      ),
    ).toBeInTheDocument()
    const [outdoor, indoor] = activityItems()
    expect(outdoor).toHaveTextContent("Cycling")
    expect(outdoor).toHaveTextContent("Outdoor")
    expect(outdoor).toHaveTextContent("2.5 h")
    expect(outdoor).toHaveTextContent("Requires daylight")
    expect(outdoor).toHaveTextContent(
      "Wind up to 10 m/s · Rain up to 0.5 mm/h · 5 to 30 °C",
    )
    expect(indoor).toHaveTextContent("Museum")
    expect(indoor).toHaveTextContent("Indoor")
    expect(indoor).toHaveTextContent("2 h")
    expect(indoor).toHaveTextContent("No daylight needed")
    expect(indoor).not.toHaveTextContent("Wind up to")
  })

  it("numbers a repeated category as on step 2", async () => {
    acceptSetup()
    acceptActivities(cycling, museum, cycling)
    render()
    await heading("Places and forecast")
    await screen.findByText("Places updated at 14:05")

    const [first, , second] = activityItems()
    expect(first).toHaveTextContent("Cycling 1")
    expect(second).toHaveTextContent("Cycling 2")
  })

  it("goes Back to Activity selection with every activity kept", async () => {
    acceptSetup()
    acceptActivities(cycling, museum)
    const user = userEvent.setup()
    const { currentLocation } = render()
    await heading("Places and forecast")

    await user.click(screen.getByRole("link", { name: "Back" }))

    await heading("Activity selection")
    expect(currentLocation()).toBe("/plan/activities")
    expect(screen.getByRole("group", { name: "Cycling" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Museum" })).toBeInTheDocument()
  })

  it("sends a user without checked activities to Activity selection", async () => {
    acceptSetup()
    const { currentLocation } = render()

    await heading("Activity selection")
    expect(currentLocation()).toBe("/plan/activities")
  })

  it("sends a user without a checked setup to Plan setup", async () => {
    acceptActivities(cycling)
    const { currentLocation } = render()

    await heading("Plan setup")
    expect(currentLocation()).toBe("/plan/setup")
  })

  it("needs a new check after an activity changes", async () => {
    acceptSetup()
    acceptActivities(cycling)
    const [activity] = usePlanActivitiesStore.getState().activities
    usePlanActivitiesStore.getState().update(activity.id, { durationText: "4" })
    const { currentLocation } = render()

    await heading("Activity selection")
    expect(currentLocation()).toBe("/plan/activities")
  })
})

describe("Places and forecast page: the forecast", () => {
  function status() {
    return screen.getByRole("status", { name: "Places and forecast" })
  }

  function activityRegion(name: string) {
    return screen.getByRole("region", { name })
  }

  it("shows 'Getting the forecast and nearby places…' while loading and asks only once", async () => {
    acceptSetup()
    acceptActivities(cycling)
    const { requests } = render(() => new Promise<Response>(() => {}))
    await heading("Places and forecast")

    await waitFor(() =>
      expect(status()).toHaveTextContent(
        "Getting the forecast and nearby places…",
      ),
    )
    expect(forecastRequests(requests)).toHaveLength(1)
    expect(forecastRequests(requests)[0].body).toEqual({
      setup: {
        locationId: 598316,
        dates: ["2026-11-07"],
        maxTravelDistanceKm: 30,
      },
      activities: [
        {
          categoryId: "category-cycling",
          type: "Outdoor",
          durationHours: 2.5,
          requiresDaylight: true,
          maxWindMs: 10,
          maxRainMmPerHour: 0.5,
          minTemperatureC: 5,
          maxTemperatureC: 30,
        },
      ],
    })
  })

  it("says when the forecast was received", async () => {
    acceptSetup()
    acceptActivities(cycling)
    render()

    expect(
      await screen.findByText("Forecast updated at 14:05"),
    ).toBeInTheDocument()
    expect(status()).toHaveTextContent("Forecast updated at 14:05")
  })

  it("shows each activity as a section named after it, with its settings and forecast", async () => {
    acceptSetup()
    acceptActivities(cycling, museum, cycling)
    render()
    await screen.findByText("Forecast updated at 14:05")

    const first = activityRegion("Cycling 1")
    expect(first).toHaveTextContent("Requires daylight")
    expect(first).toHaveTextContent("Suitable hours: 8 on 1 of 1 date.")
    expect(activityRegion("Cycling 2")).toBeInTheDocument()
    expect(activityRegion("Museum")).toBeInTheDocument()
  })

  it("shows each date with its long date, sunrise, sunset and suitable periods", async () => {
    usePlanSetupStore.getState().setChecked({
      location: kaunas,
      dates: ["2026-11-07", "2026-11-08"],
      maxTravelDistanceKm: 30,
    })
    acceptActivities(cycling)
    const days = [forecastDay("2026-11-07"), forecastDay("2026-11-08")]
    const forecast: PlanForecast = {
      updatedAt: "14:05",
      days,
      activities: [
        daylightActivityForecast(days, {
          days: [
            {
              date: "2026-11-07",
              periods: [
                {
                  start: "10:00",
                  end: "11:00",
                  lengthHours: 1,
                  shorterThanDuration: true,
                },
                {
                  start: "13:00",
                  end: "16:00",
                  lengthHours: 3,
                  shorterThanDuration: false,
                },
              ],
              hours: [],
            },
            { date: "2026-11-08", periods: [], hours: [] },
          ],
        }),
      ],
    }
    render(() => jsonResponse(200, forecast))
    await screen.findByText("Forecast updated at 14:05")

    const region = within(activityRegion("Cycling"))
    expect(
      region.getByRole("heading", {
        level: 3,
        name: "Saturday 7 November 2026",
      }),
    ).toBeInTheDocument()
    expect(
      region.getByRole("heading", {
        level: 3,
        name: "Sunday 8 November 2026",
      }),
    ).toBeInTheDocument()
    expect(region.getAllByText("Sunrise 07:46 · Sunset 16:15")).toHaveLength(2)
    expect(
      region.getByText(
        "★ Suitable 10:00–11:00 (1 h), shorter than this activity's 2.5 h",
      ),
    ).toBeInTheDocument()
    expect(region.getByText("★ Suitable 13:00–16:00 (3 h)")).toBeInTheDocument()
    expect(
      region.getByText("✗ No suitable hours on this date."),
    ).toBeInTheDocument()
  })

  it("says when today has no hours left", async () => {
    acceptSetup()
    acceptActivities(cycling)
    const today = { ...forecastDay("2026-11-07"), hours: [] }
    render(() =>
      jsonResponse(200, {
        updatedAt: "21:40",
        days: [today],
        activities: [
          daylightActivityForecast([today], {
            suitableHours: 0,
            datesWithSuitableHours: 0,
            hasLongEnoughPeriod: false,
          }),
        ],
      }),
    )

    expect(
      await screen.findByText("No hours left to plan today."),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "No suitable hours on any of your dates. Try other dates or change this activity's limits.",
      ),
    ).toBeInTheDocument()
  })

  it("adds that no period is long enough when the server says so", async () => {
    acceptSetup()
    acceptActivities(cycling)
    const days = [forecastDay("2026-11-07")]
    render(() =>
      jsonResponse(200, {
        updatedAt: "14:05",
        days,
        activities: [
          daylightActivityForecast(days, {
            suitableHours: 2,
            hasLongEnoughPeriod: false,
          }),
        ],
      }),
    )

    expect(
      await screen.findByText(
        "Suitable hours: 2 on 1 of 1 date. No period is long enough for this activity's 2.5 h.",
      ),
    ).toBeInTheDocument()
  })

  it("shows only the indoor message for an indoor activity without daylight", async () => {
    acceptSetup()
    acceptActivities(museum)
    const days = [forecastDay("2026-11-07")]
    render(() =>
      jsonResponse(200, {
        updatedAt: "14:05",
        days,
        activities: [
          daylightActivityForecast(days, {
            weatherIndependent: true,
            suitableHours: 16,
          }),
        ],
      }),
    )
    await screen.findByText("Forecast updated at 14:05")

    const region = activityRegion("Museum")
    expect(region).toHaveTextContent(
      "Weather does not affect this indoor activity. Every hour from 06:00 to 22:00 is suitable.",
    )
    // No date entries: the only level 3 heading is the activity's "Places" (feature 007 FR-017).
    expect(
      within(region)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["Places"])
    expect(region).not.toHaveTextContent("Sunrise")
  })
})

describe("Places and forecast page: the hours of a date", () => {
  const date = "Saturday 7 November 2026"

  // 12:00 too wet and windy, 14:00 without a temperature, the rest suitable in daylight.
  function forecastWithReasons(activityCount = 1): PlanForecast {
    const day = forecastDay("2026-11-07")
    day.hours = day.hours.map((hour) =>
      hour.start === "12:00"
        ? { ...hour, temperatureC: 16.4, rainMmPerHour: 1.2, windMs: 9 }
        : hour.start === "14:00"
          ? { ...hour, temperatureC: null }
          : hour,
    )
    const activity = daylightActivityForecast([day])
    activity.days[0].hours = activity.days[0].hours.map((hour) =>
      hour.start === "12:00"
        ? {
            ...hour,
            suitable: false,
            reasons: [
              "Too much rain: 1.2 mm/h, maximum 0.5 mm/h",
              "Too windy: 9.0 m/s, maximum 8.0 m/s",
            ],
          }
        : hour.start === "14:00"
          ? { ...hour, suitable: false, reasons: ["No forecast for this hour"] }
          : hour,
    )
    return {
      updatedAt: "14:05",
      days: [day],
      activities: Array.from({ length: activityCount }, () => activity),
    }
  }

  function showButton(activityName: string) {
    return screen.getByRole("button", {
      name: `Show hours for ${date}, ${activityName}`,
    })
  }

  function rowOf(table: HTMLElement, start: string) {
    return within(table)
      .getAllByRole("row")
      .find((row) => row.textContent?.includes(`${start}–`))!
  }

  it("has a closed 'Show hours' button per date that also names the activity", async () => {
    acceptSetup()
    acceptActivities(cycling)
    render(() => jsonResponse(200, forecastWithReasons()))
    await screen.findByText("Forecast updated at 14:05")

    const button = showButton("Cycling")
    expect(button).toHaveTextContent(`Show hours for ${date}`)
    expect(button).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("opens a table of the date's hours with values, daylight, suitability and reasons", async () => {
    acceptSetup()
    acceptActivities(cycling)
    const user = userEvent.setup()
    render(() => jsonResponse(200, forecastWithReasons()))
    await screen.findByText("Forecast updated at 14:05")

    await user.click(showButton("Cycling"))

    const table = screen.getByRole("table", {
      name: `Hours for Cycling on ${date}`,
    })
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual([
      "Time",
      "Temperature",
      "Rain",
      "Wind",
      "Daylight",
      "Suitability",
    ])
    const button = screen.getByRole("button", {
      name: `Hide hours for ${date}, Cycling`,
    })
    expect(button).toHaveTextContent(`Hide hours for ${date}`)
    expect(button).toHaveAttribute("aria-expanded", "true")
    expect(button).toHaveAttribute("aria-controls", table.parentElement!.id)

    const noon = rowOf(table, "12:00")
    expect(noon).toHaveTextContent("12:00–13:00")
    expect(noon).toHaveTextContent("16.4 °C")
    expect(noon).toHaveTextContent("1.2 mm/h")
    expect(noon).toHaveTextContent("9.0 m/s")
    expect(noon).toHaveTextContent("Yes")
    expect(noon).toHaveTextContent("✗ Unsuitable")
    expect(noon).toHaveTextContent("Too much rain: 1.2 mm/h, maximum 0.5 mm/h")
    expect(noon).toHaveTextContent("Too windy: 9.0 m/s, maximum 8.0 m/s")

    const ten = rowOf(table, "10:00")
    expect(ten).toHaveTextContent("★ Suitable")
    expect(ten).toHaveTextContent("18.0 °C")
    expect(ten).toHaveTextContent("0.0 mm/h")

    const evening = rowOf(table, "20:00")
    expect(evening).toHaveTextContent("No")
    expect(evening).toHaveTextContent("Outside daylight")

    const missing = rowOf(table, "14:00")
    expect(missing).toHaveTextContent("No data")
    expect(missing).toHaveTextContent("No forecast for this hour")
  })

  it("hides the table again", async () => {
    acceptSetup()
    acceptActivities(cycling)
    const user = userEvent.setup()
    render(() => jsonResponse(200, forecastWithReasons()))
    await screen.findByText("Forecast updated at 14:05")

    await user.click(showButton("Cycling"))
    await user.click(
      screen.getByRole("button", { name: `Hide hours for ${date}, Cycling` }),
    )

    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(showButton("Cycling")).toHaveAttribute("aria-expanded", "false")
  })

  it("opens each activity's table on its own", async () => {
    acceptSetup()
    acceptActivities(cycling, cycling)
    const user = userEvent.setup()
    render(() => jsonResponse(200, forecastWithReasons(2)))
    await screen.findByText("Forecast updated at 14:05")

    await user.click(showButton("Cycling 2"))

    expect(
      screen.getByRole("table", { name: `Hours for Cycling 2 on ${date}` }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("table")).toHaveLength(1)
    expect(showButton("Cycling 1")).toHaveAttribute("aria-expanded", "false")
  })

  it("has no 'Show hours' button for a date without hours", async () => {
    acceptSetup()
    acceptActivities(cycling)
    const today = { ...forecastDay("2026-11-07"), hours: [] }
    render(() =>
      jsonResponse(200, {
        updatedAt: "21:40",
        days: [today],
        activities: [daylightActivityForecast([today])],
      }),
    )

    await screen.findByText("No hours left to plan today.")
    expect(
      screen.queryByRole("button", { name: /Show hours/ }),
    ).not.toBeInTheDocument()
  })
})

describe("Places and forecast page: when the forecast cannot be shown", () => {
  function forecastStatus() {
    return screen.getByRole("status", { name: "Places and forecast" })
  }

  it.each([
    [
      "the weather service is unavailable",
      () => jsonResponse(503, { status: 503, service: "forecast" }),
      "Error: The weather service is unavailable. No forecast is shown.",
    ],
    [
      "there are too many requests",
      () => jsonResponse(429, { status: 429 }),
      "Error: Too many requests. Wait a minute and try again.",
    ],
    [
      "the server fails",
      () => jsonResponse(500),
      "Error: Something went wrong. Try again.",
    ],
  ])(
    "shows the message with Retry and no forecast when %s",
    async (_case, answer, message) => {
      acceptSetup()
      acceptActivities(cycling)
      render(answer)

      await waitFor(() => expect(forecastStatus()).toHaveTextContent(message))
      expect(
        within(forecastStatus()).getByRole("button", { name: "Retry" }),
      ).toBeInTheDocument()
      expect(screen.queryByText(/Forecast updated/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Suitable hours/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Sunrise/)).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: /Show hours/ }),
      ).not.toBeInTheDocument()
      // The setup, the activities' settings and Back stay.
      expect(screen.getByText(/Kaunas, Kaunas County/)).toBeInTheDocument()
      expect(activityItems()[0]).toHaveTextContent("Requires daylight")
      expect(screen.getByRole("link", { name: "Back" })).toBeInTheDocument()
    },
  )

  it("loads again on Retry and then shows the forecast", async () => {
    acceptSetup()
    acceptActivities(cycling)
    const user = userEvent.setup()
    let failing = true
    let release: () => void = () => {}
    const { requests } = render((request) =>
      failing
        ? jsonResponse(503, { status: 503, service: "forecast" })
        : new Promise<Response>((resolve) => {
            release = () => resolve(answerForecast(request))
          }),
    )
    await waitFor(() =>
      expect(forecastStatus()).toHaveTextContent(
        "The weather service is unavailable.",
      ),
    )

    failing = false
    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(forecastStatus()).toHaveTextContent("Getting the forecast…")
    release()
    expect(
      await screen.findByText("Forecast updated at 14:05"),
    ).toBeInTheDocument()
    expect(forecastRequests(requests)).toHaveLength(2)
  })

  it("asks again when the page is opened again, and ignores the old answer", async () => {
    acceptSetup()
    acceptActivities(cycling)
    const user = userEvent.setup()
    const answers: ((response: Response) => void)[] = []
    const { requests } = render(
      () => new Promise<Response>((resolve) => answers.push(resolve)),
      {
        // Continue on step 2 accepts the activities as sent.
        "POST /api/plan-activities/check": (request) =>
          jsonResponse(200, {
            activities: (
              request.body as { activities: Record<string, unknown>[] }
            ).activities.map((activity) => ({ ...activity, name: "Cycling" })),
          }),
      },
    )
    await waitFor(() =>
      expect(forecastStatus()).toHaveTextContent(
        "Getting the forecast and nearby places…",
      ),
    )

    await user.click(screen.getByRole("link", { name: "Back" }))
    await heading("Activity selection")
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await heading("Places and forecast")

    await waitFor(() => expect(forecastRequests(requests)).toHaveLength(2))
    // The first page's answer arrives late and must not be shown.
    answers[0](
      jsonResponse(200, {
        ...planForecast(["2026-11-07"], 1),
        updatedAt: "09:00",
      }),
    )
    answers[1](jsonResponse(200, planForecast(["2026-11-07"], 1)))
    expect(
      await screen.findByText("Forecast updated at 14:05"),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Forecast updated at 09:00"),
    ).not.toBeInTheDocument()
  })
})

describe("Places and forecast page: when the plan is out of date", () => {
  it("sends the user to Plan setup with the notice when the setup is out of date", async () => {
    acceptSetup()
    acceptActivities(cycling)
    const { currentLocation } = render(() =>
      jsonResponse(400, {
        errors: { "setup.dates[0]": ["Dates cannot be in the past."] },
      }),
    )

    await heading("Plan setup")
    expect(currentLocation()).toBe("/plan/setup")
    expect(
      screen.getByText(
        "Your plan setup needs to be checked again. Select Continue.",
      ),
    ).toBeInTheDocument()
    expect(usePlanSetupStore.getState().checked).toBeNull()
    // The activities are kept for when the setup has been checked again.
    expect(usePlanActivitiesStore.getState().activities).toHaveLength(1)
  })

  it("sends the user to Activity selection with the notice when the activities are out of date", async () => {
    acceptSetup()
    acceptActivities(cycling)
    const { currentLocation } = render(() =>
      jsonResponse(400, {
        errors: {
          "activities[0]": ["This activity is no longer available. Remove it."],
        },
      }),
    )

    await heading("Activity selection")
    expect(currentLocation()).toBe("/plan/activities")
    expect(
      screen.getByText(
        "Your activities need to be checked again. Select Continue.",
      ),
    ).toBeInTheDocument()
    expect(usePlanSetupStore.getState().checked).not.toBeNull()
  })

  it("shows the server error for a 400 that names neither part", async () => {
    acceptSetup()
    acceptActivities(cycling)
    render(() =>
      jsonResponse(400, { errors: { request: ["The request is invalid."] } }),
    )

    expect(
      await screen.findByText("Error: Something went wrong. Try again."),
    ).toBeInTheDocument()
  })
})

describe("Places and forecast page: the places", () => {
  function status() {
    return screen.getByRole("status", { name: "Places and forecast" })
  }

  function placesRequests(requests: RecordedRequest[]) {
    return requests.filter((request) => request.path === "/api/plan-places")
  }

  // The activity's list of places, the list right after its "Places" heading.
  function placesList(activityName: string) {
    const region = within(screen.getByRole("region", { name: activityName }))
    const placesHeading = region.getByRole("heading", {
      level: 3,
      name: "Places",
    })
    return placesHeading.nextElementSibling as HTMLElement
  }

  // A request that waits until the test answers it.
  function deferred() {
    let answer: (response: Response) => void = () => {}
    const handler = () =>
      new Promise<Response>((resolve) => {
        answer = resolve
      })
    return { handler, answer: (response: Response) => answer(response) }
  }

  it.each(["places", "forecast"])(
    "shows only the loading message until both have answered, when the %s answer first",
    async (first) => {
      acceptSetup()
      acceptActivities(cycling)
      const forecast = deferred()
      const places = deferred()
      const { requests } = render(forecast.handler, {
        "POST /api/plan-places": places.handler,
      })
      await waitFor(() =>
        expect(status()).toHaveTextContent(
          "Getting the forecast and nearby places…",
        ),
      )
      await waitFor(() => expect(placesRequests(requests)).toHaveLength(1))

      const forecastAnswer = jsonResponse(200, planForecast(["2026-11-07"], 1))
      const placesAnswer = jsonResponse(200, planPlaces(["category-cycling"]))
      if (first === "places") {
        places.answer(placesAnswer)
      } else {
        forecast.answer(forecastAnswer)
      }
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(status()).toHaveTextContent(
        "Getting the forecast and nearby places…",
      )
      expect(
        screen.queryByRole("list", { name: "Plan activities" }),
      ).not.toBeInTheDocument()
      expect(screen.queryByText(/updated at/)).not.toBeInTheDocument()
      expect(screen.queryByText("Nemuno slipway")).not.toBeInTheDocument()
      expect(screen.queryByText(/Suitable hours/)).not.toBeInTheDocument()

      if (first === "places") {
        forecast.answer(forecastAnswer)
      } else {
        places.answer(placesAnswer)
      }
      expect(await screen.findByText("Nemuno slipway")).toBeInTheDocument()
      expect(screen.getByText(/Suitable hours/)).toBeInTheDocument()
      expect(status()).not.toHaveTextContent("Getting")
    },
  )

  it("asks once for each, both with the checked setup and activities", async () => {
    acceptSetup()
    acceptActivities(cycling, museum)
    const { requests } = render()
    await screen.findByText("Places updated at 14:05")

    expect(forecastRequests(requests)).toHaveLength(1)
    expect(placesRequests(requests)).toHaveLength(1)
    expect(placesRequests(requests)[0].body).toEqual(
      forecastRequests(requests)[0].body,
    )
    expect(placesRequests(requests)[0].body).toMatchObject({
      setup: {
        locationId: 598316,
        dates: ["2026-11-07"],
        maxTravelDistanceKm: 30,
      },
      activities: [
        { categoryId: "category-cycling", type: "Outdoor" },
        { categoryId: "category-museum", type: "Indoor" },
      ],
    })
  })

  it("lists each activity's places with name, distance, area and a map link", async () => {
    acceptSetup()
    acceptActivities(cycling)
    render()
    await screen.findByText("Places updated at 14:05")

    const [first, second] = within(placesList("Cycling")).getAllByRole(
      "listitem",
    )
    expect(first).toHaveTextContent("Nemuno slipway")
    expect(first).toHaveTextContent("3.4 km away · Kaunas")
    expect(second).toHaveTextContent("Lampėdžių valčių nuleidimo vieta")
    expect(second).toHaveTextContent("4.1 km away")
    expect(second).not.toHaveTextContent("·")

    const link = within(first).getByRole("link", { name: /View on map/ })
    expect(link).toHaveTextContent("View on map")
    expect(link).toHaveAttribute(
      "href",
      openStreetMapLink(nemunoSlipway.latitude, nemunoSlipway.longitude),
    )
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("lists the same places for two activities of the same category", async () => {
    acceptSetup()
    acceptActivities(cycling, museum, cycling)
    render(answerForecast, {
      "POST /api/plan-places": () =>
        jsonResponse(
          200,
          planPlaces(
            ["category-cycling", "category-museum"],
            {},
            { "category-museum": [lampedziai] },
          ),
        ),
    })
    await screen.findByText("Places updated at 14:05")

    const names = (activityName: string) =>
      within(placesList(activityName))
        .getAllByRole("listitem")
        .map((item) => item.querySelector(".place-name")?.textContent)
    expect(names("Cycling 1")).toEqual([
      "Nemuno slipway",
      "Lampėdžių valčių nuleidimo vieta",
    ])
    expect(names("Cycling 2")).toEqual(names("Cycling 1"))
    expect(names("Museum")).toEqual(["Lampėdžių valčių nuleidimo vieta"])
  })

  it("says when the places and the forecast were received", async () => {
    acceptSetup()
    acceptActivities(cycling)
    render(answerForecast, {
      "POST /api/plan-places": () =>
        jsonResponse(
          200,
          planPlaces(["category-cycling"], { updatedAt: "09:30" }),
        ),
    })

    expect(
      await screen.findByText("Places updated at 09:30"),
    ).toBeInTheDocument()
    expect(status()).toHaveTextContent("Forecast updated at 14:05")
    expect(status()).toHaveTextContent("Places updated at 09:30")
  })

  it("keeps no place in the browser session", async () => {
    acceptSetup()
    acceptActivities(cycling)
    render()
    await screen.findByText("Places updated at 14:05")

    const saved = Object.keys(sessionStorage)
      .map((key) => sessionStorage.getItem(key) ?? "")
      .join("\n")
    expect(saved).not.toContain("Nemuno slipway")
    expect(saved).not.toContain("Lampėdžių")
  })

  it("asks for the places again when the step is opened again", async () => {
    acceptSetup()
    acceptActivities(cycling)
    const user = userEvent.setup()
    const { requests } = render(answerForecast, {
      "POST /api/plan-activities/check": (request) =>
        jsonResponse(200, {
          activities: (
            request.body as { activities: Record<string, unknown>[] }
          ).activities.map((activity) => ({ ...activity, name: "Cycling" })),
        }),
    })
    await screen.findByText("Places updated at 14:05")

    await user.click(screen.getByRole("link", { name: "Back" }))
    await heading("Activity selection")
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await heading("Places and forecast")

    await screen.findByText("Places updated at 14:05")
    expect(placesRequests(requests)).toHaveLength(2)
  })

  it("still shows the places when the forecast fails, with the forecast's Retry", async () => {
    acceptSetup()
    acceptActivities(cycling)
    render(() => jsonResponse(503, { status: 503, service: "forecast" }))

    await waitFor(() =>
      expect(status()).toHaveTextContent(
        "Error: The weather service is unavailable. No forecast is shown.",
      ),
    )
    expect(
      within(status()).getByRole("button", { name: "Retry" }),
    ).toBeInTheDocument()
    expect(status()).toHaveTextContent("Places updated at 14:05")
    expect(screen.getByText("Nemuno slipway")).toBeInTheDocument()
  })
})

describe("Places and forecast page: no place found", () => {
  // Cycling has no place within 30 km; Museum has its places.
  function answerNoCyclingPlace() {
    return jsonResponse(
      200,
      planPlaces(
        ["category-cycling", "category-museum"],
        { radiusKm: 30 },
        { "category-cycling": [] },
      ),
    )
  }

  function renderNoCyclingPlace(moreRoutes: Record<string, Handler> = {}) {
    return render(answerForecast, {
      "POST /api/plan-places": answerNoCyclingPlace,
      ...moreRoutes,
    })
  }

  function stepRequests(requests: RecordedRequest[]) {
    return requests.filter(
      (request) =>
        request.path === "/api/plan-places" ||
        request.path === "/api/plan-forecast",
    )
  }

  it("flags the activity with the reason and both actions, named for screen readers", async () => {
    acceptSetup()
    acceptActivities(cycling, museum)
    renderNoCyclingPlace()
    await screen.findByText("Places updated at 14:05")

    const region = within(screen.getByRole("region", { name: "Cycling" }))
    expect(
      region.getByText("✗ No place found within 30 km."),
    ).toBeInTheDocument()
    expect(
      region.getByRole("button", { name: "Remove, Cycling" }),
    ).toHaveTextContent("Remove")
    expect(
      region.getByRole("button", { name: "Change activity, Cycling" }),
    ).toHaveTextContent("Change activity")
    expect(
      region.queryByRole("link", { name: /View on map/ }),
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByRole("region", { name: "Museum" })).queryByText(
        /No place found/,
      ),
    ).not.toBeInTheDocument()
  })

  it("removes the activity without asking again, announces it and focuses the next activity", async () => {
    acceptSetup()
    acceptActivities(cycling, museum)
    const user = userEvent.setup()
    const { requests } = renderNoCyclingPlace()
    await screen.findByText("Places updated at 14:05")
    const before = stepRequests(requests).length

    await user.click(screen.getByRole("button", { name: "Remove, Cycling" }))

    expect(
      screen.queryByRole("region", { name: "Cycling" }),
    ).not.toBeInTheDocument()
    expect(screen.getByText("Cycling removed.")).toHaveAttribute(
      "role",
      "status",
    )
    expect(
      screen.getByRole("heading", { level: 2, name: "Museum" }),
    ).toHaveFocus()
    const museumRegion = screen.getByRole("region", { name: "Museum" })
    expect(museumRegion).toHaveTextContent("Nemuno slipway")
    expect(museumRegion).toHaveTextContent("Suitable hours: 8 on 1 of 1 date.")
    expect(stepRequests(requests)).toHaveLength(before)
    expect(
      usePlanActivitiesStore
        .getState()
        .activities.map((activity) => activity.name),
    ).toEqual(["Museum"])
    expect(
      usePlanActivitiesStore
        .getState()
        .checked?.map((activity) => activity.name),
    ).toEqual(["Museum"])
  })

  it("focuses the previous activity when the removed one was last", async () => {
    acceptSetup()
    acceptActivities(museum, cycling)
    const user = userEvent.setup()
    renderNoCyclingPlace()
    await screen.findByText("Places updated at 14:05")

    await user.click(screen.getByRole("button", { name: "Remove, Cycling" }))

    expect(
      screen.getByRole("heading", { level: 2, name: "Museum" }),
    ).toHaveFocus()
  })

  it("no longer lists a removed activity on Activity selection", async () => {
    acceptSetup()
    acceptActivities(cycling, museum)
    const user = userEvent.setup()
    renderNoCyclingPlace()
    await screen.findByText("Places updated at 14:05")

    await user.click(screen.getByRole("button", { name: "Remove, Cycling" }))
    await user.click(screen.getByRole("link", { name: "Back" }))

    await heading("Activity selection")
    expect(screen.getByRole("group", { name: "Museum" })).toBeInTheDocument()
    expect(
      screen.queryByRole("group", { name: "Cycling" }),
    ).not.toBeInTheDocument()
  })

  it("sends the user to Activity selection when the only activity is removed", async () => {
    acceptSetup()
    acceptActivities(cycling)
    const user = userEvent.setup()
    const { currentLocation } = render(answerForecast, {
      "POST /api/plan-places": () =>
        jsonResponse(
          200,
          planPlaces(["category-cycling"], {}, { "category-cycling": [] }),
        ),
    })
    await screen.findByText("Places updated at 14:05")

    await user.click(screen.getByRole("button", { name: "Remove, Cycling" }))

    await heading("Activity selection")
    expect(currentLocation()).toBe("/plan/activities")
    expect(
      screen.getByText(
        "No activities added yet. Select at least one category to continue.",
      ),
    ).toBeInTheDocument()
  })

  it("opens Activity selection on the activity with every activity kept for Change activity", async () => {
    acceptSetup()
    acceptActivities(cycling, museum)
    const user = userEvent.setup()
    const { currentLocation } = renderNoCyclingPlace()
    await screen.findByText("Places updated at 14:05")
    const [cyclingActivity] = usePlanActivitiesStore.getState().activities

    await user.click(
      screen.getByRole("button", { name: "Change activity, Cycling" }),
    )

    await heading("Activity selection")
    expect(currentLocation()).toBe("/plan/activities")
    const cyclingHeading = screen.getByRole("heading", {
      level: 3,
      name: "Cycling",
    })
    expect(cyclingHeading).toHaveAttribute(
      "id",
      `activity-${cyclingActivity.id}-heading`,
    )
    await waitFor(() => expect(cyclingHeading).toHaveFocus())
    expect(screen.getByRole("group", { name: "Museum" })).toBeInTheDocument()
    expect(usePlanActivitiesStore.getState().checked).toHaveLength(2)
  })

  it("keeps an activity the user does not remove flagged when step 3 opens again", async () => {
    acceptSetup()
    acceptActivities(cycling, museum)
    renderNoCyclingPlace()
    await screen.findByText("Places updated at 14:05")
    cleanup()

    renderNoCyclingPlace()
    await screen.findByText("Places updated at 14:05")

    expect(usePlanActivitiesStore.getState().activities).toHaveLength(2)
    expect(
      within(screen.getByRole("region", { name: "Cycling" })).getByText(
        "✗ No place found within 30 km.",
      ),
    ).toBeInTheDocument()
  })
})
