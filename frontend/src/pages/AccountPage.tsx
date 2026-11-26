import { DeleteAccountSection } from "../components/deleteAccountSection"
import { usePageTitle } from "../hooks/usePageTitle"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"

// The signed-in Registered User's own account: the email and Delete account (feature 016 spec FR-001, FR-013). The
// route lets only an Active Registered User reach it. A later Profile feature may add details and preferences here.
export function AccountPage() {
  usePageTitle("Account")
  const email = useCurrentUserStore((state) => state.user?.email ?? "")

  return (
    <>
      <h1>Account</h1>
      <p className="account-email">
        Email: <span>{email}</span>
      </p>
      <DeleteAccountSection email={email} />
    </>
  )
}
