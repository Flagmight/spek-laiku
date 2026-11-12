import type { NearbyPlace } from "../types/planPlaces"
import { PlaceListItem } from "./placeListItem"

interface ActivityPlacesProps {
  // The places of the activity's category, nearest first; undefined while there are none to show.
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
// things the user can do, and it is never removed without the user's action (project FR-036).
export function ActivityPlaces({
  places,
  radiusKm,
  activityName,
  onRemove,
  onChange,
}: ActivityPlacesProps) {
  if (!places) {
    return null
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
