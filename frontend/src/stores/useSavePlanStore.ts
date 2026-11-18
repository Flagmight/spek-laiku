import { create } from "zustand"
import { savePlan } from "../api/savedPlansApi"
import type { SavePlanAnswer } from "../api/savedPlansApi"
import { startTimeout } from "../helpers/timedRequest"
import type { SavePlanRequest, SavedPlanSummary } from "../types/savedPlan"
import { useCurrentUserStore } from "./useCurrentUserStore"

// The same message the server gives; checked here first so an empty name needs no request (spec FR-002).
export const nameRequiredMessage = "Enter a plan name."

export type SavePlanStatus =
  | "closed"
  | "open"
  | "saving"
  | "saved"
  | "invalid"
  // The remembered schedule is unknown or older than 30 minutes (spec FR-004).
  | "expired"
  // The session ended; the page keeps the schedule and sends the user to Log in.
  | "sessionExpired"
  | "serverError"

// The Save plan form on the Schedule Overview (feature 010 spec User Story 1). The name lives here, not in
// the form, so it survives "Generate again", which replaces the schedule under the form.
export interface SavePlanState {
  status: SavePlanStatus
  name: string
  nameError: string | null
  savedPlan: SavedPlanSummary | null
  lastRequest: SavePlanRequest | null
  controller: AbortController | null
  open: () => void
  cancel: () => void
  setName: (name: string) => void
  // No-op while saving.
  submit: (generatedScheduleId: string | null) => Promise<void>
  // Sends the last request again.
  retry: () => Promise<void>
  // Keeps the name and the open form for the schedule generated after "Generate again".
  reopen: () => void
  // Aborts a pending save and closes the form, for example when the page closes.
  reset: () => void
}

export const initialSavePlanState: Pick<
  SavePlanState,
  "status" | "name" | "nameError" | "savedPlan" | "lastRequest" | "controller"
> = {
  status: "closed",
  name: "",
  nameError: null,
  savedPlan: null,
  lastRequest: null,
  controller: null,
}

type Result = Pick<SavePlanState, "status" | "nameError" | "savedPlan">

function toResult(answer: SavePlanAnswer | null): Result {
  switch (answer?.kind) {
    case "saved":
      return { status: "saved", nameError: null, savedPlan: answer.plan }
    case "invalid":
      return {
        status: answer.errors.generatedScheduleId ? "expired" : "invalid",
        nameError: answer.errors.name ?? null,
        savedPlan: null,
      }
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

export const useSavePlanStore = create<SavePlanState>()((set, get) => {
  async function send(request: SavePlanRequest) {
    const abort = new AbortController()
    set({ status: "saving", lastRequest: request, controller: abort })
    const clearTimer = startTimeout(abort)
    let answer: SavePlanAnswer | null = null
    try {
      answer = await savePlan(request, abort.signal)
    } catch {
      // A 5xx, a network error, the timeout or an abort: answer stays null, which is a server error.
    } finally {
      clearTimer()
    }

    // After reset() the request belongs to a closed page, so its answer is dropped.
    if (get().controller !== abort) {
      return
    }

    set({ ...toResult(answer), controller: null })
  }

  return {
    ...initialSavePlanState,
    open: () => set({ status: "open", nameError: null }),
    cancel: () => {
      get().controller?.abort()
      set({ status: "closed", nameError: null, controller: null })
    },
    setName: (name) => set({ name }),
    submit: async (generatedScheduleId) => {
      if (get().status === "saving") {
        return
      }

      const name = get().name
      if (name.trim() === "") {
        set({ status: "invalid", nameError: nameRequiredMessage })
        return
      }

      await send({ generatedScheduleId, name })
    },
    retry: async () => {
      const { lastRequest, status } = get()
      if (lastRequest && status !== "saving") {
        await send(lastRequest)
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
    reset: () => {
      get().controller?.abort()
      set(initialSavePlanState)
    },
  }
})
