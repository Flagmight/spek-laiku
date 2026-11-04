const dateParts = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

const shownParts = new Set(["weekday", "day", "month", "year"])

// "2026-11-07" → "Sat 7 Nov 2026". The parts are joined with single spaces, so the browser's own
// punctuation (for example a comma after the weekday) never appears. Display only: no date rules here.
export function formatPlanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return dateParts
    .formatToParts(date)
    .filter((part) => shownParts.has(part.type))
    .map((part) => part.value)
    .join(" ")
}
