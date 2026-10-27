import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { formatErrorMessage } from "../helpers/formatErrorMessage"
import type { LoginStatus, LoginSubmitResult } from "../stores/useLoginStore"
import type { LoginField, LoginFieldErrors, LoginRequest } from "../types/login"
import { ErrorSummary } from "./errorSummary"
import type { FieldError } from "./errorSummary"
import { TextField } from "./textField"

interface LoginFormProps {
  status: LoginStatus
  errors: LoginFieldErrors
  onSubmit: (request: LoginRequest) => Promise<LoginSubmitResult | undefined>
  onRetry: () => Promise<LoginSubmitResult | undefined>
}

// Contract order, which is also the order of the fields on the page.
const fieldIds: Record<LoginField, string> = {
  email: "login-email",
  password: "login-password",
}

const incorrectMessageId = "login-incorrect"

function toFieldErrors(errors: LoginFieldErrors): FieldError[] {
  return (Object.keys(fieldIds) as LoginField[]).flatMap((field) => {
    const message = errors[field]
    return message ? [{ fieldId: fieldIds[field], message }] : []
  })
}

export function LoginForm({
  status,
  errors,
  onSubmit,
  onRetry,
}: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const pending = status === "pending"
  const incorrect = status === "incorrect"

  // After a failure, focus the first invalid field, or the email field for incorrect details
  // (FR-007). errors is a new object after every failed submission, so focus moves each time.
  useEffect(() => {
    if (status === "invalid") {
      const [first] = toFieldErrors(errors)
      if (first) {
        document.getElementById(first.fieldId)?.focus()
      }
    } else if (status === "incorrect") {
      document.getElementById(fieldIds.email)?.focus()
    }
  }, [status, errors])

  function clearPasswordAfterFailure(result: LoginSubmitResult | undefined) {
    // A server error keeps both values for Retry (FR-014); a failed login never keeps the password.
    if (result?.status === "invalid" || result?.status === "incorrect") {
      setPassword("")
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Sent exactly as typed: the server trims the email, and the password is never trimmed (FR-003).
    clearPasswordAfterFailure(await onSubmit({ email, password }))
  }

  async function retry() {
    clearPasswordAfterFailure(await onRetry())
  }

  return (
    // noValidate: the browser's own bubbles must never replace the FR-008 messages.
    <form noValidate onSubmit={(event) => void submit(event)}>
      {/* Shown once for both fields, so it never says which of them was wrong (FR-004). */}
      {incorrect && (
        <p id={incorrectMessageId} role="alert" className="form-error">
          {formatErrorMessage("Incorrect email or password.")}
        </p>
      )}
      <ErrorSummary errors={toFieldErrors(errors)} />
      <TextField
        id={fieldIds.email}
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        error={errors.email}
        describedById={incorrect ? incorrectMessageId : undefined}
        onChange={setEmail}
      />
      <TextField
        id={fieldIds.password}
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        error={errors.password}
        describedById={incorrect ? incorrectMessageId : undefined}
        onChange={setPassword}
      />
      <button type="submit" disabled={pending}>
        Log in
      </button>
      {/* Always rendered, so screen readers announce the text when it appears. */}
      <p role="status" className="loading-status">
        {pending ? "Logging you in…" : ""}
      </p>
      {/* A server error keeps both values, so Retry sends the same details (FR-014). */}
      {status === "serverError" && (
        <div className="server-error">
          <p role="alert">
            {formatErrorMessage("Something went wrong. Try again.")}
          </p>
          <button type="button" onClick={() => void retry()}>
            Retry
          </button>
        </div>
      )}
    </form>
  )
}
