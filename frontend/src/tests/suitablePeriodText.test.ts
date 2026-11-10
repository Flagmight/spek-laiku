import { describe, expect, it } from "vitest"
import { suitablePeriodText } from "../helpers/suitablePeriodText"

describe("suitablePeriodText", () => {
  it("shows the times and length of a period that is long enough", () => {
    expect(
      suitablePeriodText(
        {
          start: "10:00",
          end: "14:00",
          lengthHours: 4,
          shorterThanDuration: false,
        },
        2,
      ),
    ).toBe("★ Suitable 10:00–14:00 (4 h)")
  })

  it("adds the activity's duration to a period the server marked as too short", () => {
    expect(
      suitablePeriodText(
        {
          start: "10:00",
          end: "11:00",
          lengthHours: 1,
          shorterThanDuration: true,
        },
        2,
      ),
    ).toBe("★ Suitable 10:00–11:00 (1 h), shorter than this activity's 2 h")
  })

  it("shows a half-hour duration with its decimal", () => {
    expect(
      suitablePeriodText(
        {
          start: "20:00",
          end: "21:00",
          lengthHours: 1,
          shorterThanDuration: true,
        },
        1.5,
      ),
    ).toBe("★ Suitable 20:00–21:00 (1 h), shorter than this activity's 1.5 h")
  })
})
