// After this long without an answer a step 3 request counts as a server error (feature 006 FR-006,
// feature 007 FR-009). Shared by the forecast and places stores.
export const planRequestTimeoutMs = 10_000

// Aborts the request after planRequestTimeoutMs. Call the returned function once the answer has arrived,
// so a later abort cannot hit a finished request.
export function startTimeout(controller: AbortController): () => void {
  const timer = setTimeout(() => controller.abort(), planRequestTimeoutMs)
  return () => clearTimeout(timer)
}
