import { describe, expect, it } from "vitest"
import {
  checkedNoteText,
  planCheckSummaryText,
  planProblemItemText,
  planProblemText,
  planProblems,
} from "../helpers/planProblemText"
import type { PlanCheckEntry } from "../types/planCheck"
import { problem } from "./savedPlansFixtures"

function entry(overrides: Partial<PlanCheckEntry> = {}): PlanCheckEntry {
  return {
    date: "2026-11-21",
    startTime: "10:00",
    endTime: "12:00",
    activityName: "Kayaking",
    past: false,
    weather: null,
    problems: [],
    ...overrides,
  }
}

const wind = problem("wind", { time: "11:00", value: 9, limit: 8 })

describe("planProblemText", () => {
  it("words each weather limit as in spec User Story 3", () => {
    expect(planProblemText(wind)).toBe(
      "Wind up to 9 m/s at 11:00, more than your limit of 8 m/s.",
    )
    expect(
      planProblemText(problem("rain", { time: "13:00", value: 1.4, limit: 1 })),
    ).toBe("Rain up to 1.4 mm/h at 13:00, more than your limit of 1 mm/h.")
    expect(
      planProblemText(
        problem("cold", { time: "08:00", value: -2.5, limit: 0 }),
      ),
    ).toBe("Temperature down to -2.5 °C at 08:00, below your minimum of 0 °C.")
    expect(
      planProblemText(problem("heat", { time: "15:00", value: 33, limit: 30 })),
    ).toBe("Temperature up to 33 °C at 15:00, above your maximum of 30 °C.")
  })

  it("words a missing forecast hour", () => {
    expect(planProblemText(problem("noForecast", { time: "11:00" }))).toBe(
      "No forecast for 11:00.",
    )
  })

  it("words a start before sunrise with both times", () => {
    expect(
      planProblemText(
        problem("beforeSunrise", { time: "07:00", sunTime: "07:42" }),
      ),
    ).toBe("Starts at 07:00, before sunrise at 07:42.")
  })

  it("words an end after sunset with both times", () => {
    expect(
      planProblemText(
        problem("afterSunset", { time: "17:00", sunTime: "16:05" }),
      ),
    ).toBe("Ends at 17:00, after sunset at 16:05.")
  })

  it("words an overlap with the other activity and its time", () => {
    expect(
      planProblemText(
        problem("overlap", {
          otherActivityName: "Museum",
          otherStartTime: "11:00",
          otherEndTime: "13:00",
        }),
      ),
    ).toBe("Overlaps with Museum (11:00–13:00).")
  })

  it("words a trip over the limit, with the distance to one decimal place", () => {
    expect(
      planProblemText(
        problem("travel", {
          value: 34.2,
          limit: 30,
          fromPlaceName: "Kaunas Castle",
        }),
      ),
    ).toBe("Travel of 34.2 km from Kaunas Castle, more than your 30 km limit.")
    expect(
      planProblemText(
        problem("travel", { value: 40, limit: 30, fromPlaceName: "Museum" }),
      ),
    ).toBe("Travel of 40.0 km from Museum, more than your 30 km limit.")
  })

  it("writes decimals as the schedule's weather line does", () => {
    expect(
      planProblemText(problem("wind", { time: "11:00", value: 8.5, limit: 8 })),
    ).toBe("Wind up to 8.5 m/s at 11:00, more than your limit of 8 m/s.")
  })
})

describe("planProblemItemText", () => {
  it("names the activity, its date and time, and the reason", () => {
    expect(planProblemItemText(entry(), wind)).toBe(
      "Kayaking, 2026-11-21 10:00–12:00: Wind up to 9 m/s at 11:00, more than your limit of 8 m/s.",
    )
  })
})

describe("planProblems", () => {
  it("lists the problems in entry order, then problem order, with each entry's position", () => {
    const rain = problem("rain", { time: "10:00", value: 2, limit: 1 })
    const listed = planProblems([
      entry({ problems: [wind, rain] }),
      entry({ startTime: "13:00", problems: [] }),
      entry({ date: "2026-11-22", problems: [wind] }),
    ])

    expect(
      listed.map(({ index, problem }) => [index, problem.rule, problem.time]),
    ).toEqual([
      [0, "wind", "11:00"],
      [0, "rain", "10:00"],
      [2, "wind", "11:00"],
    ])
  })
})

describe("planCheckSummaryText", () => {
  it("counts problems, affected activities and checked activities", () => {
    const rain = problem("rain", { time: "10:00", value: 2, limit: 1 })
    expect(
      planCheckSummaryText([
        entry({ problems: [wind, rain] }),
        entry(),
        entry(),
        entry(),
      ]),
    ).toBe("2 problems in 1 of 4 scheduled activities.")
  })

  it("counts an activity with three reasons as three problems in one activity", () => {
    const overlap = problem("overlap", {
      otherActivityName: "Museum",
      otherStartTime: "11:00",
      otherEndTime: "13:00",
    })
    const travel = problem("travel", {
      value: 34.2,
      limit: 30,
      fromPlaceName: "Museum",
    })
    expect(
      planCheckSummaryText([
        entry({ problems: [wind, overlap, travel] }),
        entry(),
      ]),
    ).toBe("3 problems in 1 of 2 scheduled activities.")
  })

  it("uses the singular for one problem and one activity", () => {
    expect(planCheckSummaryText([entry({ problems: [wind] })])).toBe(
      "1 problem in 1 of 1 scheduled activity.",
    )
  })

  it("leaves past activities out of the count", () => {
    expect(
      planCheckSummaryText([
        entry({ past: true }),
        entry({ problems: [wind] }),
        entry(),
      ]),
    ).toBe("1 problem in 1 of 2 scheduled activities.")
  })
})

describe("checkedNoteText", () => {
  it("names the time the forecast was received", () => {
    expect(checkedNoteText("14:05")).toBe(
      "Checked against the forecast updated at 14:05.",
    )
  })
})
