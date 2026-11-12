// A place's distance as step 3 shows it: "3.4 km away", always with one decimal place. The server has
// already rounded the value; this only words it (spec FR-018).
export function placeDistanceText(distanceKm: number): string {
  return `${distanceKm.toFixed(1)} km away`
}
