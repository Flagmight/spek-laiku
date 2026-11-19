import { useEffect } from "react"
import type { KeyboardEvent, ReactNode } from "react"
import { TextField } from "./textField"

export const planNameFieldId = "plan-name"

// The "Plan name" form shared by Save plan, Save changes and Rename (feature 011 research section 11), so the
// three keep the same field, rules and keyboard behaviour (feature 010 spec User Story 7, feature 011 FR-020).
// Focus goes to the field when the form opens and every time the name is refused, even with the same message as
// before; Escape works like Cancel. children is the status slot (saving, errors with their buttons).
export function PlanNameForm({
  formLabel,
  submitLabel,
  name,
  nameError,
  nameRefusals,
  opened,
  busy,
  onNameChange,
  onSubmit,
  onCancel,
  children,
}: {
  formLabel: string
  submitLabel: string
  name: string
  nameError: string | null
  nameRefusals: number
  // True while the form has just been opened, before anything was submitted.
  opened: boolean
  busy: boolean
  onNameChange: (name: string) => void
  onSubmit: () => void
  onCancel: () => void
  children?: ReactNode
}) {
  useEffect(() => {
    if (opened || nameError) {
      document.getElementById(planNameFieldId)?.focus()
    }
  }, [opened, nameError, nameRefusals])

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <form
      aria-label={formLabel}
      noValidate
      onKeyDown={onKeyDown}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <TextField
        id={planNameFieldId}
        label="Plan name"
        type="text"
        autoComplete="off"
        value={name}
        error={nameError ?? undefined}
        onChange={onNameChange}
      />
      {children}
      <p>
        <button type="submit" disabled={busy}>
          {submitLabel}
        </button>{" "}
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </p>
    </form>
  )
}
