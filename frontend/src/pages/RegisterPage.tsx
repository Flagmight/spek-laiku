import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { RegistrationForm } from "../components/registrationForm"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { usePageTitle } from "../hooks/usePageTitle"
import { useRegistration } from "../hooks/useRegistration"
import type { NavigationState } from "../types/navigationState"

export function RegisterPage() {
  usePageTitle("Register")
  const navigate = useNavigate()
  const { refresh } = useCurrentUser()
  const { status, errors, submit, retry } = useRegistration()

  useEffect(() => {
    if (status === "success") {
      // The new user is signed in, so the navigation must stop offering "Register" (US1 scenario 2).
      void refresh()
      const state: NavigationState = { successMessage: "Account created." }
      navigate("/", { state })
    }
  }, [status, refresh, navigate])

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
