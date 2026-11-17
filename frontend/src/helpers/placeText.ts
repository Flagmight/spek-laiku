// A distance as the app shows it: "3.4 km", always with one decimal place. The server has already
// rounded the value; this only words it. Used for place distances and trips alike, so both read the
// same (feature 007 spec FR-018, feature 009 spec FR-007).
export function kmText(distanceKm: number): string {
  return `${distanceKm.toFixed(1)} km`
}

// A place's distance as step 3 shows it: "3.4 km away".
export function placeDistanceText(distanceKm: number): string {
  return `${kmText(distanceKm)} away`
}
