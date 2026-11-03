import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import type { ActivityCategory } from "../types/activityCategory"
import {
  jsonResponse,
  renderAppWithLocation,
  routeFetch,
  signedInUser,
} from "./renderApp"

const page = "/admin/categories"
const administrator = signedInUser("Administrator")

const museum: ActivityCategory = {
  id: "id-museum",
  name: "Museum",
  type: "Indoor",
  defaultDurationHours: 2,
  requiresDaylight: false,
  maxWindMs: null,
  maxRainMmPerHour: null,
  minTemperatureC: null,
  maxTemperatureC: null,
  placeTags: ["tourism=museum"],
  version: 1,
}

async function saveMuseumEdit() {
  const user = userEvent.setup()
  await user.click(await screen.findByRole("button", { name: "Edit Museum" }))
  await user.click(screen.getByRole("button", { name: "Save" }))
  return user
}

describe("Category save when the session or role changed", () => {
  it("sends the administrator to log in on 401 and back to the page afterwards", async () => {
    let signedIn = true
    routeFetch({
      "GET /api/auth/me": () =>
        signedIn ? jsonResponse(200, administrator) : jsonResponse(401),
      "GET /api/admin/categories": () => jsonResponse(200, [museum]),
      [`PUT /api/admin/categories/${museum.id}`]: () => {
        // The session ended on the server, for example after 30 minutes without activity.
        signedIn = false
        return jsonResponse(401)
      },
      "POST /api/auth/login": () => {
        signedIn = true
        return jsonResponse(200, administrator)
      },
    })
    const { currentLocation } = renderAppWithLocation(page)

    const user = await saveMuseumEdit()

    expect(
      await screen.findByText("Your session has expired. Log in again."),
    ).toBeInTheDocument()
    expect(currentLocation()).toBe("/login?returnTo=%2Fadmin%2Fcategories")

    await user.type(screen.getByLabelText("Email"), administrator.email)
    await user.type(screen.getByLabelText("Password"), "Password123!")
    await user.click(screen.getByRole("button", { name: "Log in" }))

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Activity categories",
      }),
    ).toBeInTheDocument()
    expect(currentLocation()).toBe(page)
  })

  it("shows Access denied on 403 when the account is no longer an administrator", async () => {
    let role = "Administrator"
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(200, signedInUser(role)),
      "GET /api/admin/categories": () => jsonResponse(200, [museum]),
      [`PUT /api/admin/categories/${museum.id}`]: () => {
        role = "Registered User"
        return jsonResponse(403)
      },
    })
    const { currentLocation } = renderAppWithLocation(page)

    await saveMuseumEdit()

    expect(
      await screen.findByRole("heading", { level: 1, name: "Access denied" }),
    ).toBeInTheDocument()
    expect(currentLocation()).toBe(page)
  })
})
