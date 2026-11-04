import { screen, waitFor, within } from "@testing-library/react"
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
) {
  const routes = Object.fromEntries(
    Object.entries(searches).map(([query, answer]) => [
      `GET /api/locations?query=${encodeURIComponent(query)}`,
      answer,
    ]),
  )
  const fetch = routeFetch({
    "GET /api/auth/me": () => jsonResponse(401),
    "GET /api/plan-setup/period": () => jsonResponse(200, period),
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
