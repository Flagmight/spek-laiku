import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import type {
  ActivityCategory,
  ActivityCategoryRequest,
} from "../types/activityCategory"
import { jsonResponse, renderApp, routeFetch, signedInUser } from "./renderApp"
import type { RecordedRequest } from "./renderApp"

const page = "/admin/categories"
const meRoute = "GET /api/auth/me"
const listRoute = "GET /api/admin/categories"
const createRoute = "POST /api/admin/categories"

function category(
  name: string,
  values: Partial<ActivityCategory> = {},
): ActivityCategory {
  return {
    id: `id-${name}`,
    name,
    type: "Indoor",
    defaultDurationHours: 2,
    requiresDaylight: false,
    maxWindMs: null,
    maxRainMmPerHour: null,
    minTemperatureC: null,
    maxTemperatureC: null,
    placeTags: ["tourism=museum"],
    version: 1,
    ...values,
  }
}

const museum = category("Museum")
const kayaking = category("Kayaking", {
  type: "Outdoor",
  requiresDaylight: true,
  maxWindMs: 8,
  maxRainMmPerHour: 0.5,
  minTemperatureC: 15,
  maxTemperatureC: 35,
  placeTags: ["leisure=slipway", "sport=canoe"],
})

const swimmingRequest: ActivityCategoryRequest = {
  name: "Swimming",
  type: "Outdoor",
  defaultDurationHours: 2,
  requiresDaylight: true,
  maxWindMs: 8,
  maxRainMmPerHour: 0.5,
  minTemperatureC: 18,
  maxTemperatureC: 35,
  placeTags: "leisure=bathing_place, sport=swimming",
}

const swimming = category("Swimming", {
  type: "Outdoor",
  requiresDaylight: true,
  maxWindMs: 8,
  maxRainMmPerHour: 0.5,
  minTemperatureC: 18,
  maxTemperatureC: 35,
  placeTags: ["leisure=bathing_place", "sport=swimming"],
})

const administrator = () => jsonResponse(200, signedInUser("Administrator"))

function stubList(categories: ActivityCategory[]) {
  return routeFetch({
    [meRoute]: administrator,
    [listRoute]: () => jsonResponse(200, categories),
  })
}

async function openCreateForm() {
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole("button", { name: "Create category" }),
  )
  return user
}

async function fillSwimming(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), "Swimming")
  await user.click(screen.getByRole("radio", { name: "Outdoor" }))
  await user.type(screen.getByLabelText("Default duration (h)"), "2")
  await user.type(screen.getByLabelText("Max wind (m/s)"), "8")
  await user.type(screen.getByLabelText("Max rain (mm/h)"), "0.5")
  await user.type(screen.getByLabelText("Min temperature (°C)"), "18")
  await user.type(screen.getByLabelText("Max temperature (°C)"), "35")
  await user.click(screen.getByRole("checkbox", { name: "Requires daylight" }))
  await user.type(
    screen.getByLabelText("Map place tags"),
    "leisure=bathing_place, sport=swimming",
  )
}

function saves(requests: RecordedRequest[]) {
  return requests.filter((request) => request.method === "POST")
}

describe("ActivityCategoriesPage", () => {
  beforeEach(() => {
    document.title = ""
  })

  it("sets the title and has one h1", async () => {
    stubList([])
    renderApp(page)

    await waitFor(() =>
      expect(document.title).toBe("Activity categories - Spėk laiku"),
    )
    const headings = await screen.findAllByRole("heading", { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent("Activity categories")
  })

  it("announces the list while it loads", async () => {
    routeFetch({
      [meRoute]: administrator,
      [listRoute]: () => new Promise<Response>(() => {}),
    })
    renderApp(page)

    const status = await screen.findByText("Loading activity categories…")
    expect(status.closest("[role=status]")).not.toBeNull()
  })

  it("lists the categories in API order with an Edit button each", async () => {
    stubList([museum, kayaking])
    renderApp(page)

    await screen.findByRole("button", { name: "Edit Museum" })
    const rows = within(
      screen.getByRole("list", { name: "Activity categories" }),
    ).getAllByRole("listitem")
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent("Museum")
    expect(rows[0]).toHaveTextContent("Indoor")
    expect(rows[1]).toHaveTextContent("Kayaking")
    expect(rows[1]).toHaveTextContent("Outdoor")
    expect(
      within(rows[1]).getByRole("button", { name: "Edit Kayaking" }),
    ).toHaveTextContent("Edit")
  })

  it("shows the empty state with a Create category button", async () => {
    stubList([])
    renderApp(page)

    expect(
      await screen.findByText("No categories yet. Create the first category."),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Create category" }),
    ).toBeInTheDocument()
  })

  it("shows a load error with Retry and no Create category button", async () => {
    let respond = () => jsonResponse(500)
    routeFetch({ [meRoute]: administrator, [listRoute]: () => respond() })
    renderApp(page)

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      "Error: Activity categories could not be loaded.",
    )
    expect(
      screen.queryByRole("button", { name: "Create category" }),
    ).not.toBeInTheDocument()

    respond = () => jsonResponse(200, [museum])
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }))

    expect(
      await screen.findByRole("button", { name: "Edit Museum" }),
    ).toBeInTheDocument()
  })

  it("opens an empty create form with its heading focused", async () => {
    stubList([museum])
    renderApp(page)

    await openCreateForm()

    const heading = screen.getByRole("heading", { name: "Create category" })
    expect(heading).toHaveFocus()
    expect(screen.getByLabelText("Name")).toHaveValue("")
    expect(screen.getByRole("radio", { name: "Indoor" })).not.toBeChecked()
    expect(screen.getByRole("radio", { name: "Outdoor" })).not.toBeChecked()
    expect(
      screen.getByRole("checkbox", { name: "Requires daylight" }),
    ).not.toBeChecked()
  })

  it("shows the weather fields only for Outdoor", async () => {
    stubList([])
    renderApp(page)
    const user = await openCreateForm()
    const weatherLabels = [
      "Max wind (m/s)",
      "Max rain (mm/h)",
      "Min temperature (°C)",
      "Max temperature (°C)",
    ]

    await user.click(screen.getByRole("radio", { name: "Outdoor" }))
    for (const label of weatherLabels) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }

    await user.click(screen.getByRole("radio", { name: "Indoor" }))
    for (const label of weatherLabels) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument()
    }
  })

  it("announces saving and disables Save while the save is pending", async () => {
    routeFetch({
      [meRoute]: administrator,
      [listRoute]: () => jsonResponse(200, []),
      [createRoute]: () => new Promise<Response>(() => {}),
    })
    renderApp(page)
    const user = await openCreateForm()
    await fillSwimming(user)

    await user.click(screen.getByRole("button", { name: "Save" }))

    const status = await screen.findByText("Saving category…")
    expect(status.closest("[role=status]")).not.toBeNull()
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  it("saves Swimming, shows the banner, closes the form and lists it", async () => {
    let categories = [museum]
    const { requests } = routeFetch({
      [meRoute]: administrator,
      [listRoute]: () => jsonResponse(200, categories),
      [createRoute]: () => {
        categories = [museum, swimming]
        return jsonResponse(201, swimming)
      },
    })
    renderApp(page)
    const user = await openCreateForm()
    await fillSwimming(user)

    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(
      await screen.findByText("✓ Success: Category saved."),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Create category" }),
    ).not.toBeInTheDocument()
    expect(
      await screen.findByRole("button", { name: "Edit Swimming" }),
    ).toBeInTheDocument()
    expect(saves(requests)[0].body).toEqual(swimmingRequest)
  })

  it("sends null limits for an Indoor category", async () => {
    const { requests } = routeFetch({
      [meRoute]: administrator,
      [listRoute]: () => jsonResponse(200, []),
      [createRoute]: () => jsonResponse(201, museum),
    })
    renderApp(page)
    const user = await openCreateForm()
    await user.type(screen.getByLabelText("Name"), "Gallery")
    await user.click(screen.getByRole("radio", { name: "Outdoor" }))
    await user.type(screen.getByLabelText("Max wind (m/s)"), "8")
    await user.click(screen.getByRole("radio", { name: "Indoor" }))
    await user.type(screen.getByLabelText("Default duration (h)"), "1.5")
    await user.type(screen.getByLabelText("Map place tags"), "tourism=gallery")

    await user.click(screen.getByRole("button", { name: "Save" }))

    await screen.findByText("✓ Success: Category saved.")
    expect(saves(requests)[0].body).toEqual({
      name: "Gallery",
      type: "Indoor",
      defaultDurationHours: 1.5,
      requiresDaylight: false,
      maxWindMs: null,
      maxRainMmPerHour: null,
      minTemperatureC: null,
      maxTemperatureC: null,
      placeTags: "tourism=gallery",
    })
  })

  it("keeps every value after a server error and Retry sends the same body", async () => {
    let respond = () => jsonResponse(500)
    const { requests } = routeFetch({
      [meRoute]: administrator,
      [listRoute]: () => jsonResponse(200, []),
      [createRoute]: () => respond(),
    })
    renderApp(page)
    const user = await openCreateForm()
    await fillSwimming(user)

    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Error: Something went wrong. Try again.",
    )
    expect(screen.getByLabelText("Name")).toHaveValue("Swimming")
    expect(screen.getByRole("radio", { name: "Outdoor" })).toBeChecked()
    expect(screen.getByLabelText("Max rain (mm/h)")).toHaveValue("0.5")
    expect(
      screen.getByRole("checkbox", { name: "Requires daylight" }),
    ).toBeChecked()
    expect(screen.getByLabelText("Map place tags")).toHaveValue(
      "leisure=bathing_place, sport=swimming",
    )

    respond = () => jsonResponse(201, swimming)
    await user.click(screen.getByRole("button", { name: "Retry" }))

    await screen.findByText("✓ Success: Category saved.")
    expect(saves(requests)).toHaveLength(2)
    expect(saves(requests)[1].body).toEqual(saves(requests)[0].body)
  })

  it("closes the form on Cancel without a request", async () => {
    const { requests } = stubList([museum])
    renderApp(page)
    const user = await openCreateForm()
    await user.type(screen.getByLabelText("Name"), "Swimming")

    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(
      screen.queryByRole("heading", { name: "Create category" }),
    ).not.toBeInTheDocument()
    expect(saves(requests)).toHaveLength(0)
  })

  it("sends a number typed with a comma as null", async () => {
    const { requests } = routeFetch({
      [meRoute]: administrator,
      [listRoute]: () => jsonResponse(200, []),
      [createRoute]: () =>
        jsonResponse(400, {
          errors: {
            defaultDurationHours: [
              "Enter a duration between 0.5 and 12 hours.",
            ],
          },
        }),
    })
    renderApp(page)
    const user = await openCreateForm()
    await user.type(screen.getByLabelText("Default duration (h)"), "2,5")

    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(saves(requests)).toHaveLength(1))
    expect(saves(requests)[0].body).toMatchObject({
      defaultDurationHours: null,
    })
  })
})
