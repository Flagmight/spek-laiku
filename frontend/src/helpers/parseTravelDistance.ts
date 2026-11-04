export type TravelDistance =
  { kind: "default" } | { kind: "number"; value: number } | { kind: "invalid" }

const plainNumber = /^\d+(\.\d+)?$/

// Reads the Maximum travel distance text (spec FR-016). Empty text means the default of 30, which
// the server applies to null. Text that is not a plain number cannot be sent as a JSON number, so the
// page refuses it itself; whether a number is whole and within 1 to 200 is checked only by the server.
export function parseTravelDistance(text: string): TravelDistance {
  const trimmed = text.trim()
  if (trimmed === "") {
    return { kind: "default" }
  }

  return plainNumber.test(trimmed)
    ? { kind: "number", value: Number(trimmed) }
    : { kind: "invalid" }
}
