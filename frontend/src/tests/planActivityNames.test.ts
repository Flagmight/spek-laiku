import { describe, expect, it } from "vitest"
import { planActivityNames } from "../helpers/planActivityNames"

const cycling1 = { id: "a", categoryId: "cycling", name: "Cycling" }
const picnic = { id: "b", categoryId: "picnic", name: "Picnic" }
const cycling2 = { id: "c", categoryId: "cycling", name: "Cycling" }

describe("planActivityNames", () => {
  it("returns nothing for no activities", () => {
    expect(planActivityNames([])).toEqual({})
  })

  it("uses the plain name when the category appears once", () => {
    expect(planActivityNames([cycling1])).toEqual({ a: "Cycling" })
  })

  it("numbers a repeated category in list order and leaves the others alone", () => {
    expect(planActivityNames([cycling1, picnic, cycling2])).toEqual({
      a: "Cycling 1",
      b: "Picnic",
      c: "Cycling 2",
    })
  })

  it("goes back to the plain name after the other one is removed", () => {
    expect(planActivityNames([picnic, cycling2])).toEqual({
      b: "Picnic",
      c: "Cycling",
    })
  })

  it("numbers two categories with the same name separately by id", () => {
    const otherCycling = { id: "d", categoryId: "other", name: "Cycling" }

    expect(planActivityNames([cycling1, otherCycling, cycling2])).toEqual({
      a: "Cycling 1",
      d: "Cycling",
      c: "Cycling 2",
    })
  })
})
