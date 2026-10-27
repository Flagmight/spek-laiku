import { usePageTitle } from "../hooks/usePageTitle"

export function AccountSuspendedPage() {
  usePageTitle("Account suspended")

  return (
    <>
      <h1>Account suspended</h1>
      <p>
        Your account is suspended. Features that need an active account are
        blocked until an administrator reactivates it.
      </p>
    </>
  )
}
