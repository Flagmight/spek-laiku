import { useLocation, useNavigate } from "react-router-dom"
import type { NavigationState } from "../types/navigationState"

// Shows the success message passed as router state until the user dismisses it.
export function SuccessBanner() {
  const location = useLocation()
  const navigate = useNavigate()
  const message = (location.state as NavigationState | null)?.successMessage

  if (!message) {
    return null
  }

  function dismiss() {
    // Clearing the state also keeps the banner from coming back after a reload.
    navigate(location.pathname, { replace: true, state: null })
  }

  return (
    <div className="success-banner">
      <p>✓ Success: {message}</p>
      <button type="button" onClick={dismiss}>
        Dismiss
      </button>
    </div>
  )
}
