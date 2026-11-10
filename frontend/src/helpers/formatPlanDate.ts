const dateParts = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

const longDateParts = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

const shownParts = new Set(["weekday", "day", "month", "year"])

// The parts are joined with single spaces, so the browser's own punctuation (for example a comma after
// the weekday) never appears. Display only: no date rules here.
function format(parts: Intl.DateTimeFormat, isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return parts
    .formatToParts(date)
    .filter((part) => shownParts.has(part.type))
    .map((part) => part.value)
    .join(" ")
}

// "2026-11-07" → "Sat 7 Nov 2026".
export function formatPlanDate(isoDate: string): string {
  return format(dateParts, isoDate)
}

// "2026-11-14" → "Saturday 14 November 2026", for headings and button names on step 3.
export function formatPlanDateLong(isoDate: string): string {
  return format(longDateParts, isoDate)
}
