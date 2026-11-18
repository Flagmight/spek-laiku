import { formatPlanDateShort } from "./formatPlanDate"

// The time a plan was saved, in Lithuanian time like every time in the app (feature 010 spec Assumptions).
const savedAtParts = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Vilnius",
})

function part(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((candidate) => candidate.type === type)?.value ?? ""
}

// The saved date alone, "Sat 21 Nov 2026", for the plan page's note. Display only.
export function formatSavedDate(iso: string): string {
  const parts = savedAtParts.formatToParts(new Date(iso))
  return ["weekday", "day", "month", "year"]
    .map((type) => part(parts, type))
    .join(" ")
}

// "2026-11-21T12:05:00Z" → "Saved on Sat 21 Nov 2026 at 14:05". Display only.
export function formatSavedAt(iso: string): string {
  const parts = savedAtParts.formatToParts(new Date(iso))
  return `Saved on ${formatSavedDate(iso)} at ${part(parts, "hour")}:${part(parts, "minute")}`
}

// A plan's dates, which need not follow each other: "Sat 21 Nov, Sun 22 Nov" (feature 010 spec US3).
export function formatPlanDates(dates: string[]): string {
  return dates.map(formatPlanDateShort).join(", ")
}
