import { Link } from "react-router-dom"
import { usePageTitle } from "../hooks/usePageTitle"

// Shown at the refused address to a signed-in Active user without the needed role (FR-019).
// Later features use it for their own refused pages; feature 010 adds a My plans link.
export function AccessDeniedPage() {
  usePageTitle("Access denied")

  return (
    <>
      <h1>Access denied</h1>
      <p>You do not have permission to open this page.</p>
      <p>
        <Link to="/">Go to the home page</Link>
      </p>
    </>
  )
}
