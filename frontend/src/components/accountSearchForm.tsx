import { useId, useState } from "react"
import type { FormEvent } from "react"
import { useAdminAccountsStore } from "../stores/useAdminAccountsStore"

// The email search of the User accounts page (feature 014 spec FR-002, FR-014). Search, or Enter in the field, sends
// the text; the server decides what is valid and its refusal is shown next to the field. Clear search is offered
// whenever a search result is shown, including one with no match, and lists every account again.
export function AccountSearchForm() {
  const shownSearch = useAdminAccountsStore((state) => state.search)
  const searchError = useAdminAccountsStore((state) => state.searchError)
  const [text, setText] = useState(shownSearch)
  const fieldId = useId()
  const errorId = useId()

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void useAdminAccountsStore.getState().load(text)
  }

  function clear() {
    setText("")
    void useAdminAccountsStore.getState().load("")
  }

  return (
    <form className="account-search" role="search" onSubmit={search}>
      <div className="form-field">
        <label htmlFor={fieldId}>Search by email</label>
        <input
          id={fieldId}
          type="search"
          value={text}
          aria-invalid={searchError ? true : undefined}
          aria-describedby={searchError ? errorId : undefined}
          onChange={(event) => setText(event.target.value)}
        />
        {searchError && (
          <p id={errorId} className="field-error">
            {searchError}
          </p>
        )}
      </div>
      <p className="account-search-actions">
        <button type="submit">Search</button>
        {shownSearch && (
          <>
            {" "}
            <button type="button" onClick={clear}>
              Clear search
            </button>
          </>
        )}
      </p>
    </form>
  )
}
