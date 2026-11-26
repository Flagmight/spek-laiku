import { useEffect, useId, useRef } from "react"
import type { FormEvent, KeyboardEvent } from "react"
import {
  deletingAccountMessage,
  useAccountDeletionStore,
} from "../stores/useAccountDeletionStore"
import { TextField } from "./textField"

const passwordFieldId = "delete-account-password"

// The confirmation for deleting one's own account, with the password field (feature 016 spec FR-002, FR-007, FR-008,
// FR-012). It looks and behaves like ConfirmDialog (the same frame, Escape, Tab kept inside), but it is its own
// component: the field takes the first focus, Enter in it submits the form, and Retry can join the buttons, so the
// trap and the submit differ from ConfirmDialog's two buttons (research section 10). The question is plain text.
export function DeleteAccountDialog({
  email,
  onClose,
  onDeleted,
}: {
  email: string
  onClose: () => void
  onDeleted: () => void
}) {
  const questionId = useId()
  const dialog = useRef<HTMLDivElement>(null)
  const retryButton = useRef<HTMLButtonElement>(null)
  const password = useAccountDeletionStore((state) => state.password)
  const status = useAccountDeletionStore((state) => state.status)
  const fieldError = useAccountDeletionStore((state) => state.fieldError)
  const error = useAccountDeletionStore((state) => state.error)
  const focusRequest = useAccountDeletionStore((state) => state.focusRequest)
  const pending = status === "pending"

  // The field when the dialog opens.
  useEffect(() => {
    document.getElementById(passwordFieldId)?.focus()
  }, [])

  // The field again after a refused password or the lock (spec User Story 1 scenarios 5 and 6).
  useEffect(() => {
    if (focusRequest !== null) {
      document.getElementById(passwordFieldId)?.focus()
      useAccountDeletionStore.getState().focusHandled()
    }
  }, [focusRequest])

  // The dialog itself while the request runs: the field and buttons are disabled, and focus must stay inside so Tab
  // and Escape still reach the dialog (feature 016 code review).
  useEffect(() => {
    if (pending) {
      dialog.current?.focus()
    }
  }, [pending])

  // Retry after a technical failure, because the buttons were disabled while the request ran.
  useEffect(() => {
    if (status === "serverError") {
      retryButton.current?.focus()
    }
  }, [status])

  async function run(action: () => Promise<string>) {
    if ((await action()) === "deleted") {
      onDeleted()
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(useAccountDeletionStore.getState().submit)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      // A deletion that may already have happened cannot be cancelled (spec FR-007).
      if (!pending) {
        onClose()
      }
      return
    }

    if (event.key !== "Tab") {
      return
    }

    const focusable = Array.from(
      dialog.current?.querySelectorAll<HTMLElement>(
        "input:not(:disabled), button:not(:disabled)",
      ) ?? [],
    )
    const first = focusable.at(0)
    const last = focusable.at(-1)
    if (!first || !last) {
      event.preventDefault()
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="confirm-backdrop">
      <div
        ref={dialog}
        className="confirm-dialog"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={questionId}
        onKeyDown={onKeyDown}
      >
        <p id={questionId}>
          {`Delete your account ${email}? All your saved plans will be deleted. This cannot be undone.`}
        </p>
        <form noValidate onSubmit={onSubmit}>
          <TextField
            id={passwordFieldId}
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            error={fieldError ?? undefined}
            disabled={pending}
            onChange={(value) =>
              useAccountDeletionStore.getState().setPassword(value)
            }
          />
          <p role="status" className="loading-status">
            {pending ? deletingAccountMessage : ""}
          </p>
          <div role="alert">
            {error && (
              <div className="form-error">
                <p>{error}</p>
                {status === "serverError" && (
                  <button
                    type="button"
                    ref={retryButton}
                    onClick={() =>
                      void run(useAccountDeletionStore.getState().retry)
                    }
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>
          <p>
            <button type="submit" disabled={pending}>
              Delete account
            </button>{" "}
            <button type="button" disabled={pending} onClick={onClose}>
              Cancel
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
