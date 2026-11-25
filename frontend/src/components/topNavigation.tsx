import { NavLink } from "react-router-dom"
import { canCreatePlan } from "../helpers/canCreatePlan"
import { canViewSavedPlans } from "../helpers/canViewSavedPlans"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { LogoutButton } from "./logoutButton"

// A visitor sees Home, Log in and Register; a signed-in user, of any role or status, sees Home
// and Log out (FR-016, FR-021). An Active Administrator also sees Categories between them
// (feature 003, FR-017), then Users (feature 014, spec FR-016); a Suspended Administrator sees neither. A visitor and an Active Registered
// User also see Create plan after Home (feature 004, spec FR-001, FR-002). An Active Registered User
// also sees My plans after Create plan (feature 010, spec FR-014).
export function TopNavigation() {
  const status = useCurrentUserStore((state) => state.status)
  const user = useCurrentUserStore((state) => state.user)
  // Hidden while loading, so a signed-in user never sees "Log in" or "Register" flash up.
  const showVisitorLinks = status === "signedOut" || status === "error"
  const showAdministratorLinks =
    status === "signedIn" &&
    user?.role === "Administrator" &&
    user.accountStatus === "Active"

  return (
    <ul>
      <li>
        <NavLink to="/" end>
          Home
        </NavLink>
      </li>
      {canCreatePlan(status, user) && (
        <li>
          <NavLink to="/plan/setup">Create plan</NavLink>
        </li>
      )}
      {canViewSavedPlans(status, user) && (
        <li>
          <NavLink to="/plans">My plans</NavLink>
        </li>
      )}
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
      {showAdministratorLinks && (
        <>
          <li>
            <NavLink to="/admin/categories">Categories</NavLink>
          </li>
          <li>
            <NavLink to="/admin/users">Users</NavLink>
          </li>
        </>
      )}
      {status === "signedIn" && (
        <li>
          <LogoutButton />
        </li>
      )}
    </ul>
  )
}
