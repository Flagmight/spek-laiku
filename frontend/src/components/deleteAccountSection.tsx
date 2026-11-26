import { useEffect, useId, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  accountDeletedMessage,
  useAccountDeletionStore,
} from "../stores/useAccountDeletionStore"
import type { NavigationState } from "../types/navigationState"
import { DeleteAccountDialog } from "./deleteAccountDialog"

// The Delete account section of the Account page (feature 016 spec FR-001, FR-004). Closing the dialog returns focus
// to the button that opened it; after a deletion Home opens with the success banner, as after logging out
// (research section 12).
export function DeleteAccountSection({ email }: { email: string }) {
  const headingId = useId()
  const navigate = useNavigate()
  const openButton = useRef<HTMLButtonElement>(null)
  const dialogOpen = useAccountDeletionStore((state) => state.dialogOpen)

  // Leaving the page, for example with Back while the dialog is open, drops the dialog and the password typed into it
  // (research section 14, feature 016 code review).
  useEffect(() => () => useAccountDeletionStore.getState().reset(), [])

  function close() {
    useAccountDeletionStore.getState().close()
    if (!useAccountDeletionStore.getState().dialogOpen) {
      openButton.current?.focus()
    }
  }

  function deleted() {
    const state: NavigationState = { successMessage: accountDeletedMessage }
    // Clearing the signed-in state has already made the guard replace this page with Log in, because a router
    // navigation is a React transition and the signed-in state is not. Replacing that entry with Home means Back
    // returns to the page before Account, not to Log in (feature 016 code review).
    navigate("/", { replace: true, state })
  }

  return (
    <section className="delete-account" aria-labelledby={headingId}>
      <h2 id={headingId}>Delete account</h2>
      <p>
        Deleting your account also deletes all your saved plans. This cannot be
        undone.
      </p>
      <button
        type="button"
        ref={openButton}
        onClick={() => useAccountDeletionStore.getState().open()}
      >
        Delete account
      </button>
      {dialogOpen && (
        <DeleteAccountDialog
          email={email}
          onClose={close}
          onDeleted={deleted}
        />
      )}
    </section>
  )
}
