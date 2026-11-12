// Whether a step 3 request has not answered yet since the page opened (feature 007 FR-003). "idle" counts
// too: the page asks for the forecast and the places as soon as it opens, so idle is only the moment before.
export function isFirstLoad(status: string): boolean {
  return status === "idle" || status === "loading"
}
