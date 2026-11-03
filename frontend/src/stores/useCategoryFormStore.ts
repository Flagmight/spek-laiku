import { create } from "zustand"
import {
  createCategory,
  getCategory,
  updateCategory,
} from "../api/activityCategoriesApi"
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

// The category being edited and the version the form was opened (or last reloaded) with.
export interface CategoryTarget {
  id: string
  version: number
}

// What was last sent, so Retry sends it again. No target means a new category.
export interface CategorySaveRequest {
  request: ActivityCategoryRequest
  target?: CategoryTarget
}

export interface CategoryFormState {
  status: CategoryFormStatus
  errors: ActivityCategoryFieldErrors
  lastRequest: CategorySaveRequest | null
  controller: AbortController | null
  // Creates a category, or updates target. Resolves with the saved category, or undefined
  // when the save failed, was ignored or was reset.
  submit: (
    request: ActivityCategoryRequest,
    target?: CategoryTarget,
  ) => Promise<ActivityCategory | undefined>
  retry: () => Promise<ActivityCategory | undefined>
  // After a conflict: reads the stored category, so the form can show it, and compares the next
  // save against its version (FR-026). Resolves with undefined when reading it fails.
  reloadCategory: (id: string) => Promise<ActivityCategory | undefined>
  // Aborts a pending request and starts again from idle, for example when the form closes.
  reset: () => void
}

export const initialCategoryFormState: Pick<
  CategoryFormState,
  "status" | "errors" | "lastRequest" | "controller"
> = { status: "idle", errors: {}, lastRequest: null, controller: null }

type FormResult = Pick<CategoryFormState, "status" | "errors">

const idle: FormResult = { status: "idle", errors: {} }
const serverError: FormResult = { status: "serverError", errors: {} }

function toResult(outcome: CategorySaveOutcome): FormResult {
  switch (outcome.kind) {
    case "saved":
      return idle
    case "invalid":
      return { status: "invalid", errors: outcome.errors }
    case "conflict":
      return { status: "conflict", errors: {} }
    case "notFound":
      // The category was removed meanwhile: a general error, and the list shows what is left.
      void useActivityCategoriesStore.getState().load()
      return serverError
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
  (set, get) => {
    // Runs one request with the timeout; value is undefined when it threw. Returns null when
    // reset() took over meanwhile, so the caller drops the result.
    async function run<T>(
      start: (signal: AbortSignal) => Promise<T>,
    ): Promise<{ value: T | undefined } | null> {
      const abort = new AbortController()
      set({ controller: abort })
      const timeout = setTimeout(() => abort.abort(), categoryFormTimeoutMs)
      let value: T | undefined
      try {
        value = await start(abort.signal)
      } catch {
        // A 5xx, a network error or the timeout. Technical details are never shown.
      } finally {
        clearTimeout(timeout)
      }

      return get().controller === abort ? { value } : null
    }

    return {
      ...initialCategoryFormState,
      submit: async (request, target) => {
        // get() reads the current state, so a second click in the same render is still ignored.
        if (get().status === "pending") {
          return undefined
        }

        set({ status: "pending", errors: {}, lastRequest: { request, target } })
        const finished = await run((signal) =>
          target
            ? updateCategory(target.id, request, target.version, signal)
            : createCategory(request, signal),
        )
        if (!finished) {
          return undefined
        }

        const outcome = finished.value
        set({ ...(outcome ? toResult(outcome) : serverError), controller: null })
        if (outcome?.kind === "saved") {
          void useActivityCategoriesStore.getState().load()
          return outcome.category
        }

        return undefined
      },
      retry: async () => {
        const { lastRequest, submit } = get()
        return lastRequest
          ? submit(lastRequest.request, lastRequest.target)
          : undefined
      },
      // Not "pending": nothing is being saved, so the form does not say "Saving category…".
      reloadCategory: async (id) => {
        const finished = await run((signal) => getCategory(id, signal))
        if (!finished) {
          return undefined
        }

        const category = finished.value
        if (!category) {
          // getCategory gives null when the category no longer exists: the list shows what is left.
          if (category === null) {
            void useActivityCategoriesStore.getState().load()
          }
          set({ ...serverError, controller: null })
          return undefined
        }

        const { lastRequest } = get()
        set({
          ...idle,
          controller: null,
          lastRequest: lastRequest && {
            ...lastRequest,
            target: { id, version: category.version },
          },
        })
        return category
      },
      reset: () => {
        get().controller?.abort()
        set(initialCategoryFormState)
      },
    }
  },
)
