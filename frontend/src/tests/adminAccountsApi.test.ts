import { describe, expect, it } from "vitest"
import { listAccounts, setAccountStatus } from "../api/adminAccountsApi"
import { ApiError } from "../api/apiClient"
import { accountList, activeUser, withStatus } from "./adminAccountsFixtures"
import { jsonResponse, routeFetch } from "./renderApp"

describe("listAccounts", () => {
  it("sends no query string for an empty search", async () => {
    const { requests } = routeFetch({
      "GET /api/admin/accounts": () => jsonResponse(200, accountList()),
    })

    await expect(listAccounts("")).resolves.toEqual({
      kind: "loaded",
      list: accountList(),
    })
    expect(requests).toHaveLength(1)
  })

  it("URL-encodes the search", async () => {
    routeFetch({
      "GET /api/admin/accounts?search=ana%26bob%40x": () =>
        jsonResponse(200, accountList([activeUser], true)),
    })

    await expect(listAccounts("ana&bob@x")).resolves.toEqual({
      kind: "loaded",
      list: accountList([activeUser], true),
    })
  })

  it("returns the server's message for a refused search", async () => {
    routeFetch({
      "GET /api/admin/accounts?search=x": () =>
        jsonResponse(400, {
          errors: { search: ["Search text can be at most 256 characters."] },
        }),
    })

    await expect(listAccounts("x")).resolves.toEqual({
      kind: "invalidSearch",
      message: "Search text can be at most 256 characters.",
    })
  })

  it.each([400, 401, 403, 500])(
    "throws ApiError for status %i without a search message",
    async (status) => {
      routeFetch({
        "GET /api/admin/accounts": () => jsonResponse(status, {}),
      })

      await expect(listAccounts("")).rejects.toEqual(new ApiError(status))
    },
  )
})

describe("setAccountStatus", () => {
  it("sends the status and returns the changed account", async () => {
    const suspended = withStatus(activeUser, "Suspended")
    const { requests } = routeFetch({
      [`PUT /api/admin/accounts/${activeUser.id}/status`]: () =>
        jsonResponse(200, suspended),
    })

    await expect(setAccountStatus(activeUser.id, "Suspended")).resolves.toEqual(
      { kind: "changed", account: suspended },
    )
    expect(requests[0]?.body).toEqual({ accountStatus: "Suspended" })
  })

  it("URL-encodes the id", async () => {
    routeFetch({
      "PUT /api/admin/accounts/a%2Fb/status": () =>
        jsonResponse(200, activeUser),
    })

    await expect(setAccountStatus("a/b", "Active")).resolves.toMatchObject({
      kind: "changed",
    })
  })

  it.each([
    [401, "sessionEnded"],
    [403, "forbidden"],
    [404, "gone"],
    [409, "administrator"],
  ])("maps status %i to %s", async (status, kind) => {
    routeFetch({
      [`PUT /api/admin/accounts/${activeUser.id}/status`]: () =>
        jsonResponse(status, {}),
    })

    await expect(setAccountStatus(activeUser.id, "Suspended")).resolves.toEqual(
      { kind },
    )
  })

  it.each([400, 500])("throws ApiError for status %i", async (status) => {
    routeFetch({
      [`PUT /api/admin/accounts/${activeUser.id}/status`]: () =>
        jsonResponse(status, {}),
    })

    await expect(setAccountStatus(activeUser.id, "Active")).rejects.toEqual(
      new ApiError(status),
    )
  })
})
