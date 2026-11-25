import { useEffect, useRef } from "react"
import { formatRegistrationDate } from "../helpers/formatSavedAt"
import { useAccountStatusStore } from "../stores/useAccountStatusStore"
import type { AdminAccount } from "../types/adminAccount"
import { AccountStatusButton } from "./accountStatusButton"

// The accounts as one table (feature 014 spec FR-001, FR-003, FR-020). On wide screens it is a table; on phones each
// row is a card titled with the email, each value labelled and the button below, with the status as a word. It reuses
// the saved plans table rules (styles.css). After a successful change, focus moves to that account's new button
// (spec FR-006), also when Retry made the change.
export function AccountList({ accounts }: { accounts: AdminAccount[] }) {
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const focusRequest = useAccountStatusStore((state) => state.focusRequest)

  // Used once and then cleared, so a list shown again after a search or a reload does not take focus.
  useEffect(() => {
    const button = focusRequest?.accountId
      ? buttons.current.get(focusRequest.accountId)
      : undefined
    if (button) {
      button.focus()
      useAccountStatusStore.getState().focusHandled()
    }
  }, [focusRequest])

  function buttonRef(accountId: string) {
    return (button: HTMLButtonElement | null) => {
      if (button) {
        buttons.current.set(accountId, button)
      } else {
        buttons.current.delete(accountId)
      }
    }
  }

  return (
    <table className="saved-plans accounts">
      <caption className="visually-hidden">User accounts</caption>
      <thead>
        <tr>
          <th scope="col">Email</th>
          <th scope="col">Role</th>
          <th scope="col">Status</th>
          <th scope="col">Registered</th>
          <th scope="col">
            <span className="visually-hidden">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {accounts.map((account) => (
          <tr key={account.id}>
            <th scope="row">{account.email}</th>
            <td>
              <span className="cell-label">Role: </span>
              {account.role}
            </td>
            <td>
              <span className="cell-label">Status: </span>
              {account.accountStatus}
            </td>
            <td>
              <span className="cell-label">Registered: </span>
              {formatRegistrationDate(account.registrationDate)}
            </td>
            <td>
              <AccountStatusButton
                account={account}
                buttonRef={buttonRef(account.id)}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
