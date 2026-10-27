import { describe, expect, it } from "vitest"
import { safeReturnTo } from "../helpers/safeReturnTo"

describe("safeReturnTo", () => {
  it.each(["/plans", "/plans/3?tab=a"])("accepts %s", (value) => {
    expect(safeReturnTo(value)).toBe(value)
  })

  it.each([
    null,
    "",
    "plans",
    "//evil.example",
    "/\\evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "/login",
    "/login?x=1",
    "/register",
    "/account-suspended",
  ])("rejects %s", (value) => {
    expect(safeReturnTo(value)).toBeNull()
  })
})
