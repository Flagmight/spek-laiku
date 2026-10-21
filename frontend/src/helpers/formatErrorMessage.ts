// Every error message shown on screen starts with "Error: " (FR-019).
// API messages never contain the prefix, so it is added only here.
export function formatErrorMessage(message: string) {
  return `Error: ${message}`
}
