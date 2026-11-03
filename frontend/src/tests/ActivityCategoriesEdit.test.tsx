import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import type { ActivityCategory } from "../types/activityCategory"
import { jsonResponse, renderApp, routeFetch, signedInUser } from "./renderApp"
import type { RecordedRequest } from "./renderApp"

const page = "/admin/categories"
const meRoute = "GET /api/auth/me"
const listRoute = "GET /api/admin/categories"
const conflictMessage =
  "Error: This category was changed by someone else. Reload it and try again."

function category(
  name: string,
  values: Partial<ActivityCategory> = {},
): ActivityCategory {
  return {
    id: `id-${name.toLowerCase().replace(/ /g, "-")}`,
    name,
    type: "Outdoor",
    defaultDurationHours: 2,
    requiresDaylight: true,
    maxWindMs: 8,
    maxRainMmPerHour: 0.5,
    minTemperatureC: 15,
    maxTemperatureC: 35,
    placeTags: ["leisure=slipway", "sport=canoe"],
    version: 1042,
    ...values,
  }
}

const kayaking = category("Kayaking")
const museum = category("Museum", {
  type: "Indoor",
  requiresDaylight: false,
  maxWindMs: null,
  maxRainMmPerHour: null,
  minTemperatureC: null,
  maxTemperatureC: null,
  placeTags: ["tourism=museum"],
})

const updateKayaking = `PUT /api/admin/categories/${kayaking.id}`

function puts(requests: RecordedRequest[]) {
  return requests.filter((request) => request.method === "PUT")
}

async function openEdit(name: string) {
  const user = userEvent.setup()
  await user.click(await screen.findByRole("button", { name: `Edit ${name}` }))
  return user
}

describe("Editing an activity category", () => {
  it("opens the form with the heading focused and every stored value", async () => {
    routeFetch({
      [meRoute]: () => jsonResponse(200, signedInUser("Administrator")),
      [listRoute]: () => jsonResponse(200, [kayaking, museum]),
    })
    renderApp(page)

    await openEdit("Kayaking")

    expect(screen.getByRole("heading", { name: "Edit Kayaking" })).toHaveFocus()
    expect(screen.getByLabelText("Name")).toHaveValue("Kayaking")
    expect(screen.getByRole("radio", { name: "Outdoor" })).toBeChecked()
    expect(screen.getByLabelText("Default duration (h)")).toHaveValue("2")
    expect(screen.getByLabelText("Max wind (m/s)")).toHaveValue("8")
    expect(screen.getByLabelText("Max rain (mm/h)")).toHaveValue("0.5")
    expect(screen.getByLabelText("Min temperature (°C)")).toHaveValue("15")
    expect(screen.getByLabelText("Max temperature (°C)")).toHaveValue("35")
    expect(
      screen.getByRole("checkbox", { name: "Requires daylight" }),
    ).toBeChecked()
    expect(screen.getByLabelText("Map place tags")).toHaveValue(
      "leisure=slipway, sport=canoe",
    )
  })

  it("saves changed values, shows the banner, closes the form and shows the new list", async () => {
    const updated = { ...kayaking, maxWindMs: 6, version: 1043 }
    let categories = [kayaking]
    const { requests } = routeFetch({
      [meRoute]: () => jsonResponse(200, signedInUser("Administrator")),
      [listRoute]: () => jsonResponse(200, categories),
      [updateKayaking]: () => {
        categories = [updated]
        return jsonResponse(200, updated)
      },
    })
    renderApp(page)
    const user = await openEdit("Kayaking")
    const wind = screen.getByLabelText("Max wind (m/s)")
    await user.clear(wind)
    await user.type(wind, "6")
    const tags = screen.getByLabelText("Map place tags")
    await user.clear(tags)
    await user.type(tags, "leisure=slipway")

    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(
      await screen.findByText("✓ Success: Category saved."),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Edit Kayaking" }),
    ).not.toBeInTheDocument()
    expect(puts(requests)[0].body).toEqual({
      name: "Kayaking",
      type: "Outdoor",
      defaultDurationHours: 2,
      requiresDaylight: true,
      maxWindMs: 6,
      maxRainMmPerHour: 0.5,
      minTemperatureC: 15,
      maxTemperatureC: 35,
      placeTags: "leisure=slipway",
      version: 1042,
    })

    // Reopening shows the stored values from the reloaded list.
    await openEdit("Kayaking")
    expect(screen.getByLabelText("Max wind (m/s)")).toHaveValue("6")
  })

  it("hides the weather fields and sends null limits after Outdoor → Indoor", async () => {
    const { requests } = routeFetch({
      [meRoute]: () => jsonResponse(200, signedInUser("Administrator")),
      [listRoute]: () => jsonResponse(200, [kayaking]),
      [updateKayaking]: () => jsonResponse(200, kayaking),
    })
    renderApp(page)
    const user = await openEdit("Kayaking")

    await user.click(screen.getByRole("radio", { name: "Indoor" }))
    expect(screen.queryByLabelText("Max wind (m/s)")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Save" }))

    await screen.findByText("✓ Success: Category saved.")
    expect(puts(requests)[0].body).toMatchObject({
      type: "Indoor",
      maxWindMs: null,
      maxRainMmPerHour: null,
      minTemperatureC: null,
      maxTemperatureC: null,
    })
  })

  it("shows the weather fields empty after Indoor → Outdoor", async () => {
    routeFetch({
      [meRoute]: () => jsonResponse(200, signedInUser("Administrator")),
      [listRoute]: () => jsonResponse(200, [museum]),
    })
    renderApp(page)
    const user = await openEdit("Museum")

    await user.click(screen.getByRole("radio", { name: "Outdoor" }))

    for (const label of [
      "Max wind (m/s)",
      "Max rain (mm/h)",
      "Min temperature (°C)",
      "Max temperature (°C)",
    ]) {
      expect(screen.getByLabelText(label)).toHaveValue("")
    }
  })

  it("closes the form on Cancel without a request", async () => {
    const { requests } = routeFetch({
      [meRoute]: () => jsonResponse(200, signedInUser("Administrator")),
      [listRoute]: () => jsonResponse(200, [kayaking]),
    })
    renderApp(page)
    const user = await openEdit("Kayaking")

    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(
      screen.queryByRole("heading", { name: "Edit Kayaking" }),
    ).not.toBeInTheDocument()
    expect(puts(requests)).toHaveLength(0)
  })

  it("on a conflict keeps the typed values, and Reload shows the stored ones and saves with their version", async () => {
    const stored = { ...kayaking, maxWindMs: 10, version: 2000 }
    let respond = () => jsonResponse(409)
    const { requests } = routeFetch({
      [meRoute]: () => jsonResponse(200, signedInUser("Administrator")),
      [listRoute]: () => jsonResponse(200, [kayaking]),
      [updateKayaking]: () => respond(),
      [`GET /api/admin/categories/${kayaking.id}`]: () =>
        jsonResponse(200, stored),
    })
    renderApp(page)
    const user = await openEdit("Kayaking")
    const wind = screen.getByLabelText("Max wind (m/s)")
    await user.clear(wind)
    await user.type(wind, "6")

    await user.click(screen.getByRole("button", { name: "Save" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(conflictMessage)
    const form = screen.getByRole("region", { name: "Edit Kayaking" })
    // The message is at the top of the form, before the first field.
    expect(
      alert.compareDocumentPosition(within(form).getByLabelText("Name")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByLabelText("Max wind (m/s)")).toHaveValue("6")

    await user.click(within(alert).getByRole("button", { name: "Reload" }))

    await waitFor(() =>
      expect(screen.getByLabelText("Max wind (m/s)")).toHaveValue("10"),
    )
    expect(screen.queryByText(conflictMessage)).not.toBeInTheDocument()

    respond = () => jsonResponse(200, stored)
    await user.click(screen.getByRole("button", { name: "Save" }))

    await screen.findByText("✓ Success: Category saved.")
    expect(puts(requests)[1].body).toMatchObject({ maxWindMs: 10, version: 2000 })
  })

  it("on 404 keeps the form open with the server error and reloads the list", async () => {
    let categories = [kayaking]
    routeFetch({
      [meRoute]: () => jsonResponse(200, signedInUser("Administrator")),
      [listRoute]: () => jsonResponse(200, categories),
      [updateKayaking]: () => {
        categories = []
        return jsonResponse(404)
      },
    })
    renderApp(page)
    const user = await openEdit("Kayaking")

    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Error: Something went wrong. Try again.",
    )
    expect(
      await screen.findByText("No categories yet. Create the first category."),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Edit Kayaking" }),
    ).toBeInTheDocument()
  })

  it("replaces an open form when another category or Create category is selected", async () => {
    routeFetch({
      [meRoute]: () => jsonResponse(200, signedInUser("Administrator")),
      [listRoute]: () => jsonResponse(200, [kayaking, museum]),
    })
    renderApp(page)
    const user = await openEdit("Kayaking")
    await user.type(screen.getByLabelText("Name"), " changed")

    await user.click(screen.getByRole("button", { name: "Edit Museum" }))

    expect(screen.getByRole("heading", { name: "Edit Museum" })).toHaveFocus()
    expect(screen.getByLabelText("Name")).toHaveValue("Museum")
    expect(
      screen.queryByRole("heading", { name: "Edit Kayaking" }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Create category" }))

    expect(screen.getByRole("heading", { name: "Create category" })).toHaveFocus()
    expect(screen.getByLabelText("Name")).toHaveValue("")
  })

  it("lists the five starter categories in alphabetical order", async () => {
    const starters = [
      category("Cycling"),
      category("Heritage site"),
      category("Kayaking"),
      museum,
      category("Picnic"),
    ]
    routeFetch({
      [meRoute]: () => jsonResponse(200, signedInUser("Administrator")),
      [listRoute]: () => jsonResponse(200, starters),
    })
    renderApp(page)

    await screen.findByRole("button", { name: "Edit Cycling" })
    const names = within(
      screen.getByRole("list", { name: "Activity categories" }),
    )
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"))
    expect(names).toEqual([
      "Edit Cycling",
      "Edit Heritage site",
      "Edit Kayaking",
      "Edit Museum",
      "Edit Picnic",
    ])
  })
})
