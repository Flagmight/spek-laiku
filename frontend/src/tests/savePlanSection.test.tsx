import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { useKeptScheduleStore } from "../stores/useKeptScheduleStore"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { PlanSchedule } from "../types/planSchedule"
import type { RecordedRequest } from "./renderApp"
import {
  jsonResponse,
  renderAppWithLocation,
  routeFetch,
  signedInUser,
} from "./renderApp"

const firstId = "6f1c2a8e-3b7d-4e55-9a10-0c4f2d9b7e31"
const secondId = "7a2d3b9f-4c8e-4f66-8b21-1d5e3f0c8f42"

const checkedSetup = {
  location: {
    id: 598316,
    name: "Kaunas",
    area: "Kaunas County",
    latitude: 54.90156,
    longitude: 23.90909,
  },
  dates: ["2026-11-14"],
  maxTravelDistanceKm: 30,
}

const checkedActivities: CheckedPlanActivity[] = [
  {
    id: "act-1",
    categoryId: "cat-museum",
    name: "Museum",
    type: "Indoor",
    durationHours: 2,
    requiresDaylight: false,
    maxWindMs: null,
    maxRainMmPerHour: null,
    minTemperatureC: null,
    maxTemperatureC: null,
  },
]

function schedule(generatedScheduleId: string | null = firstId): PlanSchedule {
  return {
    generatedScheduleId,
    scheduled: [
      {
        activityName: "Museum",
        date: "2026-11-14",
        startTime: "06:00",
        endTime: "22:00",
        place: {
          name: "City Museum",
          latitude: 54.9,
          longitude: 23.9,
          distanceKm: 1.1,
          area: "Kaunas",
        },
        weather: {
          temperatureC: null,
          rainMmPerHour: null,
          windMs: null,
          isIndoor: true,
        },
        travel: null,
      },
    ],
    unscheduled: [],
    travel: { maxDistanceKm: 30, tripsOverLimit: 0 },
  }
}

const savedPlan = {
  id: "0b8f4c1e-7d2a-4f3b-9e6c-5a1d2c3b4e5f",
  name: "Weekend in Kaunas",
  locationName: "Kaunas",
  dates: ["2026-11-14"],
  savedAt: "2026-11-18T12:05:00Z",
}

type Handler = (request: RecordedRequest) => Response | Promise<Response>

function render(
  save: Handler,
  generate: Handler = () => jsonResponse(200, schedule()),
  extraRoutes: Record<string, Handler> = {},
) {
  usePlanSetupStore.getState().setChecked(checkedSetup)
  usePlanActivitiesStore.getState().setChecked(checkedActivities)
  const user = userEvent.setup()
  const routes = routeFetch({
    "GET /api/auth/me": () => jsonResponse(200, signedInUser()),
    "POST /api/plan-schedule": generate,
    "POST /api/plans": save,
    ...extraRoutes,
  })
  const { currentLocation } = renderAppWithLocation("/plan/schedule")
  return { user, currentLocation, ...routes }
}

function saves(requests: RecordedRequest[]) {
  return requests.filter((request) => request.path === "/api/plans")
}

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Save plan" }))
  return screen.getByLabelText("Plan name")
}

function generations(requests: RecordedRequest[]) {
  return requests.filter((request) => request.path === "/api/plan-schedule")
}

describe("SavePlanSection for a Visitor (feature 010 spec User Story 2)", () => {
  it("offers Save plan with a hint to log in or register", async () => {
    render(() => jsonResponse(201, savedPlan), undefined, {
      "GET /api/auth/me": () => jsonResponse(401),
    })

    const button = await screen.findByRole("button", { name: "Save plan" })

    expect(button).toHaveAccessibleDescription(
      "Log in or register to save this plan.",
    )
  })

  it("keeps the schedule through Log in and offers the form afterwards", async () => {
    let signedIn = false
    const { user, currentLocation, requests } = render(
      () => jsonResponse(201, savedPlan),
      undefined,
      {
        "GET /api/auth/me": () =>
          signedIn ? jsonResponse(200, signedInUser()) : jsonResponse(401),
        "POST /api/auth/login": () => {
          signedIn = true
          return jsonResponse(200, signedInUser())
        },
      },
    )

    await user.click(await screen.findByRole("button", { name: "Save plan" }))

    expect(currentLocation()).toBe("/login?returnTo=%2Fplan%2Fschedule")
    expect(screen.getByText("Log in to continue.")).toBeInTheDocument()
    expect(useKeptScheduleStore.getState().kept).not.toBeNull()

    await user.type(screen.getByLabelText("Email"), "user@example.com")
    await user.type(screen.getByLabelText("Password"), "Password123!")
    await user.click(screen.getByRole("button", { name: "Log in" }))

    await waitFor(() => expect(currentLocation()).toBe("/plan/schedule"))
    expect(
      await screen.findByText("City Museum", { exact: false }),
    ).toBeInTheDocument()
    expect(generations(requests)).toHaveLength(1)
    await openForm(user)
    expect(screen.getByLabelText("Plan name")).toBeInTheDocument()
  })

  it("keeps the schedule and logs in again when the session ended while saving", async () => {
    // The server ended the session: the save and every later request answer 401.
    let sessionEnded = false
    const { user, currentLocation } = render(
      () => {
        sessionEnded = true
        return jsonResponse(401)
      },
      undefined,
      {
        "GET /api/auth/me": () =>
          sessionEnded ? jsonResponse(401) : jsonResponse(200, signedInUser()),
      },
    )
    const field = await openForm(user)
    await user.type(field, "Weekend")

    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(currentLocation()).toBe("/login?returnTo=%2Fplan%2Fschedule"),
    )
    expect(
      screen.getByText("Your session has expired. Log in again."),
    ).toBeInTheDocument()
    expect(
      useKeptScheduleStore.getState().kept?.schedule.generatedScheduleId,
    ).toBe(firstId)
  })
})

describe("SavePlanSection for a signed-in Registered User", () => {
  it("offers Save plan and opens a form with a labelled name field", async () => {
    const { user } = render(() => jsonResponse(201, savedPlan))

    const field = await openForm(user)

    expect(field).toHaveAttribute("type", "text")
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled()
  })

  it("offers nothing when no activity was scheduled", async () => {
    render(
      () => jsonResponse(201, savedPlan),
      () =>
        jsonResponse(200, {
          ...schedule(null),
          scheduled: [],
          unscheduled: [{ activityName: "Museum", reason: "noPlace" }],
        }),
    )

    await screen.findByText(/No suitable time found for any activity/)
    expect(
      screen.queryByRole("button", { name: "Save plan" }),
    ).not.toBeInTheDocument()
  })

  it("refuses an empty name next to the field and moves focus to it", async () => {
    const { user, requests } = render(() => jsonResponse(201, savedPlan))
    const field = await openForm(user)

    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(
      await screen.findByText("Error: Enter a plan name."),
    ).toBeInTheDocument()
    expect(field).toHaveAttribute("aria-invalid", "true")
    expect(field).toHaveFocus()
    expect(saves(requests)).toEqual([])
  })

  it("shows the server's message for a name that is too long", async () => {
    const { user } = render(() =>
      jsonResponse(400, {
        errors: { name: ["Plan name can be at most 80 characters."] },
      }),
    )
    const field = await openForm(user)

    await user.type(field, "a".repeat(81))
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(
      await screen.findByText("Error: Plan name can be at most 80 characters."),
    ).toBeInTheDocument()
  })

  it("disables Save while saving", async () => {
    const { user } = render(() => new Promise<Response>(() => {}))
    const field = await openForm(user)

    await user.type(field, "Weekend")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Saving your plan…")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  it("sends only the schedule id and the name, then shows the success message", async () => {
    const { user, requests } = render(() => jsonResponse(201, savedPlan))
    const field = await openForm(user)

    await user.type(field, "<script>alert(1)</script>")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(
      await screen.findByText(/✓ Success: Plan saved\./),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Go to My plans" }),
    ).toHaveAttribute("href", "/plans")
    expect(
      screen.queryByRole("button", { name: "Save plan" }),
    ).not.toBeInTheDocument()
    expect(saves(requests).map((request) => request.body)).toEqual([
      { generatedScheduleId: firstId, name: "<script>alert(1)</script>" },
    ])
  })

  it("offers Generate again for an expired schedule and keeps the name", async () => {
    let generations = 0
    let attempts = 0
    const { user, requests } = render(
      () =>
        ++attempts === 1
          ? jsonResponse(400, {
              errors: {
                generatedScheduleId: [
                  "Generate the schedule again to save it.",
                ],
              },
            })
          : jsonResponse(201, savedPlan),
      () =>
        jsonResponse(200, schedule(++generations === 1 ? firstId : secondId)),
    )
    const field = await openForm(user)
    await user.type(field, "Weekend")
    await user.click(screen.getByRole("button", { name: "Save" }))

    await user.click(
      await screen.findByRole("button", { name: "Generate again" }),
    )

    expect(await screen.findByLabelText("Plan name")).toHaveValue("Weekend")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await screen.findByText(/✓ Success: Plan saved\./)
    expect(saves(requests).map((request) => request.body)).toEqual([
      { generatedScheduleId: firstId, name: "Weekend" },
      { generatedScheduleId: secondId, name: "Weekend" },
    ])
  })

  it("shows a server error with Retry, which sends the same request", async () => {
    let attempts = 0
    const { user, requests } = render(() =>
      ++attempts === 1 ? jsonResponse(500) : jsonResponse(201, savedPlan),
    )
    const field = await openForm(user)
    await user.type(field, "Weekend")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(
      await screen.findByText(/Error: Plan could not be saved\. Try again\./),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Retry" }))

    await screen.findByText(/✓ Success: Plan saved\./)
    expect(saves(requests)).toHaveLength(2)
    expect(saves(requests)[1].body).toEqual(saves(requests)[0].body)
  })

  it("closes the form with Cancel without a request", async () => {
    const { user, requests } = render(() => jsonResponse(201, savedPlan))
    await openForm(user)

    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(screen.queryByLabelText("Plan name")).not.toBeInTheDocument()
    expect(saves(requests)).toEqual([])
  })

  it("closes the form with Escape and returns focus to Save plan", async () => {
    const { user, requests } = render(() => jsonResponse(201, savedPlan))
    await openForm(user)

    await user.keyboard("{Escape}")

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save plan" })).toHaveFocus(),
    )
    expect(screen.queryByLabelText("Plan name")).not.toBeInTheDocument()
    expect(saves(requests)).toEqual([])
  })
})
