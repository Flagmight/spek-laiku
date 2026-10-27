import { useNavigate } from "react-router-dom"
import { useLogoutStore } from "../stores/useLogoutStore"
import type { NavigationState } from "../types/navigationState"

// Logs out and opens the home page with the success banner (FR-017).
// A failure is shown by logoutError under the navigation.
export function LogoutButton() {
  const navigate = useNavigate()
  const pending = useLogoutStore((state) => state.status === "pending")
  const submit = useLogoutStore((state) => state.submit)

  async function logOut() {
    if (await submit()) {
      const state: NavigationState = { successMessage: "You have logged out." }
      navigate("/", { state })
    }
  }

  return (
    <button type="button" disabled={pending} onClick={() => void logOut()}>
      Log out
    </button>
  )
}
