import { useEffect } from "react"
import { AccountList } from "../components/accountList"
import { usePageTitle } from "../hooks/usePageTitle"
import {
  statusMessage,
  useAccountStatusStore,
} from "../stores/useAccountStatusStore"
import {
  accountsLoadFailedMessage,
  loadingAccountsMessage,
  useAdminAccountsStore,
} from "../stores/useAdminAccountsStore"

// The User accounts page for Active Administrators (feature 014 spec User Stories 1 to 5). The status region is always
// rendered, so screen readers announce the pending and success texts without focus moving; errors go to an alert
// region, with Retry when repeating the request can help.
export function UserAccountsPage() {
  usePageTitle("User accounts")
  const status = useAdminAccountsStore((state) => state.status)
  const accounts = useAdminAccountsStore((state) => state.accounts)
  const changeStatus = useAccountStatusStore(statusMessage)
  const changeError = useAccountStatusStore((state) => state.error)
  const canRetryChange = useAccountStatusStore((state) => state.failed !== null)

  // The stores outlive the page, so leaving it aborts pending requests and the next visit starts fresh.
  useEffect(() => {
    void useAdminAccountsStore.getState().load("")
    return () => {
      useAdminAccountsStore.getState().reset()
      useAccountStatusStore.getState().reset()
    }
  }, [])

  function retryLoad() {
    const { load, requestedSearch } = useAdminAccountsStore.getState()
    void load(requestedSearch)
  }

  return (
    <>
      <h1>User accounts</h1>
      <p role="status">
        {status === "loading" ? loadingAccountsMessage : changeStatus}
      </p>
      {changeError && (
        <p role="alert">
          {changeError}
          {canRetryChange && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => void useAccountStatusStore.getState().retry()}
              >
                Retry
              </button>
            </>
          )}
        </p>
      )}
      {status === "error" && (
        <div role="alert" className="server-error">
          <p>{accountsLoadFailedMessage}</p>
          <button type="button" onClick={retryLoad}>
            Retry
          </button>
        </div>
      )}
      {status === "loaded" && <AccountList accounts={accounts} />}
    </>
  )
}
