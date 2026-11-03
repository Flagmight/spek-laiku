const plainDecimal = /^-?\d+(\.\d+)?$/

// Reads a number field typed as text. Returns null for empty text and for anything that is not a
// plain decimal with a point (so "2,5", "abc" and "1e3" give null); the server then returns the
// field's range message, which is the same for missing and out of range (research section 6).
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim()
  return plainDecimal.test(trimmed) ? Number(trimmed) : null
}
