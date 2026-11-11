import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { PlanLocation } from "../types/planSetup"
import { jsonResponse, renderApp, routeFetch } from "./renderApp"

const period = { firstDate: "2026-11-04", lastDate: "2026-11-10", maxDates: 7 }

const kaunas: PlanLocation = {
  id: 598316,
  name: "Kaunas",
  area: "Kaunas County",
  latitude: 54.90156,
  longitude: 23.90909,
}

const kauniai: PlanLocation = {
  id: 11301040,
  name: "Kauniai",
  area: "Biržai District Municipality",
  latitude: 56.19924,
  longitude: 24.69617,
}

// A visitor on Plan setup; extra routes answer the searches a test makes.
function renderPlanSetup(
  searches: Record<string, () => Response | Promise<Response>> = {},
  periodAnswer: () => Response | Promise<Response> = () =>
    jsonResponse(200, period),
) {
  const routes = Object.fromEntries(
    Object.entries(searches).map(([query, answer]) => [
      `GET /api/locations?query=${encodeURIComponent(query)}`,
      answer,
    ]),
  )
  const fetch = routeFetch({
    "GET /api/auth/me": () => jsonResponse(401),
    "GET /api/plan-setup/period": periodAnswer,
    ...routes,
  })
  renderApp("/plan/setup")
  return fetch
}

function found(locations: PlanLocation[]) {
  return () => jsonResponse(200, { locations })
}

function location() {
  return screen.getByRole("combobox", { name: "Location" })
}

// Pastes the whole text at once, so exactly one search is sent for it.
async function search(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(location())
  await user.paste(text)
}

describe("Plan setup page: location", () => {
  beforeEach(() => {
    document.title = ""
  })

  it("has one main heading, its tab title and the progress bar at step 1 of 4", async () => {
    renderPlanSetup()

    expect(
      await screen.findByRole("heading", { level: 1, name: "Plan setup" }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    await waitFor(() => expect(document.title).toBe("Plan setup - Spėk laiku"))
    const progress = within(
      screen.getByRole("navigation", { name: "Plan progress" }),
    )
    expect(
      progress.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual(["Plan setup", "Activities", "Places and forecast", "Schedule"])
    expect(progress.getByText("Plan setup")).toHaveAttribute(
      "aria-current",
      "step",
    )
    expect(progress.queryAllByRole("link")).toHaveLength(0)
    expect(progress.getByText("Step 1 of 4: Plan setup")).toHaveAttribute(
      "aria-hidden",
      "true",
    )
  })

  it("starts with an empty Location that accepts at most 100 characters", async () => {
    renderPlanSetup()

    expect(await screen.findByLabelText("Location")).toHaveValue("")
    expect(location()).toHaveAttribute("maxLength", "100")
    expect(location()).toHaveAttribute("aria-expanded", "false")
  })

  it("announces the search, then lists places with their area", async () => {
    let answer: (response: Response) => void = () => {}
    const user = userEvent.setup()
    renderPlanSetup({
      Kaun: () =>
        new Promise<Response>((resolve) => {
          answer = resolve
        }),
    })
    await screen.findByLabelText("Location")

    await search(user, "Kaun")

    const status = await screen.findByText("Searching locations…")
    expect(status).toHaveAttribute("role", "status")
    answer(jsonResponse(200, { locations: [kaunas, kauniai] }))
    const options = await screen.findAllByRole("option")
    expect(options.map((option) => option.textContent)).toEqual([
      "Kaunas, Kaunas County",
      "Kauniai, Biržai District Municipality",
    ])
    expect(location()).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("2 locations found")).toHaveAttribute(
      "role",
      "status",
    )
  })

  it("chooses a place with a click", async () => {
    const user = userEvent.setup()
    renderPlanSetup({ Kaun: found([kaunas, kauniai]) })
    await screen.findByLabelText("Location")
    await search(user, "Kaun")

    await user.click(
      await screen.findByRole("option", { name: "Kaunas, Kaunas County" }),
    )

    expect(location()).toHaveValue("Kaunas, Kaunas County")
    expect(screen.queryByRole("listbox")).toBeNull()
    expect(location()).toHaveAttribute("aria-expanded", "false")
    expect(usePlanSetupStore.getState().location).toEqual(kaunas)
  })

  it("chooses a place with the arrow keys and Enter", async () => {
    const user = userEvent.setup()
    renderPlanSetup({ Kaun: found([kaunas, kauniai]) })
    await screen.findByLabelText("Location")
    await search(user, "Kaun")
    await screen.findAllByRole("option")

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}")
    const highlighted = screen.getByRole("option", { selected: true })
    expect(highlighted).toHaveTextContent("Kaunas, Kaunas County")
    expect(location()).toHaveAttribute("aria-activedescendant", highlighted.id)
    await user.keyboard("{Enter}")

    expect(location()).toHaveValue("Kaunas, Kaunas County")
    expect(screen.queryByRole("listbox")).toBeNull()
    expect(usePlanSetupStore.getState().location).toEqual(kaunas)
  })

  it("closes the list on Escape and keeps the typed text", async () => {
    const user = userEvent.setup()
    renderPlanSetup({ Kaun: found([kaunas]) })
    await screen.findByLabelText("Location")
    await search(user, "Kaun")
    await screen.findByRole("option")

    await user.keyboard("{Escape}")

    expect(screen.queryByRole("listbox")).toBeNull()
    expect(location()).toHaveValue("Kaun")
    expect(usePlanSetupStore.getState().location).toBeNull()
  })

  it("clears the chosen place when the text changes", async () => {
    const user = userEvent.setup()
    renderPlanSetup({
      Kaun: found([kaunas]),
      "Kaunas, Kaunas Count": found([kaunas]),
    })
    await screen.findByLabelText("Location")
    await search(user, "Kaun")
    await user.click(await screen.findByRole("option"))
    expect(usePlanSetupStore.getState().location).toEqual(kaunas)

    await user.keyboard("{Backspace}")

    expect(location()).toHaveValue("Kaunas, Kaunas Count")
    expect(usePlanSetupStore.getState().location).toBeNull()
    expect(await screen.findByRole("option")).toHaveTextContent(
      "Kaunas, Kaunas County",
    )
  })

  it("says when no place is found", async () => {
    const user = userEvent.setup()
    renderPlanSetup({ zzqxw: found([]) })
    await screen.findByLabelText("Location")

    await search(user, "zzqxw")

    expect(
      await screen.findByText(
        "No location found. Check the spelling or try a larger town.",
      ),
    ).toHaveAttribute("role", "status")
    expect(screen.queryByRole("option")).toBeNull()
  })

  it.each([
    [503, "Error: Location search is unavailable. Try again later."],
    [500, "Error: Location search is unavailable. Try again later."],
    [429, "Error: Too many requests. Wait a minute and try again."],
  ])("shows the error for %i with no places", async (status, message) => {
    const user = userEvent.setup()
    renderPlanSetup({ Kaun: () => jsonResponse(status) })
    await screen.findByLabelText("Location")

    await search(user, "Kaun")

    expect(await screen.findByText(message)).toHaveAttribute("role", "alert")
    expect(screen.queryByRole("option")).toBeNull()
  })

  it("starts no search for a single character", async () => {
    const user = userEvent.setup()
    const { requests } = renderPlanSetup()
    await screen.findByLabelText("Location")

    await search(user, " K ")
    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(
      requests.some((request) => request.path.startsWith("/api/locations")),
    ).toBe(false)
    expect(document.getElementById("location-status")).toBeEmptyDOMElement()
  })
})

function dateInput() {
  return screen.getByLabelText("Dates", { selector: "input" })
}

// Picks a date the way the browser's date picker reports it: as a yyyy-MM-dd value.
async function addDate(user: ReturnType<typeof userEvent.setup>, date: string) {
  fireEvent.change(dateInput(), { target: { value: date } })
  await user.click(screen.getByRole("button", { name: "Add date" }))
}

function chips() {
  return within(screen.getByRole("group", { name: "Dates" }))
    .queryAllByRole("listitem")
    .map((chip) => chip.firstChild?.textContent)
}

describe("Plan setup page: dates", () => {
  it("waits for the date limits before dates can be added, while Location still works", async () => {
    let answer: (response: Response) => void = () => {}
    renderPlanSetup(
      {},
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve
        }),
    )

    expect(await screen.findByText("Loading available dates…")).toHaveAttribute(
      "role",
      "status",
    )
    expect(dateInput()).toBeDisabled()
    expect(screen.getByRole("button", { name: "Add date" })).toBeDisabled()
    expect(location()).toBeEnabled()

    answer(jsonResponse(200, period))

    await waitFor(() => expect(dateInput()).toBeEnabled())
    expect(screen.getByRole("button", { name: "Add date" })).toBeEnabled()
    expect(screen.queryByText("Loading available dates…")).toBeNull()
  })

  it.each([
    ["a server error", () => jsonResponse(500)],
    ["a network error", () => Promise.reject(new TypeError("Failed to fetch"))],
  ])(
    "offers Retry after %s and loads the limits again",
    async (_case, failure) => {
      let calls = 0
      const user = userEvent.setup()
      renderPlanSetup({}, () => {
        calls += 1
        return calls === 1 ? failure() : jsonResponse(200, period)
      })

      const message = await screen.findByText(
        "Error: Available dates could not be loaded. Try again.",
      )
      expect(message.closest("[role='alert']")).not.toBeNull()
      expect(dateInput()).toBeDisabled()

      await user.click(screen.getByRole("button", { name: "Retry" }))

      await waitFor(() => expect(dateInput()).toBeEnabled())
      expect(
        screen.queryByText(
          "Error: Available dates could not be loaded. Try again.",
        ),
      ).toBeNull()
    },
  )

  it.each([
    [period, "2026-11-04", "2026-11-10"],
    [
      { firstDate: "2031-02-27", lastDate: "2031-03-05", maxDates: 7 },
      "2031-02-27",
      "2031-03-05",
    ],
  ])(
    "limits the date picker to the server's period",
    async (answer, min, max) => {
      renderPlanSetup({}, () => jsonResponse(200, answer))

      await waitFor(() => expect(dateInput()).toBeEnabled())

      expect(dateInput()).toHaveAttribute("min", min)
      expect(dateInput()).toHaveAttribute("max", max)
    },
  )

  it("shows added dates as chips in date order, with how many there are", async () => {
    const user = userEvent.setup()
    renderPlanSetup()
    await waitFor(() => expect(dateInput()).toBeEnabled())

    await addDate(user, "2026-11-08")
    await addDate(user, "2026-11-07")

    expect(chips()).toEqual(["Sat 7 Nov 2026", "Sun 8 Nov 2026"])
    expect(screen.getByText("2 dates added")).toBeInTheDocument()
    expect(dateInput()).toHaveValue("")
    expect(usePlanSetupStore.getState().dates).toEqual([
      "2026-11-07",
      "2026-11-08",
    ])
  })

  it("names the group and the date picker with one Dates label, with no second Date label", async () => {
    const user = userEvent.setup()
    renderPlanSetup()
    await waitFor(() => expect(dateInput()).toBeEnabled())

    const group = screen.getByRole("group", { name: "Dates" })
    expect(dateInput()).toHaveAccessibleName("Dates")
    expect(group.querySelectorAll("label, legend")).toHaveLength(1)
    expect(within(group).queryByText("Date")).toBeNull()

    await user.click(within(group).getByText("Dates"))
    expect(dateInput()).toHaveFocus()
  })

  it("removes a date, announces it and moves focus back to the date picker", async () => {
    const user = userEvent.setup()
    renderPlanSetup()
    await waitFor(() => expect(dateInput()).toBeEnabled())
    await addDate(user, "2026-11-07")
    await addDate(user, "2026-11-08")

    await user.click(
      screen.getByRole("button", { name: "Remove Sun 8 Nov 2026" }),
    )

    expect(chips()).toEqual(["Sat 7 Nov 2026"])
    expect(dateInput()).toHaveFocus()
    expect(screen.getByText("Sun 8 Nov 2026 removed.")).toHaveAttribute(
      "role",
      "status",
    )
    expect(screen.getByText("1 date added")).toBeInTheDocument()
  })

  it.each([
    ["", "Error: Choose a date first."],
    ["2026-11-03", "Error: Dates cannot be in the past."],
    ["2026-11-11", "Error: Forecast is not available that far ahead."],
  ])(
    "refuses %j with its message next to the date picker",
    async (date, message) => {
      const user = userEvent.setup()
      renderPlanSetup()
      await waitFor(() => expect(dateInput()).toBeEnabled())

      await addDate(user, date)

      const error = screen.getByText(message)
      expect(dateInput()).toHaveAttribute("aria-invalid", "true")
      expect(dateInput().getAttribute("aria-describedby")).toContain(error.id)
      expect(chips()).toEqual([])
    },
  )

  it("refuses a date that is already added", async () => {
    const user = userEvent.setup()
    renderPlanSetup()
    await waitFor(() => expect(dateInput()).toBeEnabled())
    await addDate(user, "2026-11-07")

    await addDate(user, "2026-11-07")

    expect(
      screen.getByText("Error: This date is already added."),
    ).toBeInTheDocument()
    expect(chips()).toEqual(["Sat 7 Nov 2026"])
  })

  it("adds all 7 days of the period, then refuses any other date", async () => {
    const user = userEvent.setup()
    renderPlanSetup()
    await waitFor(() => expect(dateInput()).toBeEnabled())

    for (const day of [4, 5, 6, 7, 8, 9, 10]) {
      await addDate(user, `2026-11-${String(day).padStart(2, "0")}`)
    }

    expect(chips()).toHaveLength(7)
    expect(screen.getByText("7 dates added")).toBeInTheDocument()
    await addDate(user, "2026-11-11")
    expect(
      screen.getByText("Error: Forecast is not available that far ahead."),
    ).toBeInTheDocument()
    expect(chips()).toHaveLength(7)
  })

  it("clears the message once a valid date is added", async () => {
    const user = userEvent.setup()
    renderPlanSetup()
    await waitFor(() => expect(dateInput()).toBeEnabled())
    await addDate(user, "2026-11-03")

    await addDate(user, "2026-11-05")

    expect(screen.queryByText("Error: Dates cannot be in the past.")).toBeNull()
    expect(dateInput()).not.toHaveAttribute("aria-invalid")
  })
})

const checkRoute = "POST /api/plan-setup/check"

// A visitor who chose Kaunas and added 7 November, ready to continue.
async function renderReadySetup(
  check: () => Response | Promise<Response>,
  user: ReturnType<typeof userEvent.setup>,
) {
  const fetch = routeFetch({
    "GET /api/auth/me": () => jsonResponse(401),
    "GET /api/plan-setup/period": () => jsonResponse(200, period),
    "GET /api/locations?query=Kaun": found([kaunas]),
    "GET /api/plan-activities/categories": () =>
      jsonResponse(200, { categories: [], maxActivities: 10 }),
    [checkRoute]: check,
  })
  renderApp("/plan/setup")
  await waitFor(() => expect(dateInput()).toBeEnabled())
  await search(user, "Kaun")
  await user.click(await screen.findByRole("option"))
  await addDate(user, "2026-11-07")
  return fetch
}

function checkedKaunas(dates: string[] = ["2026-11-07"]) {
  return { location: kaunas, dates, maxTravelDistanceKm: 30 }
}

describe("Plan setup page: Continue", () => {
  it("shows both missing fields in place and in the summary, focuses Location and sends nothing", async () => {
    const user = userEvent.setup()
    const { requests } = renderPlanSetup()
    await waitFor(() => expect(dateInput()).toBeEnabled())

    await user.click(screen.getByRole("button", { name: "Continue" }))

    const summary = within(screen.getByRole("alert", { name: "Error summary" }))
    expect(
      summary.getAllByRole("link").map((link) => link.textContent),
    ).toEqual([
      "Error: Select a location in Lithuania from the list.",
      "Error: Add at least one date.",
    ])
    expect(location()).toHaveFocus()
    expect(location()).toHaveAttribute("aria-invalid", "true")
    expect(dateInput()).toHaveAttribute("aria-invalid", "true")
    await user.click(
      summary.getByRole("link", { name: "Error: Add at least one date." }),
    )
    expect(dateInput()).toHaveFocus()
    expect(requests.some((request) => request.method === "POST")).toBe(false)
  })

  it("refuses typed text that was not chosen from the list and keeps it", async () => {
    const user = userEvent.setup()
    renderPlanSetup({ Kaun: found([kaunas]) })
    await waitFor(() => expect(dateInput()).toBeEnabled())
    await search(user, "Kaun")
    await addDate(user, "2026-11-07")

    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(
      screen.getByText("Error: Select a location in Lithuania from the list."),
    ).toBeInTheDocument()
    expect(location()).toHaveValue("Kaun")
    expect(location()).toHaveFocus()
  })

  it("announces the check, disables Continue, then opens Activity selection", async () => {
    let answer: (response: Response) => void = () => {}
    const user = userEvent.setup()
    const { requests } = await renderReadySetup(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve
        }),
      user,
    )

    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(
      await screen.findByText("Checking your plan setup…"),
    ).toHaveAttribute("role", "status")
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
    expect(requests.find((request) => request.method === "POST")?.body).toEqual(
      { locationId: 598316, dates: ["2026-11-07"], maxTravelDistanceKm: 30 },
    )

    answer(jsonResponse(200, checkedKaunas()))

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Activity selection",
      }),
    ).toBeInTheDocument()
  })

  it("marks each refused date and names it in the summary", async () => {
    const user = userEvent.setup()
    await renderReadySetup(
      () =>
        jsonResponse(400, {
          errors: {
            "dates[0]": ["Dates cannot be in the past."],
            "dates[1]": ["Forecast is not available that far ahead."],
          },
        }),
      user,
    )
    await addDate(user, "2026-11-08")

    await user.click(screen.getByRole("button", { name: "Continue" }))

    const summary = within(
      await screen.findByRole("alert", { name: "Error summary" }),
    )
    expect(
      summary.getAllByRole("link").map((link) => link.textContent),
    ).toEqual([
      "Error: Sat 7 Nov 2026: Dates cannot be in the past.",
      "Error: Sun 8 Nov 2026: Forecast is not available that far ahead.",
    ])
    const firstChip = within(
      screen.getByRole("group", { name: "Dates" }),
    ).getAllByRole("listitem")[0]
    expect(firstChip).toHaveTextContent("Error: Dates cannot be in the past.")
    expect(dateInput()).toHaveFocus()
  })

  it.each([
    ["a server error", () => Promise.resolve(jsonResponse(500))],
    ["a network error", () => Promise.reject(new TypeError("Failed to fetch"))],
  ])(
    "offers Retry after %s, which sends the same values",
    async (_case, failure) => {
      let calls = 0
      const user = userEvent.setup()
      const { requests } = await renderReadySetup(() => {
        calls += 1
        return calls === 1 ? failure() : jsonResponse(200, checkedKaunas())
      }, user)

      await user.click(screen.getByRole("button", { name: "Continue" }))

      expect(
        await screen.findByText("Error: Something went wrong. Try again."),
      ).toBeInTheDocument()
      expect(location()).toHaveValue("Kaunas, Kaunas County")
      await user.click(screen.getByRole("button", { name: "Retry" }))

      expect(
        await screen.findByRole("heading", {
          level: 1,
          name: "Activity selection",
        }),
      ).toBeInTheDocument()
      const posts = requests.filter((request) => request.method === "POST")
      expect(posts).toHaveLength(2)
      expect(posts[1].body).toEqual(posts[0].body)
    },
  )

  it("tells the user to wait when there were too many requests, with Retry", async () => {
    const user = userEvent.setup()
    await renderReadySetup(() => jsonResponse(429), user)

    await user.click(screen.getByRole("button", { name: "Continue" }))

    const message = await screen.findByText(
      "Error: Too many requests. Wait a minute and try again.",
    )
    expect(message.closest("[role='alert']")).not.toBeNull()
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  })
})

function distance() {
  return screen.getByLabelText("Maximum travel distance (km)")
}

function sentDistance(requests: { method: string; body: unknown }[]) {
  const post = requests.filter((request) => request.method === "POST").at(-1)
  return (post?.body as { maxTravelDistanceKm: number | null })
    .maxTravelDistanceKm
}

describe("Plan setup page: maximum travel distance", () => {
  it("starts at 30 with its allowed range as a hint", async () => {
    renderPlanSetup()

    const field = await screen.findByLabelText("Maximum travel distance (km)")

    expect(field).toHaveValue("30")
    expect(field).toHaveAttribute("inputmode", "numeric")
    const hint = screen.getByText("Whole number from 1 to 200")
    expect(field.getAttribute("aria-describedby")).toContain(hint.id)
  })

  it("refuses text that is not a number without sending anything", async () => {
    const user = userEvent.setup()
    const { requests } = await renderReadySetup(
      () => jsonResponse(200, checkedKaunas()),
      user,
    )
    await user.clear(distance())
    await user.type(distance(), "abc")

    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(
      screen.getByText("Error: Enter a whole number between 1 and 200."),
    ).toBeInTheDocument()
    expect(distance()).toHaveAttribute("aria-invalid", "true")
    expect(distance()).toHaveFocus()
    expect(requests.some((request) => request.method === "POST")).toBe(false)
  })

  it("lists a refused distance in the summary with the other errors", async () => {
    const user = userEvent.setup()
    renderPlanSetup()
    await waitFor(() => expect(dateInput()).toBeEnabled())
    await user.clear(distance())
    await user.type(distance(), "abc")

    await user.click(screen.getByRole("button", { name: "Continue" }))

    const summary = within(screen.getByRole("alert", { name: "Error summary" }))
    expect(
      summary.getAllByRole("link").map((link) => link.textContent),
    ).toEqual([
      "Error: Select a location in Lithuania from the list.",
      "Error: Add at least one date.",
      "Error: Enter a whole number between 1 and 200.",
    ])
  })

  it.each(["0", "201", "12.5"])(
    "shows the server's message for %s next to the field and focuses it",
    async (text) => {
      const user = userEvent.setup()
      const { requests } = await renderReadySetup(
        () =>
          jsonResponse(400, {
            errors: {
              maxTravelDistanceKm: ["Enter a whole number between 1 and 200."],
            },
          }),
        user,
      )
      await user.clear(distance())
      await user.type(distance(), text)

      await user.click(screen.getByRole("button", { name: "Continue" }))

      expect(
        await screen.findByText(
          "Error: Enter a whole number between 1 and 200.",
        ),
      ).toBeInTheDocument()
      expect(distance()).toHaveFocus()
      expect(sentDistance(requests)).toBe(Number(text))
    },
  )

  it("sends nothing for an empty field and shows 30 again after the check", async () => {
    const user = userEvent.setup()
    const { requests } = await renderReadySetup(
      () => jsonResponse(200, checkedKaunas()),
      user,
    )
    await user.clear(distance())

    await user.click(screen.getByRole("button", { name: "Continue" }))

    await screen.findByRole("heading", {
      level: 1,
      name: "Activity selection",
    })
    expect(sentDistance(requests)).toBeNull()
    expect(usePlanSetupStore.getState().maxTravelDistanceText).toBe("30")
    expect(usePlanSetupStore.getState().checked).not.toBeNull()
  })

  it("sends 50 and shows it on Activity selection", async () => {
    const user = userEvent.setup()
    const { requests } = await renderReadySetup(
      () =>
        jsonResponse(200, {
          ...checkedKaunas(),
          maxTravelDistanceKm: 50,
        }),
      user,
    )
    await user.clear(distance())
    await user.type(distance(), "50")

    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(
      await screen.findByText(
        "Kaunas, Kaunas County · Sat 7 Nov 2026 · Maximum travel distance: 50 km",
      ),
    ).toBeInTheDocument()
    expect(sentDistance(requests)).toBe(50)
  })
})

describe("Plan setup page: 'checked again' notice", () => {
  const notice = "Your plan setup needs to be checked again. Select Continue."

  it("is not shown when the page is opened normally", async () => {
    renderPlanSetup()
    await waitFor(() => expect(dateInput()).toBeEnabled())

    expect(screen.queryByText(notice)).not.toBeInTheDocument()
  })

  it("is shown at the top in a status region after step 3 found the setup out of date", async () => {
    usePlanSetupStore.getState().markOutdated()
    renderPlanSetup()

    const shown = await screen.findByText(notice)
    expect(shown).toHaveAttribute("role", "status")
    expect(
      shown.compareDocumentPosition(
        screen.getByRole("button", { name: "Continue" }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it("is still shown after a reload", async () => {
    usePlanSetupStore.getState().markOutdated()
    await usePlanSetupStore.persist.rehydrate()
    renderPlanSetup()

    expect(await screen.findByText(notice)).toBeInTheDocument()
  })

  it("stays after a failed Continue and is gone after a successful one", async () => {
    usePlanSetupStore.getState().markOutdated()
    let answer = jsonResponse(400, {
      errors: { "dates[0]": ["Dates cannot be in the past."] },
    })
    const user = userEvent.setup()
    await renderReadySetup(() => answer, user)

    await user.click(screen.getByRole("button", { name: "Continue" }))
    expect(
      await screen.findByText("Error: Dates cannot be in the past."),
    ).toBeInTheDocument()
    expect(screen.getByText(notice)).toBeInTheDocument()

    answer = jsonResponse(200, checkedKaunas())
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByRole("heading", { level: 1, name: "Activity selection" })
    await user.click(screen.getByRole("link", { name: "Back" }))

    await screen.findByRole("heading", { level: 1, name: "Plan setup" })
    expect(screen.queryByText(notice)).not.toBeInTheDocument()
    expect(usePlanSetupStore.getState().recheckNotice).toBe(false)
  })
})
