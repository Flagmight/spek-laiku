import { useRef, useState } from "react"
import { useAccountStatusStore } from "../stores/useAccountStatusStore"
import type { AdminAccount } from "../types/adminAccount"
import { ConfirmDialog } from "./confirmDialog"

// Suspend or Reactivate on one account of the User accounts page (feature 014 spec FR-003 to FR-005, FR-018). An
// Administrator account gets no button. Suspend asks first; Cancel or Escape returns focus to it. Reactivate needs no
// confirmation. Each button names its account for screen readers, and all are disabled while any change runs. After a
// successful change the list moves focus to the account's new button.
export function AccountStatusButton({
  account,
  buttonRef,
}: {
  account: AdminAccount
  buttonRef: (button: HTMLButtonElement | null) => void
}) {
  const busy = useAccountStatusStore((state) => state.pending !== null)
  const [confirming, setConfirming] = useState(false)
  const suspendButton = useRef<HTMLButtonElement | null>(null)

  if (account.role !== "Registered User") {
    return null
  }

  if (account.accountStatus === "Suspended") {
    return (
      <button
        type="button"
        ref={buttonRef}
        aria-label={`Reactivate ${account.email}`}
        disabled={busy}
        onClick={() =>
          void useAccountStatusStore.getState().change(account, "Active")
        }
      >
        Reactivate
      </button>
    )
  }

  // Once Suspend is pressed in the dialog the request cannot be taken back, so Cancel and Escape wait for it
  // instead of closing a dialog whose change still goes through (spec FR-004).
  function cancel() {
    if (useAccountStatusStore.getState().pending) {
      return
    }

    setConfirming(false)
    suspendButton.current?.focus()
  }

  async function confirm() {
    const outcome = await useAccountStatusStore
      .getState()
      .change(account, "Suspended")
    setConfirming(false)
    // On success the list focuses the new Reactivate button, and after a reload the page focuses its heading;
    // after a failure focus returns to Suspend, next to the error and its Retry.
    if (outcome === "failed") {
      suspendButton.current?.focus()
    }
  }

  return (
    <>
      <button
        type="button"
        ref={(button) => {
          suspendButton.current = button
          buttonRef(button)
        }}
        aria-label={`Suspend ${account.email}`}
        disabled={busy}
        onClick={() => setConfirming(true)}
      >
        Suspend
      </button>
      {confirming && (
        <ConfirmDialog
          question={`Suspend ${account.email}? They will lose access until reactivated.`}
          confirmLabel="Suspend"
          busy={busy}
          onConfirm={() => void confirm()}
          onCancel={cancel}
        />
      )}
    </>
  )
}
