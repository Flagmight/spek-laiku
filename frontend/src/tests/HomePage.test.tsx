import { screen, waitFor } from "@testing-library/react"
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
