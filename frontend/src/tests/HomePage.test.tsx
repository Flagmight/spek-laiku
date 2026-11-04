import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { jsonResponse, renderApp, stubFetch } from "./renderApp"

describe("HomePage", () => {
  beforeEach(() => {
    stubFetch(() => jsonResponse(401))
    document.title = ""
  })

  it("sets the tab title to 'Home - Spėk laiku'", async () => {
    renderApp("/")

    await waitFor(() => expect(document.title).toBe("Home - Spėk laiku"))
  })

  it("has exactly one h1, 'Spėk laiku'", async () => {
    renderApp("/")

    await screen.findByRole("heading", { level: 1 })
    const headings = screen.getAllByRole("heading", { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent("Spėk laiku")
  })
})

describe("HomePage Create plan button", () => {
  it("takes a visitor to the Plan setup page", async () => {
    stubFetch(() => jsonResponse(401))
    const user = userEvent.setup()
    renderApp("/")

    const createPlan = await within(screen.getByRole("main")).findByRole(
      "link",
      { name: "Create plan" },
    )
    expect(createPlan).toHaveAttribute("href", "/plan/setup")
    await user.click(createPlan)

    expect(
      await screen.findByRole("heading", { level: 1, name: "Plan setup" }),
    ).toBeInTheDocument()
  })
})
