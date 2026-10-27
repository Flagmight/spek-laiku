// Router state passed with navigate(); the layout shows successMessage in the banner.
export interface NavigationState {
  successMessage?: string
  // Why the user was sent to log in; the Log in page shows the matching message (FR-020).
  loginReason?: "required" | "expired"
}
