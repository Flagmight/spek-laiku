import { useEffect, useId, useRef } from "react"
import type { KeyboardEvent } from "react"

// A confirmation over the page, for deleting a plan and for replacing an unsaved plan with an edit (feature 011
// spec FR-002, FR-013, FR-020, research section 9). It is a plain component rather than the native <dialog>,
// because jsdom does not implement showModal(), so tests would need a stub that hides the real behaviour.
// Focus moves to the confirm button when it opens and Tab stays inside; Escape works like Cancel. The parent
// returns focus to the button that opened it. The question is plain text, never markup.
export function ConfirmDialog({
  question,
  confirmLabel,
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}: {
  question: string
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const questionId = useId()
  const confirmButton = useRef<HTMLButtonElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmButton.current?.focus()
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      onCancel()
      return
    }

    if (event.key !== "Tab") {
      return
    }

    // The confirm button can be disabled while busy, so the first focusable button may be Cancel.
    const first = busy ? cancelButton.current : confirmButton.current
    const last = cancelButton.current
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return (
    <div className="confirm-backdrop">
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={questionId}
        onKeyDown={onKeyDown}
      >
        <p id={questionId}>{question}</p>
        <p>
          <button
            type="button"
            ref={confirmButton}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>{" "}
          <button type="button" ref={cancelButton} onClick={onCancel}>
            {cancelLabel}
          </button>
        </p>
      </div>
    </div>
  )
}
