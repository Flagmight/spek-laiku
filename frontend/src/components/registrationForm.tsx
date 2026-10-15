import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { formatErrorMessage } from "../helpers/formatErrorMessage"
import type { RegistrationStatus } from "../hooks/useRegistration"
import type {
  RegistrationField,
  RegistrationFieldErrors,
  RegistrationRequest,
} from "../types/registration"
import { ErrorSummary } from "./errorSummary"
import type { FieldError } from "./errorSummary"

interface RegistrationFormProps {
  status: RegistrationStatus
  errors: RegistrationFieldErrors
  onSubmit: (
    request: RegistrationRequest,
  ) => Promise<RegistrationStatus | undefined>
  onRetry: () => Promise<RegistrationStatus | undefined>
}

// Contract order, which is also the order of the fields on the page.
const fieldIds: Record<RegistrationField, string> = {
  email: "registration-email",
  password: "registration-password",
  passwordConfirmation: "registration-password-confirmation",
}

function toFieldErrors(errors: RegistrationFieldErrors): FieldError[] {
  return (Object.keys(fieldIds) as RegistrationField[]).flatMap((field) => {
    const message = errors[field]
    return message ? [{ fieldId: fieldIds[field], message }] : []
  })
}

interface TextFieldProps {
  id: string
  label: string
  type: "email" | "password"
  autoComplete: string
  value: string
  error?: string
  onChange: (value: string) => void
}

function TextField({ id, label, error, onChange, ...input }: TextFieldProps) {
  const errorId = `${id}-error`
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        {...input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <p id={errorId} className="field-error">
          {formatErrorMessage(error)}
        </p>
      )}
    </div>
  )
}

export function RegistrationForm({
  status,
  errors,
  onSubmit,
  onRetry,
}: RegistrationFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const pending = status === "pending"
  const fieldErrors = toFieldErrors(errors)

  // After a validation failure, focus the first invalid field (FR-011). Its message is read
  // out through aria-describedby; with several errors the summary is announced as well.
  // errors is a new object after every failed submission, so focus moves each time.
  useEffect(() => {
    const [first] = toFieldErrors(errors)
    if (status === "invalid" && first) {
      document.getElementById(first.fieldId)?.focus()
    }
  }, [status, errors])

  function clearPasswordsAfterValidationFailure(
    result: RegistrationStatus | undefined,
  ) {
    // Only after a validation failure: a server error keeps every value for Retry (FR-015).
    if (result === "invalid") {
      setPassword("")
      setPasswordConfirmation("")
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Sent exactly as typed: the server trims the email, and passwords are never trimmed.
    clearPasswordsAfterValidationFailure(
      await onSubmit({ email, password, passwordConfirmation }),
    )
  }

  async function retry() {
    clearPasswordsAfterValidationFailure(await onRetry())
  }

  return (
    // noValidate: the browser's own bubbles must never replace the FR-010 messages.
    <form noValidate onSubmit={(event) => void submit(event)}>
      <ErrorSummary errors={fieldErrors} />
      <TextField
        id={fieldIds.email}
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        error={errors.email}
        onChange={setEmail}
      />
      <TextField
        id={fieldIds.password}
        label="Password"
        type="password"
        autoComplete="new-password"
        value={password}
        error={errors.password}
        onChange={setPassword}
      />
      <TextField
        id={fieldIds.passwordConfirmation}
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        value={passwordConfirmation}
        error={errors.passwordConfirmation}
        onChange={setPasswordConfirmation}
      />
      {status === "serverError" && (
        <div>
          <p role="alert">
            {formatErrorMessage("Something went wrong. Try again.")}
          </p>
          <button type="button" onClick={() => void retry()}>
            Retry
          </button>
        </div>
      )}
      <button type="submit" disabled={pending}>
        Create account
      </button>
      {/* Always rendered, so screen readers announce the text when it appears (FR-018). */}
      <p role="status">{pending ? "Creating your account…" : ""}</p>
    </form>
  )
}
