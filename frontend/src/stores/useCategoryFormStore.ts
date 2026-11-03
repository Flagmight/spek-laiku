import { create } from "zustand"
import { createCategory } from "../api/activityCategoriesApi"
import type { CategorySaveOutcome } from "../api/activityCategoriesApi"
import type {
  ActivityCategory,
  ActivityCategoryFieldErrors,
  ActivityCategoryRequest,
} from "../types/activityCategory"
import { useActivityCategoriesStore } from "./useActivityCategoriesStore"
import { useCurrentUserStore } from "./useCurrentUserStore"

// After this long without an answer the save counts as a server error.
export const categoryFormTimeoutMs = 10_000

export type CategoryFormStatus =
  | "idle"
  | "pending"
  | "invalid"
  | "conflict"
  | "serverError"

// What was last sent, so Retry sends it again.
export interface CategorySaveRequest {
  request: ActivityCategoryRequest
}

export interface CategoryFormState {
  status: CategoryFormStatus
  errors: ActivityCategoryFieldErrors
  lastRequest: CategorySaveRequest | null
  controller: AbortController | null
  // Resolves with the saved category, or undefined when the save failed, was ignored or was reset.
  submit: (
    request: ActivityCategoryRequest,
  ) => Promise<ActivityCategory | undefined>
  retry: () => Promise<ActivityCategory | undefined>
  // Aborts a pending save and starts again from idle, for example when the form closes.
  reset: () => void
}

export const initialCategoryFormState: Pick<
  CategoryFormState,
  "status" | "errors" | "lastRequest" | "controller"
> = { status: "idle", errors: {}, lastRequest: null, controller: null }

type FormResult = Pick<CategoryFormState, "status" | "errors">

const idle: FormResult = { status: "idle", errors: {} }

function toResult(outcome: CategorySaveOutcome): FormResult {
  switch (outcome.kind) {
    case "saved":
      return idle
    case "invalid":
      return { status: "invalid", errors: outcome.errors }
    case "conflict":
      return { status: "conflict", errors: {} }
    case "notFound":
      return { status: "serverError", errors: {} }
    case "sessionEnded":
      // The signed-in guard sends the administrator to Log in, which says the session expired.
      useCurrentUserStore.getState().markSessionEnded()
      return idle
    case "forbidden":
      // The role or status changed: reading the user again lets the guard show the right page.
      void useCurrentUserStore.getState().refresh()
      return idle
  }
}

export const useCategoryFormStore = create<CategoryFormState>()(
  (set, get) => ({
    ...initialCategoryFormState,
    submit: async (request) => {
      // get() reads the current state, so a second click in the same render is still ignored.
      if (get().status === "pending") {
        return undefined
      }

      const abort = new AbortController()
      set({
        status: "pending",
        errors: {},
        lastRequest: { request },
        controller: abort,
      })
      const timeout = setTimeout(() => abort.abort(), categoryFormTimeoutMs)
      let outcome: CategorySaveOutcome | null = null
      try {
        outcome = await createCategory(request, abort.signal)
      } catch {
        // A 5xx, a network error or the timeout. Technical details are never shown.
      } finally {
        clearTimeout(timeout)
      }

      // After reset() the save belongs to a closed form, so its result is dropped.
      if (get().controller !== abort) {
        return undefined
      }

      const result: FormResult = outcome
        ? toResult(outcome)
        : { status: "serverError", errors: {} }
      set({ ...result, controller: null })
      if (outcome?.kind === "saved") {
        void useActivityCategoriesStore.getState().load()
        return outcome.category
      }

      return undefined
    },
    retry: async () => {
      const { lastRequest, submit } = get()
      return lastRequest ? submit(lastRequest.request) : undefined
    },
    reset: () => {
      get().controller?.abort()
      set(initialCategoryFormState)
    },
  }),
)
