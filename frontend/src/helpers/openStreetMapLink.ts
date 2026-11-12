// The OpenStreetMap page for a place, with a marker at its position (spec FR-018). Opening this page is
// the user visiting a public map, not a call to the map data service from the browser (spec Assumptions).
export function openStreetMapLink(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`
}
