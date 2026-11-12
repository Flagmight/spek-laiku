import type { NearbyPlace } from "../types/planPlaces"
import { PlaceListItem } from "./placeListItem"

interface ActivityPlacesProps {
  // The places of the activity's category, nearest first; undefined while there are none to show.
  places: NearbyPlace[] | undefined
}

// The "Places" part of an activity on step 3 (spec FR-017, FR-018). The server already chose and ordered
// the places; this only lists them.
export function ActivityPlaces({ places }: ActivityPlacesProps) {
  if (!places) {
    return null
  }

  return (
    <>
      <h3>Places</h3>
      <ul className="places-list">
        {places.map((place) => (
          <PlaceListItem
            key={`${place.name}-${place.latitude}-${place.longitude}`}
            place={place}
          />
        ))}
      </ul>
    </>
  )
}
