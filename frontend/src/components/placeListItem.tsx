import { openStreetMapLink } from "../helpers/openStreetMapLink"
import { placeDistanceText } from "../helpers/placeText"
import type { NearbyPlace } from "../types/planPlaces"

interface PlaceListItemProps {
  place: NearbyPlace
}

// One nearby place (spec FR-018): its name, its distance and town or area, and a link that opens it on
// OpenStreetMap in a new tab.
export function PlaceListItem({ place }: PlaceListItemProps) {
  const details = [placeDistanceText(place.distanceKm), place.area]
    .filter(Boolean)
    .join(" · ")

  return (
    <li>
      <span className="place-name">{place.name}</span>
      <span className="place-details">{details}</span>
      <a
        href={openStreetMapLink(place.latitude, place.longitude)}
        target="_blank"
        rel="noopener noreferrer"
      >
        View on map
      </a>
    </li>
  )
}
