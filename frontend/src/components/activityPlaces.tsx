import type { StepPartState } from "../helpers/stepPartState"
import type { NearbyPlace } from "../types/planPlaces"
import { PlaceListItem } from "./placeListItem"

interface ActivityPlacesProps {
  // Whether the places arrived, are being asked for again, or could not be loaded.
  state: StepPartState
  // The places of the activity's category, nearest first, when they arrived.
  places: NearbyPlace[] | undefined
  // The search radius, for the no-place flag.
  radiusKm: number
  // The shown name, for example "Cycling 2", which names the flag's buttons for screen readers.
  activityName: string
  onRemove: () => void
  onChange: () => void
}

// The "Places" part of an activity on step 3 (spec FR-017 to FR-019). The server already chose and ordered
// the places; this only lists them. Without any place the activity is flagged with the reason and the two
// things the user can do, and it is never removed without the user's action (project FR-036). Without
// places (a failure or a Retry) nothing is flagged: there is no answer to flag it with (spec FR-009).
export function ActivityPlaces({
  state,
  places,
  radiusKm,
  activityName,
  onRemove,
  onChange,
}: ActivityPlacesProps) {
  if (state !== "loaded" || !places) {
    return (
      <>
        <h3>Places</h3>
        <p>
          {state === "retrying" ? "Getting nearby places…" : "Not available"}
        </p>
      </>
    )
  }

  return (
    <>
      <h3>Places</h3>
      {places.length === 0 ? (
        <div className="no-place">
          <p>✗ No place found within {radiusKm} km.</p>
          <button
            type="button"
            aria-label={`Remove, ${activityName}`}
            onClick={onRemove}
          >
            Remove
          </button>
          <button
            type="button"
            aria-label={`Change activity, ${activityName}`}
            onClick={onChange}
          >
            Change activity
          </button>
        </div>
      ) : (
        <ul className="places-list">
          {places.map((place) => (
            <PlaceListItem
              key={`${place.name}-${place.latitude}-${place.longitude}`}
              place={place}
            />
          ))}
        </ul>
      )}
    </>
  )
}
