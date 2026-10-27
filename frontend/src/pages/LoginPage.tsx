import { useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { LoginForm } from "../components/loginForm"
import { usePageTitle } from "../hooks/usePageTitle"
import { useLoginStore } from "../stores/useLoginStore"

export function LoginPage() {
  usePageTitle("Log in")
  const navigate = useNavigate()
  const status = useLoginStore((state) => state.status)
  const errors = useLoginStore((state) => state.errors)
  const submit = useLoginStore((state) => state.submit)
  const retry = useLoginStore((state) => state.retry)
  const reset = useLoginStore((state) => state.reset)

  // The store outlives the page, so leaving it aborts a pending request and the next visit starts idle.
  useEffect(() => reset, [reset])

  useEffect(() => {
    if (status === "success") {
      // The store has already set the signed-in user. Replace, so Back does not reopen the Log in page.
      navigate("/", { replace: true })
    }
  }, [status, navigate])

  return (
    <>
      <h1>Log in</h1>
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
