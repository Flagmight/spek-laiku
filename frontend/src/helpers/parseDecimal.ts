const plainDecimal = /^-?\d+(\.\d+)?$/

// Just under the largest number the API's decimal type can read. This is a limit of the data format,
// not a business rule: a larger number would make the server refuse the whole request.
const largestReadableByServer = 7.9e28

// Reads a number field typed as text. Returns null for empty text, for anything that is not a plain
// decimal with a point (so "2,5", "abc" and "1e3" give null) and for a number too large to send; the
// server then returns the field's range message, which is the same for missing and out of range
// (research section 6).
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim()
  if (!plainDecimal.test(trimmed)) {
    return null
  }

  const value = Number(trimmed)
  return Math.abs(value) < largestReadableByServer ? value : null
}
