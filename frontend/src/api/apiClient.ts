export class ApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`The API returned status ${status}.`)
    this.name = "ApiError"
    this.status = status
  }
}

// All API calls use relative /api URLs: the Vite dev server proxies them in
// development, and production serves the frontend and API from one origin.
export function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json")
  }

  return fetch(path, { ...init, credentials: "same-origin", headers })
}
