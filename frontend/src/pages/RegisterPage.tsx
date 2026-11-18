import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { RegistrationForm } from "../components/registrationForm"
import { safeReturnTo } from "../helpers/safeReturnTo"
import { usePageTitle } from "../hooks/usePageTitle"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { useRegistrationStore } from "../stores/useRegistrationStore"
import type { NavigationState } from "../types/navigationState"

export function RegisterPage() {
  usePageTitle("Register")
  const navigate = useNavigate()
  // Set when the Log in page sent the user here, for example from "Save plan" (feature 010 spec FR-008).
  const returnTo = safeReturnTo(useSearchParams()[0].get("returnTo"))
  const refresh = useCurrentUserStore((state) => state.refresh)
  const status = useRegistrationStore((state) => state.status)
  const errors = useRegistrationStore((state) => state.errors)
  const submit = useRegistrationStore((state) => state.submit)
  const retry = useRegistrationStore((state) => state.retry)
  const reset = useRegistrationStore((state) => state.reset)

  // The store outlives the page, so leaving it aborts a pending request and the next visit starts idle.
  useEffect(() => reset, [reset])

  // The signed-in state is read again before leaving, so the next page already knows the user is signed in:
  // the navigation stops offering "Register" (US1 scenario 2), and a schedule kept for saving shows its Save
  // plan form instead of the Visitor's button (feature 010 spec FR-008).
  useEffect(() => {
    if (status === "success") {
      const state: NavigationState = { successMessage: "Account created." }
      void refresh().then(() => navigate(returnTo ?? "/", { state }))
    } else if (status === "alreadySignedIn") {
      // Signed in elsewhere since the page opened: no banner, no error (FR-014).
      void refresh().then(() => navigate(returnTo ?? "/"))
    }
  }, [status, refresh, navigate, returnTo])

  return (
    <>
      <h1>Register</h1>
      <RegistrationForm
        status={status}
        errors={errors}
        onSubmit={submit}
        onRetry={retry}
      />
    </>
  )
}
