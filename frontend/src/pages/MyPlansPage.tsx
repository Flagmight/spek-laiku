import { useEffect } from "react"
import { Link } from "react-router-dom"
import { SavedPlanList } from "../components/savedPlanList"
import { usePageTitle } from "../hooks/usePageTitle"
import { useSavedPlansStore } from "../stores/useSavedPlansStore"

// The signed-in user's saved plans, newest saved first (feature 010 spec User Story 3, FR-009). Read-only in
// this feature: Duplicate and Delete come with feature 011.
export function MyPlansPage() {
  usePageTitle("My plans")
  const status = useSavedPlansStore((state) => state.status)
  const plans = useSavedPlansStore((state) => state.plans)

  useEffect(() => {
    const store = useSavedPlansStore.getState()
    void store.load()
    return () => store.reset()
  }, [])

  return (
    <>
      <h1>My plans</h1>
      <MyPlansBody status={status} plans={plans} />
    </>
  )
}

function MyPlansBody({
  status,
  plans,
}: Pick<ReturnType<typeof useSavedPlansStore.getState>, "status" | "plans">) {
  if (status === "loading") {
    return (
      <div role="status">
        <p>Loading your plans…</p>
        <ul className="placeholder-rows" aria-hidden="true">
          <li />
          <li />
          <li />
        </ul>
      </div>
    )
  }

  if (status === "serverError") {
    return (
      <p role="alert">
        Error: Saved plans could not be loaded.{" "}
        <button
          type="button"
          onClick={() => void useSavedPlansStore.getState().retry()}
        >
          Retry
        </button>
      </p>
    )
  }

  if (plans.length === 0) {
    return (
      <>
        <p>No saved plans yet.</p>
        <p>
          <Link to="/plan/setup" className="button-link">
            New plan
          </Link>
        </p>
      </>
    )
  }

  return <SavedPlanList plans={plans} caption="Your saved plans" />
}
