import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanPlacesStore } from "../stores/usePlanPlacesStore"
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

// Opens an activity's forecast details, which are closed at first (feature 007 FR-017).
async function openDetails(
  user: ReturnType<typeof userEvent.setup>,
  activityName: string,
) {
  await user.click(
    screen.getByRole("button", {
      name: `Show forecast details, ${activityName}`,
    }),
  )
}

// The hours tables only, not the plan overview.
const hoursTable = { name: /^Hours for/ }

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

  it("shows each date with its long date and suitable periods, and its sunrise and sunset once in the overview", async () => {
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
              longestPeriod: {
                start: "13:00",
                end: "16:00",
                lengthHours: 3,
                shorterThanDuration: false,
              },
              hours: [],
            },
            {
              date: "2026-11-08",
              periods: [],
              longestPeriod: null,
              hours: [],
            },
          ],
        }),
      ],
    }
    const user = userEvent.setup()
    render(() => jsonResponse(200, forecast))
    await screen.findByText("Forecast updated at 14:05")
    await user.click(
      screen.getByRole("button", { name: "Show forecast details, Cycling" }),
    )

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
    // The sunrise and sunset are in the overview's date headings, not under the activity (FR-015).
    expect(region.queryByText(/Sunrise/)).not.toBeInTheDocument()
    expect(
      within(screen.getByRole("table", { name: "Plan overview" }))
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual([
      "Activity",
      "Place",
      "Sat 7 Nov · Sunrise 07:46 · Sunset 16:15",
      "Sun 8 Nov · Sunrise 07:46 · Sunset 16:15",
    ])
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
    const user = userEvent.setup()
    await screen.findByText("Forecast updated at 21:40")
    await openDetails(user, "Cycling")

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
    const user = userEvent.setup()
    render(() => jsonResponse(200, forecastWithReasons()))
    await screen.findByText("Forecast updated at 14:05")
    await openDetails(user, "Cycling")

    const button = showButton("Cycling")
    expect(button).toHaveTextContent(`Show hours for ${date}`)
    expect(button).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("table", hoursTable)).not.toBeInTheDocument()
  })

  it("opens a table of the date's hours with values, daylight, suitability and reasons", async () => {
    acceptSetup()
    acceptActivities(cycling)
    const user = userEvent.setup()
    render(() => jsonResponse(200, forecastWithReasons()))
    await screen.findByText("Forecast updated at 14:05")
    await openDetails(user, "Cycling")

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
    await openDetails(user, "Cycling")

    await user.click(showButton("Cycling"))
    await user.click(
      screen.getByRole("button", { name: `Hide hours for ${date}, Cycling` }),
    )

    expect(screen.queryByRole("table", hoursTable)).not.toBeInTheDocument()
    expect(showButton("Cycling")).toHaveAttribute("aria-expanded", "false")
  })

  it("opens each activity's table on its own", async () => {
    acceptSetup()
    acceptActivities(cycling, cycling)
    const user = userEvent.setup()
    render(() => jsonResponse(200, forecastWithReasons(2)))
    await screen.findByText("Forecast updated at 14:05")
    await openDetails(user, "Cycling 1")
    await openDetails(user, "Cycling 2")

    await user.click(showButton("Cycling 2"))

    expect(
      screen.getByRole("table", { name: `Hours for Cycling 2 on ${date}` }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("table", hoursTable)).toHaveLength(1)
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
    const user = userEvent.setup()
    await screen.findByText("Forecast updated at 21:40")
    await openDetails(user, "Cycling")

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
      expect(
        await screen.findByRole("list", { name: "Plan activities" }),
      ).toHaveTextContent("Nemuno slipway")
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
    expect(screen.getByRole("region", { name: "Cycling" })).toHaveTextContent(
      "Nemuno slipway",
    )
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

describe("Places and forecast page: the overview", () => {
  // Two dates; Cycling 1 suitable 10:00–14:00 on the first date and not on the second, Museum weather
  // independent, Cycling 2 only 10:00–11:00 (too short) on the first date. Museum has no place.
  function renderOverview() {
    usePlanSetupStore.getState().setChecked({
      location: kaunas,
      dates: ["2026-11-07", "2026-11-08"],
      maxTravelDistanceKm: 30,
    })
    acceptActivities(cycling, museum, cycling)
    const days = [forecastDay("2026-11-07"), forecastDay("2026-11-08")]
    const period = (
      start: string,
      end: string,
      lengthHours: number,
      shorterThanDuration = false,
    ) => ({ start, end, lengthHours, shorterThanDuration })
    const activityDays = (
      first: ReturnType<typeof period> | null,
      second: ReturnType<typeof period> | null,
    ) =>
      [first, second].map((longest, index) => ({
        date: days[index].date,
        periods: longest ? [longest] : [],
        longestPeriod: longest,
        hours: [],
      }))
    const forecast: PlanForecast = {
      updatedAt: "14:05",
      days,
      activities: [
        daylightActivityForecast(days, {
          days: activityDays(period("10:00", "14:00", 4), null),
        }),
        daylightActivityForecast(days, {
          weatherIndependent: true,
          days: activityDays(
            period("06:00", "22:00", 16),
            period("06:00", "22:00", 16),
          ),
        }),
        daylightActivityForecast(days, {
          days: activityDays(period("10:00", "11:00", 1, true), null),
        }),
      ],
    }
    const user = userEvent.setup()
    const routes = render(() => jsonResponse(200, forecast), {
      "POST /api/plan-places": () =>
        jsonResponse(
          200,
          planPlaces(
            ["category-cycling", "category-museum"],
            {},
            { "category-museum": [] },
          ),
        ),
    })
    return { user, ...routes }
  }

  function overview() {
    return screen.getByRole("table", { name: "Plan overview" })
  }

  function overviewRow(activityName: string) {
    return within(overview())
      .getAllByRole("row")
      .find(
        (row) =>
          within(row).queryByRole("rowheader")?.textContent === activityName,
      )!
  }

  it("comes before the activities, with the place and one column per date in date order", async () => {
    renderOverview()
    await screen.findByText("Places updated at 14:05")

    const table = overview()
    const activitiesList = screen.getByRole("list", { name: "Plan activities" })
    expect(
      table.compareDocumentPosition(activitiesList) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual([
      "Activity",
      "Place",
      "Sat 7 Nov · Sunrise 07:46 · Sunset 16:15",
      "Sun 8 Nov · Sunrise 07:46 · Sunset 16:15",
    ])
  })

  it("has a row heading per activity in plan order with its shown name", async () => {
    renderOverview()
    await screen.findByText("Places updated at 14:05")

    expect(
      within(overview())
        .getAllByRole("rowheader")
        .map((header) => header.textContent),
    ).toEqual(["Cycling 1", "Museum", "Cycling 2"])
  })

  it("shows the nearest place and the longest suitable period of each date", async () => {
    renderOverview()
    await screen.findByText("Places updated at 14:05")

    const cells = (activityName: string) =>
      within(overviewRow(activityName))
        .getAllByRole("cell")
        .map((cell) => cell.textContent)
    expect(cells("Cycling 1")).toEqual([
      "Place: Nemuno slipway",
      "Sat 7 Nov: ★ 10:00–14:00 (4 h)",
      "Sun 8 Nov: ✗ None",
    ])
    expect(cells("Museum")).toEqual([
      "Place: ✗ No place found",
      "Sat 7 Nov: ★ 06:00–22:00 (16 h)",
      "Sun 8 Nov: ★ 06:00–22:00 (16 h)",
    ])
    expect(cells("Cycling 2")).toEqual([
      "Place: Nemuno slipway",
      "Sat 7 Nov: ★ 10:00–11:00 (1 h), too short",
      "Sun 8 Nov: ✗ None",
    ])
  })

  it("gives each activity one settings line, its summary and closed forecast details, without sunrise and sunset", async () => {
    renderOverview()
    await screen.findByText("Places updated at 14:05")

    const region = screen.getByRole("region", { name: "Cycling 1" })
    expect(region).toHaveTextContent(
      "Outdoor · 2.5 h · Requires daylight · Wind up to 10 m/s · Rain up to 0.5 mm/h · 5 to 30 °C",
    )
    expect(region).toHaveTextContent(/Suitable hours: \d+ on \d+ of 2 dates/)
    expect(region).not.toHaveTextContent("Sunrise")
    const details = within(region).getByRole("button", {
      name: "Show forecast details, Cycling 1",
    })
    expect(details).toHaveTextContent("Show forecast details")
    expect(details).toHaveAttribute("aria-expanded", "false")
    expect(
      within(region).queryByRole("heading", {
        level: 3,
        name: "Saturday 7 November 2026",
      }),
    ).not.toBeInTheDocument()
  })

  it("opens and closes an activity's forecast details on their own", async () => {
    const { user } = renderOverview()
    await screen.findByText("Places updated at 14:05")
    const region = within(screen.getByRole("region", { name: "Cycling 1" }))

    await user.click(
      region.getByRole("button", { name: "Show forecast details, Cycling 1" }),
    )

    const hide = region.getByRole("button", {
      name: "Hide forecast details, Cycling 1",
    })
    expect(hide).toHaveAttribute("aria-expanded", "true")
    expect(
      document.getElementById(hide.getAttribute("aria-controls")!),
    ).toContainElement(
      region.getByRole("heading", {
        level: 3,
        name: "Saturday 7 November 2026",
      }),
    )
    expect(
      region.getByRole("heading", { level: 3, name: "Sunday 8 November 2026" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Show forecast details, Cycling 2" }),
    ).toHaveAttribute("aria-expanded", "false")

    await user.click(hide)

    expect(
      region.queryByRole("heading", {
        level: 3,
        name: "Saturday 7 November 2026",
      }),
    ).not.toBeInTheDocument()
  })

  it("has no Generate schedule button yet", async () => {
    renderOverview()
    await screen.findByText("Places updated at 14:05")

    expect(
      screen.queryByRole("button", { name: /Generate schedule/ }),
    ).not.toBeInTheDocument()
  })
})

describe("Places and forecast page: when places or the forecast cannot be shown", () => {
  const mapUnavailable = () =>
    jsonResponse(503, { status: 503, service: "places" })
  const weatherUnavailable = () =>
    jsonResponse(503, { status: 503, service: "forecast" })

  function status() {
    return screen.getByRole("status", { name: "Places and forecast" })
  }

  function overview() {
    return screen.getByRole("table", { name: "Plan overview" })
  }

  function placeCells() {
    return within(overview())
      .getAllByRole("cell")
      .filter((cell) => cell.textContent?.startsWith("Place: "))
      .map((cell) => cell.textContent)
  }

  function dateCells() {
    return within(overview())
      .getAllByRole("cell")
      .filter((cell) => !cell.textContent?.startsWith("Place: "))
      .map((cell) => cell.textContent)
  }

  function placesAreas() {
    return screen
      .getAllByRole("heading", { level: 3, name: "Places" })
      .map((heading) => heading.nextElementSibling?.textContent)
  }

  // A places answer the test gives when it wants; earlier answers come from the given list.
  function placesAnswers(...answers: (() => Response)[]) {
    let release: (response: Response) => void = () => {}
    let index = 0
    const handler = () => {
      const answer = answers[index++]
      return answer
        ? answer()
        : new Promise<Response>((resolve) => {
            release = resolve
          })
    }
    return { handler, release: (response: Response) => release(response) }
  }

  function placesRequests(requests: RecordedRequest[]) {
    return requests.filter((request) => request.path === "/api/plan-places")
  }

  it("shows the map data service error once above the overview, no places and the forecast", async () => {
    acceptSetup()
    acceptActivities(cycling, museum)
    render(answerForecast, { "POST /api/plan-places": mapUnavailable })

    await waitFor(() =>
      expect(status()).toHaveTextContent(
        "Error: The map data service is unavailable. No places are shown.",
      ),
    )
    expect(
      screen.getAllByText(
        "Error: The map data service is unavailable. No places are shown.",
      ),
    ).toHaveLength(1)
    expect(
      within(status()).getByRole("button", { name: "Retry" }),
    ).toBeInTheDocument()
    expect(
      status().compareDocumentPosition(overview()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(placeCells()).toEqual([
      "Place: Not available",
      "Place: Not available",
    ])
    expect(placesAreas()).toEqual(["Not available", "Not available"])
    expect(screen.queryByText(/No place found/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /View on map/ }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Places updated/)).not.toBeInTheDocument()
    expect(status()).toHaveTextContent("Forecast updated at 14:05")
    expect(dateCells()).toEqual([
      "Sat 7 Nov: ★ 08:00–16:00 (8 h)",
      "Sat 7 Nov: ★ 08:00–16:00 (8 h)",
    ])
  })

  it("keeps the step on places Retry, says it is getting the places, then shows them without a new forecast", async () => {
    acceptSetup()
    acceptActivities(cycling)
    const places = placesAnswers(mapUnavailable)
    const { requests } = render(answerForecast, {
      "POST /api/plan-places": places.handler,
    })
    await waitFor(() =>
      expect(status()).toHaveTextContent(
        "The map data service is unavailable.",
      ),
    )

    // Two quick clicks: the second finds the request already running.
    const retry = within(status()).getByRole("button", { name: "Retry" })
    fireEvent.click(retry)
    fireEvent.click(retry)

    expect(status()).toHaveTextContent("Getting nearby places…")
    expect(status()).toHaveTextContent("Forecast updated at 14:05")
    expect(placeCells()).toEqual(["Place: Getting nearby places…"])
    expect(placesAreas()).toEqual(["Getting nearby places…"])
    expect(dateCells()).toEqual(["Sat 7 Nov: ★ 08:00–16:00 (8 h)"])
    expect(screen.getByText(/Suitable hours/)).toBeInTheDocument()
    expect(placesRequests(requests)).toHaveLength(2)

    places.release(jsonResponse(200, planPlaces(["category-cycling"])))

    expect(
      await screen.findByText("Places updated at 14:05"),
    ).toBeInTheDocument()
    expect(placeCells()).toEqual(["Place: Nemuno slipway"])
    expect(forecastRequests(requests)).toHaveLength(1)
    expect(placesRequests(requests)).toHaveLength(2)
  })

  it("keeps the overview without the forecast, with plain date headings and the places", async () => {
    usePlanSetupStore.getState().setChecked({
      location: kaunas,
      dates: ["2026-11-07", "2026-11-08"],
      maxTravelDistanceKm: 30,
    })
    acceptActivities(cycling)
    render(weatherUnavailable)

    await waitFor(() =>
      expect(status()).toHaveTextContent(
        "Error: The weather service is unavailable. No forecast is shown.",
      ),
    )
    expect(
      status().compareDocumentPosition(overview()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      within(overview())
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Activity", "Place", "Sat 7 Nov", "Sun 8 Nov"])
    expect(dateCells()).toEqual([
      "Sat 7 Nov: Not available",
      "Sun 8 Nov: Not available",
    ])
    expect(placeCells()).toEqual(["Place: Nemuno slipway"])
    expect(status()).toHaveTextContent("Places updated at 14:05")
  })

  it("says it is getting the forecast in the date cells during the forecast's Retry", async () => {
    acceptSetup()
    acceptActivities(cycling)
    const user = userEvent.setup()
    let release: (response: Response) => void = () => {}
    let failing = true
    render((request) =>
      failing
        ? weatherUnavailable()
        : new Promise<Response>((resolve) => {
            release = (response) => resolve(response)
            void request
          }),
    )
    await waitFor(() =>
      expect(status()).toHaveTextContent("The weather service is unavailable."),
    )

    failing = false
    await user.click(within(status()).getByRole("button", { name: "Retry" }))

    expect(status()).toHaveTextContent("Getting the forecast…")
    expect(dateCells()).toEqual(["Sat 7 Nov: Getting the forecast…"])
    expect(placeCells()).toEqual(["Place: Nemuno slipway"])
    release(jsonResponse(200, planForecast(["2026-11-07"], 1)))
    await waitFor(() =>
      expect(dateCells()).toEqual(["Sat 7 Nov: ★ 08:00–16:00 (8 h)"]),
    )
  })

  it("shows both errors, each with its own Retry, and Not available everywhere", async () => {
    acceptSetup()
    acceptActivities(cycling)
    render(weatherUnavailable, { "POST /api/plan-places": mapUnavailable })

    await waitFor(() =>
      expect(status()).toHaveTextContent(
        "Error: The map data service is unavailable. No places are shown.",
      ),
    )
    expect(status()).toHaveTextContent(
      "Error: The weather service is unavailable. No forecast is shown.",
    )
    expect(
      within(status()).getAllByRole("button", { name: "Retry" }),
    ).toHaveLength(2)
    expect(placeCells()).toEqual(["Place: Not available"])
    expect(dateCells()).toEqual(["Sat 7 Nov: Not available"])
  })

  it.each([
    [
      "too many requests",
      () => jsonResponse(429, { status: 429 }),
      "Error: Too many requests. Wait a minute and try again.",
    ],
    [
      "a server error",
      () => jsonResponse(500),
      "Error: Something went wrong. Try again.",
    ],
    [
      "the location search service failing",
      () => jsonResponse(503, { status: 503, service: "locationSearch" }),
      "Error: Something went wrong. Try again.",
    ],
  ])(
    "shows the places error with Retry for %s",
    async (_case, answer, message) => {
      acceptSetup()
      acceptActivities(cycling)
      render(answerForecast, { "POST /api/plan-places": answer })

      await waitFor(() => expect(status()).toHaveTextContent(message))
      expect(
        within(status()).getByRole("button", { name: "Retry" }),
      ).toBeInTheDocument()
      expect(status()).toHaveTextContent("Forecast updated at 14:05")
      expect(placeCells()).toEqual(["Place: Not available"])
    },
  )

  it("shows the server error when the places do not answer within 10 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      acceptSetup()
      acceptActivities(cycling)
      render(answerForecast, {
        "POST /api/plan-places": (request) =>
          new Promise<Response>(() => {
            void request
          }),
      })
      await waitFor(() =>
        expect(status()).toHaveTextContent(
          "Getting the forecast and nearby places…",
        ),
      )

      await act(() => vi.advanceTimersByTimeAsync(10_000))

      await waitFor(() =>
        expect(status()).toHaveTextContent(
          "Error: Something went wrong. Try again.",
        ),
      )
      expect(status()).toHaveTextContent("Forecast updated at 14:05")
    } finally {
      vi.useRealTimers()
    }
  })

  it("ignores places that arrive after the user has left the step", async () => {
    acceptSetup()
    acceptActivities(cycling)
    const user = userEvent.setup()
    const places = placesAnswers()
    render(answerForecast, { "POST /api/plan-places": places.handler })
    await waitFor(() =>
      expect(status()).toHaveTextContent(
        "Getting the forecast and nearby places…",
      ),
    )

    await user.click(screen.getByRole("link", { name: "Back" }))
    await heading("Activity selection")
    places.release(jsonResponse(200, planPlaces(["category-cycling"])))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(usePlanPlacesStore.getState().status).toBe("idle")
    expect(usePlanPlacesStore.getState().places).toBeNull()
  })
})
