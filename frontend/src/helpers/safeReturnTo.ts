// Pages a user is never sent back to after logging in.
const excludedPaths = ["/login", "/register", "/account-suspended"]

// Returns the page to go back to after login only when it is a path inside this application,
// so a crafted link cannot send the user to another site (research section 8).
export function safeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith("/")) {
    return null
  }

  // "//host" and "/\host" are read by browsers as addresses on another site.
  if (value[1] === "/" || value[1] === "\\") {
    return null
  }

  const path = value.split(/[?#]/, 1)[0]
  return excludedPaths.includes(path) ? null : value
}
