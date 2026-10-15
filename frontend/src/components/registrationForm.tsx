import { useState } from "react"
import type { FormEvent } from "react"
import { formatErrorMessage } from "../helpers/formatErrorMessage"
import type { RegistrationStatus } from "../hooks/useRegistration"
import type { RegistrationRequest } from "../types/registration"

interface RegistrationFormProps {
  status: RegistrationStatus
  onSubmit: (request: RegistrationRequest) => void
  onRetry: () => void
}

export function RegistrationForm({
  status,
  onSubmit,
  onRetry,
}: RegistrationFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const pending = status === "pending"

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Sent exactly as typed: the server trims the email, and passwords are never trimmed.
    onSubmit({ email, password, passwordConfirmation })
  }

  return (
    // noValidate: the browser's own bubbles must never replace the FR-010 messages.
    <form noValidate onSubmit={submit}>
      <div>
        <label htmlFor="registration-email">Email</label>
        <input
          id="registration-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="registration-password">Password</label>
        <input
          id="registration-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="registration-password-confirmation">
          Confirm password
        </label>
        <input
          id="registration-password-confirmation"
          type="password"
          autoComplete="new-password"
          value={passwordConfirmation}
          onChange={(event) => setPasswordConfirmation(event.target.value)}
        />
      </div>
      {status === "serverError" && (
        <div>
          <p role="alert">
            {formatErrorMessage("Something went wrong. Try again.")}
          </p>
          <button type="button" onClick={onRetry}>
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
