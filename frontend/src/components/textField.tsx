import { formatErrorMessage } from "../helpers/formatErrorMessage"

interface TextFieldProps {
  id: string
  label: string
  type: "email" | "password"
  autoComplete: string
  value: string
  hint?: string
  error?: string
  // The id of a message elsewhere on the page that also describes this field.
  describedById?: string
  onChange: (value: string) => void
}

// A labelled input with an optional hint and error message, shared by the registration and login forms.
export function TextField({
  id,
  label,
  hint,
  error,
  describedById,
  onChange,
  ...input
}: TextFieldProps) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  // Screen readers read the label, then the hint, then the error (US4 scenario 2).
  const describedBy = [hint && hintId, error && errorId, describedById]
    .filter(Boolean)
    .join(" ")
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        {...input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {formatErrorMessage(error)}
        </p>
      )}
    </div>
  )
}
