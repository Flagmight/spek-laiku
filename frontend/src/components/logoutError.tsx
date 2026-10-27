import { useNavigate } from "react-router-dom"
import { formatErrorMessage } from "../helpers/formatErrorMessage"
import { useLogoutStore } from "../stores/useLogoutStore"
import type { NavigationState } from "../types/navigationState"

// Shown under the navigation when logging out failed; the user is still signed in (FR-014).
export function LogoutError() {
  const navigate = useNavigate()
  const status = useLogoutStore((state) => state.status)
  const retry = useLogoutStore((state) => state.retry)

  async function retryLogout() {
    if (await retry()) {
      const state: NavigationState = { successMessage: "You have logged out." }
      navigate("/", { state })
    }
  }

  if (status !== "serverError") {
    return null
  }

  return (
    <div role="alert" className="server-error">
      <p>{formatErrorMessage("Something went wrong. Try again.")}</p>
      <button type="button" onClick={() => void retryLogout()}>
        Retry
      </button>
    </div>
  )
}
