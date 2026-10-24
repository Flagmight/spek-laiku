import { NavLink } from "react-router-dom"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"

// A visitor sees Home and Register; a signed-in user sees Home only (US1 scenario 2).
// There is no Log in link until the Login feature (002) adds the page.
export function TopNavigation() {
  const status = useCurrentUserStore((state) => state.status)
  // Hidden while loading, so a signed-in user never sees "Register" flash up.
  const showRegister = status === "signedOut" || status === "error"

  return (
    <ul>
      <li>
        <NavLink to="/" end>
          Home
        </NavLink>
      </li>
      {showRegister && (
        <li>
          <NavLink to="/register">Register</NavLink>
        </li>
      )}
    </ul>
  )
}
