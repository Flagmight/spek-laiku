import { create } from "zustand"
import { replacePlan, savePlan } from "../api/savedPlansApi"
import type { ReplacePlanAnswer } from "../api/savedPlansApi"
import { savePlanResult } from "../helpers/savePlanResult"
import { startTimeout } from "../helpers/timedRequest"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { CheckedPlanSetup } from "../types/planSetup"
import type { SavedPlanSummary } from "../types/savedPlan"
import { usePlanEditStore } from "./usePlanEditStore"

// The same message the server gives; checked here first so an empty name needs no request (spec FR-002).
export const nameRequiredMessage = "Enter a plan name."
export const changesSavedMessage = "✓ Success: Changes saved."
export const changesFailedMessage =
  "Error: Changes could not be saved. Try again."
export const planGoneSaveAsNewMessage =
  "This plan no longer exists. Save it as a new plan instead."

export type SavePlanStatus =
  | "closed"
  | "open"
  | "saving"
  | "saved"
  | "invalid"
  // The remembered schedule is unknown or older than 30 minutes (spec FR-004).
  | "expired"
  // The plan being edited no longer exists (feature 011 spec FR-012).
  | "planGone"
  // The session ended; the page keeps the schedule and sends the user to Log in.
  | "sessionExpired"
  | "serverError"

// What Save sends, with the plan it was generated from: a plan id saves changes to that plan (feature 011), and
// the setup and activities become the saved marker once the save succeeds (feature 011 research section 10).
export interface SaveSubmission {
  generatedScheduleId: string | null
  planId?: string
  setup: CheckedPlanSetup
  activities: CheckedPlanActivity[]
}

// The Save plan and Save changes form on the Schedule Overview (feature 010 spec User Story 1, feature 011 User
// Story 3). The name lives here, not in the form, so it survives "Generate again", which replaces the schedule
// under the form.
export interface SavePlanState {
  status: SavePlanStatus
  name: string
  nameError: string | null
  // Counts every refusal of the name, so the form moves focus to the field again even when the same message
  // is shown a second time (spec User Story 7).
  nameRefusals: number
  savedPlan: SavedPlanSummary | null
  // The last submission with the name it sent, so Retry sends exactly the same request.
  lastSubmission: (SaveSubmission & { name: string }) | null
  controller: AbortController | null
  open: () => void
  cancel: () => void
  setName: (name: string) => void
  // No-op while saving.
  submit: (submission: SaveSubmission) => Promise<void>
  // Sends the last submission again, to the same address.
  retry: () => Promise<void>
  // Keeps the name and the open form for the schedule generated after "Generate again".
  reopen: () => void
  // After the edited plan turned out to be gone: keeps the name and opens the form to save a new plan.
  saveAsNew: () => void
  // Aborts a pending save and closes the form, for example when the page closes.
  reset: () => void
}

export const initialSavePlanState: Pick<
  SavePlanState,
  | "status"
  | "name"
  | "nameError"
  | "nameRefusals"
  | "savedPlan"
  | "lastSubmission"
  | "controller"
> = {
  status: "closed",
  name: "",
  nameError: null,
  nameRefusals: 0,
  savedPlan: null,
  lastSubmission: null,
  controller: null,
}

export const useSavePlanStore = create<SavePlanState>()((set, get) => {
  async function send(submission: SaveSubmission & { name: string }) {
    const abort = new AbortController()
    // An earlier refusal no longer applies while the corrected name is being saved; keeping it would also pull
    // focus back to the field.
    set({
      status: "saving",
      nameError: null,
      lastSubmission: submission,
      controller: abort,
    })
    const clearTimer = startTimeout(abort)
    const request = {
      generatedScheduleId: submission.generatedScheduleId,
      name: submission.name,
    }
    let answer: ReplacePlanAnswer | null = null
    try {
      answer = submission.planId
        ? await replacePlan(submission.planId, request, abort.signal)
        : await savePlan(request, abort.signal)
    } catch {
      // A 5xx, a network error, the timeout or an abort: answer stays null, which is a server error.
    } finally {
      clearTimer()
    }

    // After reset() the request belongs to a closed page, so its answer is dropped.
    if (get().controller !== abort) {
      return
    }

    const result = savePlanResult(answer)
    if (result.status === "saved") {
      usePlanEditStore
        .getState()
        .markSaved(submission.setup, submission.activities)
    }
    set({
      ...result,
      controller: null,
      nameRefusals: get().nameRefusals + (result.nameError ? 1 : 0),
    })
  }

  return {
    ...initialSavePlanState,
    open: () => set({ status: "open", nameError: null }),
    cancel: () => {
      get().controller?.abort()
      set({ status: "closed", nameError: null, controller: null })
    },
    setName: (name) => set({ name }),
    submit: async (submission) => {
      if (get().status === "saving") {
        return
      }

      const name = get().name
      if (name.trim() === "") {
        set({
          status: "invalid",
          nameError: nameRequiredMessage,
          nameRefusals: get().nameRefusals + 1,
        })
        return
      }

      await send({ ...submission, name })
    },
    retry: async () => {
      const { lastSubmission, status } = get()
      if (lastSubmission && status !== "saving") {
        await send(lastSubmission)
      }
    },
    reopen: () => {
      get().controller?.abort()
      set({
        status: "open",
        nameError: null,
        savedPlan: null,
        controller: null,
      })
    },
    saveAsNew: () => set({ status: "open", nameError: null, savedPlan: null }),
    reset: () => {
      get().controller?.abort()
      set(initialSavePlanState)
    },
  }
})
