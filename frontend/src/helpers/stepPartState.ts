// What one part of step 3 (the forecast or the places) can show after the first load (feature 007 FR-009,
// FR-016): its data, "Getting …" while its Retry runs, or "Not available" after any failure.
export type StepPartState = "loaded" | "retrying" | "unavailable"

export function stepPartState(status: string, hasData: boolean): StepPartState {
  if (status === "retrying") {
    return "retrying"
  }

  return hasData ? "loaded" : "unavailable"
}
