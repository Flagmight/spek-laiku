import { describe, expect, it } from "vitest"
import { deleteAccount } from "../api/accountApi"
import { ApiError } from "../api/apiClient"
import { jsonResponse, routeFetch } from "./renderApp"

const route = "POST /api/account/delete"

// POST /api/account/delete (feature 016 contracts/account-deletion-api.md).
describe("deleteAccount", () => {
  it("posts the password exactly as entered and returns deleted on 204", async () => {
    const { requests } = routeFetch({ [route]: () => jsonResponse(204) })

    await expect(deleteAccount("  spaced  ")).resolves.toEqual({
      kind: "deleted",
    })
    expect(requests).toEqual([
      {
        method: "POST",
        path: "/api/account/delete",
        body: { password: "  spaced  " },
      },
    ])
  })

  it.each(["Enter your password.", "Password is incorrect."])(
    "returns the server's message %s for a 400",
    async (message) => {
      routeFetch({
        [route]: () => jsonResponse(400, { errors: { password: [message] } }),
      })

      await expect(deleteAccount("x")).resolves.toEqual({
        kind: "invalid",
        message,
      })
    },
  )

  it("throws ApiError for a 400 without a password message", async () => {
    routeFetch({
      [route]: () =>
        jsonResponse(400, { errors: { request: ["The request is invalid."] } }),
    })

    await expect(deleteAccount("x")).rejects.toEqual(new ApiError(400))
  })

  it.each([
    [429, "locked"],
    [401, "signedOut"],
    [403, "forbidden"],
  ] as const)("maps %i to %s", async (status, kind) => {
    routeFetch({ [route]: () => jsonResponse(status) })

    await expect(deleteAccount("x")).resolves.toEqual({ kind })
  })

  it.each([404, 500, 503])("throws ApiError for status %i", async (status) => {
    routeFetch({ [route]: () => jsonResponse(status, {}) })

    await expect(deleteAccount("x")).rejects.toEqual(new ApiError(status))
  })
})
