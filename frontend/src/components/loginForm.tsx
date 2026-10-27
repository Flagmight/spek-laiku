import { useState } from "react"
import type { FormEvent } from "react"
import { formatErrorMessage } from "../helpers/formatErrorMessage"
import type { LoginStatus, LoginSubmitResult } from "../stores/useLoginStore"
import type { LoginRequest } from "../types/login"
import { TextField } from "./textField"

interface LoginFormProps {
  status: LoginStatus
  onSubmit: (request: LoginRequest) => Promise<LoginSubmitResult | undefined>
  onRetry: () => Promise<LoginSubmitResult | undefined>
}

export function LoginForm({ status, onSubmit, onRetry }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const pending = status === "pending"

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Sent exactly as typed: the server trims the email, and the password is never trimmed (FR-003).
    void onSubmit({ email, password })
  }

  return (
    // noValidate: the browser's own bubbles must never replace the FR-008 messages.
    <form noValidate onSubmit={submit}>
      <TextField
        id="login-email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
      />
      <TextField
        id="login-password"
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
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
          <button type="button" onClick={() => void onRetry()}>
            Retry
          </button>
        </div>
      )}
    </form>
  )
}
