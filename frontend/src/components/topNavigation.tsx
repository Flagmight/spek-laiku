import { NavLink } from "react-router-dom"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"

// A visitor sees Home, Log in and Register; a signed-in user sees Home only (FR-016).
export function TopNavigation() {
  const status = useCurrentUserStore((state) => state.status)
  // Hidden while loading, so a signed-in user never sees "Log in" or "Register" flash up.
  const showVisitorLinks = status === "signedOut" || status === "error"

  return (
    <ul>
      <li>
        <NavLink to="/" end>
          Home
        </NavLink>
      </li>
      {showVisitorLinks && (
        <>
          <li>
            <NavLink to="/login">Log in</NavLink>
          </li>
          <li>
            <NavLink to="/register">Register</NavLink>
          </li>
        </>
      )}
    </ul>
  )
}
