import type { ReplacePlanAnswer } from "../api/savedPlansApi"
import type { SavePlanStatus } from "../stores/useSavePlanStore"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import type { SavedPlanSummary } from "../types/savedPlan"

export interface SavePlanResult {
  status: SavePlanStatus
  nameError: string | null
  savedPlan: SavedPlanSummary | null
}

// The Save plan form's state after an answer from saving a new plan or saving changes (feature 010 spec FR-004,
// FR-005; feature 011 spec FR-011, FR-012). No answer (a 5xx, a network error, the timeout or an abort) is a
// server error.
export function savePlanResult(
  answer: ReplacePlanAnswer | null,
): SavePlanResult {
  switch (answer?.kind) {
    case "saved":
      return { status: "saved", nameError: null, savedPlan: answer.plan }
    case "invalid":
      return {
        status: answer.errors.generatedScheduleId ? "expired" : "invalid",
        nameError: answer.errors.name ?? null,
        savedPlan: null,
      }
    case "notFound":
      // The plan being edited was deleted, for example in another tab.
      return { status: "planGone", nameError: null, savedPlan: null }
    case "unauthorized":
      return { status: "sessionExpired", nameError: null, savedPlan: null }
    case "forbidden":
      // The account changed (for example suspended); the guards show the right page after the refresh.
      void useCurrentUserStore.getState().refresh()
      return { status: "serverError", nameError: null, savedPlan: null }
    default:
      return { status: "serverError", nameError: null, savedPlan: null }
  }
}
