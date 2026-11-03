import { useLocation } from "react-router-dom"

// The current address, hidden and without a role, so it changes no accessibility check.
export function CurrentLocation() {
  const { pathname, search } = useLocation()
  return (
    <div data-testid="location" hidden>
      {pathname + search}
    </div>
  )
}
