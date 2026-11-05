import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
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

function render(entry = "/plan/activities") {
  routeFetch({
    "GET /api/auth/me": () => jsonResponse(401),
    "GET /api/plan-setup/period": () =>
      jsonResponse(200, {
        firstDate: "2026-11-04",
        lastDate: "2026-11-10",
        maxDates: 7,
      }),
  })
  return renderAppWithLocation(entry)
}

describe("Activity selection page (first version)", () => {
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
