import { create } from "zustand"
import { renamePlan } from "../api/savedPlansApi"
import type { RenamePlanAnswer } from "../api/savedPlansApi"
import { startTimeout } from "../helpers/timedRequest"
import { useCurrentUserStore } from "./useCurrentUserStore"
import { usePlanEditStore } from "./usePlanEditStore"
import { useSavedPlanStore } from "./useSavedPlanStore"
import { nameRequiredMessage } from "./useSavePlanStore"

export const planRenamedMessage = "✓ Success: Plan renamed."
export const renameFailedMessage =
  "Error: Plan could not be renamed. Try again."
export const renamingMessage = "Renaming your plan…"

export type RenamePlanStatus =
  | "closed"
  | "open"
  | "saving"
  | "renamed"
  | "invalid"
  | "notFound"
  // The session ended; the page sends the user to Log in.
  | "sessionExpired"
  | "serverError"

// The Rename form on the plan page (feature 011 spec User Story 4, FR-014), in the same shape as the Save plan
// store: the name is checked here first so an empty one needs no request, and Retry sends the same request.
export interface RenamePlanState {
  status: RenamePlanStatus
  name: string
  nameError: string | null
  // Counts every refusal of the name, so the form moves focus to the field again even for the same message.
  nameRefusals: number
  lastRequest: { planId: string; name: string } | null
  controller: AbortController | null
  open: (currentName: string) => void
  cancel: () => void
  setName: (name: string) => void
  // No-op while saving.
  submit: (planId: string) => Promise<void>
  retry: () => Promise<void>
  reset: () => void
}

export const initialRenamePlanState: Pick<
  RenamePlanState,
  | "status"
  | "name"
  | "nameError"
  | "nameRefusals"
  | "lastRequest"
  | "controller"
> = {
  status: "closed",
  name: "",
  nameError: null,
  nameRefusals: 0,
  lastRequest: null,
  controller: null,
}

type Result = Pick<RenamePlanState, "status" | "nameError">

function toResult(answer: RenamePlanAnswer | null): Result {
  switch (answer?.kind) {
    case "renamed":
      // The heading, page title and breadcrumbs follow the loaded plan's name, and an edit of this plan keeps
      // the new name, so Save changes does not undo the rename (feature 011 code review).
      useSavedPlanStore.getState().rename(answer.plan.name)
      usePlanEditStore.getState().rename(answer.plan.id, answer.plan.name)
      return { status: "renamed", nameError: null }
    case "invalid":
      return { status: "invalid", nameError: answer.errors.name ?? null }
    case "notFound":
      return { status: "notFound", nameError: null }
    case "unauthorized":
      return { status: "sessionExpired", nameError: null }
    case "forbidden":
      // The account changed (for example suspended); the guards show the right page after the refresh.
      void useCurrentUserStore.getState().refresh()
      return { status: "serverError", nameError: null }
    default:
      return { status: "serverError", nameError: null }
  }
}

export const useRenamePlanStore = create<RenamePlanState>()((set, get) => {
  async function send(request: { planId: string; name: string }) {
    const abort = new AbortController()
    set({
      status: "saving",
      nameError: null,
      lastRequest: request,
      controller: abort,
    })
    const clearTimer = startTimeout(abort)
    let answer: RenamePlanAnswer | null = null
    try {
      answer = await renamePlan(
        request.planId,
        { name: request.name },
        abort.signal,
      )
    } catch {
      // A 5xx, a network error, the timeout or an abort: answer stays null, which is a server error.
    } finally {
      clearTimer()
    }

    // After reset() the request belongs to a closed page, so its answer is dropped.
    if (get().controller !== abort) {
      return
    }

    const result = toResult(answer)
    set({
      ...result,
      controller: null,
      nameRefusals: get().nameRefusals + (result.nameError ? 1 : 0),
    })
  }

  return {
    ...initialRenamePlanState,
    open: (currentName) =>
      set({ status: "open", name: currentName, nameError: null }),
    cancel: () => {
      get().controller?.abort()
      set({ status: "closed", nameError: null, controller: null })
    },
    setName: (name) => set({ name }),
    submit: async (planId) => {
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

      await send({ planId, name })
    },
    retry: async () => {
      const { lastRequest, status } = get()
      if (lastRequest && status !== "saving") {
        await send(lastRequest)
      }
    },
    reset: () => {
      get().controller?.abort()
      set(initialRenamePlanState)
    },
  }
})
