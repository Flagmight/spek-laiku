import { useEffect } from "react"
import { Link } from "react-router-dom"
import { useSavedPlansStore } from "../stores/useSavedPlansStore"
import { SavedPlanList } from "./savedPlanList"

// How many saved plans Home shows; My plans shows them all (feature 010 spec FR-011).
export const homePlanCount = 5

// "Your saved plans" on Home for an Active Registered User (feature 010 spec User Story 6, FR-011): the most
// recently saved plans and a link to all of them. Its loading, empty and error states stay inside the block,
// so the rest of Home always works. The order comes from the server (research section 11).
export function SavedPlansBlock() {
  const status = useSavedPlansStore((state) => state.status)
  const plans = useSavedPlansStore((state) => state.plans)

  useEffect(() => {
    const store = useSavedPlansStore.getState()
    void store.load()
    return () => store.reset()
  }, [])

  return (
    <section aria-labelledby="saved-plans-heading">
      <h2 id="saved-plans-heading">Your saved plans</h2>
      <SavedPlansBlockBody status={status} plans={plans} />
    </section>
  )
}

function SavedPlansBlockBody({
  status,
  plans,
}: Pick<ReturnType<typeof useSavedPlansStore.getState>, "status" | "plans">) {
  if (status === "loading") {
    return <p role="status">Loading your saved plans…</p>
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
            Create your first plan
          </Link>
        </p>
      </>
    )
  }

  return (
    <>
      <SavedPlanList
        plans={plans.slice(0, homePlanCount)}
        caption="Your most recently saved plans"
      />
      <p>
        <Link to="/plans">All my plans</Link>
      </p>
    </>
  )
}
