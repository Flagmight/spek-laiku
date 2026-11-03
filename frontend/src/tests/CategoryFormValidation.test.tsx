import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { jsonResponse, renderApp, routeFetch, signedInUser } from "./renderApp"

const page = "/admin/categories"
const nameMessage = "Enter a category name."
const typeMessage = "Select a type."
const durationMessage = "Enter a duration between 0.5 and 12 hours."
const tagsMessage =
  "Enter tags in the form key=value, for example leisure=slipway."

// Answers every save with the given field errors, as the server does for a 400.
function stubInvalidSave(errors: Record<string, string[]>) {
  return routeFetch({
    "GET /api/auth/me": () => jsonResponse(200, signedInUser("Administrator")),
    "GET /api/admin/categories": () => jsonResponse(200, []),
    "POST /api/admin/categories": () =>
      jsonResponse(400, {
        title: "One or more request fields are invalid.",
        errors,
      }),
  })
}

async function openCreateForm() {
  renderApp(page)
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole("button", { name: "Create category" }),
  )
  return user
}

async function save(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Save" }))
  await screen.findAllByText(/^Error: /)
}

// The text of every element that describes the element, in order.
function descriptions(element: HTMLElement) {
  return (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent)
}

describe("Category form validation", () => {
  it("shows each message next to its field and a summary whose links focus the fields", async () => {
    stubInvalidSave({
      name: [nameMessage],
      type: [typeMessage],
      defaultDurationHours: [durationMessage],
      placeTags: [tagsMessage],
    })
    const user = await openCreateForm()

    await save(user)

    expect(descriptions(screen.getByLabelText("Name"))).toContain(
      `Error: ${nameMessage}`,
    )
    expect(descriptions(screen.getByRole("group", { name: "Type" }))).toContain(
      `Error: ${typeMessage}`,
    )
    expect(
      descriptions(screen.getByLabelText("Default duration (h)")),
    ).toContain(`Error: ${durationMessage}`)
    expect(descriptions(screen.getByLabelText("Map place tags"))).toContain(
      `Error: ${tagsMessage}`,
    )

    const summary = screen.getByRole("alert", { name: "Error summary" })
    const links = within(summary).getAllByRole("link")
    expect(links.map((link) => link.textContent)).toEqual([
      `Error: ${nameMessage}`,
      `Error: ${typeMessage}`,
      `Error: ${durationMessage}`,
      `Error: ${tagsMessage}`,
    ])

    await user.click(links[1])
    expect(screen.getByRole("radio", { name: "Indoor" })).toHaveFocus()
    await user.click(links[3])
    expect(screen.getByLabelText("Map place tags")).toHaveFocus()
  })

  it("moves focus to the first invalid field", async () => {
    stubInvalidSave({
      defaultDurationHours: [durationMessage],
      placeTags: [tagsMessage],
    })
    const user = await openCreateForm()

    await save(user)

    expect(screen.getByLabelText("Default duration (h)")).toHaveFocus()
  })

  it("shows no summary for a single field error", async () => {
    stubInvalidSave({ name: ["A category with this name already exists."] })
    const user = await openCreateForm()
    await user.type(screen.getByLabelText("Name"), "kayaking")

    await save(user)

    expect(descriptions(screen.getByLabelText("Name"))).toContain(
      "Error: A category with this name already exists.",
    )
    expect(
      screen.queryByRole("alert", { name: "Error summary" }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText("Name")).toHaveFocus()
  })

  it("shows the temperature order message next to the minimum temperature", async () => {
    stubInvalidSave({
      minTemperatureC: [
        "Minimum temperature must be lower than maximum temperature.",
      ],
    })
    const user = await openCreateForm()
    await user.click(screen.getByRole("radio", { name: "Outdoor" }))

    await save(user)

    expect(
      descriptions(screen.getByLabelText("Min temperature (°C)")),
    ).toContain(
      "Error: Minimum temperature must be lower than maximum temperature.",
    )
    expect(screen.getByLabelText("Max temperature (°C)")).not.toHaveAttribute(
      "aria-invalid",
    )
  })

  it("keeps every typed value", async () => {
    stubInvalidSave({
      maxWindMs: ["Enter a wind limit between 0 and 30 m/s."],
      placeTags: [tagsMessage],
    })
    const user = await openCreateForm()
    await user.type(screen.getByLabelText("Name"), "Swimming")
    await user.click(screen.getByRole("radio", { name: "Outdoor" }))
    await user.type(screen.getByLabelText("Default duration (h)"), "2")
    await user.type(screen.getByLabelText("Max wind (m/s)"), "31")
    await user.type(screen.getByLabelText("Max rain (mm/h)"), "0.5")
    await user.click(
      screen.getByRole("checkbox", { name: "Requires daylight" }),
    )
    await user.type(screen.getByLabelText("Map place tags"), "slipway")

    await save(user)

    expect(screen.getByLabelText("Name")).toHaveValue("Swimming")
    expect(screen.getByRole("radio", { name: "Outdoor" })).toBeChecked()
    expect(screen.getByLabelText("Default duration (h)")).toHaveValue("2")
    expect(screen.getByLabelText("Max wind (m/s)")).toHaveValue("31")
    expect(screen.getByLabelText("Max rain (mm/h)")).toHaveValue("0.5")
    expect(
      screen.getByRole("checkbox", { name: "Requires daylight" }),
    ).toBeChecked()
    expect(screen.getByLabelText("Map place tags")).toHaveValue("slipway")
    expect(screen.getByLabelText("Max wind (m/s)")).toHaveFocus()
  })

  it("marks invalid inputs and describes them by their hint and error", async () => {
    stubInvalidSave({
      maxWindMs: ["Enter a wind limit between 0 and 30 m/s."],
      placeTags: [tagsMessage],
    })
    const user = await openCreateForm()
    await user.click(screen.getByRole("radio", { name: "Outdoor" }))

    await save(user)

    const wind = screen.getByLabelText("Max wind (m/s)")
    expect(wind).toHaveAttribute("aria-invalid", "true")
    expect(descriptions(wind)).toEqual([
      "0 to 30",
      "Error: Enter a wind limit between 0 and 30 m/s.",
    ])
    const tags = screen.getByLabelText("Map place tags")
    expect(tags).toHaveAttribute("aria-invalid", "true")
    expect(descriptions(tags)).toEqual([
      "key=value pairs separated by commas, for example leisure=slipway",
      `Error: ${tagsMessage}`,
    ])
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-invalid")
  })

  it("links the Type error to its fieldset", async () => {
    stubInvalidSave({ type: [typeMessage] })
    const user = await openCreateForm()

    await save(user)

    const fieldset = screen.getByRole("group", { name: "Type" })
    expect(fieldset).toHaveAttribute("aria-invalid", "true")
    expect(descriptions(fieldset)).toEqual([`Error: ${typeMessage}`])
    expect(screen.getByRole("radio", { name: "Indoor" })).toHaveFocus()
  })
})
