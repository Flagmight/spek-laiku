import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { PlanCheckSection } from "../components/planCheckSection"
import { usePlanCheckStore } from "../stores/usePlanCheckStore"
import type { PlanCheck } from "../types/planCheck"
import { planCheckWith, problem } from "./savedPlansFixtures"

const wind = problem("wind", { time: "11:00", value: 9, limit: 8 })

// The section with the store in the given state and one schedule entry a problem's link can focus.
function renderSection(
  status: ReturnType<typeof usePlanCheckStore.getState>["status"],
  checked: PlanCheck | null,
) {
  usePlanCheckStore.setState({ status, result: checked })
  return render(
    <>
      <PlanCheckSection checked={checked} />
      <ul>
        <li id="scheduled-entry-0" tabIndex={-1}>
          06:00–22:00 Museum
        </li>
      </ul>
    </>,
  )
}

describe("PlanCheckSection", () => {
  it("is a region labelled by its heading 'Plan check'", () => {
    renderSection("idle", null)

    const region = screen.getByRole("region", { name: "Plan check" })
    expect(region).toContainElement(
      screen.getByRole("heading", { level: 2, name: "Plan check" }),
    )
  })

  it("announces the loading message while checking", () => {
    renderSection("checking", null)

    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking your plan against the latest forecast…",
    )
  })

  it("announces that the plan fits when no problem is found", () => {
    renderSection("checked", planCheckWith([]))

    expect(screen.getByRole("status")).toHaveTextContent(
      "✓ No problems found. Your plan fits the current forecast.",
    )
    expect(screen.queryByRole("list", { name: /problem/i })).toBeNull()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("announces the summary and lists each problem with a link to its entry", () => {
    renderSection("checked", planCheckWith([{ problems: [wind] }]))

    expect(screen.getByRole("status")).toHaveTextContent(
      "1 problem in 1 of 1 scheduled activity.",
    )
    const link = screen.getByRole("link", {
      name: "Museum, 2026-11-14 06:00–22:00: Wind up to 9 m/s at 11:00, more than your limit of 8 m/s.",
    })
    expect(link).toHaveAttribute("href", "#scheduled-entry-0")
  })

  it("moves focus to the schedule entry when a problem's link is followed", async () => {
    renderSection("checked", planCheckWith([{ problems: [wind] }]))

    await userEvent.click(screen.getByRole("link"))

    expect(document.getElementById("scheduled-entry-0")).toHaveFocus()
  })

  it("does not move focus when the result is announced", () => {
    const { rerender } = renderSection("checking", null)
    const before = document.activeElement

    usePlanCheckStore.setState({ status: "checked" })
    rerender(
      <PlanCheckSection checked={planCheckWith([{ problems: [wind] }])} />,
    )

    expect(document.activeElement).toBe(before)
  })
})
