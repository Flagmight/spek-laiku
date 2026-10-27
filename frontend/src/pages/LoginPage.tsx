import { useEffect } from "react"
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom"
import { LoginForm } from "../components/loginForm"
import { loginDestination } from "../helpers/loginDestination"
import { usePageTitle } from "../hooks/usePageTitle"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { useLoginStore } from "../stores/useLoginStore"
import type { NavigationState } from "../types/navigationState"

const loginReasonMessages = {
  required: "Log in to continue.",
  expired: "Your session has expired. Log in again.",
}

export function LoginPage() {
  usePageTitle("Log in")
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get("returnTo")
  const loginReason = (useLocation().state as NavigationState | null)
    ?.loginReason
  const status = useLoginStore((state) => state.status)
  const errors = useLoginStore((state) => state.errors)
  const submit = useLoginStore((state) => state.submit)
  const retry = useLoginStore((state) => state.retry)
  const reset = useLoginStore((state) => state.reset)

  // The store outlives the page, so leaving it aborts a pending request and the next visit starts idle.
  useEffect(() => reset, [reset])

  useEffect(() => {
    // The store has already set the signed-in user. Replace, so Back does not reopen the Log in page.
    const user = useCurrentUserStore.getState().user
    if (status === "success" && user) {
      navigate(loginDestination(user, returnTo), { replace: true })
    }
  }, [status, navigate, returnTo])

  return (
    <>
      <h1>Log in</h1>
      {loginReason && <p role="status">{loginReasonMessages[loginReason]}</p>}
      <LoginForm
        status={status}
        errors={errors}
        onSubmit={submit}
        onRetry={retry}
      />
      <p>
        <Link to="/register">Create an account</Link>
      </p>
    </>
  )
}
